import {
  TenantHeaderInvalidException,
  TenantHeaderMissingException,
} from '../errors/tenant-request.exception.js';
import { OMNIXYS_LOGGER } from '../logger.token.js';
import type { PlatformContextLogger } from '../logger.token.js';
import type { ContextModuleOptions } from '../module/context-options.js';
import {
  CONTEXT_CLIENT_IP_RESOLVER,
  CONTEXT_CORRELATION_ID_RESOLVER,
  CONTEXT_OPTIONS,
  CONTEXT_PRINCIPAL_RESOLVER,
  CONTEXT_REQUEST_ID_RESOLVER,
  CONTEXT_TENANT_RESOLVER,
  CONTEXT_TENANT_VERIFIER,
  CONTEXT_TRUSTED_PROXY_POLICY,
} from '../module/context.constants.js';
import { createRequestContextSnapshot } from '../module/request-context.factory.js';
import type {
  CorrelationIdResolver,
  RequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import {
  DefaultCorrelationIdResolver,
  DefaultRequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import type { ClientIpResolver } from '../resolvers/ip.resolver.js';
import { DefaultClientIpResolver } from '../resolvers/ip.resolver.js';
import type { PrincipalResolver } from '../resolvers/principal.resolver.js';
import { DefaultPrincipalResolver } from '../resolvers/principal.resolver.js';
import type { TenantVerifier } from '../resolvers/tenant-verifier.interface.js';
import type { TenantResolver } from '../resolvers/tenant.resolver.js';
import { DefaultTenantResolver } from '../resolvers/tenant.resolver.js';
import type { TrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import { DenyAllTrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import type { ContextSnapshot } from '../types/context-snapshot.type.js';
import type { PrincipalContext } from '../types/principal-context.type.js';
import type { TenantContext } from '../types/tenant-context.type.js';
import { getHeaders } from '../utils/get-headers.util.js';
import { getIp } from '../utils/get-ip.util.js';
import { getRequest } from '../utils/get-request.util.js';
import { ContextAccessor } from './context.store.js';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { PrincipalType } from '@omnixys/contracts-ts';
import { randomUUID } from 'node:crypto';
import { defer, from, Observable, switchMap } from 'rxjs';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  private readonly log;

  constructor(
    @Optional()
    @Inject(CONTEXT_OPTIONS)
    private readonly options?: ContextModuleOptions,
    @Optional()
    @Inject(CONTEXT_REQUEST_ID_RESOLVER)
    private readonly requestIdResolver?: RequestIdResolver,
    @Optional()
    @Inject(CONTEXT_CORRELATION_ID_RESOLVER)
    private readonly correlationIdResolver?: CorrelationIdResolver,
    @Optional()
    @Inject(CONTEXT_CLIENT_IP_RESOLVER)
    private readonly clientIpResolver?: ClientIpResolver,
    @Optional()
    @Inject(CONTEXT_PRINCIPAL_RESOLVER)
    private readonly principalResolver?: PrincipalResolver,
    @Optional()
    @Inject(CONTEXT_TENANT_RESOLVER)
    private readonly tenantResolver?: TenantResolver,
    @Optional()
    @Inject(CONTEXT_TRUSTED_PROXY_POLICY)
    private readonly trustedProxyPolicy?: TrustedProxyPolicy,
    @Optional()
    @Inject(CONTEXT_TENANT_VERIFIER)
    private readonly tenantVerifier?: TenantVerifier,
    @Optional()
    @Inject(OMNIXYS_LOGGER)
    private readonly logger?: PlatformContextLogger,
  ) {
    this.log = this.logger?.log(this.constructor.name, 'package:@omnixys/context-ts');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // A directly-constructed legacy interceptor has no module options. Retain
    // its established extraction behavior for compatibility.
    if (!this.options) return this.interceptLegacy(context, next);

    const request = getRequest(context);
    const requestIdResolver =
      this.requestIdResolver ?? new DefaultRequestIdResolver();
    const correlationIdResolver =
      this.correlationIdResolver ?? new DefaultCorrelationIdResolver();
    const trustedProxyPolicy =
      this.trustedProxyPolicy ??
      this.options.trustedProxyPolicy ??
      new DenyAllTrustedProxyPolicy();
    const clientIpResolver =
      this.clientIpResolver ?? new DefaultClientIpResolver(trustedProxyPolicy);
    const principalResolver =
      this.principalResolver ?? new DefaultPrincipalResolver();
    const tenantResolver =
      this.tenantResolver ?? new DefaultTenantResolver(this.options.tenant);
    const base =
      ContextAccessor.get() ??
      createRequestContextSnapshot(
        request,
        this.options,
        requestIdResolver,
        correlationIdResolver,
        clientIpResolver,
      );

    return runObservableInContext(base, () =>
      defer(() =>
        from(
          this.enrich(
            base,
            request,
            context,
            principalResolver,
            tenantResolver,
            trustedProxyPolicy,
          ),
        ).pipe(
          switchMap((snapshot) =>
            runObservableInContext(snapshot, () => next.handle()),
          ),
        ),
      ),
    );
  }

  private async enrich(
    base: ContextSnapshot,
    request: ReturnType<typeof getRequest>,
    executionContext: ExecutionContext,
    principalResolver: PrincipalResolver,
    tenantResolver: TenantResolver,
    trustedProxyPolicy: TrustedProxyPolicy,
  ): Promise<ContextSnapshot> {
    const headers = request?.headers;
    const principal = await principalResolver.resolve({
      verifiedPrincipal: getVerifiedPrincipal(request),
    });
    const peerAddress = request?.socket?.remoteAddress ?? request?.ip;
    const headerTenantId = firstString(
      headers
        ? headers[this.options?.tenantHeader ?? 'x-tenant-id']
        : undefined,
    );
    // Kubernetes and monitoring probes must only report the process' own
    // health. Requiring a tenant-service round trip here turns a dependent
    // service outage into a liveness restart loop.
    const tenant = isHealthRequest(request)
      ? undefined
      : this.tenantVerifier
        ? await this.verifyTenant(
            principal,
            headerTenantId,
            peerAddress,
            headers,
            tenantResolver,
            trustedProxyPolicy,
          )
        : tenantResolver.resolve({
            principal,
            headerTenantId,
            headerTrusted: trustedProxyPolicy.isTrusted(peerAddress),
            host: firstString(headers?.host),
          });
    const type = executionContext.getType<string>();

    return {
      ...base,
      principal,
      tenant,
      transport: {
        ...base.transport,
        type: type === 'graphql' ? 'graphql' : 'http',
        route:
          request?.routeOptions?.url ?? request?.url ?? base.transport.route,
        operation: executionContext.getHandler?.()?.name,
      },
    };
  }

  /**
   * Authoritative per-request tenant resolution used when a verifier is
   * registered. Protected requests must carry a valid `x-tenant-id`; public
   * requests fall back to the configured resolution sources and only verify
   * that the tenant exists and is active.
   */
  private async verifyTenant(
    principal: PrincipalContext | undefined,
    headerTenantId: string | undefined,
    peerAddress: string | undefined,
    headers: Readonly<Record<string, unknown>> | undefined,
    tenantResolver: TenantResolver,
    trustedProxyPolicy: TrustedProxyPolicy,
  ): Promise<TenantContext | undefined> {
    if (principal) {
      return this.verifyProtectedRequest(principal, headerTenantId);
    }

    const resolved = tenantResolver.resolve({
      principal,
      headerTenantId,
      headerTrusted: trustedProxyPolicy.isTrusted(peerAddress),
      host: firstString(headers?.host),
    });
    if (!resolved) return undefined;

    const tenantId = validUuid(resolved.tenantId);
    if (!tenantId) {
      this.log?.error(
        'Public tenant header rejected, tenant id is not a UUID',
        {
          tenantId: resolved.tenantId,
          reason: 'public_tenant_not_uuid',
        },
      );
      throw new TenantHeaderInvalidException({
        tenantId: resolved.tenantId,
        reason: 'public_tenant_not_uuid',
      });
    }
    await this.tenantVerifier?.verify({ tenantId });

    return { ...resolved, tenantId, verified: true };
  }

  private async verifyProtectedRequest(
    principal: PrincipalContext,
    headerTenantId: string | undefined,
  ): Promise<TenantContext> {
    if (!headerTenantId) {
      this.log?.error('Protected request rejected, tenant header missing', {
        subject: principal.subject,
      });
      throw new TenantHeaderMissingException({
        subject: principal.subject,
      });
    }
    const tenantId = validUuid(headerTenantId);
    if (!tenantId) {
      this.log?.error(
        'Protected request rejected, tenant header is not a UUID',
        {
          tenantId: headerTenantId,
        },
      );
      throw new TenantHeaderInvalidException({ tenantId: headerTenantId });
    }

    if (principal.principalType === PrincipalType.USER) {
      await this.tenantVerifier?.verify({ userId: principal.userId, tenantId });
    } else {
      await this.tenantVerifier?.verify({ tenantId });
    }

    return { tenantId, source: 'trusted-header', verified: true };
  }

  private interceptLegacy(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = getRequest(context);
    const headers = getHeaders(context);
    const user = request?.user;
    const requestIdHeader = headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : randomUUID();
    const userAgentHeader =
      headers['x-client-user-agent'] ??
      headers['x-forwarded-user-agent'] ??
      headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader;
    const legacyUser = user as
      | (typeof user & { raw?: { azp?: string }; tenantId?: string })
      | undefined;
    const headerTenant = firstString(headers['x-tenant-id']);
    const domainTenant = extractLegacyTenantFromHost(firstString(headers.host));
    const tenantId =
      legacyUser?.raw?.azp ??
      headerTenant ??
      domainTenant ??
      legacyUser?.tenantId;

    const legacyContext = {
      actorId: legacyUser?.id,
      tenantId,
      requestId,
      ip: getIp(context),
      userAgent,
    };

    return new Observable<unknown>((subscriber) =>
      ContextAccessor.run(legacyContext, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      }),
    );
  }
}

function getVerifiedPrincipal(request: unknown): PrincipalContext | undefined {
  if (!isRecord(request)) return undefined;
  if (request.contextPrincipal !== undefined) {
    return request.contextPrincipal as PrincipalContext;
  }

  const user = request.user;
  return isRecord(user)
    ? (user.contextPrincipal as PrincipalContext | undefined)
    : undefined;
}

function isHealthRequest(request: ReturnType<typeof getRequest>): boolean {
  const url = request?.url;
  return typeof url === 'string' && url.startsWith('/health');
}

function runObservableInContext<T>(
  snapshot: ContextSnapshot,
  factory: () => Observable<T>,
): Observable<T> {
  return new Observable<T>((subscriber) =>
    ContextAccessor.run(snapshot, () => {
      const subscription = factory().subscribe(subscriber);
      return () => subscription.unsubscribe();
    }),
  );
}

function extractLegacyTenantFromHost(host?: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0];

  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'omnixys';

  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : undefined;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  return value.find((entry): entry is string => typeof entry === 'string');
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string): string | undefined {
  return UUID_V4_PATTERN.test(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

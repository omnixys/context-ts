import type { ContextModuleOptions } from '../module/context-options.js';
import {
  CONTEXT_CLIENT_IP_RESOLVER,
  CONTEXT_CORRELATION_ID_RESOLVER,
  CONTEXT_OPTIONS,
  CONTEXT_PRINCIPAL_RESOLVER,
  CONTEXT_REQUEST_ID_RESOLVER,
  CONTEXT_TENANT_RESOLVER,
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
import type { TenantResolver } from '../resolvers/tenant.resolver.js';
import { DefaultTenantResolver } from '../resolvers/tenant.resolver.js';
import type { TrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import { DenyAllTrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import type { ContextSnapshot } from '../types/context-snapshot.type.js';
import type { PrincipalContext } from '../types/principal-context.type.js';
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
import { randomUUID } from 'node:crypto';
import { defer, from, Observable, switchMap } from 'rxjs';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
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
  ) {}

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
    const headers = request.headers;
    const principal = await principalResolver.resolve({
      verifiedPrincipal: getVerifiedPrincipal(request),
    });
    const peerAddress = request.socket?.remoteAddress ?? request.ip;
    const tenant = tenantResolver.resolve({
      principal,
      headerTenantId: headers[this.options?.tenantHeader ?? 'x-tenant-id'],
      headerTrusted: trustedProxyPolicy.isTrusted(peerAddress),
      host: firstString(headers.host),
    });
    const type = executionContext.getType<string>();

    return {
      ...base,
      principal,
      tenant,
      transport: {
        ...base.transport,
        type: type === 'graphql' ? 'graphql' : 'http',
        route: request.routeOptions?.url ?? request.url ?? base.transport.route,
        operation: executionContext.getHandler?.()?.name,
      },
    };
  }

  private interceptLegacy(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = getRequest(context);
    const headers = getHeaders(context);
    const user = request.user;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

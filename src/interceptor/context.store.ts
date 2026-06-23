import type { ClientMetadata } from '../types/client-metadata.type.js';
import type { ContextSnapshot } from '../types/context-snapshot.type.js';
import type { RequestContext } from '../types/context.types.js';
import type { PrincipalContext } from '../types/principal-context.type.js';
import type { TenantContext } from '../types/tenant-context.type.js';
import type { TraceMetadata } from '../types/trace-metadata.type.js';
import type { TransportMetadata } from '../types/transport-metadata.type.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const CONTEXT_SNAPSHOT = Symbol('CONTEXT_SNAPSHOT');

type StoredRequestContext = RequestContext & {
  readonly [CONTEXT_SNAPSHOT]: ContextSnapshot;
};

export const contextStorage = new AsyncLocalStorage<RequestContext>();

export class ContextUnavailableError extends Error {
  constructor() {
    super('No active Omnixys context scope');
    this.name = ContextUnavailableError.name;
  }
}

export class ContextAccessor {
  static current(): RequestContext | undefined {
    return contextStorage.getStore();
  }

  static get(): ContextSnapshot | undefined {
    const current = contextStorage.getStore();
    if (!current) return undefined;

    return getStoredSnapshot(current) ?? normalizeLegacyContext(current);
  }

  static getOrThrow(): ContextSnapshot {
    const current = ContextAccessor.get();
    if (!current) throw new ContextUnavailableError();
    return current;
  }

  /**
   * Safely resolves whether the caller is running inside an active context
   * scope without triggering legacy-normalisation.
   */
  static isActive(): boolean {
    return contextStorage.getStore() !== undefined;
  }

  /**
   * Additively replaces metadata in the active scope while preserving the
   * legacy `RequestContext` view and the canonical snapshot view.
   */
  static update(patch: Partial<RequestContext>): ContextSnapshot {
    const current = contextStorage.getStore();
    if (!current) throw new ContextUnavailableError();

    const merged = mergeRequestContext(current, patch);
    const snapshot = normalizeLegacyContext(merged);
    contextStorage.enterWith(createCompatibilityContext(merged, snapshot));
    return snapshot;
  }

  static run<T>(ctx: RequestContext, fn: () => T): T;
  static run<T>(ctx: ContextSnapshot, fn: () => T): T;
  static run<T>(ctx: RequestContext | ContextSnapshot, fn: () => T): T {
    const snapshot = isContextSnapshot(ctx) ? ctx : normalizeLegacyContext(ctx);
    const compatibilityContext = createCompatibilityContext(ctx, snapshot);

    return contextStorage.run(compatibilityContext, fn);
  }
}

function getStoredSnapshot(
  context: RequestContext,
): ContextSnapshot | undefined {
  return (context as Partial<StoredRequestContext>)[CONTEXT_SNAPSHOT];
}

function isContextSnapshot(
  context: RequestContext | ContextSnapshot,
): context is ContextSnapshot {
  return (
    typeof context.requestId === 'string' &&
    typeof (context as Partial<ContextSnapshot>).correlationId === 'string' &&
    typeof (context as Partial<ContextSnapshot>).startedAtEpochMs ===
      'number' &&
    !!(context as Partial<ContextSnapshot>).client &&
    !!(context as Partial<ContextSnapshot>).transport
  );
}

function normalizeLegacyContext(context: RequestContext): ContextSnapshot {
  const requestId = context.requestId ?? randomUUID();

  return {
    requestId,
    correlationId: context.correlationId ?? requestId,
    startedAtEpochMs: context.startedAtEpochMs ?? Date.now(),
    principal: context.principal ?? createLegacyPrincipal(context),
    tenant: context.tenant ?? createLegacyTenant(context),
    client: createLegacyClient(context),
    transport: createLegacyTransport(context),
    trace: context.trace ?? createLegacyTrace(context),
  };
}

function createLegacyPrincipal(
  context: RequestContext,
): PrincipalContext | undefined {
  const subject = context.subject ?? context.userId ?? context.actorId;
  if (!subject) return undefined;

  return {
    subject,
    actorId: context.actorId,
    userId: context.userId,
    roles: context.roles ?? [],
    sessionId: context.sessionId,
    authStrength: context.authStrength,
  };
}

function createLegacyTenant(
  context: RequestContext,
): TenantContext | undefined {
  if (!context.tenantId) return undefined;

  return {
    tenantId: context.tenantId,
    source: 'configured-default',
    verified: false,
  };
}

function createLegacyClient(context: RequestContext): ClientMetadata {
  const location =
    context.client?.location ??
    (context.country || context.region || context.city
      ? {
          country: context.country,
          region: context.region,
          city: context.city,
        }
      : undefined);

  return {
    ...context.client,
    ip: context.client?.ip ?? context.ip,
    userAgent: context.client?.userAgent ?? context.userAgent,
    deviceId: context.client?.deviceId ?? context.deviceId,
    locale: context.client?.locale ?? context.locale,
    timezone: context.client?.timezone ?? context.timezone,
    browser:
      context.client?.browser ??
      (context.browser ? { name: context.browser } : undefined),
    os: context.client?.os ?? (context.os ? { name: context.os } : undefined),
    device:
      context.client?.device ??
      (context.deviceType ? { type: context.deviceType } : undefined),
    location,
  };
}

function createLegacyTransport(context: RequestContext): TransportMetadata {
  return (
    context.transport ?? {
      type: context.transportType ?? 'internal',
      route: context.route,
      operation: context.operation,
    }
  );
}

function createLegacyTrace(context: RequestContext): TraceMetadata | undefined {
  if (!context.traceId && !context.spanId) return undefined;

  return {
    traceId: context.traceId,
    spanId: context.spanId,
  };
}

function createCompatibilityContext(
  input: RequestContext | ContextSnapshot,
  snapshot: ContextSnapshot,
): RequestContext {
  const legacyInput = isContextSnapshot(input) ? {} : input;

  const compatibilityContext: RequestContext = {
    ...legacyInput,
    actorId: snapshot.principal?.actorId ?? legacyInput.actorId,
    tenantId: snapshot.tenant?.tenantId ?? legacyInput.tenantId,
    requestId: snapshot.requestId,
    ip: snapshot.client.ip ?? legacyInput.ip,
    userAgent: snapshot.client.userAgent ?? legacyInput.userAgent,
    correlationId: snapshot.correlationId,
    userId: snapshot.principal?.userId ?? legacyInput.userId,
    subject: snapshot.principal?.subject ?? legacyInput.subject,
    roles: snapshot.principal?.roles ?? legacyInput.roles,
    locale: snapshot.client.locale ?? legacyInput.locale,
    timezone: snapshot.client.timezone ?? legacyInput.timezone,
    deviceId: snapshot.client.deviceId ?? legacyInput.deviceId,
    sessionId: snapshot.principal?.sessionId ?? legacyInput.sessionId,
    authStrength: snapshot.principal?.authStrength ?? legacyInput.authStrength,
    country: snapshot.client.location?.country ?? legacyInput.country,
    region: snapshot.client.location?.region ?? legacyInput.region,
    city: snapshot.client.location?.city ?? legacyInput.city,
    browser: snapshot.client.browser?.name ?? legacyInput.browser,
    os: snapshot.client.os?.name ?? legacyInput.os,
    deviceType: snapshot.client.device?.type ?? legacyInput.deviceType,
    traceId: snapshot.trace?.traceId ?? legacyInput.traceId,
    spanId: snapshot.trace?.spanId ?? legacyInput.spanId,
    startedAtEpochMs: snapshot.startedAtEpochMs,
    transportType: snapshot.transport.type,
    route: snapshot.transport.route ?? legacyInput.route,
    operation: snapshot.transport.operation ?? legacyInput.operation,
    principal: snapshot.principal,
    tenant: snapshot.tenant,
    client: snapshot.client,
    transport: snapshot.transport,
    trace: snapshot.trace,
  };

  Object.defineProperty(compatibilityContext, CONTEXT_SNAPSHOT, {
    configurable: false,
    enumerable: false,
    value: snapshot,
    writable: false,
  });

  return compatibilityContext;
}

function mergeRequestContext(
  current: RequestContext,
  patch: Partial<RequestContext>,
): RequestContext {
  const principalFieldsChanged = hasAnyOwnProperty(patch, [
    'actorId',
    'userId',
    'subject',
    'roles',
    'sessionId',
    'authStrength',
  ]);
  const tenantIdChanged = Object.hasOwn(patch, 'tenantId');
  const clientFieldsChanged = hasAnyOwnProperty(patch, [
    'ip',
    'userAgent',
    'locale',
    'timezone',
    'deviceId',
    'country',
    'region',
    'city',
    'browser',
    'os',
    'deviceType',
  ]);
  const traceFieldsChanged = hasAnyOwnProperty(patch, ['traceId', 'spanId']);
  const transportFieldsChanged = hasAnyOwnProperty(patch, [
    'transportType',
    'route',
    'operation',
  ]);

  return {
    ...current,
    ...patch,
    principal:
      patch.principal ??
      (principalFieldsChanged
        ? mergePrincipalContext(current, patch)
        : current.principal),
    tenant:
      patch.tenant ??
      (tenantIdChanged ? mergeTenantContext(current, patch) : current.tenant),
    client:
      patch.client ??
      (clientFieldsChanged
        ? mergeClientMetadata(current, patch)
        : current.client),
    trace:
      patch.trace ??
      (traceFieldsChanged ? mergeTraceMetadata(current, patch) : current.trace),
    transport:
      patch.transport ??
      (transportFieldsChanged
        ? mergeTransportMetadata(current, patch)
        : current.transport),
  };
}

function mergePrincipalContext(
  current: RequestContext,
  patch: Partial<RequestContext>,
): PrincipalContext | undefined {
  const subject =
    patch.subject ??
    current.principal?.subject ??
    current.subject ??
    patch.userId ??
    current.principal?.userId ??
    current.userId ??
    patch.actorId ??
    current.principal?.actorId ??
    current.actorId;
  if (!subject) return undefined;

  return {
    ...current.principal,
    subject,
    actorId: patch.actorId ?? current.principal?.actorId ?? current.actorId,
    userId: patch.userId ?? current.principal?.userId ?? current.userId,
    roles: patch.roles ?? current.principal?.roles ?? current.roles ?? [],
    sessionId:
      patch.sessionId ?? current.principal?.sessionId ?? current.sessionId,
    authStrength:
      patch.authStrength ??
      current.principal?.authStrength ??
      current.authStrength,
  };
}

function mergeTenantContext(
  current: RequestContext,
  patch: Partial<RequestContext>,
): TenantContext | undefined {
  const tenantId = patch.tenantId ?? current.tenantId;
  if (!tenantId) return undefined;
  if (current.tenant?.tenantId === tenantId) return current.tenant;

  return { tenantId, source: 'configured-default', verified: false };
}

function mergeClientMetadata(
  current: RequestContext,
  patch: Partial<RequestContext>,
): ClientMetadata {
  const merged = { ...current, ...patch, client: undefined };
  return createLegacyClient(merged);
}

function mergeTraceMetadata(
  current: RequestContext,
  patch: Partial<RequestContext>,
): TraceMetadata | undefined {
  const traceId = patch.traceId ?? current.trace?.traceId ?? current.traceId;
  const spanId = patch.spanId ?? current.trace?.spanId ?? current.spanId;
  return traceId || spanId ? { traceId, spanId } : undefined;
}

function mergeTransportMetadata(
  current: RequestContext,
  patch: Partial<RequestContext>,
): TransportMetadata {
  return {
    ...current.transport,
    type:
      patch.transportType ??
      current.transport?.type ??
      current.transportType ??
      'internal',
    route: patch.route ?? current.transport?.route ?? current.route,
    operation:
      patch.operation ?? current.transport?.operation ?? current.operation,
  };
}

function hasAnyOwnProperty(
  value: object,
  keys: readonly (keyof RequestContext)[],
): boolean {
  return keys.some((key) => Object.hasOwn(value, key));
}

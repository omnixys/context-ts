import type {
  ClientDeviceType,
  ClientMetadata,
} from './client-metadata.type.js';
import type { PrincipalContext } from './principal-context.type.js';
import type { TenantContext } from './tenant-context.type.js';
import type { TraceMetadata } from './trace-metadata.type.js';
import type {
  ContextTransportType,
  TransportMetadata,
} from './transport-metadata.type.js';

/**
 * Backwards-compatible request context shape.
 *
 * All newly introduced fields remain optional so existing callers can keep
 * constructing the original five-field context without changes.
 */
export interface RequestContext {
  actorId?: string;
  tenantId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;

  correlationId?: string;
  userId?: string;
  subject?: string;
  roles?: readonly string[];
  locale?: string;
  timezone?: string;
  deviceId?: string;
  sessionId?: string;
  authStrength?: string;
  country?: string;
  region?: string;
  city?: string;
  browser?: string;
  os?: string;
  deviceType?: ClientDeviceType;
  traceId?: string;
  spanId?: string;
  startedAtEpochMs?: number;
  transportType?: ContextTransportType;
  route?: string;
  operation?: string;

  principal?: PrincipalContext;
  tenant?: TenantContext;
  client?: ClientMetadata;
  transport?: TransportMetadata;
  trace?: TraceMetadata;
}

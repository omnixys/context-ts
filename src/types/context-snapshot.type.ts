import type { ClientMetadata } from './client-metadata.type.js';
import type { PrincipalContext } from './principal-context.type.js';
import type { TenantContext } from './tenant-context.type.js';
import type { TraceMetadata } from './trace-metadata.type.js';
import type { TransportMetadata } from './transport-metadata.type.js';

/**
 * Fully resolved, immutable metadata for one execution scope.
 *
 * The snapshot intentionally excludes raw transport objects, credentials,
 * OpenTelemetry runtime objects, and business payloads.
 */
export interface ContextSnapshot {
  readonly requestId: string;
  readonly correlationId: string;
  readonly startedAtEpochMs: number;

  readonly tenant?: TenantContext;
  readonly principal?: PrincipalContext;
  readonly client: ClientMetadata;
  readonly transport: TransportMetadata;
  readonly trace?: TraceMetadata;
}

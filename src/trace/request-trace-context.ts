import type { TraceMetadata } from '../types/trace-metadata.type.js';

const REQUEST_TRACE_CONTEXT = Symbol.for(
  '@omnixys/context-ts/request-trace-context',
);

type TraceCarrier = Record<PropertyKey, unknown>;

interface RequestDiagnostics extends TraceMetadata {
  readonly requestId?: string;
  readonly correlationId?: string;
}

/** Stores serializable trace identifiers on a transport request. */
export function setRequestTraceContext(
  request: object,
  trace: TraceMetadata,
): void {
  setRequestDiagnostics(request, {
    ...getRequestDiagnostics(request),
    ...trace,
  });
}

/** Stores request identifiers for consumers that execute after async scope exit. */
export function setRequestContextIdentifiers(
  request: object,
  identifiers: Pick<RequestDiagnostics, 'requestId' | 'correlationId'>,
): void {
  setRequestDiagnostics(request, {
    ...getRequestDiagnostics(request),
    ...identifiers,
  });
}

function setRequestDiagnostics(
  request: object,
  diagnostics: RequestDiagnostics,
): void {
  Object.defineProperty(request, REQUEST_TRACE_CONTEXT, {
    configurable: true,
    enumerable: false,
    value: diagnostics,
    writable: true,
  });
}

/** Reads trace identifiers captured by a transport integration. */
export function getRequestTraceContext(
  request: object | undefined,
): TraceMetadata | undefined {
  const candidate = getRequestDiagnostics(request);
  if (!candidate) return undefined;
  const traceId = nonEmptyString(candidate.traceId);
  const spanId = nonEmptyString(candidate.spanId);
  return traceId || spanId ? { traceId, spanId } : undefined;
}

/** Reads request identifiers captured by the context middleware. */
export function getRequestContextIdentifiers(
  request: object | undefined,
): Pick<RequestDiagnostics, 'requestId' | 'correlationId'> | undefined {
  const candidate = getRequestDiagnostics(request);
  if (!candidate) return undefined;
  const requestId = nonEmptyString(candidate.requestId);
  const correlationId = nonEmptyString(candidate.correlationId);
  return requestId || correlationId ? { requestId, correlationId } : undefined;
}

function getRequestDiagnostics(
  request: object | undefined,
): RequestDiagnostics | undefined {
  if (!request) return undefined;
  const diagnostics = (request as TraceCarrier)[REQUEST_TRACE_CONTEXT];
  return diagnostics && typeof diagnostics === 'object'
    ? (diagnostics as RequestDiagnostics)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

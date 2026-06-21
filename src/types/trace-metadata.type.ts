/**
 * Serializable trace identifiers supplied by an observability integration.
 *
 * This package does not own OpenTelemetry context, span, tracer, meter, SDK,
 * or exporter objects.
 */
export interface TraceMetadata {
  readonly traceId?: string;
  readonly spanId?: string;
}

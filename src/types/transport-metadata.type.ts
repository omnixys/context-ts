/** Transport families supported by the canonical context model. */
export type ContextTransportType =
  | 'http'
  | 'graphql'
  | 'kafka'
  | 'job'
  | 'internal';

/**
 * Transport metadata for the current execution.
 *
 * Raw requests, responses, messages, jobs, and business payloads are excluded
 * deliberately.
 */
export interface TransportMetadata {
  readonly type: ContextTransportType;

  readonly method?: string;
  readonly route?: string;
  readonly operation?: string;
  readonly protocol?: string;
  readonly host?: string;

  readonly topic?: string;
  readonly partition?: number;
  readonly offset?: string;
  readonly consumerGroup?: string;

  readonly jobId?: string;
  readonly jobType?: string;
  readonly attempt?: number;
}

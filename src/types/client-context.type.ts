import type { Locale } from '@omnixys/contracts-ts';

/**
 * Legacy flattened client metadata returned by ClientInfo.
 *
 * @deprecated Prefer ClientMetadata for new integrations.
 */
export interface ClientContext {
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
  readonly device: string;
  readonly browser: string;
  readonly os: string;
  readonly location: string;
  readonly locale: Locale;
}

/** Browser or operating-system metadata derived from a user agent. */
export interface ClientSoftwareMetadata {
  readonly name?: string;
  readonly version?: string;
}

/** Normalized device categories used by the context model. */
export type ClientDeviceType =
  | 'desktop'
  | 'mobile'
  | 'tablet'
  | 'bot'
  | 'service'
  | 'unknown';

/** Device metadata derived from request/client information. */
export interface ClientDeviceMetadata {
  readonly type?: ClientDeviceType;
  readonly vendor?: string;
  readonly model?: string;
}

/** Optional geographic metadata associated with a client IP. */
export interface ClientLocationMetadata {
  readonly country?: string;
  readonly region?: string;
  readonly city?: string;
  readonly source?: 'geoip' | 'explicit';
}

/** Safe client metadata associated with the current execution. */
export interface ClientMetadata {
  readonly ip?: string;
  readonly userAgent?: string;
  readonly deviceId?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly browser?: ClientSoftwareMetadata;
  readonly os?: ClientSoftwareMetadata;
  readonly device?: ClientDeviceMetadata;
  readonly location?: ClientLocationMetadata;
}

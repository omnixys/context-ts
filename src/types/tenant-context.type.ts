/** Describes how a tenant was resolved for the current execution. */
export type TenantContextSource =
  | 'principal'
  | 'trusted-header'
  | 'trusted-host'
  | 'service-context'
  | 'configured-default';

/** Tenant metadata associated with the current execution. */
export interface TenantContext {
  readonly tenantId: string;
  readonly source: TenantContextSource;
  readonly verified: boolean;
}

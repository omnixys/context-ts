/**
 * Validates a resolved tenant against the authoritative tenant source.
 *
 * Implementations are registered by the host application (for example via
 * `SecurityModule.forRoot({ tenantVerification })`). The verifier is invoked
 * after a verified principal is available and the requested tenant id has
 * passed syntactic validation. It throws the canonical exception for every
 * non-success outcome; success is communicated by resolving normally.
 */
export interface TenantVerifier {
  /**
   * @param input.userId Subject of the verified principal. Omitted for
   *        unauthenticated (public) requests, in which case only the tenant
   *        existence/activity is verified.
   * @param input.tenantId Tenant id requested for the current execution.
   */
  verify(input: { userId?: string; tenantId: string }): Promise<void>;
}

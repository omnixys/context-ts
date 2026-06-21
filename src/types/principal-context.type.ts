/**
 * Verified identity metadata associated with the current execution.
 *
 * Authentication and token verification are intentionally performed outside
 * of this package. This type contains only the normalized result supplied by
 * the security layer.
 */
export interface PrincipalContext {
  readonly subject: string;
  readonly actorId?: string;
  readonly userId?: string;
  /** Verified tenant claim supplied by the security layer, when available. */
  readonly tenantId?: string;
  readonly roles: readonly string[];
  readonly sessionId?: string;
  readonly authStrength?: string;
  readonly authenticatedAtEpochMs?: number;
}

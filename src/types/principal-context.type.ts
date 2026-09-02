/**
 * Verified identity metadata associated with the current execution.
 *
 * Authentication and token verification are intentionally performed outside
 * of this package. This type contains only the normalized result supplied by
 * the security layer.
 */
import type { PrincipalType } from '@omnixys/contracts-ts';

export interface PrincipalContext {
  readonly subject: string;
  readonly actorId?: string;
  readonly userId?: string;
  /**
   * Kind of principal resolved from the token.
   *
   * - `USER`: `userId` = internal Omnixys U (required). `subject` = Keycloak sub (K).
   * - `SERVICE`: machine / service account / agent. `subject` = Keycloak service sub
   *   (K_service), `userId` = null, `actorId` = subject (transitional compatibility).
   */
  readonly principalType: PrincipalType;
  /**
   * Planned internal Omnixys service principal id (UUIDv7, S).
   * Present on SERVICE principals once a dedicated Service-Principal domain is
   * introduced; null/absent until then (transitional compatibility: actorId = subject).
   */
  readonly serviceId?: string;
  /** Verified tenant claim supplied by the security layer, when available. */
  readonly tenantId?: string;
  readonly roles: readonly string[];
  readonly sessionId?: string;
  readonly authStrength?: string;
  readonly authenticatedAtEpochMs?: number;
}

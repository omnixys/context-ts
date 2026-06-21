import type { PrincipalContext } from '../types/principal-context.type.js';

export interface PrincipalResolutionInput {
  /** A security-layer result, never an unverified JWT payload. */
  readonly verifiedPrincipal?: unknown;
}

export interface PrincipalResolver {
  resolve(
    input: PrincipalResolutionInput,
  ): PrincipalContext | undefined | Promise<PrincipalContext | undefined>;
}

/**
 * Validates the structural boundary between security and context. It does not
 * authenticate input or decode tokens.
 */
export class DefaultPrincipalResolver implements PrincipalResolver {
  resolve(input: PrincipalResolutionInput): PrincipalContext | undefined {
    return isPrincipalContext(input.verifiedPrincipal)
      ? input.verifiedPrincipal
      : undefined;
  }
}

export class NoopPrincipalResolver implements PrincipalResolver {
  resolve(): undefined {
    return undefined;
  }
}

export function isPrincipalContext(value: unknown): value is PrincipalContext {
  if (!isRecord(value)) return false;
  if (typeof value.subject !== 'string' || value.subject.length === 0)
    return false;
  if (!Array.isArray(value.roles)) return false;
  return value.roles.every((role) => typeof role === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

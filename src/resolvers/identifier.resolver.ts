import { randomUUID } from 'node:crypto';

const DEFAULT_MAX_LENGTH = 128;
const DEFAULT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

export interface IdentifierResolverOptions {
  readonly maxLength?: number;
  readonly pattern?: RegExp;
}

/** Resolves a request identifier without accepting malformed header values. */
export interface RequestIdResolver {
  resolve(candidate?: unknown): string;
}

/** Resolves a correlation identifier, falling back to the request identifier. */
export interface CorrelationIdResolver {
  resolve(candidate: unknown, requestId: string): string;
}

export class DefaultRequestIdResolver implements RequestIdResolver {
  constructor(private readonly options: IdentifierResolverOptions = {}) {}

  resolve(candidate?: unknown): string {
    return resolveIdentifier(candidate, this.options) ?? randomUUID();
  }
}

export class DefaultCorrelationIdResolver implements CorrelationIdResolver {
  constructor(private readonly options: IdentifierResolverOptions = {}) {}

  resolve(candidate: unknown, requestId: string): string {
    return resolveIdentifier(candidate, this.options) ?? requestId;
  }
}

/**
 * Returns a normalized identifier or `undefined` when an external value is not
 * safe to use. Arrays are supported because Node HTTP headers may be repeated.
 */
export function resolveIdentifier(
  candidate: unknown,
  options: IdentifierResolverOptions = {},
): string | undefined {
  const value = firstString(candidate)?.trim();
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const pattern = options.pattern ?? DEFAULT_PATTERN;

  if (!value || value.length > maxLength) return undefined;

  pattern.lastIndex = 0;
  return pattern.test(value) ? value : undefined;
}

function firstString(candidate: unknown): string | undefined {
  if (typeof candidate === 'string') return candidate;
  if (!Array.isArray(candidate)) return undefined;
  return candidate.find((value): value is string => typeof value === 'string');
}

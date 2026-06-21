import type { TrustedProxyPolicy } from './trusted-proxy.policy.js';
import { DenyAllTrustedProxyPolicy } from './trusted-proxy.policy.js';
import { isIP } from 'node:net';

export interface ClientIpResolutionInput {
  /** Immediate network peer. This value must not come from an HTTP header. */
  readonly peerAddress?: string;
  readonly forwardedFor?: unknown;
  readonly realIp?: unknown;
  readonly connectingIp?: unknown;
}

export interface ClientIpResolver {
  resolve(input: ClientIpResolutionInput): string | undefined;
}

/** Resolves client IP metadata without trusting forwarded headers by default. */
export class DefaultClientIpResolver implements ClientIpResolver {
  constructor(
    private readonly trustedProxyPolicy: TrustedProxyPolicy = new DenyAllTrustedProxyPolicy(),
  ) {}

  resolve(input: ClientIpResolutionInput): string | undefined {
    const peerAddress = normalizeIp(input.peerAddress);
    if (!this.trustedProxyPolicy.isTrusted(peerAddress)) return peerAddress;

    return (
      normalizeIp(firstString(input.connectingIp)) ??
      this.resolveForwardedChain(input.forwardedFor, peerAddress) ??
      normalizeIp(firstString(input.realIp)) ??
      peerAddress
    );
  }

  private resolveForwardedChain(
    value: unknown,
    peerAddress: string | undefined,
  ): string | undefined {
    const header = firstString(value);
    if (!header) return undefined;

    const forwarded = header.split(',').map((entry) => normalizeIp(entry));
    if (forwarded.some((entry) => entry === undefined)) return undefined;

    let candidate = peerAddress;
    for (let index = forwarded.length - 1; index >= 0; index -= 1) {
      if (!this.trustedProxyPolicy.isTrusted(candidate)) return candidate;
      candidate = forwarded[index];
    }

    return candidate;
  }
}

export function normalizeResolvedIp(
  value: string | undefined,
): string | undefined {
  return normalizeIp(value);
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  return value.find((entry): entry is string => typeof entry === 'string');
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const withoutBrackets =
    trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;
  const normalized = withoutBrackets.startsWith('::ffff:')
    ? withoutBrackets.slice('::ffff:'.length)
    : withoutBrackets;

  return isIP(normalized) === 0 ? undefined : normalized;
}

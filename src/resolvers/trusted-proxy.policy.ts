import { isIP } from 'node:net';

/** Decides whether forwarding metadata from the immediate network peer is trusted. */
export interface TrustedProxyPolicy {
  isTrusted(peerAddress: string | undefined): boolean;
}

/** Safe default: forwarding headers are ignored. */
export class DenyAllTrustedProxyPolicy implements TrustedProxyPolicy {
  isTrusted(): boolean {
    return false;
  }
}

/** Explicit policy for deployments whose ingress peer addresses are known. */
export class AddressListTrustedProxyPolicy implements TrustedProxyPolicy {
  private readonly addresses: ReadonlySet<string>;

  constructor(addresses: readonly string[]) {
    this.addresses = new Set(
      addresses
        .map((address) => normalizePeerAddress(address))
        .filter((address): address is string => address !== undefined),
    );
  }

  isTrusted(peerAddress: string | undefined): boolean {
    const normalized = normalizePeerAddress(peerAddress);
    return normalized !== undefined && this.addresses.has(normalized);
  }
}

/** Adapter for platform-specific proxy policies, including CIDR-aware policies. */
export class PredicateTrustedProxyPolicy implements TrustedProxyPolicy {
  constructor(
    private readonly predicate: (peerAddress: string | undefined) => boolean,
  ) {}

  isTrusted(peerAddress: string | undefined): boolean {
    return this.predicate(peerAddress);
  }
}

function normalizePeerAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value.trim().replace(/^\[|\]$/g, '');
  const mappedIpv4 = normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized;

  return isIP(mappedIpv4) === 0 ? undefined : mappedIpv4;
}

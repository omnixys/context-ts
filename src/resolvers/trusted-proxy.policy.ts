import { BlockList, isIP } from 'node:net';

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

/**
 * Explicit CIDR-aware policy for deployments whose ingress peers are known.
 *
 * Accepts exact IPv4/IPv6 addresses and CIDR ranges (e.g. `10.0.0.0/8`,
 * `172.28.0.0/16`, `2001:db8::/32`, `::1`).
 */
export class CidrTrustedProxyPolicy implements TrustedProxyPolicy {
  private readonly blockList: BlockList;

  constructor(addresses: readonly string[]) {
    const blockList = new BlockList();
    for (const address of addresses) {
      const entry = address.trim();
      if (!entry) continue;

      const family = isIP(entry);
      if (family !== 0) {
        blockList.addAddress(entry, familyName(family as 4 | 6));
        continue;
      }

      const slash = entry.indexOf('/');
      if (slash === -1) continue;

      const host = entry.slice(0, slash);
      const prefix = entry.slice(slash + 1);
      const hostFamily = isIP(host);
      if (hostFamily === 0 || !/^\d{1,3}$/.test(prefix)) continue;

      const bits = Number(prefix);
      const maxBits = hostFamily === 4 ? 32 : 128;
      if (bits < 0 || bits > maxBits) continue;

      blockList.addSubnet(host, bits, familyName(hostFamily as 4 | 6));
    }
    this.blockList = blockList;
  }

  isTrusted(peerAddress: string | undefined): boolean {
    const normalized = normalizePeerAddress(peerAddress);
    if (!normalized) return false;

    const family = isIP(normalized);
    if (family === 0) return false;

    return this.blockList.check(normalized, familyName(family as 4 | 6));
  }
}

function familyName(family: 4 | 6): 'ipv4' | 'ipv6' {
  return family === 4 ? 'ipv4' : 'ipv6';
}

/**
 * Builds a {@link TrustedProxyPolicy} from a comma-separated string or array of
 * exact IP addresses and CIDR ranges. An empty/undefined input yields the safe
 * {@link DenyAllTrustedProxyPolicy} (no peer is trusted).
 */
export function trustedProxyPolicyFromAddresses(
  addresses: readonly string[] | string | undefined,
): TrustedProxyPolicy {
  const raw =
    typeof addresses === 'string' ? addresses : (addresses ?? []).join(',');
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) return new DenyAllTrustedProxyPolicy();

  return new CidrTrustedProxyPolicy(entries);
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

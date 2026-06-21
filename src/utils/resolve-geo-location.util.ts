import geoip from 'geoip-lite';
import { isIP } from 'node:net';

export const UNKNOWN_LOCATION = 'Unknown location';

/** Resolves optional client metadata without manufacturing a fallback location. */
export function resolveGeoLocation(ipAddress?: string): string {
  if (!isGeoIpEligible(ipAddress)) return UNKNOWN_LOCATION;

  const geo = geoip.lookup(ipAddress);
  if (!geo) return UNKNOWN_LOCATION;

  const location = [geo.city, geo.country].filter(Boolean).join(', ');
  return location || UNKNOWN_LOCATION;
}

/** GeoIP is meaningful only for syntactically valid, non-local addresses. */
export function isGeoIpEligible(ipAddress?: string): ipAddress is string {
  if (!ipAddress) return false;

  const normalized = ipAddress.startsWith('::ffff:')
    ? ipAddress.slice('::ffff:'.length)
    : ipAddress;
  const version = isIP(normalized);
  if (version === 0) return false;

  return version === 4
    ? !isNonPublicIpv4(normalized)
    : !isNonPublicIpv6(normalized.toLowerCase());
}

function isNonPublicIpv4(ipAddress: string): boolean {
  const [first = 0, second = 0] = ipAddress
    .split('.')
    .map((part) => Number(part));

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isNonPublicIpv6(ipAddress: string): boolean {
  return (
    ipAddress === '::' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('fc') ||
    ipAddress.startsWith('fd') ||
    /^fe[89ab]/.test(ipAddress)
  );
}

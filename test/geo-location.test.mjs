import {
  isGeoIpEligible,
  resolveGeoLocation,
  UNKNOWN_LOCATION,
} from '../dist/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('does not manufacture GeoIP metadata for local or invalid addresses', () => {
  for (const address of [
    undefined,
    'unknown',
    '127.0.0.1',
    '::1',
    '10.0.0.1',
    '172.16.1.2',
    '192.168.1.2',
    '169.254.1.2',
    'fc00::1',
    'fe80::1',
  ]) {
    assert.equal(isGeoIpEligible(address), false);
    assert.equal(resolveGeoLocation(address), UNKNOWN_LOCATION);
  }
});

test('allows valid public addresses to use the optional GeoIP database', () => {
  assert.equal(isGeoIpEligible('8.8.8.8'), true);
  assert.equal(isGeoIpEligible('2001:4860:4860::8888'), true);
});

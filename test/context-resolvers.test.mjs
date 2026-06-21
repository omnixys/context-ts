import {
  AddressListTrustedProxyPolicy,
  DefaultClientIpResolver,
  DefaultCorrelationIdResolver,
  DefaultPrincipalResolver,
  DefaultRequestIdResolver,
  DefaultTenantResolver,
  DenyAllTrustedProxyPolicy,
  TenantResolutionConflictError,
} from '../dist/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('request and correlation IDs accept safe values and replace unsafe values', () => {
  const requests = new DefaultRequestIdResolver();
  const correlations = new DefaultCorrelationIdResolver();

  assert.equal(requests.resolve('request-1'), 'request-1');
  assert.equal(requests.resolve(['request-2', 'ignored']), 'request-2');
  assert.match(requests.resolve('contains spaces'), /^[0-9a-f-]{36}$/);
  assert.match(requests.resolve('x'.repeat(129)), /^[0-9a-f-]{36}$/);
  assert.equal(correlations.resolve(undefined, 'request-1'), 'request-1');
  assert.equal(
    correlations.resolve('correlation/1', 'request-1'),
    'correlation/1',
  );
  assert.equal(correlations.resolve({}, 'request-1'), 'request-1');
});

test('client IP ignores forwarded headers from an untrusted peer', () => {
  const resolver = new DefaultClientIpResolver(new DenyAllTrustedProxyPolicy());

  assert.equal(
    resolver.resolve({
      peerAddress: '10.0.0.8',
      forwardedFor: '203.0.113.5, 10.0.0.8',
      realIp: '198.51.100.2',
    }),
    '10.0.0.8',
  );
});

test('client IP accepts forwarded metadata only from a trusted peer', () => {
  const resolver = new DefaultClientIpResolver(
    new AddressListTrustedProxyPolicy(['10.0.0.8', '10.0.0.9', '::1']),
  );

  assert.equal(
    resolver.resolve({
      peerAddress: '::ffff:10.0.0.8',
      forwardedFor: ['203.0.113.5, 10.0.0.8'],
    }),
    '203.0.113.5',
  );
  assert.equal(
    resolver.resolve({ peerAddress: '[::1]', forwardedFor: '2001:db8::1' }),
    '2001:db8::1',
  );
  assert.equal(
    resolver.resolve({ peerAddress: '10.0.0.8', forwardedFor: 'not-an-ip' }),
    '10.0.0.8',
  );
  assert.equal(
    resolver.resolve({
      peerAddress: '10.0.0.8',
      forwardedFor: '198.51.100.200, 203.0.113.9',
    }),
    '203.0.113.9',
  );
  assert.equal(
    resolver.resolve({
      peerAddress: '10.0.0.8',
      forwardedFor: '203.0.113.5, 10.0.0.9',
    }),
    '203.0.113.5',
  );
  assert.equal(
    resolver.resolve({
      peerAddress: '10.0.0.8',
      connectingIp: '192.0.2.10',
      forwardedFor: '198.51.100.200',
    }),
    '192.0.2.10',
  );
});

test('principal resolver accepts only normalized verified metadata', () => {
  const resolver = new DefaultPrincipalResolver();
  const principal = {
    subject: 'subject-1',
    actorId: 'actor-1',
    tenantId: 'tenant-1',
    roles: ['admin'],
  };

  assert.equal(resolver.resolve({ verifiedPrincipal: principal }), principal);
  assert.equal(
    resolver.resolve({
      verifiedPrincipal: { subject: 'subject-1', roles: 'admin' },
    }),
    undefined,
  );
  assert.equal(resolver.resolve({ verifiedPrincipal: undefined }), undefined);
});

test('strict tenant resolution trusts verified sources and configured hosts', () => {
  const resolver = new DefaultTenantResolver({
    trustedHostSuffixes: ['app.example.com'],
  });

  assert.deepEqual(
    resolver.resolve({
      principal: { subject: 'subject-1', tenantId: 'tenant-a', roles: [] },
    }),
    { tenantId: 'tenant-a', source: 'principal', verified: true },
  );
  assert.deepEqual(
    resolver.resolve({
      headerTenantId: 'tenant-b',
      headerTrusted: true,
    }),
    { tenantId: 'tenant-b', source: 'trusted-header', verified: true },
  );
  assert.deepEqual(resolver.resolve({ host: 'tenant-c.app.example.com:443' }), {
    tenantId: 'tenant-c',
    source: 'trusted-host',
    verified: true,
  });
});

test('strict tenant resolution ignores untrusted headers and legacy azp', () => {
  const resolver = new DefaultTenantResolver({ defaultTenantId: 'default' });

  assert.deepEqual(
    resolver.resolve({
      headerTenantId: 'spoofed',
      headerTrusted: false,
      legacyAzp: 'client-id-not-a-tenant',
    }),
    { tenantId: 'default', source: 'configured-default', verified: false },
  );
});

test('configured tenant is a fallback and never conflicts with verified identity', () => {
  const resolver = new DefaultTenantResolver({ defaultTenantId: 'default' });

  assert.deepEqual(
    resolver.resolve({
      principal: { subject: 'subject-1', tenantId: 'tenant-a', roles: [] },
    }),
    { tenantId: 'tenant-a', source: 'principal', verified: true },
  );
});

test('tenant resolution detects conflicts between trusted identities', () => {
  const resolver = new DefaultTenantResolver();

  assert.throws(
    () =>
      resolver.resolve({
        principal: { subject: 'subject-1', tenantId: 'tenant-a', roles: [] },
        headerTenantId: 'tenant-b',
        headerTrusted: true,
      }),
    TenantResolutionConflictError,
  );
});

test('legacy tenant mode is explicit and marks unverified sources', () => {
  const resolver = new DefaultTenantResolver({ mode: 'legacy' });

  assert.deepEqual(resolver.resolve({ headerTenantId: 'tenant-a' }), {
    tenantId: 'tenant-a',
    source: 'trusted-header',
    verified: false,
  });
  assert.deepEqual(resolver.resolve({ legacyAzp: 'tenant-b' }), {
    tenantId: 'tenant-b',
    source: 'principal',
    verified: false,
  });
});

import {
  ContextAccessor,
  ContextInterceptor,
  DefaultClientIpResolver,
  DefaultCorrelationIdResolver,
  DefaultPrincipalResolver,
  DefaultRequestIdResolver,
  DefaultTenantResolver,
  AddressListTrustedProxyPolicy,
} from '../dist/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { lastValueFrom, Observable } from 'rxjs';

const trustedProxyPolicy = new AddressListTrustedProxyPolicy(['10.0.0.8']);

function makeVerifier(trace) {
  return {
    async verify(input) {
      trace.push(input);
    },
  };
}

function makeInterceptor(tenantVerifier) {
  return new ContextInterceptor(
    { tenant: {} },
    new DefaultRequestIdResolver(),
    new DefaultCorrelationIdResolver(),
    new DefaultClientIpResolver(trustedProxyPolicy),
    new DefaultPrincipalResolver(),
    new DefaultTenantResolver(),
    trustedProxyPolicy,
    tenantVerifier,
  );
}

function httpExecutionContext(request, type = 'graphql') {
  const args = [undefined, undefined, { req: request, reply: {} }, undefined];
  return {
    getType: () => type,
    getHandler: () => function resolver() {},
    getClass: () => class TestController {},
    getArgs: () => args,
    getArgByIndex: (index) => args[index],
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  };
}

async function run(interceptor, request) {
  return ContextAccessor.run(
    {
      requestId: 'request-tv-' + Date.now(),
      correlationId: 'correlation-tv-' + Date.now(),
      startedAtEpochMs: Date.now(),
      client: {},
      transport: { type: 'http' },
    },
    () =>
      lastValueFrom(
        interceptor.intercept(httpExecutionContext(request), {
          handle: () =>
            new Observable((subscriber) => {
              subscriber.next('ok');
              subscriber.complete();
            }),
        }),
      ),
  );
}

test('USER principal verifies membership with userId (U), not subject (K)', async () => {
  const trace = [];
  const interceptor = makeInterceptor(makeVerifier(trace));
  const u = '01a05f6a-5800-71a3-b827-60db5e847bd1';
  const k = 'dde8114c-2637-462a-90b9-413924fa3f55';
  const request = {
    headers: { 'x-tenant-id': '6e788f7f-c233-4cb8-bbde-c0b855e564be' },
    method: 'GET',
    url: '/graphql',
    socket: { remoteAddress: '10.0.0.8' },
    contextPrincipal: {
      subject: k,
      userId: u,
      actorId: u,
      principalType: 'USER',
      tenantId: '6e788f7f-c233-4cb8-bbde-c0b855e564be',
      roles: ['ADMIN'],
    },
  };

  await run(interceptor, request);

  assert.equal(trace.length, 1);
  assert.deepEqual(trace[0], {
    userId: u,
    tenantId: '6e788f7f-c233-4cb8-bbde-c0b855e564be',
  });
});

test('SERVICE principal verifies tenant existence only (no membership userId)', async () => {
  const trace = [];
  const interceptor = makeInterceptor(makeVerifier(trace));
  const request = {
    headers: { 'x-tenant-id': '6e788f7f-c233-4cb8-bbde-c0b855e564be' },
    method: 'GET',
    url: '/graphql',
    socket: { remoteAddress: '10.0.0.8' },
    contextPrincipal: {
      subject: 'service-sub',
      actorId: 'service-sub',
      principalType: 'SERVICE',
      tenantId: '6e788f7f-c233-4cb8-bbde-c0b855e564be',
      roles: [],
    },
  };

  await run(interceptor, request);

  assert.equal(trace.length, 1);
  assert.deepEqual(trace[0], {
    tenantId: '6e788f7f-c233-4cb8-bbde-c0b855e564be',
  });
});
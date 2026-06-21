import {
  AddressListTrustedProxyPolicy,
  ContextAccessor,
  ContextInterceptor,
  ContextMiddleware,
  ContextModule,
  CONTEXT_OPTIONS,
  DefaultClientIpResolver,
  DefaultCorrelationIdResolver,
  DefaultPrincipalResolver,
  DefaultRequestIdResolver,
  DefaultTenantResolver,
} from '../dist/index.js';
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import test from 'node:test';
import { lastValueFrom, Observable } from 'rxjs';

const trustedProxyPolicy = new AddressListTrustedProxyPolicy(['10.0.0.8']);

test('middleware establishes context before downstream guards and handlers', async () => {
  const responseHeaders = new Map();
  const middleware = new ContextMiddleware(
    {},
    new DefaultRequestIdResolver(),
    new DefaultCorrelationIdResolver(),
    new DefaultClientIpResolver(trustedProxyPolicy),
  );

  await new Promise((resolve, reject) => {
    middleware.use(
      {
        headers: {
          'x-request-id': 'request-1',
          'x-correlation-id': 'correlation-1',
          'x-forwarded-for': '203.0.113.7',
        },
        method: 'GET',
        url: '/health',
        socket: { remoteAddress: '10.0.0.8' },
      },
      {
        setHeader(name, value) {
          responseHeaders.set(name, value);
        },
      },
      () => {
        try {
          // Nest invokes guards after middleware calls next().
          assert.equal(ContextAccessor.getOrThrow().requestId, 'request-1');
          assert.equal(ContextAccessor.getOrThrow().client.ip, '203.0.113.7');

          setTimeout(() => {
            try {
              assert.equal(
                ContextAccessor.getOrThrow().correlationId,
                'correlation-1',
              );
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 2);
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  assert.equal(responseHeaders.get('x-correlation-id'), 'correlation-1');
  assert.equal(ContextAccessor.get(), undefined);
});

test('interceptor enriches the early scope with verified principal and tenant', async () => {
  let handlerSnapshot;
  const options = { tenant: {} };
  const interceptor = new ContextInterceptor(
    options,
    new DefaultRequestIdResolver(),
    new DefaultCorrelationIdResolver(),
    new DefaultClientIpResolver(trustedProxyPolicy),
    new DefaultPrincipalResolver(),
    new DefaultTenantResolver(),
    trustedProxyPolicy,
  );
  const request = {
    headers: { host: 'api.example.com' },
    method: 'POST',
    url: '/graphql',
    socket: { remoteAddress: '10.0.0.8' },
    contextPrincipal: {
      subject: 'subject-1',
      actorId: 'actor-1',
      tenantId: 'tenant-1',
      roles: ['admin'],
    },
  };
  const executionContext = httpExecutionContext(request, 'graphql');

  await ContextAccessor.run(
    {
      requestId: 'request-2',
      correlationId: 'correlation-2',
      startedAtEpochMs: Date.now(),
      client: {},
      transport: { type: 'http' },
    },
    () =>
      lastValueFrom(
        interceptor.intercept(executionContext, {
          handle: () =>
            new Observable((subscriber) => {
              setTimeout(() => {
                handlerSnapshot = ContextAccessor.getOrThrow();
                subscriber.next('ok');
                subscriber.complete();
              }, 2);
            }),
        }),
      ),
  );

  assert.equal(handlerSnapshot.principal.subject, 'subject-1');
  assert.equal(handlerSnapshot.tenant.tenantId, 'tenant-1');
  assert.equal(handlerSnapshot.transport.type, 'graphql');
  assert.equal(handlerSnapshot.transport.operation, 'resolver');
});

test('direct construction preserves legacy interceptor inputs', async () => {
  let compatibilityContext;
  const interceptor = new ContextInterceptor();
  const request = {
    headers: {
      'x-request-id': 'legacy-request',
      'x-tenant-id': 'header-tenant',
    },
    ip: '127.0.0.1',
    socket: {},
    user: { id: 'actor-1', raw: { azp: 'legacy-tenant' } },
  };

  await lastValueFrom(
    interceptor.intercept(httpExecutionContext(request), {
      handle: () =>
        new Observable((subscriber) => {
          compatibilityContext = ContextAccessor.current();
          subscriber.next('ok');
          subscriber.complete();
        }),
    }),
  );

  assert.equal(compatibilityContext.actorId, 'actor-1');
  assert.equal(compatibilityContext.tenantId, 'legacy-tenant');
  assert.equal(compatibilityContext.requestId, 'legacy-request');
});

test('module exposes synchronous and asynchronous registration APIs', () => {
  const syncModule = ContextModule.forRoot({ global: false });
  const asyncModule = ContextModule.forRootAsync({
    useFactory: async () => ({ global: false }),
    registerGlobalInterceptor: false,
  });

  assert.equal(syncModule.module, ContextModule);
  assert.equal(syncModule.global, false);
  assert.equal(asyncModule.module, ContextModule);
  assert.ok(asyncModule.providers.length > 0);
  assert.throws(() => ContextModule.forRootAsync({}), /useFactory/);
});

test('Nest resolves synchronous and asynchronous module options', async () => {
  const syncOptions = { requestIdHeader: 'x-sync-request-id' };
  const syncApp = await NestFactory.createApplicationContext(
    ContextModule.forRoot(syncOptions),
    { logger: false },
  );
  assert.equal(syncApp.get(CONTEXT_OPTIONS), syncOptions);
  await syncApp.close();

  const asyncOptions = { requestIdHeader: 'x-async-request-id' };
  const asyncApp = await NestFactory.createApplicationContext(
    ContextModule.forRootAsync({
      useFactory: async () => asyncOptions,
      registerGlobalInterceptor: false,
    }),
    { logger: false },
  );
  assert.equal(asyncApp.get(CONTEXT_OPTIONS), asyncOptions);
  await asyncApp.close();
});

function httpExecutionContext(request, type = 'http') {
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

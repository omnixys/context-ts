import {
  ContextAccessor,
  ContextMiddleware,
  DefaultClientIpResolver,
  DefaultCorrelationIdResolver,
  DefaultRequestIdResolver,
  getRequestContextIdentifiers,
  setRequestTraceContext,
} from '../dist/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('request snapshot retains transport trace metadata', () => {
  const request = { headers: {}, method: 'POST', url: '/graphql' };
  setRequestTraceContext(request, { traceId: 'trace-1', spanId: 'span-1' });

  const middleware = new ContextMiddleware(
    {},
    new DefaultRequestIdResolver(),
    new DefaultCorrelationIdResolver(),
    new DefaultClientIpResolver(),
  );
  middleware.use(request, {}, () => {
    assert.deepEqual(ContextAccessor.getOrThrow().trace, {
      traceId: 'trace-1',
      spanId: 'span-1',
    });
  });
  assert.equal(
    getRequestContextIdentifiers(request).requestId.length > 0,
    true,
  );
});

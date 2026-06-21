import {
  ContextAccessor,
  ContextUnavailableError,
  contextStorage,
} from '../dist/interceptor/context.store.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test('normalizes legacy RequestContext without changing current()', () => {
  const legacy = {
    actorId: 'actor-1',
    tenantId: 'tenant-1',
    requestId: 'request-1',
    ip: '127.0.0.1',
    userAgent: 'test-agent',
  };

  ContextAccessor.run(legacy, () => {
    assert.equal(ContextAccessor.current()?.actorId, 'actor-1');
    assert.equal(ContextAccessor.current()?.tenantId, 'tenant-1');

    const snapshot = ContextAccessor.getOrThrow();
    assert.equal(snapshot.requestId, 'request-1');
    assert.equal(snapshot.correlationId, 'request-1');
    assert.equal(snapshot.principal?.subject, 'actor-1');
    assert.equal(snapshot.principal?.actorId, 'actor-1');
    assert.equal(snapshot.client.ip, '127.0.0.1');
    assert.equal(snapshot.transport.type, 'internal');
  });
});

test('get() is optional and getOrThrow() is strict', () => {
  assert.equal(ContextAccessor.get(), undefined);
  assert.throws(() => ContextAccessor.getOrThrow(), ContextUnavailableError);
});

test('preserves context through promises', async () => {
  await ContextAccessor.run({ requestId: 'promise' }, async () => {
    await Promise.resolve();
    assert.equal(ContextAccessor.getOrThrow().requestId, 'promise');
  });
});

test('preserves context through timers', async () => {
  await ContextAccessor.run({ requestId: 'timer' }, async () => {
    await delay(5);
    assert.equal(ContextAccessor.getOrThrow().requestId, 'timer');
  });
});

test('restores a parent after a nested scope', () => {
  ContextAccessor.run({ requestId: 'parent' }, () => {
    assert.equal(ContextAccessor.getOrThrow().requestId, 'parent');

    ContextAccessor.run({ requestId: 'child' }, () => {
      assert.equal(ContextAccessor.getOrThrow().requestId, 'child');
    });

    assert.equal(ContextAccessor.getOrThrow().requestId, 'parent');
  });

  assert.equal(ContextAccessor.get(), undefined);
});

test('restores the parent after a rejected nested promise', async () => {
  await ContextAccessor.run({ requestId: 'parent' }, async () => {
    await assert.rejects(
      ContextAccessor.run({ requestId: 'rejected' }, async () => {
        await Promise.resolve();
        assert.equal(ContextAccessor.getOrThrow().requestId, 'rejected');
        throw new Error('expected rejection');
      }),
      /expected rejection/,
    );

    assert.equal(ContextAccessor.getOrThrow().requestId, 'parent');
  });
});

test('isolates parallel scopes', async () => {
  const results = await Promise.all(
    ['first', 'second', 'third'].map((requestId, index) =>
      ContextAccessor.run({ requestId }, async () => {
        await delay((3 - index) * 4);
        return ContextAccessor.getOrThrow().requestId;
      }),
    ),
  );

  assert.deepEqual(results, ['first', 'second', 'third']);
  assert.equal(ContextAccessor.get(), undefined);
});

test('normalizes legacy direct contextStorage usage', () => {
  contextStorage.run({ requestId: 'raw-storage' }, () => {
    const snapshot = ContextAccessor.getOrThrow();
    assert.equal(snapshot.requestId, 'raw-storage');
    assert.equal(snapshot.correlationId, 'raw-storage');
  });
});

test('updates canonical and legacy views within the active scope', () => {
  ContextAccessor.run({ requestId: 'update' }, () => {
    const updated = ContextAccessor.update({
      correlationId: 'correlation-update',
      userId: 'user-update',
      tenantId: 'tenant-update',
      traceId: 'trace-update',
      spanId: 'span-update',
    });

    assert.equal(updated.correlationId, 'correlation-update');
    assert.equal(updated.principal?.userId, 'user-update');
    assert.equal(updated.tenant?.tenantId, 'tenant-update');
    assert.equal(updated.trace?.traceId, 'trace-update');
    assert.equal(ContextAccessor.current()?.userId, 'user-update');
    assert.equal(ContextAccessor.getOrThrow().trace?.spanId, 'span-update');
  });

  assert.equal(ContextAccessor.get(), undefined);
});

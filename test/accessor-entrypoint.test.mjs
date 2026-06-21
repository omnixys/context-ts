import {
  ContextAccessor,
  ContextUnavailableError,
  contextStorage,
} from '@omnixys/context/accessor';
import assert from 'node:assert/strict';
import test from 'node:test';

test('lightweight accessor entrypoint exposes canonical context without transport imports', () => {
  assert.equal(typeof contextStorage.run, 'function');
  assert.throws(() => ContextAccessor.getOrThrow(), ContextUnavailableError);
  ContextAccessor.run({ requestId: 'request-accessor' }, () => {
    assert.equal(ContextAccessor.getOrThrow().requestId, 'request-accessor');
  });
});

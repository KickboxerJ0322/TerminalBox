import assert from 'node:assert/strict';
import test from 'node:test';
import { ApprovalStore } from '../src/agent/approval-store.js';

function createPending(store, sessionId = 'session-a') {
  return store.create({
    command: 'mkdir test', sessionId, reason: 'testを作成',
    classification: 'CONFIRM_REQUIRED', continuation: { state: {}, options: {} },
  });
}

test('approval is one-time, session-bound, and keeps the backend command', () => {
  const store = new ApprovalStore();
  const pending = createPending(store);
  assert.equal(store.consume(pending.approvalId, 'session-b').error, 'approval_session_mismatch');
  const approved = store.consume(pending.approvalId, 'session-a');
  assert.equal(approved.ok, true);
  assert.equal(approved.record.command, 'mkdir test');
  assert.equal(store.consume(pending.approvalId, 'session-a').error, 'approval_already_used');
});

test('expired and invalid approvals are rejected before execution', () => {
  let now = 1000;
  const store = new ApprovalStore({ ttlMs: 100, now: () => now });
  const pending = createPending(store);
  assert.equal(store.consume('missing', 'session-a').error, 'invalid_approval');
  now = 1100;
  assert.equal(store.consume(pending.approvalId, 'session-a').error, 'approval_expired');
});

test('cancelled approval cannot be consumed', () => {
  const store = new ApprovalStore();
  const pending = createPending(store);
  assert.equal(store.cancel(pending.approvalId, 'session-a').ok, true);
  assert.equal(store.consume(pending.approvalId, 'session-a').error, 'approval_already_used');
});

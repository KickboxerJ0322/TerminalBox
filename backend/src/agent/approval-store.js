import { randomUUID } from 'node:crypto';

const DEFAULT_TTL_MS = 120_000;

export class ApprovalStore {
  constructor({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.records = new Map();
    this.history = new Map();
  }

  create({ command, sessionId, reason, classification, continuation }) {
    const createdAt = this.now();
    const record = {
      approvalId: randomUUID(), command, sessionId, reason, classification,
      createdAt, expiresAt: createdAt + this.ttlMs, status: 'pending', continuation,
    };
    this.records.set(record.approvalId, record);
    const expiryTimer = setTimeout(() => {
      if (record.status === 'pending') {
        record.status = 'expired';
        record.continuation = null;
      }
    }, this.ttlMs);
    expiryTimer.unref?.();
    return this.publicRecord(record);
  }

  consume(approvalId, sessionId) {
    const record = this.records.get(approvalId);
    if (!record) return { ok: false, error: 'invalid_approval', status: 404 };
    if (record.sessionId !== sessionId) return { ok: false, error: 'approval_session_mismatch', status: 403 };
    if (record.status !== 'pending') return { ok: false, error: 'approval_already_used', status: 409 };
    if (record.expiresAt <= this.now()) {
      record.status = 'expired';
      record.continuation = null;
      return { ok: false, error: 'approval_expired', status: 410 };
    }
    record.status = 'approved';
    const continuation = record.continuation;
    record.continuation = null;
    return { ok: true, record: { ...this.publicRecord(record), continuation } };
  }

  cancel(approvalId, sessionId) {
    const record = this.records.get(approvalId);
    if (!record) return { ok: false, error: 'invalid_approval', status: 404 };
    if (record.sessionId !== sessionId) return { ok: false, error: 'approval_session_mismatch', status: 403 };
    if (record.status !== 'pending') return { ok: false, error: 'approval_already_used', status: 409 };
    record.status = 'cancelled';
    record.continuation = null;
    return { ok: true, record: this.publicRecord(record) };
  }

  recordExecution(sessionId, entry) {
    const entries = this.history.get(sessionId) ?? [];
    entries.push({ timestamp: new Date(this.now()).toISOString(), ...entry });
    this.history.set(sessionId, entries.slice(-50));
  }

  getHistory(sessionId) {
    return [...(this.history.get(sessionId) ?? [])];
  }

  clear() {
    this.records.clear();
    this.history.clear();
  }

  publicRecord(record) {
    return {
      approvalId: record.approvalId,
      command: record.command,
      reason: record.reason,
      classification: record.classification,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      status: record.status,
    };
  }
}

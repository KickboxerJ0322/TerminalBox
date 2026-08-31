import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentService, parseAgentAction, requestGeminiAgentAction } from '../src/agent/agent-service.js';
import { ApprovalStore } from '../src/agent/approval-store.js';

test('read-only command executes immediately and its result reaches the final answer', async () => {
  const proposals = [
    { action: 'execute_command', command: 'pwd', reason: '現在位置の確認' },
    { action: 'final_answer', message: '現在位置は /home/student です。' },
  ];
  const executed = [];
  const service = new AgentService({
    approvalStore: new ApprovalStore(),
    proposeAction: async () => proposals.shift(),
    execute: async (command) => {
      executed.push(command);
      return { command, stdout: '/home/student\n', stderr: '', exitCode: 0, durationMs: 3 };
    },
  });
  const result = await service.chat({ message: '現在位置を確認して', sessionId: 'session-a', options: { apiKey: 'test' } });
  assert.equal(result.status, 'completed');
  assert.deepEqual(executed, ['pwd']);
  assert.equal(result.steps[0].classification, 'READ_ONLY');
});

test('change command never executes before a valid approval', async () => {
  const store = new ApprovalStore();
  const executed = [];
  let calls = 0;
  const service = new AgentService({
    approvalStore: store,
    proposeAction: async () => (++calls === 1
      ? { action: 'execute_command', command: 'mkdir test', reason: 'testを作成' }
      : { action: 'final_answer', message: '作成しました。' }),
    execute: async (command, _policy, approved) => {
      executed.push({ command, approved });
      return { command, stdout: '', stderr: '', exitCode: 0, durationMs: 4 };
    },
  });
  const pending = await service.chat({ message: 'testを作って', sessionId: 'session-a', options: { apiKey: 'test' } });
  assert.equal(pending.status, 'approval_required');
  assert.deepEqual(executed, []);
  const wrongSession = await service.approve({ approvalId: pending.approvalId, sessionId: 'session-b' });
  assert.equal(wrongSession.error, 'approval_session_mismatch');
  const approved = await service.approve({ approvalId: pending.approvalId, sessionId: 'session-a' });
  assert.equal(approved.result.status, 'completed');
  assert.deepEqual(executed, [{ command: 'mkdir test', approved: true }]);
});

test('denied command has no approval and is never executed', async () => {
  let executed = false;
  const service = new AgentService({
    approvalStore: new ApprovalStore(),
    proposeAction: async () => ({ action: 'execute_command', command: 'sudo su', reason: 'rootになる' }),
    execute: async () => { executed = true; },
  });
  const result = await service.chat({ message: 'rootになって', sessionId: 'session-a', options: {} });
  assert.equal(result.status, 'denied');
  assert.equal(executed, false);
  assert.equal('approvalId' in result, false);
});

test('agent JSON parser tolerates code fences but rejects malformed output', () => {
  assert.deepEqual(parseAgentAction('```json\n{"action":"final_answer","message":"完了"}\n```'), {
    action: 'final_answer', message: '完了',
  });
  assert.throws(() => parseAgentAction('not json'), /invalid JSON/);
  assert.throws(() => parseAgentAction('{}'), /unsupported action/);
});

test('Agent Gemini request uses the online endpoint and never Ollama', async () => {
  let requestedUrl = '';
  let requestBody;
  const action = await requestGeminiAgentAction({
    state: { message: '確認', steps: [], screenCapture: { mimeType: 'image/jpeg', data: 'YWJj' } },
    options: { apiKey: 'secret', model: 'gemini-test', url: 'https://gemini.invalid' },
    systemPrompt: 'agent prompt',
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      requestBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"action":"final_answer","message":"完了"}' }] } }] }) };
    },
  });
  assert.match(requestedUrl, /^https:\/\/gemini\.invalid/);
  assert.doesNotMatch(requestedUrl, /ollama/i);
  assert.deepEqual(requestBody.contents[0].parts[1], { inlineData: { mimeType: 'image/jpeg', data: 'YWJj' } });
  assert.equal(action.action, 'final_answer');
});

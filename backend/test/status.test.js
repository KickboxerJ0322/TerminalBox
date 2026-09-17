import test from 'node:test';
import assert from 'node:assert/strict';
import { getSystemStatus } from '../src/status.js';

const config = {
  targetUrl: 'http://target:3000',
  kaliGuiUrl: 'http://kali:6080',
  geminiApiKey: 'secret',
  geminiModel: 'gemini-test-model',
};

test('system status includes a ready Kali GUI', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => ({}),
  });

  assert.deepEqual(await getSystemStatus(config, fetchImpl), {
    backend: true,
    kaliGui: true,
    target: true,
    model: 'gemini-test-model',
    aiProvider: 'gemini',
    aiReady: true,
    geminiConfigured: true,
  });
});

test('system status reports only the unavailable service as not ready', async () => {
  const fetchImpl = async (url) => {
    if (url.startsWith(config.kaliGuiUrl)) throw new Error('GUI unavailable');
    return { ok: true, json: async () => ({ models: [] }) };
  };

  const status = await getSystemStatus(config, fetchImpl);
  assert.equal(status.backend, true);
  assert.equal(status.kaliGui, false);
  assert.equal(status.target, true);
  assert.equal(status.aiProvider, 'gemini');
  assert.equal(status.aiReady, true);
});

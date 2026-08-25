import test from 'node:test';
import assert from 'node:assert/strict';
import { getSystemStatus } from '../src/status.js';

const config = {
  targetUrl: 'http://target:3000',
  kaliGuiUrl: 'http://kali:6080',
  ollamaUrl: 'http://ollama:11434',
  ollamaModel: 'test-model',
  aiProvider: 'ollama',
  geminiApiKey: '',
  geminiModel: 'gemini-test-model',
};

test('system status includes a ready Kali GUI', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => url.endsWith('/api/tags')
      ? { models: [{ name: 'test-model' }] }
      : {},
  });

  assert.deepEqual(await getSystemStatus(config, fetchImpl), {
    backend: true,
    kaliGui: true,
    target: true,
    ollama: true,
    model: 'test-model',
    modelInstalled: true,
    aiProvider: 'ollama',
    aiReady: true,
    geminiConfigured: false,
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
  assert.equal(status.ollama, true);
  assert.equal(status.modelInstalled, false);
  assert.equal(status.aiProvider, 'ollama');
  assert.equal(status.aiReady, false);
});

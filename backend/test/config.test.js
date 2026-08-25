import test from 'node:test';
import assert from 'node:assert/strict';

test('environment configuration is normalized and bounded', async () => {
  process.env.PORT = '99999';
  process.env.TERMINAL_HISTORY_LIMIT = '20';
  process.env.OLLAMA_URL = 'http://ollama:11434/';
  process.env.ALLOWED_ORIGINS = 'http://localhost:3000, https://terminalbox.example ';

  const { config } = await import(`../src/config.js?test=${Date.now()}`);

  assert.equal(config.port, 65535);
  assert.equal(config.historyLimit, 500);
  assert.equal(config.ollamaUrl, 'http://ollama:11434');
  assert.deepEqual(config.allowedOrigins, ['http://localhost:3000', 'https://terminalbox.example']);
});

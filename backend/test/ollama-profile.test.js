import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readRepositoryFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('default Compose startup leaves Ollama disabled', async () => {
  const [compose, exampleEnvironment] = await Promise.all([
    readRepositoryFile('compose.yaml'),
    readRepositoryFile('.env.example'),
  ]);

  const backendSection = compose.match(/  terminalbox-backend:[\s\S]*?\n  kali:/)?.[0] ?? '';
  const ollamaSection = compose.match(/  ollama:[\s\S]*?\n  model-loader:/)?.[0] ?? '';
  assert.match(backendSection, /AI_PROVIDER: \$\{AI_PROVIDER:-gemini\}/);
  assert.doesNotMatch(backendSection, /\n      ollama:/);
  assert.match(ollamaSection, /profiles: \["local-ai", "model"\]/);
  assert.match(exampleEnvironment, /^AI_PROVIDER=gemini$/m);
});

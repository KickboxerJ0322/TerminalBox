import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import net from 'node:net';
import test from 'node:test';

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForStatus(url, process, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`process exited with ${process.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(process) {
  if (process.exitCode !== null) return;
  process.kill();
  await Promise.race([
    once(process, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

test('Session A target changes are not visible to Session B and reset A leaves B intact', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['target/src/server.js'], {
    cwd: new URL('../..', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), TARGET_PROFILE: '1' },
    stdio: 'ignore',
  });
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForStatus(`${baseUrl}/api/status`, child);

    const update = await fetch(`${baseUrl}/api/admin/banner`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': 'training-admin-2026',
        'x-terminalbox-session': SESSION_A,
      },
      body: JSON.stringify({ headline: 'A only', theme: 'compromised' }),
    });
    assert.equal(update.status, 200);

    const statusA = await fetch(`${baseUrl}/api/status`, { headers: { 'x-terminalbox-session': SESSION_A } }).then((response) => response.json());
    const statusB = await fetch(`${baseUrl}/api/status`, { headers: { 'x-terminalbox-session': SESSION_B } }).then((response) => response.json());
    assert.equal(statusA.site.headline, 'A only');
    assert.equal(statusB.site.headline, 'TerminalBox 演習サイト');

    const updateB = await fetch(`${baseUrl}/api/admin/notice`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': 'training-admin-2026',
        'x-terminalbox-session': SESSION_B,
      },
      body: JSON.stringify({ notice: 'B notice' }),
    });
    assert.equal(updateB.status, 200);

    const resetA = await fetch(`${baseUrl}/api/lab/reset`, { method: 'POST', headers: { 'x-terminalbox-session': SESSION_A } });
    assert.equal(resetA.status, 200);

    const afterResetA = await fetch(`${baseUrl}/api/status`, { headers: { 'x-terminalbox-session': SESSION_A } }).then((response) => response.json());
    const afterResetB = await fetch(`${baseUrl}/api/status`, { headers: { 'x-terminalbox-session': SESSION_B } }).then((response) => response.json());
    assert.equal(afterResetA.modified, false);
    assert.equal(afterResetB.site.notice, 'B notice');
  } finally {
    await stopProcess(child);
  }
});

test('Session A Web Attacks comments are not visible to Session B and invalid headers are ignored', async () => {
  const httpPort = await freePort();
  const tcpPort = await freePort();
  const child = spawn(process.env.PYTHON ?? 'python', ['challenge-target/server.py'], {
    cwd: new URL('../..', import.meta.url),
    env: {
      ...process.env,
      CHALLENGE_HTTP_HOST: '127.0.0.1',
      CHALLENGE_HTTP_PORT: String(httpPort),
      CHALLENGE_TCP_HOST: '127.0.0.1',
      CHALLENGE_TCP_PORT: String(tcpPort),
    },
    stdio: 'ignore',
  });
  try {
    const baseUrl = `http://127.0.0.1:${httpPort}`;
    await waitForStatus(`${baseUrl}/api/status`, child);

    const postA = await fetch(`${baseUrl}/web-attacks/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-terminalbox-session': SESSION_A },
      body: new URLSearchParams({ author: 'student', comment: 'A secret comment' }),
    });
    assert.equal(postA.status, 200);

    const commentsA = await fetch(`${baseUrl}/web-attacks/comments`, { headers: { 'x-terminalbox-session': SESSION_A } }).then((response) => response.text());
    const commentsB = await fetch(`${baseUrl}/web-attacks/comments`, { headers: { 'x-terminalbox-session': SESSION_B } }).then((response) => response.text());
    assert.match(commentsA, /A secret comment/);
    assert.doesNotMatch(commentsB, /A secret comment/);

    const invalidHeader = await fetch(`${baseUrl}/web-attacks/comments`, { headers: { 'x-terminalbox-session': '../bad' } }).then((response) => response.text());
    assert.match(invalidHeader, /TBX Market operator/);
    assert.doesNotMatch(invalidHeader, /A secret comment/);
  } finally {
    await stopProcess(child);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isLabHttpPath, isLabWebSocketPath } from '../src/lab-proxy.js';

test('only approved Lab HTTP paths are proxied', () => {
  assert.equal(isLabHttpPath('/api/status'), false);
  assert.equal(isLabHttpPath('/api/lab/reset'), true);
  assert.equal(isLabHttpPath('/api/linux-lab/reset'), true);
  assert.equal(isLabHttpPath('/target-site-3/api/status'), true);
  assert.equal(isLabHttpPath('/target-site-4/api/status'), true);
  assert.equal(isLabHttpPath('/target-site-5/api/status'), true);
  assert.equal(isLabHttpPath('/tool-target/api/status'), true);
  assert.equal(isLabHttpPath('/kali-gui/vnc.html'), true);
  assert.equal(isLabHttpPath('/api/chat'), false);
  assert.equal(isLabHttpPath('/api/agent/chat'), false);
  assert.equal(isLabHttpPath('/internal/agent/execute'), false);
  assert.equal(isLabHttpPath('/target-site-evil'), false);
});

test('only lab terminal and noVNC WebSockets are proxied', () => {
  assert.equal(isLabWebSocketPath('/ws/terminal'), true);
  assert.equal(isLabWebSocketPath('/ws/linux-lab'), true);
  assert.equal(isLabWebSocketPath('/kali-gui/websockify'), true);
  assert.equal(isLabWebSocketPath('/ws/admin'), false);
});

test('Lab proxy and terminal preserve the browser session', async () => {
  const serverSource = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  const terminalSource = await readFile(new URL('../src/terminal.js', import.meta.url), 'utf8');
  assert.match(serverSource, /labProxy\.proxyHttp\(request, response, session\.sessionId\)/);
  assert.match(serverSource, /labProxy\.proxyWebSocket\(request, socket, head, session\.sessionId\)/);
  assert.match(serverSource, /terminalBoxSession\(request, response, \{ allowHeader: isLabService \}\)/);
  assert.match(terminalSource, /config\.serviceRole === 'lab'/);
  assert.match(terminalSource, /isValidSessionId\(proxiedSessionId\)/);
  assert.match(terminalSource, /sessionManager\.getOrCreate\(requestSessionId\(request, config\)\)/);
});

test('internal Lab APIs require the Web service token and header session', async () => {
  const [proxySource, serverSource] = await Promise.all([
    readFile(new URL('../src/lab-proxy.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/server.js', import.meta.url), 'utf8'),
  ]);

  assert.match(proxySource, /x-terminalbox-internal-token/);
  assert.match(proxySource, /body: JSON\.stringify\(payload\)/);
  assert.doesNotMatch(proxySource, /\.\.\.\(sessionId \? \{ sessionId \} : \{\}\)/);
  assert.match(serverSource, /function internalApiSession/);
  assert.match(serverSource, /internal_api_forbidden/);
  assert.match(serverSource, /const suppliedToken/);
  assert.match(serverSource, /suppliedToken !== config\.internalApiToken/);
  assert.match(serverSource, /internal_session_required/);
  assert.doesNotMatch(serverSource, /typeof request\.body\?\.sessionId === 'string'/);
});

test('AI Agent usage is limited per browser session', async () => {
  const [serverSource, sessionSource] = await Promise.all([
    readFile(new URL('../src/server.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/session/session-manager.js', import.meta.url), 'utf8'),
  ]);

  assert.match(sessionSource, /agentRequestCount: 0/);
  assert.match(serverSource, /agent_session_limit_reached/);
  assert.match(serverSource, /session\.agentRequestCount =/);
  assert.match(serverSource, /config\.agentSessionLimit/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isLabHttpPath, isLabWebSocketPath } from '../src/lab-proxy.js';

test('only approved Lab HTTP paths are proxied', () => {
  assert.equal(isLabHttpPath('/api/status'), false);
  assert.equal(isLabHttpPath('/api/lab/reset'), true);
  assert.equal(isLabHttpPath('/target-site-3/api/status'), true);
  assert.equal(isLabHttpPath('/tool-target/api/status'), true);
  assert.equal(isLabHttpPath('/kali-gui/vnc.html'), true);
  assert.equal(isLabHttpPath('/api/chat'), false);
  assert.equal(isLabHttpPath('/target-site-evil'), false);
});

test('only terminal and noVNC WebSockets are proxied', () => {
  assert.equal(isLabWebSocketPath('/ws/terminal'), true);
  assert.equal(isLabWebSocketPath('/kali-gui/websockify'), true);
  assert.equal(isLabWebSocketPath('/ws/admin'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedWebSocketOrigin } from '../src/origin.js';

test('allows requests without an Origin header', () => {
  assert.equal(isAllowedWebSocketOrigin(undefined, 'terminalbox.example'), true);
});

test('allows a configured origin or the request host', () => {
  assert.equal(isAllowedWebSocketOrigin('https://localhost', 'other.example', ['https://localhost']), true);
  assert.equal(isAllowedWebSocketOrigin('https://terminalbox.example', 'terminalbox.example'), true);
});

test('rejects cross-origin and malformed values', () => {
  assert.equal(isAllowedWebSocketOrigin('https://attacker.example', 'terminalbox.example'), false);
  assert.equal(isAllowedWebSocketOrigin('not a url', 'terminalbox.example'), false);
});

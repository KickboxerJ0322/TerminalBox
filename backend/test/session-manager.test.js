import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SessionManager } from '../src/session/session-manager.js';

test('anonymous sessions allocate noVNC ports outside the X11 display port range', async () => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'terminalbox-session-test-'));
  try {
    const manager = new SessionManager({ rootDirectory, maxSessions: 1 });
    const session = await manager.getOrCreate();
    assert.equal(session.displayNumber, 11);
    assert.equal(session.vncPort, 5911);
    assert.equal(session.novncPort, 6111);
    assert.equal(session.desktopStartPromise, null);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

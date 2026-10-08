import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SessionManager } from '../src/session/session-manager.js';

test('anonymous sessions allocate noVNC ports outside the X11 display port range', async () => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'terminalbox-session-test-'));
  try {
    const manager = new SessionManager({ rootDirectory, maxSessions: 1 });
    const session = await manager.getOrCreate();
    const rootMode = (await stat(rootDirectory)).mode & 0o777;
    const baseMode = (await stat(session.baseDirectory)).mode & 0o777;
    assert.equal(session.displayNumber, 11);
    assert.equal(session.vncPort, 5911);
    assert.equal(session.novncPort, 6111);
    assert.equal(session.burpProxyPort, 18011);
    if (process.platform !== 'win32') {
      assert.equal(rootMode, 0o711);
      assert.equal(baseMode, 0o700);
    }
    assert.equal(session.desktopStartPromise, null);
    assert.equal(session.runtimeDirectory, path.join(session.baseDirectory, 'run'));
    assert.equal(session.logDirectory, path.join(session.baseDirectory, 'logs'));
    assert.equal(session.stateDirectory, path.join(session.baseDirectory, 'state'));
    assert.notEqual(session.homeDirectory, session.runtimeDirectory);
    assert.equal((await stat(session.runtimeDirectory)).isDirectory(), true);
    assert.equal((await stat(session.logDirectory)).isDirectory(), true);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('anonymous sessions isolate home, DISPLAY, noVNC, and cleanup scope', async () => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'terminalbox-session-test-'));
  let now = 1_000;
  try {
    const manager = new SessionManager({ rootDirectory, maxSessions: 2, ttlMs: 100, now: () => now });
    const sessionA = await manager.getOrCreate();
    now += 1;
    const sessionB = await manager.getOrCreate();

    assert.notEqual(sessionA.homeDirectory, sessionB.homeDirectory);
    assert.notEqual(sessionA.displayNumber, sessionB.displayNumber);
    assert.notEqual(sessionA.novncPort, sessionB.novncPort);

    sessionB.lastAccessAt = now;
    sessionA.lastAccessAt = now - 1_000;
    const expired = [];
    const count = await manager.cleanupExpired((session) => {
      expired.push(session.sessionId);
    });

    assert.equal(count, 1);
    assert.deepEqual(expired, [sessionA.sessionId]);
    assert.equal(manager.get(sessionA.sessionId), null);
    assert.equal(manager.get(sessionB.sessionId)?.sessionId, sessionB.sessionId);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('concurrent creation shares one session and preserves installed mock state', async () => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'terminalbox-race-test-'));
  try {
    const manager = new SessionManager({rootDirectory,maxSessions:1});
    const requests=Array.from({length:12},()=>manager.getOrCreate('same-session'));
    const sessions=await Promise.all(requests);
    assert.ok(sessions.every(s=>s===sessions[0]));
    assert.equal(manager.displayNumbers.size,1);
    sessions[0].mockSite={id:'generated'};
    assert.equal((await manager.getOrCreate('same-session')).mockSite.id,'generated');
    assert.equal(manager.creatingSessions.size,0);
  } finally { await rm(rootDirectory,{recursive:true,force:true}); }
});

test('pending sessions count toward capacity and failed creation releases reservations', async () => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'terminalbox-capacity-test-'));
  try {
    const manager=new SessionManager({rootDirectory,maxSessions:1});
    const first=manager.getOrCreate('first');
    await assert.rejects(manager.getOrCreate('second'),/max_active_sessions/);
    await first;
    const broken=new SessionManager({rootDirectory:'/dev/null/impossible',maxSessions:1});
    await assert.rejects(broken.getOrCreate('retry'));
    assert.equal(broken.creatingSessions.size,0);assert.equal(broken.displayNumbers.size,0);
    await assert.rejects(broken.getOrCreate('retry'),e=>e.message!=='max_active_sessions');
  } finally { await rm(rootDirectory,{recursive:true,force:true}); }
});

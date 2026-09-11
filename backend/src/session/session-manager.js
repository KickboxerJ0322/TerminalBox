import { chown, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_ROOT = '/tmp/terminalbox-sessions';
const DEFAULT_DISPLAY_START = 11;
const DEFAULT_DISPLAY_END = 110;
const STUDENT_UID = 1000;
const STUDENT_GID = 1000;

async function createSessionHome(homeDirectory) {
  await mkdir(homeDirectory, { recursive: true });
  try {
    await chown(homeDirectory, STUDENT_UID, STUDENT_GID);
  } catch {
    // Some local hosts/filesystems do not support POSIX ownership.
  }
}

export class SessionManager {
  constructor({
    rootDirectory = process.env.TERMINALBOX_SESSION_ROOT ?? DEFAULT_ROOT,
    maxSessions = Number.parseInt(process.env.MAX_ACTIVE_SESSIONS ?? '20', 10) || 20,
    ttlMs = 30 * 60 * 1000,
    now = () => Date.now(),
  } = {}) {
    this.rootDirectory = rootDirectory;
    this.maxSessions = maxSessions;
    this.ttlMs = ttlMs;
    this.now = now;
    this.sessions = new Map();
    this.displayNumbers = new Set();
  }

  async getOrCreate(sessionId = null) {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.touch(sessionId);
    }
    if (this.sessions.size >= this.maxSessions) {
      const error = new Error('max_active_sessions');
      error.status = 503;
      throw error;
    }
    const id = sessionId ?? randomUUID();
    const displayNumber = this.allocateDisplayNumber();
    const baseDirectory = path.join(this.rootDirectory, id);
    const homeDirectory = path.join(baseDirectory, 'home');
    await createSessionHome(homeDirectory);
    const createdAt = this.now();
    const session = {
      sessionId: id,
      createdAt,
      lastAccessAt: createdAt,
      baseDirectory,
      homeDirectory,
      displayNumber,
      vncPort: 5900 + displayNumber,
      novncPort: 6100 + displayNumber,
      status: 'active',
      terminalProcesses: new Set(),
      desktopProcess: null,
    };
    this.sessions.set(id, session);
    return session;
  }

  async touch(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return this.getOrCreate(sessionId);
    session.lastAccessAt = this.now();
    return session;
  }

  get(sessionId) {
    return this.sessions.get(sessionId) ?? null;
  }

  trackTerminal(sessionId, child) {
    const session = this.get(sessionId);
    if (!session || !child) return;
    session.terminalProcesses.add(child);
    child.once?.('close', () => session.terminalProcesses.delete(child));
    child.once?.('exit', () => session.terminalProcesses.delete(child));
  }

  async reset(sessionId) {
    const session = this.get(sessionId);
    if (!session) return null;
    for (const child of session.terminalProcesses) {
      child.kill?.('SIGHUP');
    }
    session.terminalProcesses.clear();
    await rm(session.homeDirectory, { recursive: true, force: true });
    await createSessionHome(session.homeDirectory);
    session.lastAccessAt = this.now();
    return session;
  }

  async cleanupExpired(onExpire = async () => {}) {
    const cutoff = this.now() - this.ttlMs;
    const expired = [...this.sessions.values()].filter((session) => session.lastAccessAt < cutoff);
    for (const session of expired) {
      await onExpire(session);
      await this.destroy(session.sessionId);
    }
    return expired.length;
  }

  async destroy(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    for (const child of session.terminalProcesses) {
      child.kill?.('SIGHUP');
    }
    this.displayNumbers.delete(session.displayNumber);
    this.sessions.delete(sessionId);
    await rm(session.baseDirectory, { recursive: true, force: true });
    return true;
  }

  allocateDisplayNumber() {
    for (let display = DEFAULT_DISPLAY_START; display <= DEFAULT_DISPLAY_END; display += 1) {
      if (!this.displayNumbers.has(display)) {
        this.displayNumbers.add(display);
        return display;
      }
    }
    throw new Error('display_pool_exhausted');
  }
}

export const sessionManager = new SessionManager();

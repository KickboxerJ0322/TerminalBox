import { chmod, chown, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_ROOT = '/tmp/terminalbox-sessions';
const DEFAULT_DISPLAY_START = 11;
const DEFAULT_DISPLAY_END = 110;
const STUDENT_UID = 1000;
const STUDENT_GID = 1000;
const SESSION_ROOT_MODE = 0o711;
const SESSION_DIRECTORY_MODE = 0o700;

const INITIAL_PROGRESS = Object.freeze({
  target1: false,
  target2: false,
  target3: false,
  target4: false,
  target5: false,
  target6: false,
  target7: false,
  target8: false,
  target9: false,
});

async function prepareSessionRoot(directory) {
  await mkdir(directory, { recursive: true, mode: SESSION_ROOT_MODE });
  await chmod(directory, SESSION_ROOT_MODE);
}

async function prepareStudentDirectory(directory, mode = SESSION_DIRECTORY_MODE) {
  await mkdir(directory, { recursive: true, mode });
  await chmod(directory, mode);
  try {
    await chown(directory, STUDENT_UID, STUDENT_GID);
  } catch {
    // Some local hosts/filesystems do not support POSIX ownership.
  }
}

async function prepareSessionDirectories(session) {
  await prepareSessionRoot(path.dirname(session.baseDirectory));
  await prepareStudentDirectory(session.baseDirectory);
  await Promise.all([
    prepareStudentDirectory(session.homeDirectory),
    prepareStudentDirectory(session.runtimeDirectory),
    prepareStudentDirectory(session.logDirectory),
    prepareStudentDirectory(session.stateDirectory),
  ]);
}

function initialProgress() {
  return { ...INITIAL_PROGRESS };
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
    const createdAt = this.now();
    const session = {
      sessionId: id,
      createdAt,
      lastAccessAt: createdAt,
      baseDirectory,
      homeDirectory: path.join(baseDirectory, 'home'),
      runtimeDirectory: path.join(baseDirectory, 'run'),
      logDirectory: path.join(baseDirectory, 'logs'),
      stateDirectory: path.join(baseDirectory, 'state'),
      displayNumber,
      vncPort: 5900 + displayNumber,
      novncPort: 6100 + displayNumber,
      status: 'active',
      agentRequestCount: 0,
      progress: initialProgress(),
      completedChallengeIds: new Set(),
      linuxLab: null,
      terminalProcesses: new Set(),
      desktopProcess: null,
      desktopStartPromise: null,
    };
    await prepareSessionDirectories(session);
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
    await Promise.all([
      rm(session.homeDirectory, { recursive: true, force: true }),
      rm(session.runtimeDirectory, { recursive: true, force: true }),
      rm(session.logDirectory, { recursive: true, force: true }),
      rm(session.stateDirectory, { recursive: true, force: true }),
    ]);
    await prepareSessionDirectories(session);
    session.progress = initialProgress();
    session.completedChallengeIds.clear();
    session.linuxLab = null;
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

import Docker from 'dockerode';
import httpProxy from 'http-proxy';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const DESKTOP_READY_TIMEOUT_MS = Number.parseInt(process.env.KALI_DESKTOP_READY_TIMEOUT_MS ?? '120000', 10) || 120_000;

function desktopLogContext(session, process, extra = {}) {
  return JSON.stringify({
    sessionId: session.sessionId,
    displayNumber: session.displayNumber,
    novncPort: session.novncPort,
    process,
    ...extra,
  });
}

function desktopTargetUrl(config, session) {
  const url = new URL(config.kaliGuiUrl);
  url.port = String(session.novncPort);
  if (config.kaliExecMode === 'local') {
    url.hostname = '127.0.0.1';
  }
  return url.origin;
}

function rewriteKaliGuiUrl(request) {
  const originalUrl = request.url;
  request.url = request.url.replace(/^\/kali-gui(?=\/|\?|$)/, '') || '/';
  return () => {
    request.url = originalUrl;
  };
}

function configRootDirectory(session) {
  return path.dirname(session.baseDirectory);
}

async function waitForReady(url) {
  const deadline = Date.now() + DESKTOP_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The VNC stack is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Kali Desktop did not become ready in time');
}

function desktopEnvironment(session) {
  return {
    HOME: session.homeDirectory,
    XDG_CONFIG_HOME: `${session.homeDirectory}/.config`,
    XDG_DATA_HOME: `${session.homeDirectory}/.local/share`,
    XDG_RUNTIME_DIR: session.runtimeDirectory,
    TMPDIR: session.runtimeDirectory,
    USER: 'student',
    LOGNAME: 'student',
    LANG: 'ja_JP.UTF-8',
    LANGUAGE: 'ja_JP:ja',
    LC_ALL: 'ja_JP.UTF-8',
    DISPLAY: `:${session.displayNumber}`,
    KALI_VNC_DISPLAY: String(session.displayNumber),
    KALI_NOVNC_PORT: String(session.novncPort),
    KALI_VNC_GEOMETRY: process.env.KALI_VNC_GEOMETRY ?? '1440x900',
    KALI_VNC_PASSWORD: process.env.KALI_VNC_PASSWORD ?? 'student',
    TBX_SESSION_ID: session.sessionId,
    TBX_SESSION_LOG_DIR: session.logDirectory,
    TBX_DESKTOP_LOG: `${session.logDirectory}/desktop.log`,
  };
}

async function prepareDockerSessionDirectories(container, session) {
  const execution = await container.exec({
    Cmd: ['/bin/sh', '-lc', [
      'mkdir -p "$5" "$6" "$1" "$2" "$3" "$4"',
      'chmod 711 "$5"',
      'chown 1000:1000 "$6" "$1" "$2" "$3" "$4"',
      'chmod 700 "$6" "$1" "$2" "$3" "$4"',
    ].join(' && '), 'sh', session.homeDirectory, session.runtimeDirectory, session.logDirectory, session.stateDirectory, configRootDirectory(session), session.baseDirectory],
    User: 'root',
    AttachStdout: true,
    AttachStderr: true,
  });
  await execution.start({ hijack: true, stdin: false });
}

async function startDockerDesktop(config, session) {
  const container = docker.getContainer(config.kaliContainer);
  const details = await container.inspect();
  if (!details.State.Running) throw new Error('Kali container is not running');

  await prepareDockerSessionDirectories(container, session);
  const env = desktopEnvironment(session);

  const execution = await container.exec({
    Cmd: ['/bin/sh', '-lc', 'exec /usr/local/bin/start-gui >> "$TBX_DESKTOP_LOG" 2>&1 & echo $!'],
    User: 'student',
    WorkingDir: session.homeDirectory,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Env: Object.entries(env).map(([name, value]) => `${name}=${value}`),
  });
  console.log(`Kali Desktop start requested ${desktopLogContext(session, 'start-gui', { mode: 'docker' })}`);
  const stream = await execution.start({ hijack: true, stdin: false, Tty: true });
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output += chunk.toString('utf8'); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  const pid = output.trim().split(/\s+/).pop();
  if (!/^\d+$/.test(pid ?? '')) throw new Error('Could not start Kali Desktop');
  session.desktopProcess = { type: 'docker', pid };
  console.log(`Kali Desktop process started ${desktopLogContext(session, 'start-gui', { mode: 'docker', pid })}`);
}

async function startLocalDesktop(session) {
  await mkdir(session.logDirectory, { recursive: true, mode: 0o700 });
  const env = desktopEnvironment(session);
  const child = spawn('/bin/sh', ['-lc', 'exec /usr/local/bin/start-gui >> "$TBX_DESKTOP_LOG" 2>&1'], {
    cwd: session.homeDirectory,
    uid: 1000,
    gid: 1000,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'ignore',
  });
  console.log(`Kali Desktop start requested ${desktopLogContext(session, 'start-gui', { mode: 'local', pid: child.pid })}`);
  child.unref();
  session.desktopProcess = { type: 'local', child };
  child.once('exit', (exitCode) => {
    console.warn(`Kali Desktop process exited ${desktopLogContext(session, 'start-gui', { mode: 'local', exitCode })}`);
    if (session.desktopProcess?.child === child) session.desktopProcess = null;
  });
}

export function createDesktopManager(config) {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 3_600_000,
    timeout: 3_600_000,
  });

  proxy.on('error', (error, _request, responseOrSocket) => {
    console.error(`Kali Desktop proxy failed: ${error.message}`);
    if ('writeHead' in responseOrSocket) {
      if (!responseOrSocket.headersSent) responseOrSocket.writeHead(502, { 'content-type': 'application/json' });
      responseOrSocket.end(JSON.stringify({ error: 'Kali Desktop is unavailable' }));
      return;
    }
    responseOrSocket.destroy();
  });

  async function ensureStarted(session) {
    if (session.desktopStartPromise) return session.desktopStartPromise;

    session.desktopStartPromise = (async () => {
      try {
        if (session.desktopProcess) {
          try {
            await waitForReady(desktopTargetUrl(config, session));
            return;
          } catch {
            await stop(session);
          }
        }
        if (config.kaliExecMode === 'local') await startLocalDesktop(session);
        else await startDockerDesktop(config, session);
        await waitForReady(desktopTargetUrl(config, session));
        console.log(`Kali Desktop ready ${desktopLogContext(session, 'noVNC')}`);
      } catch (error) {
        console.error(`Kali Desktop start failed ${desktopLogContext(session, 'noVNC', { error: error.message })}`);
        throw error;
      } finally {
        session.desktopStartPromise = null;
      }
    })();

    return session.desktopStartPromise;
  }

  async function stop(session) {
    session.desktopStartPromise = null;
    const process = session.desktopProcess;
    session.desktopProcess = null;
    if (!process) return;
    if (process.type === 'local') {
      process.child.kill('SIGTERM');
      return;
    }
    const container = docker.getContainer(config.kaliContainer);
    const execution = await container.exec({
      Cmd: ['/bin/sh', '-lc', `kill ${process.pid} >/dev/null 2>&1 || true`],
      User: 'student',
      AttachStdout: true,
      AttachStderr: true,
    });
    await execution.start({ hijack: true, stdin: false });
  }

  async function proxyHttp(request, response, session) {
    await ensureStarted(session);
    const restoreUrl = rewriteKaliGuiUrl(request);
    proxy.web(request, response, { target: desktopTargetUrl(config, session) });
    response.once('finish', restoreUrl);
    response.once('close', restoreUrl);
  }

  async function proxyWebSocket(request, socket, head, session) {
    await ensureStarted(session);
    const restoreUrl = rewriteKaliGuiUrl(request);
    proxy.ws(request, socket, head, { target: desktopTargetUrl(config, session) });
    socket.once('close', restoreUrl);
  }

  return { ensureStarted, proxyHttp, proxyWebSocket, stop };
}

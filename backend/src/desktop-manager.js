import Docker from 'dockerode';
import httpProxy from 'http-proxy';
import { spawn } from 'node:child_process';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const DESKTOP_READY_TIMEOUT_MS = 20_000;

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

async function startDockerDesktop(config, session) {
  const container = docker.getContainer(config.kaliContainer);
  const details = await container.inspect();
  if (!details.State.Running) throw new Error('Kali container is not running');

  const prepare = await container.exec({
    Cmd: ['/bin/mkdir', '-p', session.homeDirectory],
    User: 'student',
    AttachStdout: true,
    AttachStderr: true,
  });
  await prepare.start({ hijack: true, stdin: false });

  const execution = await container.exec({
    Cmd: ['/bin/sh', '-lc', `/usr/local/bin/start-gui >/tmp/terminalbox-gui-${session.sessionId}.log 2>&1 & echo $!`],
    User: 'student',
    WorkingDir: session.homeDirectory,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Env: [
      `HOME=${session.homeDirectory}`,
      `XDG_CONFIG_HOME=${session.homeDirectory}/.config`,
      `XDG_DATA_HOME=${session.homeDirectory}/.local/share`,
      'USER=student',
      'LOGNAME=student',
      'LANG=ja_JP.UTF-8',
      `KALI_VNC_DISPLAY=${session.displayNumber}`,
      `KALI_NOVNC_PORT=${session.novncPort}`,
      `KALI_VNC_GEOMETRY=${process.env.KALI_VNC_GEOMETRY ?? '1440x900'}`,
      `KALI_VNC_PASSWORD=${process.env.KALI_VNC_PASSWORD ?? 'student'}`,
    ],
  });
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
}

function startLocalDesktop(session) {
  const child = spawn('su', ['-s', '/bin/sh', 'student', '-c', 'exec /usr/local/bin/start-gui'], {
    cwd: session.homeDirectory,
    env: {
      ...process.env,
      HOME: session.homeDirectory,
      XDG_CONFIG_HOME: `${session.homeDirectory}/.config`,
      XDG_DATA_HOME: `${session.homeDirectory}/.local/share`,
      USER: 'student',
      LOGNAME: 'student',
      LANG: 'ja_JP.UTF-8',
      KALI_VNC_DISPLAY: String(session.displayNumber),
      KALI_NOVNC_PORT: String(session.novncPort),
      KALI_VNC_GEOMETRY: process.env.KALI_VNC_GEOMETRY ?? '1440x900',
      KALI_VNC_PASSWORD: process.env.KALI_VNC_PASSWORD ?? 'student',
    },
    stdio: 'ignore',
  });
  child.unref();
  session.desktopProcess = { type: 'local', child };
  child.once('exit', () => {
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
    if (session.desktopProcess) {
      try {
        await waitForReady(desktopTargetUrl(config, session));
        return;
      } catch {
        await stop(session);
      }
    }
    if (config.kaliExecMode === 'local') startLocalDesktop(session);
    else await startDockerDesktop(config, session);
    await waitForReady(desktopTargetUrl(config, session));
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

  async function stop(session) {
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

  return { ensureStarted, proxyHttp, proxyWebSocket, stop };
}

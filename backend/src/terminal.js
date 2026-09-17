import { spawn } from 'node:child_process';
import { isValidSessionId, readSessionCookie } from './session/session-cookie.js';
import { sessionManager } from './session/session-manager.js';

function isAuthorized(request, expectedToken) {
  if (!expectedToken) return true;
  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.searchParams.get('token') === expectedToken;
}

function attachLocalTerminal(socket, session) {
  let child;
  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };

  const homeDirectory = session.homeDirectory;
  const sessionEnv = {
    HOME: homeDirectory,
    XDG_CONFIG_HOME: `${homeDirectory}/.config`,
    XDG_DATA_HOME: `${homeDirectory}/.local/share`,
    XDG_RUNTIME_DIR: session.runtimeDirectory,
    TMPDIR: session.runtimeDirectory,
    USER: 'student',
    LOGNAME: 'student',
    SHELL: '/bin/bash',
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERMINALBOX_SESSION_ID: session.sessionId,
    DISPLAY: `:${session.displayNumber}`,
    LANG: 'ja_JP.UTF-8',
    LANGUAGE: 'ja_JP:ja',
    LC_ALL: 'ja_JP.UTF-8',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  };
  try {
    child = spawn(
      '/usr/bin/script',
      ['-qfec', 'exec /bin/bash --noprofile --rcfile /etc/terminalbox.bashrc -i', '/dev/null'],
      {
        cwd: homeDirectory,
        uid: 1000,
        gid: 1000,
        env: sessionEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    sessionManager.trackTerminal(session.sessionId, child);
    child.stdout.on('data', (chunk) => send('output', { data: chunk.toString('utf8') }));
    child.stderr.on('data', (chunk) => send('output', { data: chunk.toString('utf8') }));
    child.on('error', (error) => send('error', { message: `Terminal connection failed: ${error.message}` }));
    child.on('exit', () => {
      send('exit');
      if (socket.readyState === 1) socket.close(1012, 'Terminal session ended');
    });
    send('ready');
  } catch (error) {
    send('error', { message: `Terminal connection failed: ${error.message}` });
    socket.close(1011, 'Terminal unavailable');
  }

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'input' && typeof message.data === 'string' && child?.stdin.writable) {
        child.stdin.write(message.data.slice(0, 8192));
      }
    } catch {
      send('error', { message: 'Invalid terminal message' });
    }
  });
  socket.on('close', () => {
    child?.stdin.end();
    child?.kill('SIGHUP');
  });
}

function requestSessionId(request, config) {
  const proxiedSessionId = request.headers['x-terminalbox-session'];
  if (config.serviceRole === 'lab' && isValidSessionId(proxiedSessionId)) {
    return proxiedSessionId;
  }
  return readSessionCookie(request);
}

export function attachTerminalSocket(socket, request, config) {
  if (!isAuthorized(request, config.wsAuthToken)) {
    socket.close(1008, 'Unauthorized');
    return;
  }

  const startWithSession = async () => {
    const session = await sessionManager.getOrCreate(requestSessionId(request, config));
    attachLocalTerminal(socket, session);
  };

  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };
  startWithSession().catch((error) => {
    send('error', { message: `Terminal connection failed: ${error.message}` });
    socket.close(1011, 'Terminal unavailable');
  });
}

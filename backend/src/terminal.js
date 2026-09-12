import Docker from 'dockerode';
import { spawn } from 'node:child_process';
import { readSessionCookie } from './session/session-cookie.js';
import { sessionManager } from './session/session-manager.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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

async function ensureDockerHome(container, homeDirectory) {
  const execution = await container.exec({
    Cmd: ['/bin/mkdir', '-p', homeDirectory],
    User: 'student',
    AttachStdout: true,
    AttachStderr: true,
  });
  await execution.start({ hijack: true, stdin: false });
}

async function ensureDockerSessionDirectories(container, session) {
  const execution = await container.exec({
    Cmd: ['/bin/sh', '-lc', [
      'mkdir -p "$1" "$2" "$3" "$4"',
      'chown 1000:1000 "$1" "$2" "$3" "$4"',
      'chmod 700 "$1" "$2" "$3" "$4"',
    ].join(' && '), 'sh', session.homeDirectory, session.runtimeDirectory, session.logDirectory, session.stateDirectory],
    User: 'root',
    AttachStdout: true,
    AttachStderr: true,
  });
  await execution.start({ hijack: true, stdin: false });
}

export function attachTerminalSocket(socket, request, config) {
  if (!isAuthorized(request, config.wsAuthToken)) {
    socket.close(1008, 'Unauthorized');
    return;
  }

  const startWithSession = async () => {
    const session = await sessionManager.getOrCreate(readSessionCookie(request));
    if (config.kaliExecMode === 'local') {
      attachLocalTerminal(socket, session);
      return;
    }
    await startDockerTerminal(session);
  };

  let dockerStream;
  let exec;

  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };

  const startDockerTerminal = async (session) => {
    try {
      const container = docker.getContainer(config.kaliContainer);
      const details = await container.inspect();
      if (!details.State.Running) throw new Error('Kali container is not running');

      const homeDirectory = session.homeDirectory;
      await ensureDockerHome(container, homeDirectory);
      await ensureDockerSessionDirectories(container, session);
      exec = await container.exec({
        Cmd: ['/bin/bash', '--noprofile', '--rcfile', '/etc/terminalbox.bashrc', '-i'],
        User: 'student',
        WorkingDir: homeDirectory,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: [
          `HOME=${homeDirectory}`,
          `XDG_CONFIG_HOME=${homeDirectory}/.config`,
          `XDG_DATA_HOME=${homeDirectory}/.local/share`,
          `XDG_RUNTIME_DIR=${session.runtimeDirectory}`,
          `TMPDIR=${session.runtimeDirectory}`,
          'USER=student',
          'LOGNAME=student',
          `DISPLAY=:${session.displayNumber}`,
          'TERM=xterm-256color',
          'COLORTERM=truecolor',
        ],
      });
      dockerStream = await exec.start({ hijack: true, stdin: true, Tty: true });
      dockerStream.on('data', (chunk) => send('output', { data: chunk.toString('utf8') }));
      dockerStream.on('end', () => send('exit'));
      dockerStream.on('error', (error) => send('error', { message: error.message }));
      send('ready');
    } catch (error) {
      send('error', { message: `Terminal connection failed: ${error.message}` });
      socket.close(1011, 'Terminal unavailable');
    }
  };

  socket.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'input' && typeof message.data === 'string' && dockerStream) {
        dockerStream.write(message.data.slice(0, 8192));
      }
      if (message.type === 'resize' && exec) {
        const cols = Math.min(300, Math.max(20, Number(message.cols) || 80));
        const rows = Math.min(120, Math.max(5, Number(message.rows) || 24));
        await exec.resize({ w: cols, h: rows });
      }
    } catch {
      send('error', { message: 'Invalid terminal message' });
    }
  });

  socket.on('close', () => dockerStream?.destroy());
  startWithSession().catch((error) => {
    send('error', { message: `Terminal connection failed: ${error.message}` });
    socket.close(1011, 'Terminal unavailable');
  });
}

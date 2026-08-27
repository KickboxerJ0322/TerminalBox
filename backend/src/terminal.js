import Docker from 'dockerode';
import { spawn } from 'node:child_process';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function isAuthorized(request, expectedToken) {
  if (!expectedToken) return true;
  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.searchParams.get('token') === expectedToken;
}

function attachLocalTerminal(socket) {
  let child;
  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };

  try {
    child = spawn(
      '/usr/bin/script',
      ['-qfec', 'exec /bin/bash --noprofile --rcfile /etc/terminalbox.bashrc -i', '/dev/null'],
      {
        cwd: '/home/student',
        uid: 1000,
        gid: 1000,
        env: {
          HOME: '/home/student',
          USER: 'student',
          LOGNAME: 'student',
          SHELL: '/bin/bash',
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          DISPLAY: ':1',
          LANG: 'ja_JP.UTF-8',
          LANGUAGE: 'ja_JP:ja',
          LC_ALL: 'ja_JP.UTF-8',
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
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

export function attachTerminalSocket(socket, request, config) {
  if (!isAuthorized(request, config.wsAuthToken)) {
    socket.close(1008, 'Unauthorized');
    return;
  }

  if (config.kaliExecMode === 'local') {
    attachLocalTerminal(socket);
    return;
  }

  let dockerStream;
  let exec;

  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };

  const start = async () => {
    try {
      const container = docker.getContainer(config.kaliContainer);
      const details = await container.inspect();
      if (!details.State.Running) throw new Error('Kali container is not running');

      exec = await container.exec({
        Cmd: ['/bin/bash', '--noprofile', '--rcfile', '/etc/terminalbox.bashrc', '-i'],
        User: 'student',
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: ['TERM=xterm-256color', 'COLORTERM=truecolor'],
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
  start();
}

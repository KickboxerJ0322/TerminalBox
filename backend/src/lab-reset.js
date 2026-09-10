import Docker from 'dockerode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const execFileAsync = promisify(execFile);

export const HOME_RESET_SCRIPT = String.raw`
set -eu
home="${'${'}TBX_SESSION_HOME:-/home/student}"
desktop="$home/Desktop"

mkdir -p "$desktop"
find "$desktop" -mindepth 1 -maxdepth 1 ! -name TerminalBox.desktop -exec rm -rf -- {} +
find "$home" -mindepth 1 -maxdepth 1 \
  ! -name Desktop \
  ! -name .cache \
  ! -name .config \
  ! -name .local \
  ! -name .mozilla \
  ! -name .vnc \
  ! -name .Xauthority \
  -exec rm -rf -- {} +
cp /usr/local/share/applications/TerminalBox.desktop "$desktop/TerminalBox.desktop"
chmod 0755 "$desktop/TerminalBox.desktop"
mkdir -p "$home/Downloads"
HOME="$home" /usr/local/bin/seed-training-home
`;

async function collectExecOutput(stream) {
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      output = `${output}${chunk.toString('utf8')}`.slice(-4000);
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return output.trim();
}

async function resetKaliHome(containerName, session) {
  const container = docker.getContainer(containerName);
  const details = await container.inspect();
  if (!details.State.Running) throw new Error('Kali container is not running');

  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', HOME_RESET_SCRIPT],
    User: 'student',
    Env: [`TBX_SESSION_HOME=${session.homeDirectory}`],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false, Tty: true });
  const output = await collectExecOutput(stream);
  const result = await exec.inspect();
  if (result.ExitCode !== 0) {
    throw new Error(`Kali home reset failed (${result.ExitCode}): ${output || 'no output'}`);
  }
}

async function resetLocalKaliHome(session) {
  await execFileAsync('/bin/sh', ['-c', HOME_RESET_SCRIPT], {
    uid: 1000,
    gid: 1000,
    env: { ...process.env, TBX_SESSION_HOME: session.homeDirectory },
    timeout: 15_000,
    maxBuffer: 4096,
  });
}

async function resetTarget(url, session) {
  const response = await fetch(`${url}/api/lab/reset`, {
    method: 'POST',
    headers: { 'x-terminalbox-session': session.sessionId },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

export async function resetLab(config, session) {
  const [targets] = await Promise.all([
    Promise.all(config.targetUrls.map((url) => resetTarget(url, session))),
    config.kaliExecMode === 'local'
      ? resetLocalKaliHome(session)
      : resetKaliHome(config.kaliContainer, session),
  ]);
  return { status: 'reset', sessionId: session.sessionId, targets: targets.length, kaliHome: true };
}

import Docker from 'dockerode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const execFileAsync = promisify(execFile);

const HOME_RESET_SCRIPT = String.raw`
set -eu
home=/home/student
desktop="$home/Desktop"

# Stop interactive training shells first so they cannot rewrite old history.
pkill -u "$(id -u)" -x bash 2>/dev/null || true

mkdir -p "$desktop"
find "$desktop" -mindepth 1 -maxdepth 1 ! -name TerminalBox.desktop -exec rm -rf -- {} +
find "$home" -mindepth 1 -maxdepth 1 \
  ! -name Desktop \
  ! -name .cache \
  ! -name .config \
  ! -name .local \
  ! -name .mozilla \
  ! -name .vnc \
  -exec rm -rf -- {} +
cp /usr/local/share/applications/TerminalBox.desktop "$desktop/TerminalBox.desktop"
chmod 0755 "$desktop/TerminalBox.desktop"
mkdir -p "$home/Downloads"
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

async function resetKaliHome(containerName) {
  const container = docker.getContainer(containerName);
  const details = await container.inspect();
  if (!details.State.Running) throw new Error('Kali container is not running');

  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', HOME_RESET_SCRIPT],
    User: 'student',
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

async function resetLocalKaliHome() {
  await execFileAsync('/bin/sh', ['-c', HOME_RESET_SCRIPT], {
    uid: 1000,
    gid: 1000,
    timeout: 15_000,
    maxBuffer: 4096,
  });
}

async function resetTarget(url) {
  const response = await fetch(`${url}/api/lab/reset`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

export async function resetLab(config) {
  const [targets] = await Promise.all([
    Promise.all(config.targetUrls.map(resetTarget)),
    config.kaliExecMode === 'local'
      ? resetLocalKaliHome()
      : resetKaliHome(config.kaliContainer),
  ]);
  return { status: 'reset', targets: targets.length, kaliHome: true };
}

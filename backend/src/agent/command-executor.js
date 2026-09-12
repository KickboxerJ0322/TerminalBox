import { spawn } from 'node:child_process';
import path from 'node:path';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const EXECUTOR_PATH = '/usr/local/bin/terminalbox-agent-executor';
const OUTPUT_LIMIT = 70_000;

function encodePlan(plan) {
  return Buffer.from(JSON.stringify(plan), 'utf8').toString('base64url');
}

function parseRunnerOutput(raw, command, startedAt) {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  let payload;
  try {
    payload = JSON.parse(normalized);
  } catch {
    throw new Error('Agent executor returned an invalid response');
  }
  if (payload.error) throw new Error(`Agent executor rejected the plan: ${payload.error}`);
  return {
    command,
    stdout: String(payload.stdout ?? '').slice(0, 65_536),
    stderr: String(payload.stderr ?? '').slice(0, 65_536),
    exitCode: Number.isInteger(payload.exitCode) ? payload.exitCode : 125,
    durationMs: Number.isFinite(payload.durationMs) ? payload.durationMs : Date.now() - startedAt,
    truncated: String(payload.stdout ?? '').length > 65_536 || String(payload.stderr ?? '').length > 65_536,
  };
}

function executeLocal(plan, command, timeoutMs, session) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const homeDirectory = session?.homeDirectory ?? '/home/student';
    const child = spawn(EXECUTOR_PATH, [encodePlan(plan)], {
      cwd: homeDirectory,
      uid: 1000,
      gid: 1000,
      env: {
        HOME: homeDirectory, XDG_CONFIG_HOME: `${homeDirectory}/.config`, XDG_DATA_HOME: `${homeDirectory}/.local/share`,
        USER: 'student', LOGNAME: 'student', LANG: 'ja_JP.UTF-8', PAGER: 'cat',
        GIT_PAGER: 'cat', SYSTEMD_PAGER: 'cat', GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 500).unref();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString('utf8')).slice(-OUTPUT_LIMIT); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-OUTPUT_LIMIT); });
    child.on('error', reject);
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ command, stdout: '', stderr: 'Agent command timed out.', exitCode: 124, durationMs: Date.now() - startedAt, timedOut: true });
        return;
      }
      if (stderr.trim() && !stdout.trim()) reject(new Error(stderr.trim().slice(0, 500)));
      else resolve(parseRunnerOutput(stdout, command, startedAt));
    });
  });
}

async function ensureDockerSessionDirectories(container, session) {
  const execution = await container.exec({
    Cmd: ['/bin/sh', '-lc', [
      'mkdir -p "$5" "$6" "$1" "$2" "$3" "$4"',
      'chmod 711 "$5"',
      'chown 1000:1000 "$6" "$1" "$2" "$3" "$4"',
      'chmod 700 "$6" "$1" "$2" "$3" "$4"',
    ].join(' && '), 'sh', session.homeDirectory, session.runtimeDirectory, session.logDirectory, session.stateDirectory, path.dirname(session.baseDirectory), session.baseDirectory],
    User: 'root',
    AttachStdout: true,
    AttachStderr: true,
  });
  await execution.start({ hijack: true, stdin: false });
}

async function executeDocker(plan, command, config, timeoutMs, session) {
  const startedAt = Date.now();
  const container = docker.getContainer(config.kaliContainer);
  const details = await container.inspect();
  if (!details.State.Running) throw new Error('Kali container is not running');
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const homeDirectory = session?.homeDirectory ?? '/home/student';
  if (session) await ensureDockerSessionDirectories(container, session);
  const execution = await container.exec({
    Cmd: ['/usr/bin/timeout', '--signal=KILL', `${timeoutSeconds}s`, EXECUTOR_PATH, encodePlan(plan)],
    User: 'student',
    WorkingDir: homeDirectory,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Env: [
      `HOME=${homeDirectory}`, `XDG_CONFIG_HOME=${homeDirectory}/.config`, `XDG_DATA_HOME=${homeDirectory}/.local/share`,
      'USER=student', 'LOGNAME=student', 'LANG=ja_JP.UTF-8', 'PAGER=cat', 'GIT_PAGER=cat',
      'SYSTEMD_PAGER=cat', 'GIT_CONFIG_NOSYSTEM=1', 'GIT_CONFIG_GLOBAL=/dev/null',
      'GIT_OPTIONAL_LOCKS=0', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    ],
  });
  const stream = await execution.start({ hijack: true, stdin: false, Tty: true });
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output = (output + chunk.toString('utf8')).slice(-OUTPUT_LIMIT); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  const inspection = await execution.inspect();
  if (inspection.ExitCode === 124 || inspection.ExitCode === 137) {
    return { command, stdout: '', stderr: 'Agent command timed out.', exitCode: 124, durationMs: Date.now() - startedAt, timedOut: true };
  }
  return parseRunnerOutput(output, command, startedAt);
}

export function executeAgentPlan(plan, command, config, timeoutMs = 10_000, session = null) {
  return config.kaliExecMode === 'local'
    ? executeLocal(plan, command, timeoutMs, session)
    : executeDocker(plan, command, config, timeoutMs, session);
}

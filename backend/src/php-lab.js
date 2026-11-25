import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const LESSON_PATH = fileURLToPath(new URL('../../php-target/lesson.php', import.meta.url));
export const PHP_CHOICES = { understand: 'web-user', defend: 'business-input' };

export function createPhpState() {
  return { epoch: randomBytes(16).toString('hex'), flag: `TBX{php_${randomBytes(1).toString('hex')}}`, identityObserved: false, dataRead: false, secureBlocked: false, completed: [] };
}

export function phpState(session) {
  return session.phpLab ??= createPhpState();
}

export function phpSummary(session) {
  const state = phpState(session);
  return { epoch: state.epoch, identityObserved: state.identityObserved, dataRead: state.dataRead, secureBlocked: state.secureBlocked, completed: [...state.completed], cleared: ['attack', 'understand', 'defend'].every(id => state.completed.includes(id)) };
}

export function checkPhpAnswer(session, stage, answer) {
  const state = phpState(session);
  const correct = stage === 'attack'
    ? state.identityObserved && state.dataRead && answer === state.flag
    : stage === 'understand'
      ? state.completed.includes('attack') && answer === PHP_CHOICES.understand
      : stage === 'defend' && state.completed.includes('understand') && state.secureBlocked && answer === PHP_CHOICES.defend;
  if (correct && !state.completed.includes(stage)) state.completed.push(stage);
  return { correct: Boolean(correct), ...phpSummary(session) };
}

export async function runPhpLesson(mode, topic) {
  // Drop supplementary groups and prohibit privilege gain before starting PHP.
  // No inherited API keys, internal token, or session environment is passed.
  const child = execFileAsync('/usr/bin/setpriv', [
    '--reuid=1001', '--regid=1001', '--clear-groups', '--no-new-privs',
    '/usr/bin/php', '-n', '-d', 'memory_limit=32M', '-d', 'max_execution_time=2',
    '-d', 'display_errors=0', '-d', 'log_errors=0', '-d', 'allow_url_fopen=0',
    '-d', 'disable_functions=exec,system,shell_exec,passthru,popen,pcntl_exec,mail,fsockopen,pfsockopen,stream_socket_client,stream_socket_server',
    LESSON_PATH,
  ], { timeout: 3000, maxBuffer: 16_384, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }, cwd: '/' });
  child.child.stdin.on('error', () => { /* execFile reports startup/exit failures. */ });
  child.child.stdin.end(JSON.stringify({ mode, topic }));
  const { stdout } = await child;
  const result = JSON.parse(stdout);
  if (![200, 400, 500].includes(result.status) || typeof result.output !== 'string' || !/^PHP \d/.test(result.runtime ?? '')) throw new Error('PHP教材の実行結果が不正です。');
  return result;
}

export function recordPhpResult(session, state, mode, topic, result) {
  // A response that arrives after RESET must not restore the old progress.
  if (session.phpLab !== state) return null;
  if (mode === 'vulnerable' && result.status === 200) {
    state.identityObserved ||= result.identityObserved === true;
    state.dataRead ||= result.dataRead === true;
  }
  if (mode === 'secure' && topic === 'summary; cat data/customers.csv' && result.blocked === true) state.secureBlocked = true;
  return { ...result, ...(mode === 'vulnerable' && result.dataRead && state.identityObserved ? { flag: state.flag } : {}) };
}

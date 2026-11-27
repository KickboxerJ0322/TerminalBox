import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const LESSON_PATH = fileURLToPath(new URL('../../php-target/lesson.php', import.meta.url));
export const PHP_SIMULATION_NOTICE = 'PHP2Shellのメモリ情報漏えいを概念的に再現した模擬演習であり、実際の脆弱性や攻撃手順の再現ではない';
export const PHP_CHOICES = { understand: 'stale-reference', defend: 'update-php' };
export const PHP_SIMULATION_CVE = 'CVE-2026-109618';
const newMemory = mode => ({ phase: 'reused', slot: 'SLOT-A（架空）', staleReference: mode === 'vulnerable', payload: '', events: [
  '① リクエストAの領域確保は、教材側で準備済みです。',
  '② 異常終了と領域解放も準備済みです。実際のOOMやクラッシュは起こしません。',
  mode === 'vulnerable' ? '修正前モデル：解放済み領域への古い参照が残っています。' : '修正後モデル：古い参照は消去されています。',
  '③ 別の正規利用者の処理が同じ場所を再利用し、架空の顧客情報を置いた状態を教材が準備しています。攻撃者の操作ではありません。',
] });

export function createPhpState() {
  return { epoch: randomBytes(16).toString('hex'), flag: `TBX{php_${randomBytes(1).toString('hex')}}`, readyModelVersion: 2, normalViewed: false, dataRead: false, secureBlocked: false, completed: [], loginPassword: randomBytes(9).toString('base64url'), auth: {}, loginAttempts: [], memory: { vulnerable: newMemory('vulnerable'), secure: newMemory('secure') } };
}

export function phpState(session) {
  // Reset obsolete command-dispatch lessons when a session survives a code reload.
  if (session.phpLab?.readyModelVersion !== 2) session.phpLab = createPhpState();
  return session.phpLab;
}

export function phpSummary(session) {
  const state = phpState(session);
  const memory = Object.fromEntries(Object.entries(state.memory).map(([mode, value]) => [mode, { phase: value.phase, slot: value.slot, staleReference: value.staleReference, events: [...value.events] }]));
  return { epoch: state.epoch, simulation: true, cve: PHP_SIMULATION_CVE, notice: PHP_SIMULATION_NOTICE, normalViewed: state.normalViewed, dataRead: state.dataRead, secureBlocked: state.secureBlocked, completed: [...state.completed], cleared: ['attack', 'understand', 'defend'].every(id => state.completed.includes(id)), login: { id: 'phpstudent', password: state.loginPassword }, memory };
}

export function checkPhpAnswer(session, stage, answer) {
  const state = phpState(session);
  const correct = stage === 'attack'
    ? state.dataRead && answer === state.flag
    : stage === 'understand'
      ? state.completed.includes('attack') && answer === PHP_CHOICES.understand
      : stage === 'defend' && state.completed.includes('understand') && state.secureBlocked && answer === PHP_CHOICES.defend;
  if (correct && !state.completed.includes(stage)) state.completed.push(stage);
  return { correct: Boolean(correct), ...phpSummary(session) };
}

// Real PHP is used only for the ordinary authenticated fixture read.
// The memory demonstration below is a JavaScript state machine, not an exploit.
export async function runPhpLesson() {
  const child = execFileAsync('/usr/bin/setpriv', [
    '--reuid=1001', '--regid=1001', '--clear-groups', '--no-new-privs',
    '/usr/bin/php', '-n', '-d', 'memory_limit=32M', '-d', 'max_execution_time=2',
    '-d', 'display_errors=0', '-d', 'log_errors=0', '-d', 'allow_url_fopen=0',
    '-d', 'disable_functions=exec,system,shell_exec,passthru,popen,proc_open,pcntl_exec,mail,fsockopen,pfsockopen,stream_socket_client,stream_socket_server',
    LESSON_PATH,
  ], { timeout: 3000, maxBuffer: 16_384, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }, cwd: '/' });
  child.child.stdin.on('error', () => { /* execFile reports startup/exit failures. */ });
  child.child.stdin.end(JSON.stringify({ action: 'customers' }));
  const { stdout } = await child;
  const result = JSON.parse(stdout);
  if (result.status !== 200 || typeof result.output !== 'string' || !/^PHP \d/.test(result.runtime ?? '')) throw new Error('PHP教材の実行結果が不正です。');
  return result;
}

export async function simulatePhpMemory(session, mode, step, loadCustomers = runPhpLesson) {
  const info = { simulation: true, cve: PHP_SIMULATION_CVE, notice: PHP_SIMULATION_NOTICE };
  if (!['vulnerable', 'secure'].includes(mode) || step !== 'inspect') {
    return { status: 400, ...info, error: '①〜③は教材側で準備済みです。step=inspectだけを送信してください。' };
  }
  const state = phpState(session);
  const model = state.memory[mode];
  let memoryFragment;
  let flag;
  let blocked = false;
  if (model.staleReference) {
    // Lazy loading of the common fixture backs the pre-populated conceptual slot.
    // It is automatic setup, not a request asking an attacker to place data.
    if (!model.payload) {
      const fixture = await loadCustomers();
      if (session.phpLab !== state || state.memory[mode] !== model) return { status: 409, ...info, error: '演習が初期化されました。やり直してください。' };
      if (fixture.status !== 200 || typeof fixture.output !== 'string' || !fixture.output.startsWith('customer_id,name,birth_date,email')) throw new Error('教材データを読み取れません。');
      model.payload = fixture.output;
    }
    state.dataRead = true;
    memoryFragment = `[架空のメモリ断片 / ${model.slot}]\n${model.payload}`;
    flag = state.flag;
  } else {
    // Do not read or return the fixture on the protected inspection path.
    state.secureBlocked = true;
    blocked = true;
  }
  if (model.phase !== 'inspected') model.events.push(blocked ? '④ 古い参照がないため、顧客情報は返りません。' : '④ 未ログインの観察者へ顧客情報が漏れる影響を模擬しました。');
  model.phase = 'inspected';
  return { status: 200, ...info, mode, step, phase: model.phase, slot: model.slot, staleReference: model.staleReference, events: [...model.events], blocked, ...(memoryFragment ? { memoryFragment, flag } : {}) };
}

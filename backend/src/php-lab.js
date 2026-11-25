import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const LESSON_PATH = fileURLToPath(new URL('../../php-target/lesson.php', import.meta.url));
export const PHP_SIMULATION_NOTICE = 'PHP2Shellのメモリ情報漏えいを概念的に再現した模擬演習であり、実際の脆弱性や攻撃手順の再現ではない';
export const PHP_CHOICES = { understand: 'stale-reference', defend: 'update-php' };
const newMemory = () => ({ phase: 'idle', slot: 'SLOT-A（架空）', staleReference: false, payload: '', events: [] });

export function createPhpState() {
  return { epoch: randomBytes(16).toString('hex'), flag: `TBX{php_${randomBytes(1).toString('hex')}}`, normalViewed: false, dataRead: false, secureBlocked: false, completed: [], loginPassword: randomBytes(9).toString('base64url'), auth: {}, loginAttempts: [], memory: { vulnerable: newMemory(), secure: newMemory() } };
}

export function phpState(session) {
  // Reset obsolete command-dispatch lessons when a session survives a code reload.
  if (!session.phpLab?.memory) session.phpLab = createPhpState();
  return session.phpLab;
}

export function phpSummary(session) {
  const state = phpState(session);
  const memory = Object.fromEntries(Object.entries(state.memory).map(([mode, value]) => [mode, { phase: value.phase, slot: value.slot, staleReference: value.staleReference, events: [...value.events] }]));
  return { epoch: state.epoch, simulation: true, notice: PHP_SIMULATION_NOTICE, normalViewed: state.normalViewed, dataRead: state.dataRead, secureBlocked: state.secureBlocked, completed: [...state.completed], cleared: ['attack', 'understand', 'defend'].every(id => state.completed.includes(id)), login: { id: 'phpstudent', password: state.loginPassword }, memory };
}

export function checkPhpAnswer(session, stage, answer) {
  const state = phpState(session);
  const correct = stage === 'attack'
    ? state.normalViewed && state.dataRead && answer === state.flag
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
  if (!['vulnerable', 'secure'].includes(mode) || !['allocate', 'abort', 'reuse', 'inspect'].includes(step)) {
    return { status: 400, simulation: true, error: '教材用の4段階だけを指定してください。', notice: PHP_SIMULATION_NOTICE };
  }
  const state = phpState(session);
  if (!state.normalViewed) return { status: 409, simulation: true, error: '先にTargetへID・パスワードでログインし、通常の顧客一覧を確認してください。', notice: PHP_SIMULATION_NOTICE };
  if (step === 'allocate') state.memory[mode] = newMemory();
  const model = state.memory[mode];
  const expected = { allocate: 'idle', abort: 'allocated', reuse: 'released', inspect: 'reused' };
  if (model.phase !== expected[step]) return { status: 409, simulation: true, error: '確保 → 模擬異常終了・解放 → 再利用 → 参照確認の順で進めてください。', notice: PHP_SIMULATION_NOTICE };
  let memoryFragment;
  let flag;
  let blocked = false;
  if (step === 'allocate') {
    model.phase = 'allocated';
    model.events.push('① リクエストA：架空のSLOT-Aを確保し、参照を登録。');
  } else if (step === 'abort') {
    model.phase = 'released';
    model.staleReference = mode === 'vulnerable';
    model.events.push('② リクエストAの異常終了を模擬し、SLOT-Aを解放。実際のメモリ不足やクラッシュは起こしません。');
    model.events.push(mode === 'vulnerable' ? '修正前モデル：解放した場所への古い参照が残っています。' : '修正後モデル：古い参照も消去しました。');
  } else if (step === 'reuse') {
    const fixture = await loadCustomers();
    if (session.phpLab !== state || state.memory[mode] !== model) return { status: 409, simulation: true, error: '演習が初期化されました。やり直してください。', notice: PHP_SIMULATION_NOTICE };
    if (fixture.status !== 200 || typeof fixture.output !== 'string' || !fixture.output.startsWith('customer_id,name,birth_date,email')) throw new Error('教材データを読み取れません。');
    model.payload = fixture.output;
    model.phase = 'reused';
    model.events.push('③ 別のリクエストBが同じ架空の場所を再利用した、という設定で共通の架空顧客データを配置。');
  } else {
    model.phase = 'inspected';
    if (model.staleReference) {
      state.dataRead = true;
      memoryFragment = `[架空のメモリ断片 / ${model.slot}]\n${model.payload}`;
      flag = state.flag;
      model.events.push('④ 古い参照を使った結果、別のリクエストのデータが漏れる状況を模擬。');
    } else {
      state.secureBlocked = true;
      blocked = true;
      model.events.push('④ 古い参照がないため、情報は返りません。修正後モデルで漏えい防止を確認。');
    }
  }
  return { status: 200, simulation: true, notice: PHP_SIMULATION_NOTICE, mode, step, phase: model.phase, slot: model.slot, staleReference: model.staleReference, events: [...model.events], blocked, ...(memoryFragment ? { memoryFragment, flag } : {}) };
}

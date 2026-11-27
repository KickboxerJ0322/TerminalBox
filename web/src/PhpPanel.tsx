import { useCallback, useEffect, useRef, useState } from 'react';

type Stage = 'prepare' | 'attack' | 'understand' | 'defend';
export type PhpMode = 'vulnerable' | 'secure';
interface Memory { phase: string; slot: string; staleReference: boolean; events: string[] }
interface Progress { epoch: string; normalViewed: boolean; dataRead: boolean; secureBlocked: boolean; completed: string[]; cleared: boolean; login: { id: string; password: string }; memory: Record<PhpMode, Memory> }
interface Props { onInsertCommand: (command: string) => void; mode: PhpMode; onModeChange: (mode: PhpMode) => void; refreshSignal: number; onReset: () => void }
const notice = 'PHP2Shellのメモリ情報漏えいを概念的に再現した模擬演習であり、実際の脆弱性や攻撃手順の再現ではない';
const stages: { id: Stage; label: string; title: string }[] = [
  { id: 'prepare', label: '任意の比較', title: '正規ログインで顧客情報を見る（任意）' },
  { id: 'attack', label: 'ATTACK', title: '未ログインでのメモリ情報漏えいを模擬する' },
  { id: 'understand', label: 'UNDERSTAND', title: 'PHP内部の古い参照と情報漏えいを理解する' },
  { id: 'defend', label: 'DEFEND', title: '修正後モデルで漏えいが防がれることを確認する' },
];
const choices = {
  understand: [
    ['root', 'PHPの脆弱性なら、必ずroot権限が自動取得されるため。'],
    ['stale-reference', '解放済みの領域への古い参照が残り、再利用された領域の別のデータを扱ってしまうため。'],
    ['login-form', 'ログイン画面のパスワード欄が短いため。'],
  ],
  defend: [
    ['hide-form', '画面から入力欄を消す。'],
    ['update-php', 'PHP本体を修正済みバージョンへ更新する。'],
    ['change-password', 'サイトのログインパスワードだけを変更する。'],
  ],
};
const phases: Record<string, string> = { idle: '未開始', allocated: '確保済み', released: '模擬異常終了・解放済み', reused: '情報取得前（①〜③は準備済み）', inspected: '参照確認済み' };

export function PhpPanel({ onInsertCommand, mode, onModeChange, refreshSignal, onReset }: Props) {
  const [stage, setStage] = useState<Stage>('attack');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const epoch = useRef<string | undefined>(undefined);
  const readProgress = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/php-lab', { cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '進捗を取得できません。');
    if (!signal?.aborted) { setProgress(body); setError(''); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void readProgress(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }); };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [readProgress, refreshSignal]);
  useEffect(() => {
    if (epoch.current && epoch.current !== progress?.epoch) { setAnswer(''); setFeedback(''); setStage('attack'); }
    epoch.current = progress?.epoch;
  }, [progress?.epoch]);
  const call = async (action: string, payload: object = {}) => {
    setBusy(true); setFeedback(''); setError('');
    try {
      const response = await fetch(`/api/php-lab/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '処理に失敗しました。');
      setProgress(body);
      if (action === 'check') setFeedback(body.correct ? '正解です。' : '事前ログイン・模擬演習の達成条件・回答を確認し、ATTACKから順に回答してください。');
      else { setAnswer(''); if (action === 'reset') { onModeChange('vulnerable'); setStage('attack'); onReset(); } }
    } catch (e) { setError(e instanceof Error ? e.message : '処理に失敗しました。'); }
    finally { setBusy(false); }
  };
  const selectModel = (next: PhpMode) => {
    onModeChange(next);
    if (stage === 'attack' || stage === 'defend') setStage(next === 'secure' ? 'defend' : 'attack');
    setAnswer(''); setHint(false); setFeedback('');
  };
  const selectedMode = mode;
  const commands = stage === 'attack' || stage === 'defend' ? [{
    step: 'inspect', label: '④ 古い参照による情報取得の結果を確認する',
    meaning: stage === 'defend' ? '修正後モデルは古い参照が消去済みです。同じ④を送ってもblocked:trueとなり、memoryFragmentもFlagも返りません。' : 'ログインや①〜③の操作は不要です。準備済みの古い参照から情報が漏れる影響を模擬します。memoryFragmentに10件の架空顧客情報、flagに回答用Flagが返ります。',
  }] : [];
  const completed = stage === 'prepare' ? progress?.normalViewed : progress?.completed.includes(stage);
  const model = progress?.memory?.[selectedMode];
  return <section className="panel tutorial-panel challenge-panel" id="php-panel" role="tabpanel" aria-labelledby="php-tab">
    <div className="panel-heading"><h2>CVE-2026-109618：メモリ漏えいの模擬演習</h2><span className="ai-badge">{progress?.completed.length ?? 0}/3 CLEAR</span></div>
    <div className="php-mode-actions"><button type="button" aria-pressed={mode === 'vulnerable'} className={mode === 'vulnerable' ? 'active' : ''} onClick={() => selectModel('vulnerable')}>修正前モデルを表示</button><button type="button" aria-pressed={mode === 'secure'} className={mode === 'secure' ? 'active' : ''} onClick={() => selectModel('secure')}>修正後モデルを表示</button><button type="button" disabled={busy} onClick={() => void call('reset')}>PHP演習を初期化</button><span role="status">{progress?.cleared ? '全問クリア' : '演習中'}</span></div>
    <div className="tutorial-body">
      <nav className="lesson-list" aria-label="PHP問題の一覧">{stages.map(item => {
        const done = item.id === 'prepare' ? progress?.normalViewed : progress?.completed.includes(item.id);
        return <button type="button" key={item.id} className={`${stage === item.id ? 'active' : ''} ${done ? 'completed' : ''}`} onClick={() => { setStage(item.id); setAnswer(''); setHint(false); setFeedback(''); if (item.id === 'defend') onModeChange('secure'); else if (item.id === 'prepare' || item.id === 'attack') onModeChange('vulnerable'); }}><span>{done ? '✓' : item.label}</span>{item.title}</button>;
      })}</nav>
      <article className="lesson-detail">
        <div className="lesson-title-row"><div><span className="eyebrow">PHP / {stage === 'prepare' ? '任意の比較' : stage.toUpperCase()}</span><h3>{stages.find(item => item.id === stage)?.title}</h3></div><span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? '確認済み' : '未確認'}</span></div>
        <div className="lesson-card lesson-check"><span>模擬演習について</span><p>{notice}。実際のメモリ破壊・OOM・コマンド実行は行いません。</p></div>
        <p>CVE-2026-109618のメモリ情報漏えいを題材にした模擬攻撃演習です。実際にこのCVEを悪用するものではありません。対象はログイン認証を設けた顧客情報管理サイトで、10件の氏名・生年月日・メールアドレスはすべて架空です。ログインの不備や入力欄へのコマンド混入ではなく、PHP本体の内部状態の問題を、教材専用の状態遷移で学びます。</p>
        {stage === 'prepare' && <>
          <div className="lesson-card lesson-check"><span>任意：通常のログインと比較する</span><ol><li>上の「修正前モデルを表示」を押します。</li><li>左下のTargetのログイン画面に、以下のID・パスワードを入力します。</li><li>顧客情報一覧の氏名・生年月日・メールアドレスを確認します。正規のログインで表示される情報を確認できます。</li><li>一覧画面の「ログアウト」を押して、ログイン画面へ戻ります。</li><li>ATTACKへ戻り、④の教材用リクエストを送ります。事前のログインは演習開始の条件ではありません。</li></ol></div>
          <div className="php-command-guide"><dl><dt>ID</dt><dd><code>{progress?.login?.id ?? 'phpstudent'}</code></dd><dt>パスワード（この演習セッション専用）</dt><dd><code>{progress?.login?.password ?? '取得中…'}</code></dd></dl><p>これは教材サイト用の認証情報です。LinuxのOSパスワードではありません。正常にログインして一覧を見ただけではFlagは取得できません。</p></div>
          <p role="status">{progress?.normalViewed ? '✓ 正規ログインでの一覧閲覧を確認しました。これは任意の比較手順です。' : '未ログインのままATTACKへ進めます。比較したい場合だけログインしてください。'}</p>
          <button type="button" className="lesson-clear-button" onClick={() => { setStage('attack'); setHint(false); }}>ATTACKへ進む</button>
        </>}
        {stage === 'attack' && <div className="lesson-card lesson-check"><span>ATTACKの前提：①〜③は準備済み</span><p>最初から、リクエストAの異常終了・領域解放が起き、古い参照が残っている状態です。その参照先には、別の正規利用者の正常な処理で置かれた10件の架空顧客情報がある、と教材側で設定しています。</p><p>あなたは未ログインの観察者です。①〜③を実行したり、顧客情報を自分で配置したり、先にID・パスワードでログインしたりする必要はありません。以下の④だけを実行してください。</p><p>このHTTPリクエストは教材専用で、実際のCVE-2026-109618の攻撃形式ではありません。出力は既知の架空データであり、他利用者の実メモリは読みません。</p></div>}
        {stage === 'understand' && <p>領域を解放したのに参照だけが残り、再利用された場所の別のデータを扱ってしまうことが問題です。これはログインIDとOSユーザー名が分かったから起きる問題でも、sudoで管理者になった結果でもありません。原因を選んでください。</p>}
        {stage === 'defend' && <p>①〜③は準備済みです。ATTACKと同じ④だけを修正後モデルへ送ってください。古い参照を消去したモデルでは顧客情報もFlagも返りません。この切り替えは実際のPHPを更新する操作ではありません。実運用で必要な対策を選んでください。</p>}
        <div className="command-stack" aria-label="PHP模擬演習コマンド">{commands.map(item => {
          const command = `curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" --data-urlencode 'step=${item.step}' http://phptarget:3300/${selectedMode}/api/memory-demo`;
          return <div key={item.step}><p>{item.label}</p><button type="button" onClick={() => { onInsertCommand(command); setFeedback('Terminalへ貼り付けました。Enterで実行してください。'); }}><code>{command}</code><span>PASTE</span></button><p className="php-command-result">{item.meaning}</p></div>;
        })}</div>
        {(stage === 'attack' || stage === 'defend') && <div className="lesson-card lesson-check" aria-live="polite"><span>{selectedMode === 'secure' ? '修正後モデル' : '修正前モデル'}：架空のメモリ状態</span><p>場所：{model?.slot ?? 'SLOT-A（架空）'} ／ 状態：{phases[model?.phase ?? 'idle']}</p><p>古い参照：{model?.staleReference ? '残っている' : 'なし'}</p><ol>{model?.events.map((event, index) => <li key={index}>{event}</li>)}</ol><p>①〜③は教材側の準備履歴で、利用者が行う攻撃操作ではありません。実際のメモリアドレスやプロセスの内容ではありません。</p></div>}
        {stage !== 'prepare' && <form className="challenge-answer" onSubmit={e => { e.preventDefault(); void call('check', { stage, answer }); }}>
          {stage === 'attack' ? <input aria-label="PHPのFlag回答" placeholder="TBX{php_**} を入力" maxLength={200} value={answer} disabled={busy || completed} onChange={e => setAnswer(e.target.value)} /> : <div className="choice-list" role="radiogroup" aria-label="回答の選択肢">{choices[stage].map(([id, label]) => <label className="choice-option" key={id}><input type="radio" name={`php-${stage}`} value={id} checked={answer === id} disabled={busy || completed} onChange={() => setAnswer(id)} /><span>{label}</span></label>)}</div>}
          <button disabled={busy || completed || !answer.trim()}>{busy ? '確認中…' : completed ? '正解' : '回答する'}</button>
        </form>}
        {feedback && <p role="status">{feedback}</p>}
        <button type="button" className="hint-toggle" aria-expanded={hint} aria-controls="php-hint" onClick={() => setHint(current => !current)}><span>HINT</span><strong>{hint ? 'ヒントを隠す' : 'ヒントを表示'}</strong></button>
        <div id="php-hint" hidden={!hint} className="lesson-card lesson-hint"><p>{stage === 'prepare' ? '比較用の任意手順です。ログインしなくてもATTACKは実行できます。RESET後は新しいパスワードになります。' : stage === 'attack' ? 'step=inspectの④だけを送ります。①〜③の状態は最初から教材が用意しています。応答のmemoryFragmentに10件の架空顧客情報、flagに回答用Flagが入ります。これは実際のPHP2Shellのリクエスト形式ではありません。' : stage === 'understand' ? '解放後使用では、古い参照を信じて再利用された場所を扱うことで、別のリクエストのデータが漏れることがあります。アプリの認証処理より下の層に問題があるため、認証だけでは十分ではありません。' : '入力欄を消したりパスワードを変えたりするだけでは、PHPエンジン内部の不具合は修正されません。修正済みPHPへの更新が中心です。'}</p></div>
        <div className="lesson-card lesson-check"><span>CHECK</span><p>ログインは任意です。ATTACK・UNDERSTAND・DEFENDの3設問に正解すると全問クリアです。修正後モデルへ同じ④を送り、顧客情報が返らないことを確かめてください。PHP初期化・HP復元・全体RESETは、進捗・Flag・ログイン状態を初期化し、両モデルを①〜③準備済みの状態へ戻します。</p></div>
        <button type="button" className="lesson-clear-button" disabled={busy || !progress?.completed.length} onClick={() => void call('unclear')}>クリア解除</button>
        {error && <p role="alert">{error}</p>}
      </article>
    </div>
  </section>;
}

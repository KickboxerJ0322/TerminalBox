import { useCallback, useEffect, useRef, useState } from 'react';

type Stage = 'prepare' | 'attack' | 'understand' | 'defend';
export type PhpMode = 'vulnerable' | 'secure';
interface Memory { phase: string; slot: string; staleReference: boolean; events: string[] }
interface Progress { epoch: string; normalViewed: boolean; dataRead: boolean; secureBlocked: boolean; completed: string[]; cleared: boolean; login: { id: string; password: string }; memory: Record<PhpMode, Memory> }
interface Props { onInsertCommand: (command: string) => void; mode: PhpMode; onModeChange: (mode: PhpMode) => void; refreshSignal: number; onReset: () => void }
const notice = 'PHP2Shellのメモリ情報漏えいを概念的に再現した模擬演習であり、実際の脆弱性や攻撃手順の再現ではない';
const stages: { id: Stage; label: string; title: string }[] = [
  { id: 'prepare', label: '準備', title: 'Web画面でログインし、顧客情報を確認する' },
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
const phases: Record<string, string> = { idle: '未開始', allocated: '確保済み', released: '模擬異常終了・解放済み', reused: '再利用済み', inspected: '参照確認済み' };

export function PhpPanel({ onInsertCommand, mode, onModeChange, refreshSignal, onReset }: Props) {
  const [stage, setStage] = useState<Stage>('prepare');
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
    if (epoch.current && epoch.current !== progress?.epoch) { setAnswer(''); setFeedback(''); setStage('prepare'); }
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
      else { setAnswer(''); if (action === 'reset') { onModeChange('vulnerable'); setStage('prepare'); onReset(); } }
    } catch (e) { setError(e instanceof Error ? e.message : '処理に失敗しました。'); }
    finally { setBusy(false); }
  };
  const selectedMode: PhpMode = stage === 'defend' ? 'secure' : 'vulnerable';
  const commands = stage === 'attack' || stage === 'defend' ? [
    { step: 'allocate', label: '① 架空のメモリ領域を確保する', meaning: 'リクエストAのデータを置くSLOT-Aと参照を、教材の状態として作ります。' },
    { step: 'abort', label: '② 異常終了と解放を模擬する', meaning: '実際のOOMやクラッシュは起こしません。修正前モデルでは古い参照が残り、修正後モデルでは消えます。' },
    { step: 'reuse', label: '③ 別のデータによる再利用を模擬する', meaning: '別リクエストBが同じ場所を使うという設定で、先ほどWeb画面で見た共通の架空顧客データを配置します。他の利用者の実データは使いません。' },
    { step: 'inspect', label: '④ 古い参照を使う結果を確認する', meaning: stage === 'defend' ? '修正後モデルは古い参照がないため、顧客情報もFlagも返りません。blocked:trueを確認してください。' : '修正前モデルでは、別のデータが漏れる結果を架空のメモリ断片として返します。memoryFragment内の顧客情報と、flagのTBX{php_**}を確認してください。' },
  ] : [];
  const completed = stage === 'prepare' ? progress?.normalViewed : progress?.completed.includes(stage);
  const model = progress?.memory?.[selectedMode];
  return <section className="panel tutorial-panel challenge-panel" id="php-panel" role="tabpanel" aria-labelledby="php-tab">
    <div className="panel-heading"><h2>PHP2Shell：メモリ情報漏えいの模擬演習</h2><span className="ai-badge">{progress?.completed.length ?? 0}/3 CLEAR</span></div>
    <div className="php-mode-actions"><button type="button" aria-pressed={mode === 'vulnerable'} className={mode === 'vulnerable' ? 'active' : ''} onClick={() => onModeChange('vulnerable')}>修正前モデルを表示</button><button type="button" aria-pressed={mode === 'secure'} className={mode === 'secure' ? 'active' : ''} onClick={() => onModeChange('secure')}>修正後モデルを表示</button><button type="button" disabled={busy} onClick={() => void call('reset')}>PHP演習を初期化</button><span role="status">{progress?.cleared ? '全問クリア' : '演習中'}</span></div>
    <div className="tutorial-body">
      <nav className="lesson-list" aria-label="PHP問題の一覧">{stages.map(item => {
        const done = item.id === 'prepare' ? progress?.normalViewed : progress?.completed.includes(item.id);
        return <button type="button" key={item.id} className={`${stage === item.id ? 'active' : ''} ${done ? 'completed' : ''}`} onClick={() => { setStage(item.id); setAnswer(''); setHint(false); setFeedback(''); if (item.id === 'defend') onModeChange('secure'); else if (item.id === 'prepare' || item.id === 'attack') onModeChange('vulnerable'); }}><span>{done ? '✓' : item.label}</span>{item.title}</button>;
      })}</nav>
      <article className="lesson-detail">
        <div className="lesson-title-row"><div><span className="eyebrow">PHP / {stage === 'prepare' ? '準備' : stage.toUpperCase()}</span><h3>{stages.find(item => item.id === stage)?.title}</h3></div><span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? '確認済み' : '未確認'}</span></div>
        <div className="lesson-card lesson-check"><span>模擬演習について</span><p>{notice}。実際のメモリ破壊・OOM・コマンド実行は行いません。</p></div>
        <p>題材は「ログイン認証を設けた顧客情報管理サイト」です。氏名・生年月日・メールアドレスはすべて架空です。ログインの不備や入力欄へのコマンド混入ではなく、PHP本体の内部状態の問題を、教材専用の状態遷移で学びます。</p>
        {stage === 'prepare' && <>
          <div className="lesson-card lesson-check"><span>攻撃前：正常な閲覧を確認</span><ol><li>上の「修正前モデルを表示」を押します。</li><li>左下のTargetのログイン画面に、以下のID・パスワードを入力します。</li><li>顧客情報一覧の氏名・生年月日・メールアドレスを確認します。ここまで完了すると準備確認済みになります。</li><li>一覧画面の「ログアウト」を押して、ログイン画面へ戻ります。</li><li>右上のATTACKへ進み、未ログインの教材用リクエストを送ります。</li></ol></div>
          <div className="php-command-guide"><dl><dt>ID</dt><dd><code>{progress?.login?.id ?? 'phpstudent'}</code></dd><dt>パスワード（この演習セッション専用）</dt><dd><code>{progress?.login?.password ?? '取得中…'}</code></dd></dl><p>これは教材サイト用の認証情報です。LinuxのOSパスワードではありません。正常にログインして一覧を見ただけではFlagは取得できません。</p></div>
          <p role="status">{progress?.normalViewed ? '✓ 正規ログインでの一覧閲覧を確認しました。ログアウトしてATTACKへ進んでください。' : '□ 先にWeb画面でログインし、顧客一覧を確認してください。'}</p>
          <button type="button" className="lesson-clear-button" disabled={!progress?.normalViewed} onClick={() => { setStage('attack'); setHint(false); }}>ATTACKへ進む</button>
        </>}
        {stage === 'attack' && <p>以下は実際の攻撃コードではなく、教材専用APIに4段階の処理を指示するコマンドです。Kaliから送るcurlにはログインCookieを付けません。通常の顧客一覧は未ログインでは拒否されますが、修正前モデルでは古い参照からの情報漏えいを再現します。</p>}
        {stage === 'understand' && <p>領域を解放したのに参照だけが残り、再利用された場所の別のデータを扱ってしまうことが問題です。これはログインIDとOSユーザー名が分かったから起きる問題でも、sudoで管理者になった結果でもありません。原因を選んでください。</p>}
        {stage === 'defend' && <p>同じ4段階を修正後モデルへ送ります。古い参照を消去したモデルでは顧客情報もFlagも返りません。この切り替えは実際のPHPを更新する操作ではありません。実運用で必要な対策を選んでください。</p>}
        {!progress?.normalViewed && stage !== 'prepare' && <p role="status">先に「準備」でWeb画面からログインし、顧客一覧を表示してください。</p>}
        <div className="command-stack" aria-label="PHP模擬演習コマンド">{commands.map(item => {
          const command = `curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" --data-urlencode 'step=${item.step}' http://phptarget:3300/${selectedMode}/api/memory-demo`;
          return <div key={item.step}><p>{item.label}</p><button type="button" disabled={!progress?.normalViewed} onClick={() => { onInsertCommand(command); setFeedback('Terminalへ貼り付けました。Enterで実行してください。'); }}><code>{command}</code><span>PASTE</span></button><p className="php-command-result">{item.meaning}</p></div>;
        })}</div>
        {(stage === 'attack' || stage === 'defend') && <div className="lesson-card lesson-check" aria-live="polite"><span>{selectedMode === 'secure' ? '修正後モデル' : '修正前モデル'}：架空のメモリ状態</span><p>場所：{model?.slot ?? 'SLOT-A（架空）'} ／ 状態：{phases[model?.phase ?? 'idle']}</p><p>古い参照：{model?.staleReference ? '残っている' : 'なし'}</p><ol>{model?.events.map((event, index) => <li key={index}>{event}</li>)}</ol><p>実際のメモリアドレス・プロセスの内容ではありません。リクエストごとの状態を単純化した図解用モデルです。</p></div>}
        {stage !== 'prepare' && <form className="challenge-answer" onSubmit={e => { e.preventDefault(); void call('check', { stage, answer }); }}>
          {stage === 'attack' ? <input aria-label="PHPのFlag回答" placeholder="TBX{php_**} を入力" maxLength={200} value={answer} disabled={busy || completed} onChange={e => setAnswer(e.target.value)} /> : <div className="choice-list" role="radiogroup" aria-label="回答の選択肢">{choices[stage].map(([id, label]) => <label className="choice-option" key={id}><input type="radio" name={`php-${stage}`} value={id} checked={answer === id} disabled={busy || completed} onChange={() => setAnswer(id)} /><span>{label}</span></label>)}</div>}
          <button disabled={busy || completed || !answer.trim()}>{busy ? '確認中…' : completed ? '正解' : '回答する'}</button>
        </form>}
        {feedback && <p role="status">{feedback}</p>}
        <button type="button" className="hint-toggle" aria-expanded={hint} aria-controls="php-hint" onClick={() => setHint(current => !current)}><span>HINT</span><strong>{hint ? 'ヒントを隠す' : 'ヒントを表示'}</strong></button>
        <div id="php-hint" hidden={!hint} className="lesson-card lesson-hint"><p>{stage === 'prepare' ? '正しいID・パスワードで顧客一覧を実際に表示してから、ログアウトしてください。演習のRESET後は新しいパスワードになります。' : stage === 'attack' ? 'allocate → abort → reuse → inspectの順です。最後の応答のmemoryFragmentに架空の顧客情報、flagに回答用Flagが入ります。これは実際のPHP2Shellのリクエスト形式ではありません。' : stage === 'understand' ? '解放後使用では、古い参照を信じて再利用された場所を扱うことで、別のリクエストのデータが漏れることがあります。アプリの認証処理より下の層に問題があるため、認証だけでは十分ではありません。' : '入力欄を消したりパスワードを変えたりするだけでは、PHPエンジン内部の不具合は修正されません。修正済みPHPへの更新が中心です。'}</p></div>
        <div className="lesson-card lesson-check"><span>CHECK</span><p>事前ログイン確認の後、ATTACK・UNDERSTAND・DEFENDの3設問に正解すると全問クリアです。修正後モデルでは同じ4段階を完了して漏えいしないことを確かめてください。PHP初期化・HP復元・全体RESETは、モデル・進捗・Flag・ログイン状態も初期化します。</p></div>
        <button type="button" className="lesson-clear-button" disabled={busy || !progress?.completed.length} onClick={() => void call('unclear')}>クリア解除</button>
        {error && <p role="alert">{error}</p>}
      </article>
    </div>
  </section>;
}

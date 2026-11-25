import { useCallback, useEffect, useState } from 'react';

type Stage = 'attack' | 'understand' | 'defend';
export type PhpMode = 'vulnerable' | 'secure';
interface Progress { epoch: string; identityObserved: boolean; dataRead: boolean; secureBlocked: boolean; completed: Stage[]; cleared: boolean }
interface Props { onInsertCommand: (command: string) => void; mode: PhpMode; onModeChange: (mode: PhpMode) => void; refreshSignal: number; onReset: () => void }
const stages: { id: Stage; label: string; title: string }[] = [
  { id: 'attack', label: 'ATTACK', title: 'PHP実行ユーザーと教材データを確認する' },
  { id: 'understand', label: 'UNDERSTAND', title: '管理者権限なしでも情報を取得できる理由' },
  { id: 'defend', label: 'DEFEND', title: '対策版で同じ入力が拒否されることを確認する' },
];
const choices = {
  understand: [
    ['root', 'PHPからコマンドが動けば、自動的にrootになるため。'],
    ['web-user', 'PHP実行ユーザーに教材データの読み取り権限があるため。'],
    ['public-url', 'すべてのサーバーファイルがURLで公開されているため。'],
  ],
  defend: [
    ['sudo', 'sudoをアンインストールするだけで入力処理も安全になる。'],
    ['hidden', 'ファイル名を長くして隠す。'],
    ['business-input', '業務上必要な入力値だけを許可し、入力をコマンドとして扱わない。'],
  ],
};

export function PhpPanel({ onInsertCommand, mode, onModeChange, refreshSignal, onReset }: Props) {
  const [stage, setStage] = useState<Stage>('attack');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const readProgress = useCallback(async () => {
    const response = await fetch('/api/php-lab', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '進捗を取得できません。');
    setProgress(current => {
      if (current && current.epoch !== body.epoch) { setAnswer(''); setFeedback(''); }
      return body;
    });
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) void readProgress().catch(e => { if (active) setError(e.message); }); };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [readProgress, refreshSignal]);
  const call = async (action: string, payload: object = {}) => {
    setBusy(true); setFeedback(''); setError('');
    try {
      const response = await fetch(`/api/php-lab/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '処理に失敗しました。');
      setProgress(body);
      if (action === 'check') setFeedback(body.correct ? '正解です。' : stage === 'defend' && !body.secureBlocked ? '先にSecure版へ同じ教材データ取得の入力を送り、拒否を確認してください。' : '実習の達成条件と回答を確認してください。前の設問から順に進めてください。');
      else { setAnswer(''); if (action === 'reset') { onModeChange('vulnerable'); onReset(); } }
    } catch (e) { setError(e instanceof Error ? e.message : '処理に失敗しました。'); }
    finally { setBusy(false); }
  };
  const base = `curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" --get`;
  const request = (topic: string, selectedMode: PhpMode = 'vulnerable') => `${base} --data-urlencode 'topic=${topic}' http://phptarget:3300/${selectedMode}/api/report`;
  const commands = stage === 'attack' ? [
    { description: '通常の業務入力を確認する', command: request('summary') },
    { description: 'PHPがどのOSユーザーで処理しているか確認する', command: request('summary; whoami') },
    { description: 'UID・GIDを確認する（rootではありません）', command: request('summary; id') },
    { description: '教材用データの一覧を確認する', command: request('summary; ls data') },
    { description: '教材データとFlagを取得する', command: request('summary; cat data/customers.csv') },
  ] : stage === 'defend' ? [
    { description: 'Secure版でも通常の業務入力は受け付けることを確認する', command: request('summary', 'secure') },
    { description: '学習版と同じ情報取得の入力が拒否されることを確認する', command: request('summary; cat data/customers.csv', 'secure') },
  ] : [];
  const completed = progress?.completed.includes(stage) ?? false;
  return <section className="panel tutorial-panel challenge-panel" id="php-panel" role="tabpanel" aria-labelledby="php-tab">
    <div className="panel-heading"><h2>PHP：Webユーザー権限と情報漏えい</h2><span className="ai-badge">{progress?.completed.length ?? 0}/3 CLEAR</span></div>
    <div className="php-mode-actions"><button type="button" className={mode === 'vulnerable' ? 'active' : ''} onClick={() => onModeChange('vulnerable')}>学習版を表示</button><button type="button" className={mode === 'secure' ? 'active' : ''} onClick={() => onModeChange('secure')}>Secure版を表示</button><button type="button" disabled={busy} onClick={() => void call('reset')}>PHP演習を初期化</button><span role="status">{progress?.cleared ? '全問クリア' : '演習中'}</span></div>
    <div className="tutorial-body">
      <nav className="lesson-list" aria-label="PHP問題の一覧">{stages.map(item => <button type="button" key={item.id} className={`${stage === item.id ? 'active' : ''} ${progress?.completed.includes(item.id) ? 'completed' : ''}`} onClick={() => { setStage(item.id); setAnswer(''); setHint(false); setFeedback(''); if (item.id === 'defend') onModeChange('secure'); }}><span>{progress?.completed.includes(item.id) ? '✓' : item.label}</span>{item.title}</button>)}</nav>
      <article className="lesson-detail">
        <div className="lesson-title-row"><div><span className="eyebrow">PHP / {stage.toUpperCase()}</span><h3>{stages.find(item => item.id === stage)?.title}</h3></div><span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? 'クリア済み' : '未クリア'}</span></div>
        <p>対象はTerminalBox内部の <code>http://phptarget:3300/</code> です。実際のPHPが専用ユーザー phpstudent の権限でOSコマンドを実行します。管理者権限の取得は行いません。氏名・連絡先はすべて架空の教材データです。</p>
        <div className="lesson-card lesson-check"><span>学習範囲</span><p>入力が意図しない操作につながる仕組みを、実行できる操作を限定して学びます。許可されるのはユーザー確認・UID確認・教材一覧・教材ファイル読み取りの4操作です。任意のシェルや他のファイルへのアクセスは提供しません。</p></div>
        {stage === 'attack' && <><p>以下を上から順にTerminalで実行してください。ユーザー確認とデータ取得の両方を完了すると、取得結果にセッション用Flagが表示されます。</p><p>進捗：{progress?.identityObserved ? '✓' : '□'} ユーザー確認　{progress?.dataRead ? '✓' : '□'} 教材データ取得</p></>}
        {stage === 'understand' && <p>教材データはURLでは直接公開していません。それでもPHP実行ユーザーの操作で読めた理由を選んでください。sudoやroot権限を取得したわけではありません。</p>}
        {stage === 'defend' && <><p>同じデータ取得の入力をSecure版へ送り、入力が拒否されて氏名・連絡先・Flagが返らないことを確認します。通常の summary は動作します。その後、適切な対策を選んでください。</p><p>進捗：{progress?.secureBlocked ? '✓ 拒否を確認済み' : '□ 対策版での拒否を確認'}</p></>}
        <div className="command-stack" aria-label="PHP演習コマンド">{commands.map(item => <div key={item.command}><p>{item.description}</p><button type="button" onClick={() => { onInsertCommand(item.command); setFeedback('Terminalへ貼り付けました。Enterで実行してください。'); }}><code>{item.command}</code><span>PASTE</span></button></div>)}</div>
        <form className="challenge-answer" onSubmit={e => { e.preventDefault(); void call('check', { stage, answer }); }}>
          {stage === 'attack' ? <input aria-label="PHPのFlag回答" placeholder="TBX{php_**} を入力" maxLength={200} value={answer} disabled={busy || completed} onChange={e => setAnswer(e.target.value)} /> : <div className="choice-list" role="radiogroup" aria-label="回答の選択肢">{choices[stage].map(([id, label]) => <label className="choice-option" key={id}><input type="radio" name={`php-${stage}`} value={id} checked={answer === id} disabled={busy || completed} onChange={() => setAnswer(id)} /><span>{label}</span></label>)}</div>}
          <button disabled={busy || completed || !answer.trim()}>{busy ? '確認中…' : completed ? '正解' : '回答する'}</button>
          {feedback && <p role="status">{feedback}</p>}
        </form>
        <button type="button" className="hint-toggle" aria-expanded={hint} aria-controls="php-hint" onClick={() => setHint(current => !current)}><span>HINT</span><strong>{hint ? 'ヒントを隠す' : 'ヒントを表示'}</strong></button>
        <div id="php-hint" hidden={!hint} className="lesson-card lesson-hint"><p>{stage === 'attack' ? 'summary だけなら公開レポートです。教材では「summary; 」に続けた4つの操作をPHPが受け付けます。whoamiまたはidで実行ユーザーを確認してからcustomers.csvを読み取ってください。操作はそのユーザーの読み取り権限で動きます。' : stage === 'understand' ? '非公開URLでも、アプリ自身が処理に使うデータはOS上で読める場合があります。Webユーザーの権限でも情報漏えいは起こります。' : 'Secure版ではtopicをsummaryに限定し、ユーザー入力からOS操作を選ばせません。権限の最小化も被害を抑えますが、今回は入力と操作の分離が直接の対策です。'}</p></div>
        <div className="lesson-card lesson-check"><span>CHECK</span><p>ATTACK・UNDERSTAND・DEFENDの3つに正解すると全問クリアです。PHP演習の初期化／TargetのHP復元はこのセッションのPHP進捗とFlagを初期化し、全体RESETもPHP演習を初期化します。</p></div>
        <button type="button" disabled={busy || !progress?.completed.length} onClick={() => void call('unclear')}>クリア解除</button>
        {error && <p role="alert">{error}</p>}
      </article>
    </div>
  </section>;
}

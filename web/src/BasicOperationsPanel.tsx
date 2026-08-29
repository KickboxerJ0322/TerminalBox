import { useEffect, useMemo, useState } from 'react';

interface Operation {
  id: string;
  title: string;
  goal: string;
  commands: string[];
  mission: string;
  hint: string;
  check: string;
}

interface Props {
  onInsertCommand: (command: string) => void;
  resetSignal: number;
}

const STORAGE_KEY = 'terminalbox:operations-completed';

const operations: Operation[] = [
  {
    id: '01', title: 'ファイルを新規作成する', goal: 'Kali Desktop にファイルを作成します。',
    commands: ['mkdir -p ~/Desktop', 'touch ~/Desktop/terminalbox-note.txt', 'ls -l ~/Desktop/terminalbox-note.txt'],
    mission: '`terminalbox-note.txt` を作成し、デスクトップにもアイコンが現れることを確認してください。',
    hint: '`touch` は対象が存在しない場合に空のファイルを作成します。',
    check: 'ターミナルとKali Desktopの両方にファイルが見えればクリアです。',
  },
  {
    id: '02', title: 'ファイルを読み取る', goal: 'ファイルへ文章を書き、内容を読み取ります。',
    commands: ['echo "TerminalBox file practice" > ~/Desktop/terminalbox-note.txt', 'cat ~/Desktop/terminalbox-note.txt'],
    mission: '1行保存して、`cat` で同じ内容を表示してください。',
    hint: '`>` はコマンドの出力でファイル内容を上書きします。',
    check: '「TerminalBox file practice」と表示されればクリアです。',
  },
  {
    id: '03', title: 'ファイルを変更する', goal: '既存ファイルへ新しい行を追記します。',
    commands: ['echo "second line" >> ~/Desktop/terminalbox-note.txt', 'cat -n ~/Desktop/terminalbox-note.txt'],
    mission: '2行目を追記し、行番号付きで変更後の内容を確認してください。',
    hint: '`>>` は既存内容を残して末尾へ追記します。',
    check: '1行目と2行目の両方が表示されればクリアです。',
  },
  {
    id: '04', title: 'ファイルを削除する', goal: '対象を確認してからファイルを削除します。',
    commands: ['ls -l ~/Desktop/terminalbox-note.txt', 'rm ~/Desktop/terminalbox-note.txt', 'test ! -e ~/Desktop/terminalbox-note.txt && echo "削除を確認しました"'],
    mission: '対象パスを確認して削除し、存在しないことを検証してください。',
    hint: '`rm` の前に `ls` で対象を確認する習慣を付けます。',
    check: '確認メッセージが表示され、デスクトップからアイコンが消えればクリアです。',
  },
  {
    id: '05', title: 'フォルダーを作成する', goal: 'デスクトップ上に作業用フォルダーを作ります。',
    commands: ['mkdir -p ~/Desktop/practice/docs', 'find ~/Desktop/practice -maxdepth 2 -type d'],
    mission: '`practice` と、その中の `docs` を一度に作成してください。',
    hint: '`mkdir -p` は途中のフォルダーもまとめて作成します。',
    check: '`practice` と `docs` の2つのパスが表示されればクリアです。',
  },
  {
    id: '06', title: 'コピーして名前を変える', goal: 'ファイルのコピーと名前変更を練習します。',
    commands: ['echo "original" > ~/Desktop/practice/original.txt', 'cp ~/Desktop/practice/original.txt ~/Desktop/practice/copy.txt', 'mv ~/Desktop/practice/copy.txt ~/Desktop/practice/renamed.txt', 'ls -l ~/Desktop/practice'],
    mission: '`original.txt` をコピーし、コピー側を `renamed.txt` に変更してください。',
    hint: '`cp` は複製、`mv` は移動と名前変更に使います。',
    check: '`original.txt` と `renamed.txt` が両方表示されればクリアです。',
  },
  {
    id: '07', title: 'GUIのメモ帳で開く', goal: 'ターミナルからMousepadを起動してファイルを編集します。',
    commands: ['DISPLAY=:1 mousepad ~/Desktop/practice/renamed.txt >/tmp/mousepad.log 2>&1 &'],
    mission: 'コマンドを実行してKali Desktopを開き、Mousepadにファイル内容が表示されることを確認してください。',
    hint: 'デスクトップ上の `.txt` をダブルクリックしてもMousepadで開けます。',
    check: 'GUIで文章を編集して保存し、`cat ~/Desktop/practice/renamed.txt` で変更を読めればクリアです。',
  },
  {
    id: '08', title: 'ファイルの権限を変える', goal: '読み書きできる人を権限で制御します。',
    commands: ['chmod 600 ~/Desktop/practice/renamed.txt', 'ls -l ~/Desktop/practice/renamed.txt'],
    mission: '所有者だけが読み書きできる `600` に変更してください。',
    hint: '`600` は所有者の読み取りと書き込みだけを許可します。',
    check: '権限表示の先頭が `-rw-------` になればクリアです。',
  },
  {
    id: '09', title: 'フォルダーを圧縮する', goal: '複数ファイルを1つのアーカイブにまとめます。',
    commands: ['tar -czf ~/Desktop/practice-backup.tar.gz -C ~/Desktop practice', 'tar -tzf ~/Desktop/practice-backup.tar.gz'],
    mission: '`practice` フォルダーをgzip形式で圧縮し、中身を一覧表示してください。',
    hint: '`tar -czf` で作成、`tar -tzf` で内容確認ができます。',
    check: 'アーカイブ内に `practice/` 以下のファイルが表示されればクリアです。',
  },
  {
    id: '10', title: '練習ファイルを片付ける', goal: '作成した練習データを安全に片付けます。',
    commands: ['find ~/Desktop/practice -maxdepth 2 -print', 'rm -r ~/Desktop/practice', 'rm ~/Desktop/practice-backup.tar.gz', 'ls -la ~/Desktop'],
    mission: '`find` で削除対象を確認してから、練習フォルダーとアーカイブを削除してください。',
    hint: '`rm -r` はフォルダー全体を削除するため、実行前のパス確認が重要です。',
    check: '`practice` と `practice-backup.tar.gz` が一覧から消えればクリアです。',
  },
];

function loadCompleted() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export function BasicOperationsPanel({ onInsertCommand, resetSignal }: Props) {
  const [selectedId, setSelectedId] = useState(operations[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompleted);
  const [queuedCommand, setQueuedCommand] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const operation = operations.find((item) => item.id === selectedId) ?? operations[0];
  const completed = completedSet.has(operation.id);

  useEffect(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds)), [completedIds]);
  useEffect(() => { setSelectedId('01'); setCompletedIds(loadCompleted()); }, [resetSignal]);
  useEffect(() => setHintVisible(false), [selectedId, resetSignal]);

  const queueCommand = (command: string) => {
    onInsertCommand(command);
    setQueuedCommand(command);
    window.setTimeout(() => setQueuedCommand((current) => current === command ? null : current), 1400);
  };

  return (
    <section className="panel tutorial-panel" id="operations-panel" role="tabpanel" aria-labelledby="operations-tab">
      <div className="panel-heading">
        <div><span className="eyebrow">KALI DESKTOP PRACTICE</span><h2>基本操作</h2></div>
        <span className="ai-badge">{completedIds.length}/{operations.length} CLEAR</span>
      </div>
      <div className="tutorial-body">
        <nav className="lesson-list" aria-label="基本操作一覧">
          {operations.map((item) => {
            const itemCompleted = completedSet.has(item.id);
            return <button key={item.id} type="button" className={`${item.id === selectedId ? 'active' : ''} ${itemCompleted ? 'completed' : ''}`} onClick={() => setSelectedId(item.id)}><span>{itemCompleted ? '✓' : item.id}</span>{item.title}</button>;
          })}
        </nav>
        <article className="lesson-detail">
          <div className="lesson-title-row">
            <div><span className="eyebrow">OPERATION {operation.id}</span><h3>{operation.title}</h3></div>
            <span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? 'クリア済み' : '未クリア'}</span>
          </div>
          <p>{operation.goal}</p>
          <div className="lesson-actions">
            <button type="button" disabled={completed} onClick={() => setCompletedIds((current) => current.includes(operation.id) ? current : [...current, operation.id])}>クリアにする</button>
            <button type="button" className="secondary" disabled={!completed} onClick={() => setCompletedIds((current) => current.filter((id) => id !== operation.id))}>クリア解除</button>
          </div>
          <div className="lesson-card"><span>MISSION</span><p>{operation.mission}</p></div>
          <div className="command-stack">{operation.commands.map((command) => <button key={command} type="button" onClick={() => queueCommand(command)}><code>{command}</code><span>{queuedCommand === command ? 'PASTED' : 'PASTE'}</span></button>)}</div>
          <button type="button" className="hint-toggle" aria-expanded={hintVisible} onClick={() => setHintVisible((current) => !current)}>
            <span>HINT</span><strong>{hintVisible ? 'ヒントを隠す' : 'ヒントを表示'}</strong>
          </button>
          {hintVisible && <div className="lesson-card lesson-hint"><p>{operation.hint}</p></div>}
          <div className="lesson-card lesson-check"><span>CHECK</span><p>{operation.check}</p></div>
        </article>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';

interface Lesson {
  id: string;
  title: string;
  level: string;
  goal: string;
  scenario: string;
  commands: string[];
  mission: string;
  hint: string;
  check: string;
}

interface Props {
  onInsertCommand: (command: string) => void;
  resetSignal: number;
}

const STORAGE_KEY = 'terminalbox:tutorial-completed';

const lessons: Lesson[] = [
  {
    id: '01',
    title: '現在地を確認する',
    level: '基本コマンド',
    goal: 'ターミナルで自分が今どこにいるかを確認できるようになる。',
    scenario: 'まずは迷子にならないことが大切です。作業場所と見えているファイルを確認します。',
    commands: ['pwd', 'ls', 'ls -la'],
    mission: '`pwd` で現在地を確認し、`ls -la` で見えるファイルと隠しファイルを比べてください。',
    hint: 'Linux では `.` で始まる名前が隠しファイルです。',
    check: '現在のディレクトリ名と、`.` で始まるファイルが表示されたことを確認できればクリアです。',
  },
  {
    id: '02',
    title: 'ディレクトリを移動する',
    level: '基本コマンド',
    goal: '`cd` で移動し、元の場所へ戻れるようになる。',
    scenario: 'ログや設定ファイルは場所が分かれているため、移動の感覚が重要です。',
    commands: ['cd /tmp', 'pwd', 'cd -', 'cd ~'],
    mission: '`/tmp` へ移動して現在地を確認し、`cd -` で元の場所へ戻ってください。',
    hint: '`~` はホームディレクトリ、`cd -` は直前の場所へ戻ります。',
    check: '`pwd` の表示が移動前後で変わることを確認できればクリアです。',
  },
  {
    id: '03',
    title: 'ファイルを読む',
    level: '基本コマンド',
    goal: '短いファイルと長いファイルの見方を覚える。',
    scenario: 'セキュリティ調査では、設定ファイルやログを読む場面がよくあります。',
    commands: ['cat /etc/os-release', 'head /etc/passwd', 'tail /etc/passwd'],
    mission: '`/etc/os-release` を読んで、この環境の OS 情報を確認してください。',
    hint: '`head` は先頭、`tail` は末尾だけを表示します。',
    check: 'OS 名やバージョンの表示を見つけられればクリアです。',
  },
  {
    id: '04',
    title: 'grep で探す',
    level: '検索コマンド',
    goal: '`grep` で必要な行だけを絞り込めるようになる。',
    scenario: '大きなログから気になるキーワードを探したい場面を想定します。',
    commands: ['grep root /etc/passwd', 'grep -n bash /etc/passwd'],
    mission: '`/etc/passwd` から `shell` に関係しそうな行を探してください。',
    hint: '`-n` を付けると行番号も表示されます。',
    check: '`grep` で該当行だけを表示できればクリアです。',
  },
  {
    id: '05',
    title: 'find で見つける',
    level: '検索コマンド',
    goal: '`find` で場所の分からないファイルを探せるようになる。',
    scenario: '壁紙や設定ファイルがどこにあるか調べる練習です。',
    commands: ['find /usr/share/backgrounds/kali -maxdepth 2 -type f | head', 'find /etc -name "*release*" 2>/dev/null'],
    mission: 'Kali の壁紙フォルダから画像ファイルをいくつか探してください。',
    hint: 'エラーを消したいときは `2>/dev/null` を使えます。',
    check: '`find` で複数のファイルパスを表示できればクリアです。',
  },
  {
    id: '06',
    title: '権限を見る',
    level: 'Linux 入門',
    goal: '`ls -l` の権限表示を読めるようになる。',
    scenario: '読める・書ける・実行できる、の違いはセキュリティの基礎です。',
    commands: ['ls -l /etc/passwd', 'whoami', 'id'],
    mission: '`/etc/passwd` の権限と、自分のユーザー名・グループを確認してください。',
    hint: '`r` は読み取り、`w` は書き込み、`x` は実行です。',
    check: '自分がどのユーザーとして動いているか説明できればクリアです。',
  },
  {
    id: '07',
    title: 'ファイルを新規作成する',
    level: 'Kali Desktop 基本操作',
    goal: 'Kali Desktop にファイルを作成します。',
    scenario: 'GUI と Terminal が同じホームディレクトリを見ていることを確認する練習です。',
    commands: ['mkdir -p ~/Desktop', 'touch ~/Desktop/terminalbox-note.txt', 'ls -l ~/Desktop/terminalbox-note.txt'],
    mission: '`terminalbox-note.txt` を作成し、デスクトップにもアイコンが現れることを確認してください。',
    hint: '`touch` は対象が存在しない場合に空のファイルを作成します。',
    check: 'Terminal と Kali Desktop の両方にファイルが見えればクリアです。',
  },
  {
    id: '08',
    title: 'ファイルを読み取る',
    level: 'Kali Desktop 基本操作',
    goal: 'ファイルへ文章を書き、内容を読み取ります。',
    scenario: '調査メモをファイルに残し、後から内容を確認するための基本操作です。',
    commands: ['echo "TerminalBox file practice" > ~/Desktop/terminalbox-note.txt', 'cat ~/Desktop/terminalbox-note.txt'],
    mission: '1行保存して、`cat` で同じ内容を表示してください。',
    hint: '`>` はコマンドの出力でファイル内容を上書きします。',
    check: '`TerminalBox file practice` と表示されればクリアです。',
  },
  {
    id: '09',
    title: 'ファイルを変更する',
    level: 'Kali Desktop 基本操作',
    goal: '既存ファイルへ新しい行を追記します。',
    scenario: '既存の記録を消さずに、調査結果を追記する練習です。',
    commands: ['echo "second line" >> ~/Desktop/terminalbox-note.txt', 'cat -n ~/Desktop/terminalbox-note.txt'],
    mission: '2行目を追記し、行番号付きで変更後の内容を確認してください。',
    hint: '`>>` は既存内容を残して末尾へ追記します。',
    check: '1行目と2行目の両方が表示されればクリアです。',
  },
  {
    id: '10',
    title: 'ファイルを削除する',
    level: 'Kali Desktop 基本操作',
    goal: '対象を確認してからファイルを削除します。',
    scenario: '削除前に対象を確認し、削除後に存在しないことを検証する練習です。',
    commands: ['ls -l ~/Desktop/terminalbox-note.txt', 'rm ~/Desktop/terminalbox-note.txt', 'test ! -e ~/Desktop/terminalbox-note.txt && echo "削除を確認しました"'],
    mission: '対象パスを確認して削除し、存在しないことを検証してください。',
    hint: '`rm` の前に `ls` で対象を確認する習慣を付けます。',
    check: '確認メッセージが表示され、デスクトップからアイコンが消えればクリアです。',
  },
  {
    id: '11',
    title: 'フォルダーを作成する',
    level: 'Kali Desktop 基本操作',
    goal: 'デスクトップ上に作業用フォルダーを作ります。',
    scenario: '演習ファイルをまとめるためのディレクトリ構成を作る練習です。',
    commands: ['mkdir -p ~/Desktop/practice/docs', 'find ~/Desktop/practice -maxdepth 2 -type d'],
    mission: '`practice` と、その中の `docs` を一度に作成してください。',
    hint: '`mkdir -p` は途中のフォルダーもまとめて作成します。',
    check: '`practice` と `docs` の2つのパスが表示されればクリアです。',
  },
  {
    id: '12',
    title: 'コピーして名前を変える',
    level: 'Kali Desktop 基本操作',
    goal: 'ファイルのコピーと名前変更を練習します。',
    scenario: '元ファイルを残しながら別名の作業ファイルを作る練習です。',
    commands: ['echo "original" > ~/Desktop/practice/original.txt', 'cp ~/Desktop/practice/original.txt ~/Desktop/practice/copy.txt', 'mv ~/Desktop/practice/copy.txt ~/Desktop/practice/renamed.txt', 'ls -l ~/Desktop/practice'],
    mission: '`original.txt` をコピーし、コピー側を `renamed.txt` に変更してください。',
    hint: '`cp` は複製、`mv` は移動と名前変更に使います。',
    check: '`original.txt` と `renamed.txt` が両方表示されればクリアです。',
  },
  {
    id: '13',
    title: 'GUIのメモ帳で開く',
    level: 'Kali Desktop 基本操作',
    goal: 'Terminal から Mousepad を起動してファイルを編集します。',
    scenario: 'コマンドで作ったファイルを GUI アプリで開く練習です。',
    commands: ['mousepad ~/Desktop/practice/renamed.txt >/tmp/mousepad.log 2>&1 &'],
    mission: 'コマンドを実行して Kali Desktop を開き、Mousepad にファイル内容が表示されることを確認してください。',
    hint: 'デスクトップ上の `.txt` をダブルクリックしても Mousepad で開けます。',
    check: 'GUIで文章を編集して保存し、`cat ~/Desktop/practice/renamed.txt` で変更を読めればクリアです。',
  },
  {
    id: '14',
    title: 'ファイルの権限を変える',
    level: 'Kali Desktop 基本操作',
    goal: '読み書きできる人を権限で制御します。',
    scenario: 'ファイルの公開範囲を最小にする考え方を体験します。',
    commands: ['chmod 600 ~/Desktop/practice/renamed.txt', 'ls -l ~/Desktop/practice/renamed.txt'],
    mission: '所有者だけが読み書きできる `600` に変更してください。',
    hint: '`600` は所有者の読み取りと書き込みだけを許可します。',
    check: '権限表示の先頭が `-rw-------` になればクリアです。',
  },
  {
    id: '15',
    title: 'フォルダーを圧縮する',
    level: 'Kali Desktop 基本操作',
    goal: '複数ファイルを1つのアーカイブにまとめます。',
    scenario: '作業成果を提出や退避のためにまとめる練習です。',
    commands: ['tar -czf ~/Desktop/practice-backup.tar.gz -C ~/Desktop practice', 'tar -tzf ~/Desktop/practice-backup.tar.gz'],
    mission: '`practice` フォルダーを gzip 形式で圧縮し、中身を一覧表示してください。',
    hint: '`tar -czf` で作成、`tar -tzf` で内容確認ができます。',
    check: 'アーカイブ内に `practice/` 以下のファイルが表示されればクリアです。',
  },
  {
    id: '16',
    title: '練習ファイルを片付ける',
    level: 'Kali Desktop 基本操作',
    goal: '作成した練習データを安全に片付けます。',
    scenario: '削除対象を確認してから、作業フォルダーとバックアップを消す練習です。',
    commands: ['find ~/Desktop/practice -maxdepth 2 -print', 'rm -r ~/Desktop/practice', 'rm ~/Desktop/practice-backup.tar.gz', 'ls -la ~/Desktop'],
    mission: '`find` で削除対象を確認してから、練習フォルダーとアーカイブを削除してください。',
    hint: '`rm -r` はフォルダー全体を削除するため、実行前のパス確認が重要です。',
    check: '`practice` と `practice-backup.tar.gz` が一覧から消えればクリアです。',
  },
  {
    id: '17',
    title: 'ネットワークを確認する',
    level: 'ネットワーク入門',
    goal: '名前解決、ポート、HTTP 応答を確認できるようになる。',
    scenario: 'サービスが見えているか、通信できるかを確かめる練習です。',
    commands: ['ip a', 'getent hosts target', 'ss -tuln', "curl -i -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/api/status"],
    mission: '`target` の名前解決を確認し、HTTP のステータスも確認してください。',
    hint: '`getent hosts` は名前解決、`ss -tuln` は待ち受けポート、`curl` は HTTP 確認です。',
    check: '`curl` で HTTP レスポンスと JSON が見えればクリアです。',
  },
  {
    id: '18',
    title: 'ping の返答を確認する',
    level: 'ネットワーク入門',
    goal: '`ping` で相手までパケットが届き、返答が戻ることを確認する。',
    scenario: 'HTTPを調べる前に、演習用Targetと基本的なIP通信ができるか確認します。',
    commands: ['ping -c 4 target', 'ping -c 4 labtarget'],
    mission: '`target` に4回pingを送り、送信数・受信数・パケットロスを確認してください。',
    hint: '`-c 4` は4回送信したら終了する指定です。`0% packet loss` なら全て返答しています。',
    check: '`4 packets transmitted, 4 received` と応答時間が表示されればクリアです。',
  },
  {
    id: '19',
    title: 'ログを読む',
    level: 'ログ分析',
    goal: '先頭、末尾、行数をすばやく確認できるようになる。',
    scenario: '長いログ全部を読む前に、全体感を掴む練習です。',
    commands: ['head /var/log/dpkg.log 2>/dev/null', 'tail /var/log/dpkg.log 2>/dev/null', 'wc -l /var/log/dpkg.log 2>/dev/null'],
    mission: '`/var/log/dpkg.log` の先頭・末尾・行数を確認してください。',
    hint: '`head`、`tail`、`wc -l` を組み合わせると全体像が見えやすくなります。',
    check: '3 つのコマンドの使い分けができればクリアです。',
  },
  {
    id: '20',
    title: '並べ替えて数える',
    level: '検索コマンド',
    goal: '標準入力を使って並べ替えと集計ができるようになる。',
    scenario: 'ログや一覧を整理して、重複や出現回数を見つける練習です。',
    commands: ['printf "alice\\nbob\\nalice\\n" | sort', 'printf "alice\\nbob\\nalice\\n" | sort | uniq -c'],
    mission: 'サンプルの名前一覧を並べ替え、出現回数を数えてください。',
    hint: '`sort | uniq -c` は基本の組み合わせです。',
    check: '`alice` が 2 回、`bob` が 1 回と表示されればクリアです。',
  },
  {
    id: '21',
    title: '小さなメモを残す',
    level: '実践',
    goal: 'コマンド結果をファイルへ保存できるようになる。',
    scenario: '調査結果を見返せる形で残す練習です。',
    commands: ['mkdir -p ~/terminalbox-notes', 'date > ~/terminalbox-notes/report.txt', "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/api/status >> ~/terminalbox-notes/report.txt", 'cat ~/terminalbox-notes/report.txt'],
    mission: '日時と Target の状態を `~/terminalbox-notes/report.txt` に保存してください。',
    hint: '`>` は上書き、`>>` は追記です。',
    check: '`cat` で保存した内容を確認できればクリアです。',
  },
];

function loadCompletedLessons() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function TutorialPanel({ onInsertCommand, resetSignal }: Props) {
  const [selectedId, setSelectedId] = useState(lessons[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompletedLessons);
  const [queuedCommand, setQueuedCommand] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const lesson = lessons.find((item) => item.id === selectedId) ?? lessons[0];
  const lessonCompleted = completedSet.has(lesson.id);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
  }, [completedIds]);

  useEffect(() => {
    setSelectedId(lessons[0].id);
    setCompletedIds(loadCompletedLessons());
    setQueuedCommand(null);
  }, [resetSignal]);

  useEffect(() => setHintVisible(false), [selectedId, resetSignal]);

  const queueCommand = (command: string) => {
    onInsertCommand(command);
    setQueuedCommand(command);
    window.setTimeout(() => {
      setQueuedCommand((current) => (current === command ? null : current));
    }, 1400);
  };

  const markCompleted = () => {
    setCompletedIds((current) => (current.includes(lesson.id) ? current : [...current, lesson.id]));
  };

  const clearCompleted = () => {
    setCompletedIds((current) => current.filter((id) => id !== lesson.id));
  };

  return (
    <section className="panel tutorial-panel" id="tutorial-panel" role="tabpanel" aria-labelledby="tutorial-tab">
      <div className="panel-heading">
        <div>
          <h2>チュートリアル</h2>
        </div>
        <span className="ai-badge">{completedIds.length}/{lessons.length} CLEAR</span>
      </div>
      <button type="button" className="learning-quick-start" onClick={() => queueCommand("curl -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/api/status")}>
        <span>QUICK START</span><strong>Targetの状態を確認</strong><code>curl -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" http://target:3000/api/status</code>
      </button>

      <div className="tutorial-body">
        <nav className="lesson-list" aria-label="チュートリアル一覧">
          {lessons.map((item) => {
            const completed = completedSet.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`${item.id === selectedId ? 'active' : ''} ${completed ? 'completed' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{completed ? '✓' : item.id}</span>
                {item.title}
              </button>
            );
          })}
        </nav>

        <article className="lesson-detail">
          <div className="lesson-title-row">
            <div>
              <span className="eyebrow">LESSON {lesson.id} / {lesson.level}</span>
              <h3>{lesson.title}</h3>
            </div>
            <span className={`lesson-clear-badge ${lessonCompleted ? 'cleared' : ''}`}>
              {lessonCompleted ? 'クリア済み' : '未クリア'}
            </span>
          </div>
          <p>{lesson.goal}</p>

          <div className="lesson-actions">
            <button type="button" onClick={markCompleted} disabled={lessonCompleted}>
              クリアにする
            </button>
            <button type="button" className="secondary" onClick={clearCompleted} disabled={!lessonCompleted}>
              クリア解除
            </button>
          </div>

          <div className="lesson-card">
            <span>SCENARIO</span>
            <p>{lesson.scenario}</p>
          </div>

          <div className="lesson-card">
            <span>MISSION</span>
            <p>{lesson.mission}</p>
          </div>

          <div className="command-stack" aria-label="使うコマンド">
            {lesson.commands.map((command) => (
              <button key={command} type="button" onClick={() => queueCommand(command)}>
                <code>{command}</code>
                <span>{queuedCommand === command ? 'PASTED' : 'PASTE'}</span>
              </button>
            ))}
          </div>

          <button type="button" className="hint-toggle" aria-expanded={hintVisible} onClick={() => setHintVisible((current) => !current)}>
            <span>HINT</span><strong>{hintVisible ? 'ヒントを隠す' : 'ヒントを表示'}</strong>
          </button>
          {hintVisible && <div className="lesson-card lesson-hint"><p>{lesson.hint}</p></div>}

          <div className="lesson-card lesson-check">
            <span>CHECK</span>
            <p>{lesson.check}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

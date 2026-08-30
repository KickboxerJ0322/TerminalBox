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
    title: 'ネットワークを確認する',
    level: 'ネットワーク入門',
    goal: '名前解決、ポート、HTTP 応答を確認できるようになる。',
    scenario: 'サービスが見えているか、通信できるかを確かめる練習です。',
    commands: ['ip a', 'getent hosts target', 'ss -tuln', 'curl -i http://target:3000/api/status'],
    mission: '`target` の名前解決を確認し、HTTP のステータスも確認してください。',
    hint: '`getent hosts` は名前解決、`ss -tuln` は待ち受けポート、`curl` は HTTP 確認です。',
    check: '`curl` で HTTP レスポンスと JSON が見えればクリアです。',
  },
  {
    id: '08',
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
    id: '09',
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
    id: '10',
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
    id: '11',
    title: '小さなメモを残す',
    level: '実践',
    goal: 'コマンド結果をファイルへ保存できるようになる。',
    scenario: '調査結果を見返せる形で残す練習です。',
    commands: ['mkdir -p ~/terminalbox-notes', 'date > ~/terminalbox-notes/report.txt', 'curl -s http://target:3000/api/status >> ~/terminalbox-notes/report.txt', 'cat ~/terminalbox-notes/report.txt'],
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
          <span className="eyebrow">GUIDED PRACTICE</span>
          <h2>チュートリアル</h2>
        </div>
        <span className="ai-badge">{completedIds.length}/{lessons.length} CLEAR</span>
      </div>
      <button type="button" className="learning-quick-start" onClick={() => queueCommand('curl http://target:3000/api/status')}>
        <span>QUICK START</span><strong>Targetの状態を確認</strong><code>curl http://target:3000/api/status</code>
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

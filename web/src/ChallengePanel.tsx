import { useEffect, useMemo, useState } from 'react';

interface Challenge {
  id: string;
  title: string;
  goal: string;
  commands: string[];
  hint: string;
  result: string;
}

interface ChallengeGroup {
  id: 1 | 2 | 3;
  title: string;
  subtitle: string;
  challenges: Challenge[];
}

interface Props {
  onInsertCommand: (command: string) => void;
  resetSignal: number;
  targetId: 1 | 2 | 3;
  onTargetChange: (targetId: 1 | 2 | 3) => void;
}

const challengeGroups: ChallengeGroup[] = [
  {
    id: 1,
    title: '問題1',
    subtitle: '研修サイトの管理API',
    challenges: [
      {
        id: '01', title: '隠されたバックアップを探す',
        goal: '`robots.txt` を調べ、公開されてはいけない設定ファイルから管理APIとキーを特定してください。',
        commands: ['curl -i http://target:3000/robots.txt', 'curl http://target:3000/backup/config.json'],
        hint: '`Disallow` は検索エンジンへのお願いであり、アクセス制御ではありません。',
        result: '設定JSONに `adminApi` と `adminKey` が表示されれば調査成功です。',
      },
      {
        id: '02', title: 'トップページを改ざんする', goal: '漏えいしたキーで管理APIを呼び、見出しと配色を変更してください。',
        commands: ["curl -X POST http://target:3000/api/admin/banner -H 'Content-Type: application/json' -H 'X-Admin-Key: training-admin-2026' -d '{\"headline\":\"演習サイトは改ざんされました\",\"theme\":\"compromised\"}'"],
        hint: 'JSONを送るときは `Content-Type`、認証値は `X-Admin-Key` ヘッダーに指定します。',
        result: '左下のサイトが赤くなり、見出しが「演習サイトは改ざんされました」になれば成功です。',
      },
      {
        id: '03', title: '偽のメンテナンス画面にする', goal: '同じ脆弱なAPIから、サイトをメンテナンス表示へ切り替えてください。',
        commands: ["curl -X POST http://target:3000/api/admin/banner -H 'Content-Type: application/json' -H 'X-Admin-Key: training-admin-2026' -d '{\"headline\":\"システムメンテナンス中\",\"theme\":\"maintenance\"}'"],
        hint: '攻撃者が管理機能を使えると、偽のお知らせや誘導画面にも悪用できます。',
        result: '左下のサイトが黄色のメンテナンス表示へ変われば成功です。',
      },
      {
        id: '04', title: '偽の緊急メッセージを掲示する', goal: '漏えいしたキーを使い、トップページへ任意の緊急メッセージを追加してください。',
        commands: ["curl -X POST http://target:3000/api/admin/notice -H 'Content-Type: application/json' -H 'X-Admin-Key: training-admin-2026' -d '{\"notice\":\"直ちにパスワードを変更してください\"}'"],
        hint: '管理APIで更新できる項目が多いほど、キー漏えい時の被害も広がります。',
        result: '左下のサイトに赤い緊急メッセージが追加されれば成功です。',
      },
      {
        id: '05', title: '改ざん状態を確認する', goal: 'APIから現在の改ざん状態を取得し、画面とレスポンスが一致するか確認してください。',
        commands: ['curl -s http://target:3000/api/status'], hint: '見た目だけでなく、APIの状態も証拠として記録します。',
        result: '`modified` が `true` で、現在のサイト状態がJSONに含まれていれば成功です。',
      },
    ],
  },
  {
    id: 2,
    title: '問題2',
    subtitle: 'オンラインストアの商品管理',
    challenges: [
      {
        id: '01', title: 'ストアの非公開設定を探す', goal: '`robots.txt` を手掛かりに、バックアップされたストア設定を見つけてください。',
        commands: ['curl -i http://target2:3000/robots.txt', 'curl http://target2:3000/backup/store-config.json'],
        hint: 'バックアップファイルも公開ディレクトリに置けば、URLを知る人から取得できます。',
        result: '`productApi`、`campaignApi`、`adminKey` が確認できれば成功です。',
      },
      {
        id: '02', title: '商品情報を書き換える', goal: '漏えいした管理キーを使い、おすすめ商品の名称・価格・在庫数を変更してください。',
        commands: ["curl -X POST http://target2:3000/api/admin/product -H 'Content-Type: application/json' -H 'X-Admin-Key: store-admin-2026' -d '{\"product\":\"特別セール商品\",\"price\":100,\"stock\":999}'"],
        hint: '価格や在庫の更新APIが適切に保護されていないと、販売情報を任意に変更されます。',
        result: '左下の商品名が「特別セール商品」、価格が100円、在庫が999になれば成功です。',
      },
      {
        id: '03', title: '偽のキャンペーンを掲載する', goal: '管理APIから、利用者を急がせる偽のキャンペーン告知を掲載してください。',
        commands: ["curl -X POST http://target2:3000/api/admin/campaign -H 'Content-Type: application/json' -H 'X-Admin-Key: store-admin-2026' -d '{\"notice\":\"本日限定・全商品90%OFF\"}'"],
        hint: '表示内容の改ざんは、詐欺的な誘導やブランド毀損につながります。',
        result: 'ストア上部に赤いキャンペーン告知が表示されれば成功です。',
      },
      {
        id: '04', title: 'ストアの改ざん状態を確認する', goal: '状態APIを取得し、変更後の商品情報をJSONでも確認してください。',
        commands: ['curl -s http://target2:3000/api/status'], hint: 'レスポンスの `site` に画面と同じ値があるか比較します。',
        result: '`service` が `terminalbox-target-2`、`modified` が `true` なら成功です。',
      },
    ],
  },
  {
    id: 3,
    title: '問題3',
    subtitle: '図書館サイトのデバッグ設定',
    challenges: [
      {
        id: '01', title: 'デバッグ設定の漏えいを調べる', goal: '`robots.txt` から、公開されたデバッグ設定と管理キーを発見してください。',
        commands: ['curl -i http://target3:3000/robots.txt', 'curl http://target3:3000/debug/app-config.json'],
        hint: 'デバッグ用ファイルには、本番で不要な接続先や秘密情報を残さないことが重要です。',
        result: '`heroApi`、`alertApi`、`adminKey` が表示されれば成功です。',
      },
      {
        id: '02', title: '図書館の見出しを改ざんする', goal: '漏えいしたキーを使い、公式サイトの見出しとテーマを変更してください。',
        commands: ["curl -X POST http://target3:3000/api/admin/hero -H 'Content-Type: application/json' -H 'X-Admin-Key: library-admin-2026' -d '{\"headline\":\"図書館サイトは改ざんされました\",\"theme\":\"compromised\"}'"],
        hint: '公式情報を表示するAPIほど、認証情報の管理と操作記録が重要になります。',
        result: '左下の図書館サイトが赤い警告テーマへ変われば成功です。',
      },
      {
        id: '03', title: '偽の休館案内を掲示する', goal: 'お知らせAPIを悪用し、偽の臨時休館メッセージを表示してください。',
        commands: ["curl -X POST http://target3:3000/api/admin/alert -H 'Content-Type: application/json' -H 'X-Admin-Key: library-admin-2026' -d '{\"notice\":\"本日は臨時休館です\"}'"],
        hint: '公共情報の改ざんは、利用者の行動へ直接影響します。',
        result: '図書館サイトに「本日は臨時休館です」と表示されれば成功です。',
      },
      {
        id: '04', title: '図書館サイトの状態を確認する', goal: 'APIレスポンスから、表示中の改ざん内容を確認してください。',
        commands: ['curl -s http://target3:3000/api/status'], hint: '`profile` と `site` の内容から対象と変更内容を確認します。',
        result: '`service` が `terminalbox-target-3`、`modified` が `true` なら成功です。',
      },
    ],
  },
];

const STORAGE_KEY = 'terminalbox:challenge-completed';

function loadCompleted() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').map((id) => id.includes(':') ? id : `1:${id}`);
  } catch { return []; }
}

export function ChallengePanel({ onInsertCommand, resetSignal, targetId, onTargetChange }: Props) {
  const group = challengeGroups.find((item) => item.id === targetId) ?? challengeGroups[0];
  const [selectedId, setSelectedId] = useState(group.challenges[0].id);
  const [queuedCommand, setQueuedCommand] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompleted);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const challenge = group.challenges.find((item) => item.id === selectedId) ?? group.challenges[0];
  const completionId = `${group.id}:${challenge.id}`;
  const completed = completedSet.has(completionId);
  const groupCompleted = group.challenges.filter((item) => completedSet.has(`${group.id}:${item.id}`)).length;

  useEffect(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds)), [completedIds]);
  useEffect(() => { setSelectedId(group.challenges[0].id); setQueuedCommand(null); }, [group]);
  useEffect(() => { setSelectedId('01'); setCompletedIds(loadCompleted()); }, [resetSignal]);

  const queueCommand = (command: string) => {
    onInsertCommand(command);
    setQueuedCommand(command);
    window.setTimeout(() => setQueuedCommand((current) => current === command ? null : current), 1400);
  };

  return (
    <section className="panel tutorial-panel challenge-panel" id="challenge-panel" role="tabpanel" aria-labelledby="challenge-tab">
      <div className="panel-heading">
        <div><span className="eyebrow">TARGET MISSIONS</span><h2>{group.subtitle}</h2></div>
        <span className="ai-badge">{groupCompleted}/{group.challenges.length} CLEAR</span>
      </div>
      <div className="challenge-target-tabs" role="tablist" aria-label="ターゲット問題を選択">
        {challengeGroups.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === targetId} className={item.id === targetId ? 'active' : ''} onClick={() => onTargetChange(item.id)}>
            {item.title}
          </button>
        ))}
      </div>
      <div className="tutorial-body">
        <nav className="lesson-list" aria-label={`${group.title}の一覧`}>
          {group.challenges.map((item) => {
            const itemCompletionId = `${group.id}:${item.id}`;
            return (
              <button key={item.id} type="button" className={`${item.id === selectedId ? 'active' : ''} ${completedSet.has(itemCompletionId) ? 'completed' : ''}`} onClick={() => setSelectedId(item.id)}>
                <span>{completedSet.has(itemCompletionId) ? '✓' : item.id}</span>{item.title}
              </button>
            );
          })}
        </nav>
        <article className="lesson-detail">
          <div className="lesson-title-row">
            <div><span className="eyebrow">{group.title.toUpperCase()} / QUESTION {challenge.id}</span><h3>{challenge.title}</h3></div>
            <span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? 'クリア済み' : '未クリア'}</span>
          </div>
          <p>{challenge.goal}</p>
          <div className="lesson-actions">
            <button type="button" disabled={completed} onClick={() => setCompletedIds((current) => current.includes(completionId) ? current : [...current, completionId])}>クリアにする</button>
            <button type="button" className="secondary" disabled={!completed} onClick={() => setCompletedIds((current) => current.filter((id) => id !== completionId))}>クリア解除</button>
          </div>
          <div className="command-stack" aria-label="問題で使うコマンド">
            {challenge.commands.map((command) => (
              <button key={command} type="button" onClick={() => queueCommand(command)}><code>{command}</code><span>{queuedCommand === command ? 'PASTED' : 'PASTE'}</span></button>
            ))}
          </div>
          <div className="lesson-card lesson-hint"><span>HINT</span><p>{challenge.hint}</p></div>
          <div className="lesson-card lesson-check"><span>CHECK</span><p>{challenge.result}</p></div>
        </article>
      </div>
    </section>
  );
}

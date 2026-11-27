# TerminalBox

**TerminalBoxは、ブラウザでコマンドを実行しながら、サイバーセキュリティの仕組みと対策を学べる実習環境です。**

教材を読み、演習用サイトを調べ、結果を確認し、分からないところをAIに質問できます。自分のPCにLinuxや多数のセキュリティツールをインストールする手間を減らし、実際に手を動かす学習に集中できます。

Google Cloud Run上で動作し、Kali Linux、演習用サイト、学習教材、AI Agentを一つの画面にまとめています。

## はじめての方へ

- **Kali Linux**：セキュリティの調査に使うツールを集めたLinuxです。TerminalBoxではクラウド上のKaliを操作します。
- **ターミナル**：文字で命令（コマンド）を入力して、コンピューターを操作する画面です。
- **ターゲット（Target）**：練習のために用意されたサイトや環境です。
- **脆弱性**：情報の漏えいや、本来できない操作につながるプログラム・設定の弱点です。
- **Flag**：演習の成功を確認するための文字列です。取得したFlagを回答欄に入力すると、正解した問題がCLEARになります。

「攻撃ができた」で終わらず、**何が原因だったのか、どうすれば防げるのか**まで学ぶことを目指しています。

## 画面の見方

PCでは、次の4つの領域を同時に使えます。境界線をドラッグして、左右の幅や上下の高さを調整できます。狭い画面では縦に並び、スクロールして利用します。

| 位置 | 領域 | 使い方 |
| --- | --- | --- |
| 左上 | Kaliワークスペース | コマンド実行、Burp Suite、Wireshark、Kali Desktopの操作 |
| 右上 | 学習パネル | 教材、演習手順、ヒント、回答欄を確認 |
| 左下 | Target | 演習用サイトやLinux演習の状態を確認 |
| 右下 | AI Agent | 質問、実行結果の解説、調査の支援 |

### 学習パネルのタブ

現在の表示順は、**チュートリアル → ターゲット → 脆弱性 → セキュリティツール → 模擬サイト → PHP**です。

| タブ | 学ぶこと |
| --- | --- |
| チュートリアル | コマンド操作やKali Desktopの使い方を、手順に沿って練習 |
| ターゲット | 問題1〜5で、Webサイトの秘密情報管理、認可、入力値処理、認証と防御を学習 |
| 脆弱性 | 問題6〜9で、Linuxの権限や設定ミスによる影響を疑似環境で学習 |
| セキュリティツール | 10種類のツールを、専用の演習環境で実際に使用 |
| 模擬サイト | URLと任意のスクショからAIが教材を生成。管理キーの取得、表示の改ざん、Flag回答、対策版との比較を体験 |
| PHP | 正規ログインでの顧客確認後、PHP2Shellのメモリ情報漏えいと修正後の防止を概念的に模擬 |

### Kaliワークスペースのタブ

| タブ | 用途 |
| --- | --- |
| Terminal | Linuxコマンドや調査ツールを実行 |
| Burp Suite | Web通信を観察・編集するツールを起動 |
| Wireshark | 記録された通信データを調べるツールを起動 |
| Kali Desktop | Linuxのデスクトップをブラウザで操作 |

GUIツールは共通のKali Desktop上で起動します。起動直後は表示まで数秒かかることがあります。「別画面で開く」から大きな画面でも利用できます。問題6〜9の疑似Linux演習中は、Terminalを使います。

上部の**INFO**はアプリの説明、**COMMAND**はコマンドの一覧、**RESET**は現在の演習環境の初期化です。

## 学習の進め方

1. 運営者から案内されたURLを開きます。入口で案内されたユーザー名とパスワードを入力します。
2. 初めて使う場合は「チュートリアル」でコマンド操作を練習します。
3. 「ターゲット」で問題を選び、右上の手順を読みます。
4. 左上のTerminalでコマンドを実行し、左下のサイトや実行結果の変化を確認します。
5. 条件を満たしたらFlagを取得し、教材の回答欄に入力します。
6. 原因と防御方法の設問に回答し、なぜ成功したのかを振り返ります。
7. 「脆弱性」や「セキュリティツール」へ進み、学習範囲を広げます。

困ったときはAI Agentへ「この結果はどういう意味？」「次に何を確認すればよい？」と質問できます。最初からやり直したいときはRESETを使います。

## 演習の内容

### Webセキュリティ：問題1〜5

基本的に、**ATTACK（実際に試す）→ UNDERSTAND（原因を理解する）→ DEFEND（対策を学ぶ）**の順で進めます。

| 問題 | テーマ | 体験する内容 |
| --- | --- | --- |
| 問題1 | 秘密情報管理 | 公開されたバックアップ設定が、管理機能の悪用につながることを確認 |
| 問題2 | 認可 | ログインできることと、他人のデータを操作できることの違いを確認（IDOR） |
| 問題3 | 入力値処理 | 入力がSQLの命令として扱われる問題を体験（SQL Injection） |
| 問題4 | セッション・認証 | ログイン状態を示すトークンの改変と、検証の重要性を学習 |
| 問題5 | 多層防御 | 問題1〜4の対策が施されたサイトで、攻撃が防がれることを確認 |

問題5は、防御を確認する演習です。問題ごとの達成条件は教材に記載されています。Flagはセッションごとに生成され、`TBX{target1_**}`のような形式で表示されます。

### Linuxの脆弱性・設定ミス：問題6〜9

| 問題 | テーマ | 学ぶこと |
| --- | --- | --- |
| 問題6 | Copy Fail | OSの中核であるカーネルの不具合によって、権限が昇格する考え方 |
| 問題7 | File Permission | ファイルの所有者・グループ・読み書き実行の権限と、過剰な書き込み権限 |
| 問題8 | SUID設定ミス | 所有者の権限で動作するプログラムの設定が、危険につながる仕組み |
| 問題9 | sudo設定ミス | 管理者権限を委ねる設定と、必要以上の権限を与える危険性 |

問題6〜9は、**疑似Linux Lab**で実施します。Cloud Runの実際のカーネルを攻撃する演習ではなく、教材用に権限昇格やファイル操作の結果を再現します。Flagもセッションごとに異なります。

### セキュリティツール：10種類の実践教材

| ツール | 主な用途 |
| --- | --- |
| Burp Suite Community | ブラウザとWebサイトの間の通信を観察・編集 |
| Wireshark / tshark | 通信の記録を画面やコマンドで解析 |
| Gobuster | Webサイトのディレクトリやファイルを探索 |
| Nikto | Webサーバーの設定や既知の問題を調査 |
| sqlmap | SQL Injectionの検証 |
| John the Ripper | パスワードの強度を検証 |
| Hashcat | ハッシュ化されたパスワードの強度を検証 |
| Netcat | TCP通信の接続や送受信を確認 |
| Hydra | ログイン認証に対する試行を演習 |
| Metasploit Framework | 脆弱性検証の仕組みを学習 |

ツール用の演習先は`labtarget`です。WiresharkはCloud Runの制約に合わせ、配布された通信記録ファイル（PCAP）を使うオフライン解析です。

## 模擬サイト

「模擬サイト」タブでは、URLと任意のスクショを参考に、AIが架空の学習用Webサイトを生成します。元サイトの見た目や機能を完全に再現するものではありません。サイトの用途・配色・配置を参考にしながら、演習は問題1と同じ「公開バックアップから管理キーを取得し、管理APIで表示を変更する」内容に統一しています。難易度・テーマの選択は不要です。

生成後は「ヒントを表示」を押してください。ヒントは初期状態では非表示で、同じボタンから隠せます。ヒント内の4つのコマンドを上から順にコピーしてKaliのTerminalへ貼り付け、Enterを押してください。コマンドの編集や管理キーの書き写しは不要です。

1. robots.txtで公開ファイルの手がかりを見る。
2. バックアップから管理APIと管理キーを取得する（内容は自動でファイルに保存）。
3. 管理キーを自動で読み取り、管理APIでサイトの「改ざんしました」と赤系の表示に変更する。表示画面は変更を検知して自動更新される（通常1秒程度）。
4. Flagを取得し、返されたTBX{…}を回答欄へ貼り付ける。

「コピー」はクリップボードへコピー、「Terminalへ」は貼り付けです。実行にはEnterを押します。正しいFlagを回答すると「クリア」と表示され、「クリア解除」で取り消せます。成功理由と対策は手順内のヒントに記載しています。個別のAI解説はありません。Secure版と比較できます。Secure版はバックアップを公開せず、演習用の管理キーによる変更を拒否します。

- 元サイトへの攻撃・診断は行いません。取得するのは公開HTMLだけで、外部スクリプトや画像は取得しません。教材のバックアップ・キー・弱点は学習用に作成したものです。
- 公開IPv4のHTTPS（443番）に対応します。IPv6併存は対応、内部・予約済みIPv4を含むサイトとIPv6のみのサイトは拒否します。転送先も毎回確認し、最大3回までたどります。各取得は10秒まで、取り込むHTMLは512,000バイト（約500KB）までです。上限に達したら接続を終了し、取得済みの部分を参考に生成します。ページ後半の内容や、JavaScriptで後から表示される情報は含まれないことがあります。
- PNG・JPEG・WebPのスクショを任意で添付できます（元画像10MB以下）。画像を長辺1600px以下のJPEGへ縮小してAIに送ります。URL取得に失敗した場合は画像から生成できます。
- Kaliの接続先は `http://mocksite:3200/vulnerable/`、対策版は `http://mocksite:3200/secure/` です。手順のコマンドにはセッションヘッダーを含めています。
- 表示画面の「模擬」ボタンで切り替えられます。戻る・再読み込み・HP復元・表示中URLを利用できます。HP復元は生成時の見た目に戻し、演習状態とFlagを初期化します。
- Flagは他の演習と同じく末尾2桁です（`TBX{mock_ab}`）。生成は1セッション3回までです。失敗も回数に含みます。AIの空応答や生成上限では1回自動再試行し、失敗理由を表示します。

## PHP2Shell：メモリ漏えいの模擬演習

PHPタブは、CVE-2026-109618の情報漏えいの影響を概念的に学ぶ教材です。実際にこの脆弱性を悪用するものではありません。Targetと学習パネルには次の注意書きを表示します。

> PHP2Shellのメモリ情報漏えいを概念的に再現した模擬演習であり、実際の脆弱性や攻撃手順の再現ではない

### 初期状態と学習手順

最初から①領域確保、②異常終了・解放、③別の正規利用者の処理で架空顧客情報が置かれた状態を、教材側で準備しています。①〜③は攻撃者が実行する操作ではありません。実際のOOMやクラッシュも起こしません。修正前モデルでは古い参照が残り、修正後モデルでは古い参照が消去されています。

1. **比較**：PHPタブを開くと「PHP / 任意の比較」から始まります。ID・パスワードで顧客一覧を確認してログアウトし、正常な表示と未ログインの状態を比較します。この手順は学習の導入であり、実際の情報漏えいに攻撃者のログインが必要という意味ではありません。
2. **ATTACK**：ログインせず、④に相当するstep=inspectのコマンドだけを実行します。架空のmemoryFragmentに氏名・生年月日・メールアドレス10件が表示され、flagのTBX{php_**}を回答します。
3. **UNDERSTAND**：解放済み領域の古い参照と情報漏えいの関係を、選択式で確認します。
4. **DEFEND**：修正後モデルへ同じ④だけを送ります。blocked:trueとなり、顧客情報もFlagも返りません。実運用の対策はPHP本体の修正済みバージョンへの更新です。

進捗は全4段階です。正規ログイン成功で1/4、ATTACK・UNDERSTAND・DEFENDに正解すると順に進み、4/4で全問クリアになります。クリア解除・初期化で0/4に戻ります。

学習フローは正規ログインによる比較から始まります。学習パネルの「任意の比較」でセッション専用ID・パスワードを確認し、Targetでログインすると、同じ架空の顧客10件を表示できます。このログインは模擬演習の開始条件ではありません。通常の未認証の顧客一覧アクセスは拒否されます。教材サイトのIDとLinuxのOSユーザー名は別の概念です。

PHPタブの初期表示・再表示・RESET後は比較手順です。正規ログイン成功とATTACK・UNDERSTAND・DEFENDの3設問の正解で全4段階のクリアです。ヒントは初期状態で非表示です。表示モデルを切り替えると、ATTACK/DEFENDのコマンドと状態表示もそのモデルに揃います。

### 表示と実装範囲

| 項目 | 内容 |
| --- | --- |
| Target | 修正前：http://phptarget:3300/vulnerable/ ／ 修正後：http://phptarget:3300/secure/ |
| サイト名 | 顧客情報管理サイト ／ 顧客情報管理サイト（修正後） |
| 正規の顧客一覧 | 各版のcustomers・api/customers。サイト用ログインCookieが必要。すべて架空の10件 |
| 模擬演習 | 各版のapi/memory-demoへPOSTし、step=inspectだけを指定。教材専用の通信形式であり、実際の攻撃リクエストではありません |
| 架空メモリ | Node.jsの状態モデル。準備済みのSLOT-Aは実メモリアドレスではありません。情報取得時の固定CSV読み取りは教材データを自動供給する内部処理です |
| PHPの役割 | 専用ユーザーUID/GID 1001で、共通の架空顧客CSVを読み取るだけ。任意コマンド・proc_open等は無効 |
| セッション | コマンドにX-TerminalBox-Sessionを付与。Flag・進捗・モデル・ログインは演習セッション単位で管理 |
| ログイン | phpstudentという教材用IDとセッション専用パスワード。Cookieは版ごと・15分有効。認証後の一覧表示だけではFlagを与えません。比較から学習を始めますが、サーバー側の模擬漏えい処理にログインは要求しません |
| スクロールバー | iframeのルートの標準スクロールを止め、PHPページ内の専用スクロール領域を使用。半透明の細いノブと透明なトラックを領域に直接適用 |

「クリア解除」は採点状態だけを解除します。PHP初期化・HP復元・全体RESETは、進捗・Flag・ログインを初期化し、両モデルを①〜③準備済みに戻します。他の利用者への実メモリ参照は行いません。修正後モデルへの切り替えは、実際のPHPの更新ではありません。

検証：cd backend && npm test、cd web && npm run build。PHP CLIがある環境ではpython3 php-target/test_lesson.pyで固定CSV読み取りと旧コマンドの拒否を確認できます。反映にはWeb・Labの再ビルド／デプロイが必要です。

参考：[Recorded Future](https://www.recordedfuture.com/jp/blog/php2shell-vulnerability-exploitation)、[Wiz Research](https://www.wiz.io/blog/php2shell-php-rce)。

## AI Agentでできること

AI Agentは、**Geminiが次の行動を考え、TerminalBoxがコマンドを審査・実行し、その結果をGeminiが読んで次の行動を決める**学習支援機能です。質問への回答に加え、必要に応じてLab内のKaliで調査できます。

例えば「現在のユーザーとファイル一覧を確認して」と依頼すると、AIが確認コマンドを提案し、TerminalBoxが審査して実行します。取得した結果をAIへ返し、追加確認または日本語での最終回答へ進みます。Geminiが直接ターミナルへ接続するわけではありません。

### AIに渡す情報と記憶の範囲

送信時に、次の情報を添付するか選べます。

| 情報 | 内容・上限 |
| --- | --- |
| 依頼文 | 2,000文字以内 |
| AI会話履歴 | 初期状態で添付。直近6件まで、各400文字・合計2,400文字まで |
| 直近のターミナル履歴 | 初期状態で添付。コマンドとその出力・エラーを含み、サーバー側の既定上限は末尾2,000文字 |
| ターミナル全文 | 選択時に、現在のターミナルバッファに残る記録を最大120,000文字まで送信。過去の全操作を永久保存する機能ではありません |
| キャプチャ | 選択時にTerminalBox画面をJPEG画像として添付 |

**質問文を入力せず、ターミナル記録だけを送ることもできます。** 画面側が分析を依頼する文章を補い、AIは実行済みのコマンドと出力を読み取って、状況・結果・エラー・次の確認事項を日本語で説明します。記録だけで答えられる場合は、追加コマンドを実行しない方針です。

今回の依頼中にAIが実行した結果も、次の判断へ渡します。各ステップでAIへ送る標準出力は先頭12,000文字、標準エラーは先頭6,000文字までで、終了コードも含みます。会話によってモデル自体を追加学習する仕組みや、永続的な長期記憶はありません。選択中の問題番号・教材本文・達成状況は、専用の項目として自動添付されません。必要な状況を依頼文や記録で伝えてください。

### 行動を決める仕組み

Geminiには、次のいずれかのJSONを返すよう指示します。

- `execute_command`：次に実行したいコマンドと理由。
- `final_answer`：利用者に表示する日本語の回答。

処理は次の順です。

1. 利用者の依頼、選択した添付情報、今回の実行結果をGeminiへ送ります。
2. Geminiが回答できる場合は、最終回答を表示して終了します。
3. 追加確認が必要な場合は、提案されたコマンド名・引数・構文をTerminalBoxのコードで審査します。
4. 自動実行、事前承認、拒否のいずれかに分岐します。
5. 実行した場合は結果をGeminiへ返し、次の判断へ進みます。

実行する場所はLab内のKaliで、`student`権限（UID/GID 1000）を使います。Web側からLabへ中継し、Lab側でもコマンドと承認状態を再確認します。解析済みのコマンド名・引数を専用のPythonプログラムで起動し、コマンド文字列をそのまま`bash -c`で実行しない構成です。

### コマンドの3つの分類

**次の制限は、AI Agentが実行するコマンドの規則です。利用者が手入力するTerminal全体の許可リストではありません。** 教材で利用できるツールでも、AI Agentからは実行できないものがあります。

分類はAIの自己申告ではなく、[command-policy.js](backend/src/agent/command-policy.js)で決めます。同じコマンドでも引数によって分類が変わります。`READ_ONLY`は実装上の分類名であり、すべての引数や接続先の動作について副作用がないことを保証する名称ではありません。

| 分類 | 動作 |
| --- | --- |
| `READ_ONLY` | 許可された閲覧・確認操作として、承認画面を出さずに実行 |
| `CONFIRM_REQUIRED` | 実行予定のコマンドと理由を表示し、「実行を許可」を押した場合だけ実行 |
| `DENIED` | 実行せず、その依頼の処理を停止。利用者の承認による解除はできません |

### 自動実行の対象になるコマンド

次は、基本分類が`READ_ONLY`のコマンドの全一覧です。後述する変更オプションや禁止条件を含む場合は、承認対象または拒否になります。

| 用途 | コマンド |
| --- | --- |
| 現在位置・ユーザー・環境 | `pwd`、`whoami`、`id`、`hostname`、`uname`、`date`、`uptime` |
| ファイルの閲覧・検索 | `ls`、`stat`、`file`、`wc`、`head`、`tail`、`cat`、`grep`、`find`、`sed` |
| コマンド・環境変数の確認 | `which`、`whereis`、`type`、`env`、`printenv` |
| ディスク・メモリ・プロセス | `df`、`du`、`free`、`ps`、`top` |
| ネットワーク情報・内部宛ての確認 | `ip`、`ss`、`netstat`、`ping`、`traceroute`、`dig`、`nslookup`、`curl`、`nmap`、`tshark` |

追加で、`git status`、`git log`、`git diff`、`git show`、引数なしの`git branch`、`git remote`、`git remote -v`、`systemctl status`は自動実行の対象です。`git branch`のオプション付き操作は、削除・移動・コピーなどに該当するかを個別判定します。

例：`pwd`、`whoami`、`ls -la`、`cat notes.txt`、`curl http://target:3000/`、`git status`。

### 事前承認が必要なコマンド・引数

| 対象 | 承認が必要になる操作 |
| --- | --- |
| ファイル・ディレクトリの変更 | `touch`、`mkdir`、`cp`、`mv`、`rm`、`rmdir`、`chmod`、`chown`、`ln`、`tee`、`truncate`、`dd` |
| パッケージ変更 | `apt`、`apt-get`。また、`pip`／`pip3`の`install`・`uninstall`、`npm`の`install`・`i`・`ci`・`uninstall`・`update` |
| プロセス・サービス | `kill`、`pkill`、`killall`。`systemctl`は先頭の引数が`status`の場合を除いて承認対象 |
| Git | 上記の閲覧操作や禁止条件に該当しないGit操作。例：`git add`、`git commit` |
| `find` | `-delete`、`-fprint`、`-fprint0`、`-fprintf`、`-fls` |
| `sed` | 許可された式での`-i`／`--in-place`によるファイル更新 |
| `curl` | ファイル保存・アップロード・データ送信。例：`-o`、`-O`、`-T`、`-d`、`-F`、`--json`と、実装が判定する対応する長形式など |
| HTTPメソッドの指定 | `-X`／`--request`で`GET`・`HEAD`以外を指定。例：`curl -X POST http://target:3000/api/reset` |
| 結果の保存 | `nmap -oN`／`-oX`／`-oS`／`-oG`／`-oA`、`tshark -w` |
| ネットワーク設定の変更 | `ip`の引数に`add`、`del`、`delete`、`replace`、`change`、`flush`、`set`を含む場合 |
| リダイレクト | 原則として`>`、`>>`、`<`、`1>`、`1>>`、`2>`、`2>>`を含む操作。入力リダイレクトも承認対象です |

実装上、`git`と`systemctl status`には後段での分類の再設定があるため、リダイレクトを組み合わせた場合も最終分類はコードの判定に従います。

**承認は実行の成功を保証しません。** `student`に権限がない操作、必要なサービスが動いていない操作、外部通信が必要なパッケージ取得などは、承認しても失敗する場合があります。承認によって管理者権限や外部通信権限が追加されることはありません。

### 拒否されるコマンド・構文

| 対象 | 拒否条件 |
| --- | --- |
| 権限昇格 | `sudo`、`su` |
| OS・ディスク操作 | `shutdown`、`reboot`、`poweroff`、`mount`、`umount`、`fdisk`、`mkfs`、`parted` |
| コンテナ・クラウド管理 | `docker`、`kubectl`、`gcloud`、`aws`、`az` |
| シェル実行など | `bash`、`sh`、`eval`、`exec`、`source`、`.` |
| 許可リスト外 | 例：`python3`、`node`、`wget`、`nc`、`sqlmap`、`hydra`、`msfconsole`、`cd`、`history`。プロンプトに例があっても、実行可否は許可リストが優先されます |
| 実行ファイルのパス指定 | `/usr/bin/ls`、`./script`など。実行するコマンド名に`/`を含む場合は拒否します。ファイルの引数にパスを使うこととは別です |
| 外部宛ての通信 | 接続先を検査するコマンドで、許可された内部ホスト以外を指定した場合 |
| 接続先の省略 | `curl`、`ping`、`traceroute`、`dig`、`nslookup`、`nmap`で、明示的な内部宛先がない場合 |
| 別コマンドの起動 | `find -exec`／`-execdir`／`-ok`／`-okdir`、引数付きの`env`、`ip`の`exec` |
| `sed`の制限 | スクリプトファイル指定（`-f`／`--file`）や、実装が許可する表示・削除・終了・行番号表示・置換の式以外 |
| `nmap`の制限 | `--script`、`-iL`／`--input-file` |
| `curl`の制限 | `-K`／`--config`による設定ファイル指定 |
| `tshark`の制限 | `-X`で始まる拡張実行オプション |
| Gitの実行設定変更 | `-c`、`--exec-path`、`--config-env`、`--ext-diff`、`--textconv` |
| パッケージ管理の制限 | `npm`／`pip`／`pip3`で、上表の許可されたサブコマンド以外。例：`npm run`、`pip list` |
| 広い範囲の削除 | `rm`の引数が`/`、`/home`、`/home/student`、`~`に一致する場合 |
| コマンド置換など | `$()`、バッククォート、`<()`、`>()`、`${...}`を含む文字列 |
| その他の構文 | 改行・NULを含むコマンド、2,000文字超、単独の`&`によるバックグラウンド実行、解析できない構文 |

### 内部ホストと複数コマンドの扱い

コマンド審査で許可する内部ホスト名は、次のとおりです。

`target`、`target2`、`target3`、`target4`、`target5`、`labtarget`、`mocksite`、`localhost`、`127.0.0.1`、`::1`、`kali`

これはAgent側の接続先判定です。Lab自体の外部IPv4通信遮断は、別途VPC・Firewallで行います。許可ホストであっても、ポートやサービスの状態により接続できるとは限りません。

1回のAI応答では1つのコマンド文字列を扱いますが、その中のパイプ（`|`）、`;`、`&&`、`||`は解析できます。含まれる各コマンドを審査し、1つでも拒否なら全体を拒否、拒否がなく承認対象を含むなら全体を承認対象にします。実行プログラムには、列挙する処理は最大12、各パイプラインは最大8コマンドという上限もあります。

### 承認・停止・回数制限

変更操作では、実行予定のコマンドと理由を確認してから「実行を許可」または「キャンセル」を選びます。承認すると、保存済みのコマンドを実行し、結果をAIへ返して途中から続行します。承認はそのセッション・そのコマンドに対して1回限りで、有効期限は既定で2分です。次の変更操作には再び承認が必要です。

| 項目 | 既定値・動作 |
| --- | --- |
| 1回の依頼 | 最大15実行ステップ |
| 同じコマンドの連続提案 | 停止。同じコマンドが間を空けて再登場する場合まで一律に止めるものではありません |
| 1コマンドの実行時間 | 10秒。設定可能範囲は1〜30秒 |
| 1セッションの依頼回数 | 10回。画面に使用回数を表示。処理失敗もカウントされます |
| Geminiとの通信 | 1回の通信で60秒のタイムアウト。不完全なJSONの場合は1回再試行 |
| 待機中の動作 | 常時監視は行わず、送信または承認をきっかけに処理 |

依頼回数はAPI呼び出し回数とは異なります。1回の依頼でも、実行結果を見て次を判断するたびにGemini APIを呼ぶため、複数回のAPI利用が発生します。

既定モデルはコード上で`gemini-3.7-flash`です。モデル、ステップ数、実行時間、依頼回数は設定値であり、実際の利用可否や稼働値はデプロイ先の設定に依存します。Geminiとの通信とAPIキーの管理はWeb側が担当し、キーをLabへ渡しません。

### 操作範囲と隔離の限界

- Agentのコマンドは、利用者が開いている対話型Terminalとは別プロセスで動きます。Terminal内の`cd`や、そのシェルだけで設定した変数をそのまま引き継ぎません。現行のPython実行プログラムでは作業ディレクトリが`/home/student`に固定されているため、利用者のTerminalの現在位置と一致するとは限りません。
- 問題6〜9の疑似Linux Labを操作する専用の実行経路は、Agentにはありません。添付記録の解説はできますが、Agentのコマンド実行先はKaliです。
- キャプチャは送信時の画像です。各ステップでの自動撮影や、画面をクリック・キー入力して操作する機能はありません。
- プロンプトでも、外部への攻撃、実際の基盤への権限昇格、reverse shellを提案しない方針を指定しています。これはAIへの行動指示であり、コマンド審査やネットワーク制限を置き換えるものではありません。教材の疑似権限昇格と実際の基盤への操作は区別して扱ってください。
- Labは共有の実行基盤です。セッション別の保存先を作りますが、Linux上では同じ`student`ユーザーを使うため、利用者ごとの独立したVMやコンテナによる隔離ではありません。Agentの承認機能だけで、手動操作を含むLab全体の安全性を保証するものではありません。

実装の確認先：[画面と添付](web/src/AgentPanel.tsx)、[APIと文脈の組み立て](backend/src/server.js)、[行動ループ](backend/src/agent/agent-service.js)、[コマンド審査](backend/src/agent/command-policy.js)、[承認管理](backend/src/agent/approval-store.js)、[実行処理](backend/src/agent/command-executor.js)、[Python実行プログラム](kali/agent-executor.py)、[設定](backend/src/config.js)。

## 利用者ごとの環境とRESET

演習の状態は、個人のログインIDではなく、ブラウザに発行する**セッションID**で管理します。Web入口ではBasic認証を使い、Labとの内部通信には専用の認証を使います。

ホームディレクトリ、ログ、演習の状態、進捗、ターミナル、デスクトップ、AIの承認状態などをセッションごとに管理します。既定の同時セッション上限は20で、最終アクセスから30分で期限切れとなる設計です。

RESETは現在のセッションを初期化します。他の利用者の演習状態を初期化する操作ではありません。演習は一時的な環境です。サービスの再起動・再デプロイ、セッション期限切れ、ブラウザのCookie削除などで状態が失われる場合があるため、必要な記録は手元に残してください。

## システムの仕組み

Google Cloud Runのサービスを、画面やAIを担当する**Web**と、演習を実行する**Lab**に分けています。

| サービス | 役割 |
| --- | --- |
| `terminalbox`（公開Web） | ブラウザ向け画面、匿名セッション管理、URL解析・画像送信、Gemini通信、Labへの中継 |
| `terminalbox-lab`（非公開Lab） | Kali、Terminal、Desktop、問題1〜5、ツール用Target、疑似Linux Lab、模擬サイトの演習処理、コマンド実行 |

ブラウザはWebサービスに接続し、演習の通信はWebがLabへ中継します。LabはCloud Runの内部向け接続設定と認証を使用し、Web用サービスアカウントに呼び出し権限を付与します。

### 外部通信と秘密情報

- Labから一般インターネットへのIPv4通信は、VPCのファイアウォールで拒否する構成です。
- 演習サイトはLab内部のループバックアドレスで動作します。
- WebはCloud NAT経由でGemini APIと模擬サイト生成用の公開HTTPSサイトへ接続します。URLの接続先はWeb側で検証します。
- Gemini APIキーはLabへ渡しません。Web入口の認証にはSecret Managerに登録したパスワードハッシュを使います。
- WebとLabの内部API認証には、専用の内部トークンを使います。このトークンは両サービスへSecret Managerから渡します。
- Lab用サービスアカウントには、インフラ準備スクリプトでプロジェクト単位のIAMロールを付与しません。

セッションごとに状態を分けますが、Labの実行基盤は共有しています。利用者ごとに独立した仮想マシンを作る構成ではありません。ネットワークや権限の設定が実際に有効かは、デプロイ後に確認します。

## 開発者・運営者向け情報

### 主な技術

| 分野 | 使用技術 |
| --- | --- |
| 画面 | React、TypeScript、Vite、xterm.js |
| API・中継 | Node.js、Express、WebSocket |
| 演習環境 | Kali Linux、noVNC、演習用Webサーバー、疑似Linux Lab |
| AI | Gemini API |
| 実行・ビルド | Google Cloud Run、Cloud Build、Artifact Registry |
| 秘密情報・通信 | Secret Manager、VPC、Cloud NAT、Firewall |

### リポジトリの主なファイル

| パス | 内容 |
| --- | --- |
| `web/` | 画面と学習教材 |
| `backend/` | API、セッション管理、AI Agent、通信の中継 |
| `target/` | 問題1〜5のWeb演習サイト |
| `php-target/` | PHP教材、共通の架空データ、実PHPでの実習テスト |
| `challenge-target/` | セキュリティツール用の演習サーバー |
| `kali/` | Kaliの起動・デスクトップ・ツール用の設定 |
| `challenges/` | 演習データ |
| `config/` | AIへの指示文 |
| `cloud/` | Cloud Run用の起動・ネットワーク構築スクリプト |
| `cloudbuild.yaml` | WebとLabのビルド・デプロイ設定 |
| `Dockerfile.web.cloud` / `Dockerfile.lab.cloud` | 各サービスのコンテナ定義 |
| `docs/` | 構成の補足資料 |

現在の運用対象はCloud Run版です。ローカルDocker ComposeやローカルLLMで起動する手順は提供していません。

## Google Cloud へのデプロイ

### 1. プロジェクトとリージョンを指定

Google Cloudの課金が有効なプロジェクト、Google Cloud CLI（`gcloud`）、PowerShellを用意し、必要なリソースを作成できるアカウントで認証してください。以下はリポジトリのルートで実行します。

PowerShell では次のように指定します。

```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
$env:TERMINALBOX_REGION="asia-northeast1"
```

### 2. Gemini APIキーを登録

Gemini APIキーをSecret Managerに登録します。

```powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
$geminiKey = Read-Host 'Gemini API key' -AsSecureString
$credential = [PSCredential]::new('unused', $geminiKey)
$plainGeminiKey = $credential.GetNetworkCredential().Password
$plainGeminiKey | gcloud secrets versions add GEMINI_API_KEY --data-file=-
Remove-Variable plainGeminiKey, credential, geminiKey

```

すでに Secret が存在する場合は `gcloud secrets create` を省略し、新しい version だけを追加します。

### 3. インフラを準備

```powershell
./cloud/setup-infrastructure.ps1
```

このスクリプトで、主に次の環境を準備します。

- 必要な Google Cloud API
- Web / Lab 用 Service Account
- 内部 API Token
- VPC / Subnet
- Lab の外向き通信を拒否する Firewall Rule
- Cloud Router / Cloud NAT
- Secret Manager の IAM

### 4. 入口のBasic認証を準備

Cloud Shellで `htpasswd` を使い、パスワードを対話入力で設定します。未導入の場合は `sudo apt-get update && sudo apt-get install -y apache2-utils` を実行してください。

```bash
(
  set -e
  project="YOUR_PROJECT_ID"
  umask 077
  auth_file="$(mktemp)"
  trap 'rm -f "$auth_file"' EXIT

  htpasswd -cB "$auth_file" tbx-user
  gcloud secrets create terminalbox-basic-auth --project="$project" \
    --replication-policy=automatic --data-file="$auth_file"
  gcloud secrets add-iam-policy-binding terminalbox-basic-auth --project="$project" \
    --member="serviceAccount:terminalbox-web-runtime@$project.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
)
```

既にSecretがある場合は `gcloud secrets versions add terminalbox-basic-auth --project="$project" --data-file="$auth_file"` で新しいバージョンを登録し、`cloudbuild.yaml` のマウント指定をそのバージョン番号に更新します。利用者にはHTTPSのURLを案内してください。

### 5. Cloud Build で公開

```powershell
gcloud builds submit `
  --project=$env:GOOGLE_CLOUD_PROJECT `
  --config=cloudbuild.yaml `
  --substitutions="_REGION=$env:TERMINALBOX_REGION"
```

`cloudbuild.yaml` は Web と Lab の 2 イメージを build / push し、その後 2 つの Cloud Run サービスをデプロイします。

- `Dockerfile.web.cloud` → `terminalbox`
- `Dockerfile.lab.cloud` → `terminalbox-lab`

現在の Lab は Cloud Run 上で 4 vCPU / 8 GiB、Web は 1 vCPU / 1 GiB を基本構成とし、どちらも `max-instances=1` としています。

## デプロイ後の確認

Cloud Runへ反映した後、実際のサービスで以下を確認してください。

- 未認証で `/terminalbox/` を開くとBasic認証を求められ、正しい認証情報で画面が表示される。未認証の `/api/health` と `/ws/terminal` は `401` を返す。
- 学習タブが「チュートリアル、ターゲット、脆弱性、セキュリティツール、模擬サイト」の順で表示される。
- Terminal、Target、Desktop、AI Agentが利用できる。
- 問題1〜5、問題6〜9、ツール教材を切り替えられる。
- 模擬サイトを生成し、ヒントの表示切替、Terminalからの操作、改ざん表示の自動更新、Flag回答とクリア解除、Secure版との比較、HP復元ができる。
- ターミナル記録だけをAIへ送って、説明を受け取れる。
- Labへ外部から直接アクセスできず、Labから一般インターネットへの接続も拒否される。
- 別ブラウザなどで2つのセッションを開き、演習状態とFlagが分かれている。
- RESETが現在のセッションだけに作用する。

LabのTerminalでの疎通確認例です。演習先へはセッションIDを付けてアクセスします。

```bash
for host in target target2 target3 target4 target5; do
  curl -fsS -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" "http://$host:3000/api/status"
done
curl -fsS -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" http://labtarget:3100/api/status
curl --connect-timeout 5 https://example.com/
```

演習先への接続は成功し、外部サイトへの接続は失敗することを確認します。秘密情報の確認では、値を画面やログへ出さず、設定の有無だけを調べてください。

## 利用上の注意

教材のコマンドやツールは、TerminalBoxが提供する演習先、または明示的な許可を受けた環境で使ってください。

AIへ添付したターミナル記録や画面はGeminiへ送信されます。実際の業務情報、個人情報、パスワードやAPIキーを演習や添付に含めないでください。

## 補足資料

- [Cloud RunのWeb / Lab構成資料](docs/cloud-run-web-lab.md)

機能の実装は`web/src/App.tsx`、`web/src/ChallengePanel.tsx`、`web/src/AgentPanel.tsx`、`backend/src/`、`cloudbuild.yaml`などで確認できます。このREADMEは現在のリポジトリ内のコードと設定に基づく説明です。稼働中サービスの状態を保証するものではありません。

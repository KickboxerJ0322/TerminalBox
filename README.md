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

現在の表示順は、**チュートリアル → ターゲット → 脆弱性 → セキュリティツール → 模擬サイト**です。

| タブ | 学ぶこと |
| --- | --- |
| チュートリアル | コマンド操作やKali Desktopの使い方を、手順に沿って練習 |
| ターゲット | 問題1〜5で、Webサイトの秘密情報管理、認可、入力値処理、認証と防御を学習 |
| 脆弱性 | 問題6〜9で、Linuxの権限や設定ミスによる影響を疑似環境で学習 |
| セキュリティツール | 10種類のツールを、専用の演習環境で実際に使用 |

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

1. 運営者から案内されたURLを開き、必要なアクセス認証を行います。
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

「模擬サイト」タブでは、URLと任意のスクショを参考に、AIが架空の学習用Webサイトを生成します。サイトの用途・配色・配置を参考にしながら、演習は問題1と同じ「公開バックアップから管理キーを取得し、管理APIで表示を変更する」内容に統一しています。難易度・テーマの選択は不要です。

生成後は、表示される4つのコマンドを上から順にコピーしてKaliのTerminalへ貼り付け、Enterを押してください。コマンドの編集や管理キーの書き写しは不要です。

1. robots.txtで公開ファイルの手がかりを見る。
2. バックアップから管理APIと管理キーを取得する（内容は自動でファイルに保存）。
3. 管理キーを自動で読み取り、管理APIでサイトの「改ざんしました」と赤系の表示に変更する。表示画面を再読み込みして確認する。
4. Flagを取得し、返されたTBX{…}を回答欄へ貼り付ける。

「コピー」はクリップボードへコピー、「Terminalへ」は貼り付けです。実行にはEnterを押します。正しいFlagを回答すると「クリア」と表示され、「クリア解除」で取り消せます。成功理由と対策は手順内のヒントに記載しています。Secure版と比較できます。Secure版はバックアップを公開せず、演習用の管理キーによる変更を拒否します。

- 元サイトへの攻撃・診断は行いません。取得するのは公開HTMLだけで、外部スクリプトや画像は取得しません。教材のバックアップ・キー・弱点は学習用に作成したものです。
- 公開IPv4のHTTPS（443番）に対応します。IPv6併存は対応、内部・予約済みIPv4を含むサイトとIPv6のみのサイトは拒否します。転送先も毎回確認し、最大3回までたどります。各取得は10秒・512KBまでです。
- PNG・JPEG・WebPのスクショを任意で添付できます（元画像10MB以下）。画像を長辺1600px以下のJPEGへ縮小してAIに送ります。URL取得に失敗した場合は画像から生成できます。
- Kaliの接続先は `http://mocksite:3200/vulnerable/`、対策版は `http://mocksite:3200/secure/` です。手順のコマンドにはセッションヘッダーを含めています。
- 表示画面の「模擬」ボタンで切り替えられます。戻る・再読み込み・HP復元・表示中URLを利用できます。HP復元は生成時の見た目に戻し、演習状態とFlagを初期化します。
- Flagは他の演習と同じく末尾2桁です（`TBX{mock_ab}`）。生成は1セッション3回までです。失敗も回数に含みます。AIの空応答や生成上限では1回自動再試行し、失敗理由を表示します。

## AI Agentでできること

Geminiを使い、質問への回答やコマンド実行を支援します。会話履歴、直近のターミナル記録、ターミナル全文、画面キャプチャを添付するか選べます。

**質問文を入力せず、ターミナル記録だけを送ることもできます。** AIは実行済みのコマンドと出力を読み取り、現在の状況を日本語で説明します。追加の確認が必要な場合は、調査を続けます。

- コマンドは実行前に分類され、読み取り系は自動実行、変更を伴う操作は承認待ち、禁止された操作は実行しない仕組みです。
- 実行結果を確認しながら、1回の依頼で最大15ステップまで続けます。
- 同じコマンドを連続提案した場合は停止します。
- 既定の依頼回数上限は1セッション10回です。残り回数は画面に表示されます。

既定モデルはコード上で`gemini-3.7-flash`に設定されています。モデル、ステップ数、回数制限は設定値であり、実際の利用可否はデプロイ先の設定に依存します。Geminiとの通信とAPIキーの管理はWeb側が担当します。

## 利用者ごとの環境とRESET

演習の状態は、個人のログインIDではなく、ブラウザに発行する**セッションID**で管理します。サービス入口のアクセス認証と、演習状態の管理は別の仕組みです。

ホームディレクトリ、ログ、演習の状態、進捗、ターミナル、デスクトップ、AIの承認状態などをセッションごとに管理します。既定の同時セッション上限は20で、最終アクセスから30分で期限切れとなる設計です。

RESETは現在のセッションを初期化します。他の利用者の演習状態を初期化する操作ではありません。演習は一時的な環境のため、必要な記録は手元に残してください。

## システムの仕組み

Google Cloud Runのサービスを、画面やAIを担当する**Web**と、演習を実行する**Lab**に分けています。

| サービス | 役割 |
| --- | --- |
| `terminalbox`（公開Web） | ブラウザ向け画面、アクセス認証、セッション管理、Gemini通信、Labへの中継 |
| `terminalbox-lab`（非公開Lab） | Kali、Terminal、Desktop、問題1〜5、ツール用Target、疑似Linux Lab、コマンド実行 |

ブラウザはWebサービスに接続し、演習の通信はWebがLabへ中継します。LabはCloud Runの内部向け接続設定と認証を使用し、Web用サービスアカウントに呼び出し権限を付与します。

### 外部通信と秘密情報

- Labから一般インターネットへのIPv4通信は、VPCのファイアウォールで拒否する構成です。
- 演習サイトはLab内部のループバックアドレスで動作します。
- WebはCloud NAT経由でGemini APIに接続します。
- Gemini APIキーと入口のアクセス用パスワードはLabへ渡しません。
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

### 2. APIキーとアクセス用パスワードを登録

Gemini API Key と TerminalBox のアクセス用パスワードを Secret Manager に登録します。

```powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
$geminiKey = Read-Host 'Gemini API key' -AsSecureString
$credential = [PSCredential]::new('unused', $geminiKey)
$plainGeminiKey = $credential.GetNetworkCredential().Password
$plainGeminiKey | gcloud secrets versions add GEMINI_API_KEY --data-file=-
Remove-Variable plainGeminiKey, credential, geminiKey

gcloud secrets create terminalbox-access-password --replication-policy=automatic
$accessPassword = Read-Host 'TerminalBox password' -AsSecureString
$credential = [PSCredential]::new('unused', $accessPassword)
$plainAccessPassword = $credential.GetNetworkCredential().Password
$plainAccessPassword | gcloud secrets versions add terminalbox-access-password --data-file=-
Remove-Variable plainAccessPassword, credential, accessPassword
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

### 4. Cloud Build で公開

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

- アクセス認証後に`/terminalbox/`が表示される。
- 学習タブが「チュートリアル、ターゲット、脆弱性、セキュリティツール」の順で表示される。
- Terminal、Target、Desktop、AI Agentが利用できる。
- 問題1〜5、問題6〜9、ツール教材を切り替えられる。
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

TerminalBoxのWeb入口ではID・パスワードは不要です。匿名セッションで利用します。Lab内部の認証とセッション分離は維持しています。

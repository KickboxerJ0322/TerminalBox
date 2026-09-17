# TerminalBox

TerminalBox は、**Kali Linux・演習用ターゲット・学習教材・AI Agent をブラウザ上にまとめたサイバーセキュリティ学習環境**です。

ローカル PC に Kali Linux や多数のセキュリティツールを個別構築しなくても、Google Cloud Run 上の隔離された Lab で、ターミナル操作、Web セキュリティ、Linux 権限管理、代表的なセキュリティツールを実際に触りながら学べることを目指しています。

現在の正式構成は **Google Cloud Run 版のみ**です。以前のローカル Docker Compose 版、Ollama、ローカル LLM は廃止しており、ローカル Docker での起動・検証は想定していません。

## TerminalBox でできること

TerminalBox の画面は、学習中に必要な情報をできるだけ 1 画面で確認できるように構成しています。

- **Kali Terminal**: Linux コマンドや各種セキュリティツールを実行
- **Target**: 演習用 Web サイトやツール用ターゲットを表示
- **チュートリアル / ターゲット / セキュリティツール / 脆弱性**: 手順、ヒント、解説、Flag 判定を表示
- **AI Agent**: Gemini がターミナル操作を支援
- **Kali Desktop**: noVNC 経由で Kali の GUI を利用
- **RESET**: 現在のセッションだけを初期状態へ戻す

画面は 4 ペイン構成で、左右・上下の境界をドラッグして表示領域を調整できます。

```text
+---------------------------+---------------------------+
| Kali Terminal             | 学習パネル                |
|                           | Tutorial / Target /       |
|                           | Tools / Vulnerabilities   |
+---------------------------+---------------------------+
| Target                    | AI Agent                  |
|                           |                           |
+---------------------------+---------------------------+
```

## 学習コンテンツ

### Web セキュリティ

Target 1〜5 は、単に攻撃手順を実行するだけではなく、基本的に **ATTACK → UNDERSTAND → DEFEND** の順で学ぶ構成です。

| Target | テーマ | 主な学習内容 |
| --- | --- | --- |
| Target 1 | 秘密情報管理 | 公開領域に置かれた設定・Secret の危険性 |
| Target 2 | 認可 | IDOR / Broken Access Control、認証と認可の違い |
| Target 3 | 入力値処理 | SQL Injection、Parameterized Query、入力値検証 |
| Target 4 | セッション / 認証 | JWT 相当トークンの改変、署名・有効期限・失効管理 |
| Target 5 | Defense in Depth | Target 1〜4 の攻撃が防御されることを確認 |

Flag は演習の進行状態に応じて取得し、TerminalBox 上で回答して正解すると CLEAR になります。

### Linux / OS の脆弱性・設定ミス

「脆弱性」タブでは、Web アプリとは別に Linux の権限境界を学びます。

| 問題 | テーマ | 主な学習内容 |
| --- | --- | --- |
| 問題6 | Copy Fail | Kernel LPE の考え方を安全な疑似環境で再現 |
| 問題7 | File Permission | owner / group / rwx と過剰な書き込み権限 |
| 問題8 | SUID 設定ミス | root 所有 SUID プログラムの危険性 |
| 問題9 | sudo 設定ミス | sudoers と過剰な権限委譲 |

Copy Fail を含む Linux 演習は、Cloud Run の実 Kernel を攻撃するものではありません。セッションごとの安全な疑似 Linux Lab で、権限昇格が起きた場合の結果を再現します。

### セキュリティツール

Kali Desktop / Terminal から代表的なツールを学習できます。

- Burp Suite Community
- Wireshark / tshark
- Gobuster
- Nikto
- sqlmap
- John the Ripper
- Hashcat
- Netcat
- Hydra
- Metasploit Framework

Wireshark は Cloud Run の制約に合わせ、リアルタイム packet capture ではなく配布 PCAP を使ったオフライン解析を行います。

## AI Agent

TerminalBox の AI Agent は **Gemini API** を利用します。現在の標準モデルは `gemini-3.7-flash` です。

AI Agent はユーザーの依頼を見て、必要に応じて Lab 内のコマンドを提案・実行します。

- 読み取り系コマンドは自動実行可能
- 更新・変更を伴うコマンドはユーザー承認が必要
- 禁止対象のコマンドは実行しない
- 1 回の依頼で最大 15 ステップまで自律的に続行
- 同じコマンドを連続提案した場合は停止
- 実行結果を次の判断材料として Gemini に返し、必要なら追加調査を継続

Gemini API キーは公開 Lab 側へ渡しません。Gemini との通信は Web サービス側だけで行い、Lab はコマンド実行だけを担当します。

## システム構成

TerminalBox は 2 つの Cloud Run サービスに分離されています。

```text
Browser
   |
   v
+-----------------------------+
| terminalbox                 |
| Public Web Service          |
|                             |
| React UI                    |
| Basic Authentication       |
| Session Management          |
| AI Agent / Gemini API       |
| Approval State              |
| Lab Proxy                   |
+-----------------------------+
              |
              | Google-signed ID token
              v
+-----------------------------+
| terminalbox-lab             |
| Private Lab Service         |
|                             |
| Kali Terminal               |
| Kali Desktop / noVNC        |
| Target 1〜5                 |
| Security Tool Target        |
| Linux Lab                   |
| Agent Command Executor      |
+-----------------------------+
```

ブラウザは `terminalbox-lab` へ直接接続せず、必ず公開 Web サービス `terminalbox` を経由します。

`terminalbox-lab` は Cloud Run の内部 ingress と認証必須設定を使用し、Web Runtime Service Account だけが `roles/run.invoker` で呼び出せる構成です。

## セッション分離

TerminalBox はログイン ID ごとではなく、ブラウザへ発行した **Session ID** を単位として Lab の状態を分離します。

セッションごとに、次の情報を個別に管理します。

- ホームディレクトリ
- ランタイムディレクトリ
- ログ
- Target / Challenge の状態
- 学習進捗
- Terminal プロセス
- Kali Desktop / noVNC
- Linux Lab の状態
- AI Agent の承認状態

既定では最大 20 セッション、最終アクセスから 30 分で期限切れとなる設計です。

`RESET` を実行すると、現在の Session ID に属する Terminal、Desktop、Target、Challenge、AI Agent の状態だけを初期化します。他の利用者のセッションには影響しません。

## ネットワーク分離

TerminalBox では、演習用 Kali / Lab から一般のインターネットへ自由にアクセスできないようにしています。

- Web と Lab は Direct VPC egress を使用
- Web サービスは Cloud NAT 経由で Gemini API へアクセス
- Lab サービスには `terminalbox-lab-deny-egress` ネットワークタグを付与
- Firewall で Lab から `0.0.0.0/0` への IPv4 egress を拒否
- 演習用 Target は Lab コンテナ内の loopback アドレスで動作
- Lab Runtime Service Account には project-level IAM role を付与しない
- Gemini API Key、TerminalBox のアクセス用パスワードは Lab へ渡さない

このため、TerminalBox の演習は TerminalBox 内に用意された Target を対象とすることを前提としています。

## 技術構成

主な構成は次のとおりです。

- Google Cloud Run
- Google Cloud Build
- Artifact Registry
- Secret Manager
- VPC / Cloud NAT / Firewall
- React 19
- TypeScript
- Vite
- xterm.js
- Node.js / Express
- WebSocket
- Kali Linux
- noVNC
- Gemini API

## リポジトリ構成

```text
TerminalBox/
├─ cloudbuild.yaml
├─ Dockerfile.web.cloud
├─ Dockerfile.lab.cloud
├─ cloud/
│  ├─ start-web.sh
│  ├─ start-lab.sh
│  ├─ nginx-web.conf
│  ├─ nginx-lab.conf
│  └─ setup-infrastructure.ps1
├─ web/                  # React / TypeScript UI
├─ backend/              # Web API、Session、AI Agent、Proxy
├─ kali/                 # Kali Desktop / Lab 用スクリプト・アセット
├─ target/               # Web 演習 Target
├─ challenge-target/     # セキュリティツール用 Target
├─ challenges/           # 演習データ
├─ config/               # AI / Agent system prompt
└─ docs/                 # Cloud Run 構成資料
```

## Google Cloud へのデプロイ

### 1. Project と Region を指定

PowerShell では次のように指定します。

```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
$env:TERMINALBOX_REGION="asia-northeast1"
```

### 2. Secret を作成

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

### 4. Cloud Build でデプロイ

```powershell
gcloud builds submit `
  --project=$env:GOOGLE_CLOUD_PROJECT `
  --config=cloudbuild.yaml
```

`cloudbuild.yaml` は Web と Lab の 2 イメージを build / push し、その後 2 つの Cloud Run サービスをデプロイします。

- `Dockerfile.web.cloud` → `terminalbox`
- `Dockerfile.lab.cloud` → `terminalbox-lab`

現在の Lab は Cloud Run 上で 4 vCPU / 8 GiB、Web は 1 vCPU / 1 GiB を基本構成とし、どちらも `max-instances=1` としています。

## デプロイ後の確認

デプロイ後は、ローカル Docker ではなく実際の Cloud Run 環境を確認してください。

- `terminalbox` が公開 Web として起動する
- Basic 認証後に `/terminalbox/` が表示される
- `terminalbox-lab` は外部から直接アクセスできない
- Terminal / Target / Kali Desktop / AI が ONLINE になる
- Target 1〜5 を切り替えられる
- セキュリティツール用 `labtarget` が利用できる
- Linux Lab の問題6〜9がセッションごとに動作する
- Lab Terminal から一般インターネットへの接続が失敗する
- Gemini API Key が Lab 環境変数に存在しない
- RESET が現在のセッションだけを初期化する

Lab 内部の疎通確認例:

```bash
curl -fsS http://target:3000/api/status
curl -fsS http://target2:3000/api/status
curl -fsS http://target3:3000/api/status
curl -fsS http://target4:3000/api/status
curl -fsS http://target5:3000/api/status
curl -fsS http://labtarget:3100/api/status
curl --connect-timeout 5 https://example.com/
env | grep -E 'GEMINI|TERMINALBOX_PASSWORD'
```

Target / `labtarget` は成功し、外部 URL への接続は失敗し、最後の環境変数確認では何も表示されないことを想定しています。

## 重要な注意

TerminalBox は **学習用に用意された隔離環境を対象とするセキュリティ教材**です。

コマンド例やセキュリティツールは、TerminalBox が提供する Target、または自分が明示的に許可を受けた環境だけで使用してください。第三者の Web サイト、サーバー、ネットワークに対する無断の検査・攻撃を目的としたものではありません。

## 補足資料

Cloud Run の Web / Lab 分離については、次のドキュメントも参照してください。

- [`docs/cloud-run-web-lab.md`](docs/cloud-run-web-lab.md)

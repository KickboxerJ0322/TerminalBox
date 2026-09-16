# TerminalBox

TerminalBox は、**ブラウザだけで Linux / Kali Linux とサイバーセキュリティを学べるクラウド型の演習環境**です。

ターミナル、Kali Desktop、演習用ターゲット、チュートリアル、AI Agent を1つの画面にまとめ、実際に操作しながら「何が危険なのか」「なぜ問題なのか」「どう防ぐのか」を学べるようにしています。

> 現在の運用対象は **Google Cloud Run 上のクラウド版のみ**です。  
> この README ではローカル Docker 版の起動手順は扱いません。

---

## TerminalBox でできること

TerminalBox では、主に次のことができます。

- ブラウザ上の Terminal から Kali Linux を操作
- noVNC を使って Kali Desktop を表示
- Burp Suite、Wireshark などの GUI ツールを利用
- 演習専用の Web サイトや Linux Lab を調査
- Flag を取得して問題をクリア
- 攻撃だけでなく、原因と防御方法まで学習
- Gemini を使った AI Agent に質問
- AI Agent に安全な範囲で Terminal 操作を依頼
- 利用者ごとにセッションを分離して演習

TerminalBox は CTF のように Flag を取得する要素を持っていますが、目的は単なる攻略ではなく、**セキュリティの仕組みを順番に理解すること**です。

---

## 画面構成

画面は4つの領域を同時に表示できる構成です。

```text
┌──────────────────────┬──────────────────────┐
│ Terminal / Kali      │ Tutorial / Learning  │
│ Desktop / Tools      │                      │
├──────────────────────┼──────────────────────┤
│ Target Browser       │ AI Agent             │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

### 左上：Kali ワークスペース

次のタブを切り替えて利用できます。

- Terminal
- Burp Suite
- Wireshark
- Kali Desktop

Terminal と Kali Desktop は同じセッションの作業領域を使用します。

### 左下：Target

問題1〜9とセキュリティツール用ターゲットを切り替えて表示します。

Web 問題では実際の演習サイトを表示し、Linux / OS 問題では安全な疑似 Linux Lab を利用します。

### 右上：学習パネル

次の4つのタブがあります。

- チュートリアル
- ターゲット
- セキュリティツール
- 脆弱性

各問題には、操作手順、コマンド、ヒント、回答欄、クリア状態があります。

### 右下：AI Agent

Gemini を利用した AI Agent です。

自然言語で質問したり、TerminalBox 内で必要な確認操作を依頼したりできます。

---

## 学習の流れ

Target 問題と脆弱性問題は、基本的に次の順番で進みます。

```text
ATTACK
  ↓
UNDERSTAND
  ↓
DEFEND
  ↓
MISSION COMPLETE
```

- **ATTACK**：演習環境で問題を再現し、Flag を取得
- **UNDERSTAND**：なぜ成功したのかを理解
- **DEFEND**：どのように防ぐべきかを確認
- **MISSION COMPLETE**：テーマ全体を整理

Flag や進捗はセッションごとに管理されます。

---

## Web セキュリティ問題

| 問題 | テーマ | 学ぶこと |
|---|---|---|
| 問題1 | 秘密情報管理 | Secret や設定情報を公開領域へ置く危険性 |
| 問題2 | 認可 / IDOR | ログイン済みでも他人のデータへアクセスできてはいけない理由 |
| 問題3 | 入力値処理 / SQL Injection | ユーザー入力を安全に扱う方法 |
| 問題4 | セッション / 認証 | トークン改変、署名検証、セッション管理 |
| 問題5 | Defense in Depth | 複数の防御を組み合わせる考え方 |

問題5では、問題1〜4で扱った代表的な攻撃を試し、**攻撃が成功しないことを確認する演習**になっています。

---

## Linux / OS 脆弱性問題

| 問題 | テーマ | 学ぶこと |
|---|---|---|
| 問題6 | Copy Fail LPE | Kernel 脆弱性による権限昇格の流れ |
| 問題7 | File Permission | owner / group / rwx と過剰な書き込み権限 |
| 問題8 | SUID 設定ミス | root 所有 SUID プログラムの危険性 |
| 問題9 | sudo 設定ミス | sudoers による過剰な権限委譲 |

問題6〜9は、Cloud Run やホスト OS を攻撃するものではありません。

**セッションごとの安全な疑似 Linux Lab** の中で、root 取得までの考え方だけを再現します。

---

## セキュリティツール演習

Kali 環境には、学習用として代表的なセキュリティツールを導入しています。

- Burp Suite Community
- Wireshark / tshark
- Gobuster
- Nikto
- sqlmap
- Nmap
- John the Ripper
- Hashcat
- Netcat
- Hydra
- Metasploit Framework

演習対象は TerminalBox 内部の専用ターゲットに限定しています。

Wireshark については Cloud Run の制約を考慮し、ライブパケットキャプチャではなく配布 PCAP を使う問題も用意しています。

---

## AI Agent

TerminalBox の AI Agent は、Google Gemini API を利用しています。

現在の Cloud Run 構成では `gemini-3.7-flash` を使用します。

AI Agent は、ユーザーの依頼をそのまま無制限に実行するのではなく、Backend 側のポリシーでコマンドを再判定します。

### 1. 自動実行できる操作

閲覧・確認を中心とした安全な操作です。

例：

```text
pwd
whoami
ls
cat
head
tail
grep
find
ip addr
ss
curl
nmap
tshark
git status
```

### 2. ユーザー確認が必要な操作

ファイル作成、変更、削除、インストール、停止など、環境を変更する操作は実行前に確認を求めます。

### 3. AI Agent から実行できない操作

危険性が高い操作や、TerminalBox の境界を越える操作は拒否します。

AI Agent の1回の依頼では最大15ステップまで実行できます。

---

## セッション分離

TerminalBox は匿名利用を前提に、ブラウザごとにセッションを発行します。

セッションごとに次の状態を分離します。

- Home ディレクトリ
- Terminal 状態
- Kali Desktop
- Target 状態
- 問題の進捗
- Linux Lab 状態
- AI Agent の承認・履歴

標準設定では最大20セッションを管理し、一定時間利用されていないセッションは自動的に整理されます。

画面上部の `RESET` は、**現在のセッションだけ**を初期状態へ戻します。他の利用者には影響しません。

---

## Cloud Run 構成

TerminalBox は、役割を分けた2つの Cloud Run サービスで動作します。

```text
Browser
   │
   ▼
┌───────────────────────────────┐
│ terminalbox                   │
│ Public Web / UI / AI Backend │
└──────────────┬────────────────┘
               │ 認証された内部通信
               ▼
┌───────────────────────────────┐
│ terminalbox-lab               │
│ Private Kali / noVNC / Lab   │
│ Target 1〜5 / Tool Target    │
└───────────────────────────────┘

terminalbox ──────> Gemini API
```

### `terminalbox`

外部ブラウザからアクセスする Web 側です。

主な役割：

- React / Vite UI の配信
- API
- AI Agent
- Gemini API との通信
- Lab サービスへの認証付き Proxy

### `terminalbox-lab`

Kali Linux と演習環境を動かす Lab 側です。

主な役割：

- Kali Terminal
- Kali Desktop / noVNC
- Burp Suite / Wireshark
- Target 1〜5
- セキュリティツール用 Target
- Linux Lab

Lab サービスは外部へ直接公開せず、Web サービスからの内部アクセスを前提にしています。

---

## ネットワーク分離

TerminalBox では、学習用 Kali から一般の Web サイトへ自由にアクセスできない構成を目指しています。

Cloud Run の Web と Lab は `terminalbox-vpc` に接続し、Lab 側には外向き通信を拒否するネットワークタグを設定します。

Lab 内の演習ターゲットは loopback アドレスで動作します。

```text
target     127.0.0.2:3000
target2    127.0.0.3:3000
target3    127.0.0.4:3000
target4    127.0.0.5:3000
target5    127.0.0.6:3000
labtarget  127.0.0.7:3100
```

そのため、Kali から演習ターゲットへはアクセスできますが、Lab から一般インターネットへの通信は分離できます。

Web 側は Gemini API を利用するため、Cloud NAT 経由で必要な外部通信を行います。

---

## 使用技術

| 分類 | 技術 |
|---|---|
| Frontend | React / TypeScript / Vite |
| Backend | Node.js |
| Web Proxy | Nginx |
| Terminal | xterm.js / WebSocket |
| Linux Lab | Kali Linux |
| Desktop | XFCE / TigerVNC / noVNC |
| AI | Google Gemini API |
| Runtime | Google Cloud Run |
| Build | Google Cloud Build |
| Container Registry | Artifact Registry |
| Secret | Secret Manager |
| Network | VPC / Direct VPC egress / Cloud NAT / Firewall |

---

## リポジトリ構成

```text
TerminalBox/
├─ web/                React / Vite の画面
├─ backend/            API、Session、AI Agent、Terminal 制御
├─ kali/               Kali Desktop と演習用スクリプト
├─ target/             Web 演習 Target 1〜5
├─ challenge-target/   セキュリティツール用 Target
├─ challenges/         演習用データ
├─ cloud/              Cloud Run / Nginx / 構築スクリプト
├─ config/             AI Prompt などの設定
├─ docs/               技術ドキュメント
├─ Dockerfile.web.cloud
├─ Dockerfile.lab.cloud
└─ cloudbuild.yaml
```

---

## Cloud 版のデプロイ

### 前提

- Google Cloud プロジェクト
- `gcloud` CLI
- Cloud Run
- Cloud Build
- Artifact Registry
- Secret Manager
- VPC
- Gemini API キー

### 必要な Secret

Web 側では次の Secret を使用します。

```text
GEMINI_API_KEY
terminalbox-access-password
terminalbox-internal-api-token
```

`terminalbox-internal-api-token` は Web と Lab の内部 API 通信に使用します。

### インフラ準備

PowerShell から次を実行します。

```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
$env:TERMINALBOX_REGION="asia-northeast1"
./cloud/setup-infrastructure.ps1
```

このスクリプトは、Service Account、VPC、Subnet、Firewall、Cloud NAT など、TerminalBox の Web / Lab 分離に必要な基盤を準備します。

### Cloud Build

```powershell
gcloud builds submit `
  --project=$env:GOOGLE_CLOUD_PROJECT `
  --config=cloudbuild.yaml
```

`cloudbuild.yaml` は次の処理を行います。

```text
Web Image build
Lab Image build
      ↓
Artifact Registry
      ↓
terminalbox-lab deploy
      ↓
terminalbox deploy
```

GitHub の `main` ブランチを Cloud Build Trigger に接続すれば、`git push origin main` をきっかけに自動デプロイできます。

---

## 開発時の基本フロー

```text
コード修正
   ↓
git add .
   ↓
git commit
   ↓
git push origin main
   ↓
Cloud Build
   ↓
Cloud Run
```

例：

```bash
git add .
git commit -m "Update TerminalBox"
git push origin main
```

---

## 注意事項

TerminalBox は **学習用の隔離された演習環境**です。

このリポジトリのコマンド、ツール、AI Agent は、TerminalBox 内の演習ターゲットまたは明示的に許可された検証環境でのみ使用してください。

第三者が管理する Web サイト、サーバー、ネットワークに対して、許可なく診断・スキャン・攻撃を行うことを目的としていません。

---

## 現在の方針

TerminalBox は、ローカル PC 上で複雑な Docker 環境を起動する方式ではなく、**Cloud Run 上でブラウザからすぐ使えるセキュリティ学習 Lab**として開発を続けています。

目標は、Linux やセキュリティに詳しくない人でも、

> 操作する → 結果を見る → 理由を理解する → 防御方法を学ぶ

という流れで学べる「セキュリティの教科書のような実習環境」を作ることです。

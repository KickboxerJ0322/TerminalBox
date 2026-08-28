# TerminalBox

TerminalBox は、ブラウザ上で Linux/Kali Linux を実際に操作しながら学べる、セキュリティ学習用の演習環境です。隔離された Kali 環境から演習専用の Target サイトへコマンドを実行し、分からない結果は AI アシスタントへ質問できます。AI はコマンドを自動実行しません。

## 主な構成

- Web UI: React/Vite 製の学習画面、ターミナル、Target 表示、AI パネル。
- Backend: WebSocket ターミナル、AI 連携、状態確認、Lab リセット API。
- Kali/noVNC: ブラウザから操作できる Kali XFCE デスクトップ。
- Target: 演習用の 3 つのローカル Web サイト。
- AI: ローカルでは Ollama、Cloud Run では Gemini Secret Manager を使う構成。

## ローカル起動

必要なもの:

- Windows 11 + Docker Desktop（WSL 2 backend 推奨）
- または Docker Engine / Docker Compose が使える Linux
- 初回の Ollama モデル取得用に十分な空き容量

起動手順:

```bash
git clone https://github.com/KickboxerJ0322/TerminalBox.git
cd TerminalBox
cp .env.example .env
docker compose up -d --build
```

Windows PowerShell では次のように `.env` を作成できます。

```powershell
Copy-Item .env.example .env
```

ブラウザで次を開きます。

```text
http://localhost:3000
```

学習画面を直接開く場合は次の URL です。

```text
http://localhost:3000/terminalbox/
```

## Ollama モデル

ローカル AI として Ollama を使う場合、初回だけモデルを取得します。

```bash
docker compose --profile model run --rm model-loader
```

既定モデルは `.env` の `OLLAMA_MODEL` で変更できます。

```text
LiquidAI/lfm2.5-1.2b-instruct:q4_k_m
```

## Kali GUI

TerminalBox 画面上部の `KALI DESKTOP` から Kali デスクトップを開けます。直接開く場合は次の URL です。

```text
http://localhost:3000/kali-gui/?autoconnect=1&resize=remote
```

noVNC のパスワードは既定で `student` です。`.env` の `KALI_VNC_PASSWORD` で変更できます。

Kali GUI と Web ターミナルは同じ Kali 環境を操作します。作成したファイルや Target への接続状態を、どちらからでも確認できます。ローカル構成では Kali のホームディレクトリは一時領域なので、コンテナを作り直すと消えます。

## 動作確認

TerminalBox のターミナルで次を試します。

```bash
whoami
curl http://target:3000/api/status
curl http://target2:3000/api/status
curl http://target3:3000/api/status
nmap target
```

期待する結果:

- `whoami` は `student` を返す。
- 3 つの Target API は `"status":"ok"` を含む JSON を返す。
- `nmap target` で演習用 Target をスキャンできる。

状態とログの確認:

```bash
docker compose ps
docker compose logs -f
```

停止:

```bash
docker compose down
```

Ollama モデルを含む Docker Volume も削除する場合だけ、次を使います。

```bash
docker compose down -v
```

## 主な設定

`.env` で変更できます。

| 変数 | 既定値 | 用途 |
|---|---|---|
| `PORT` | `3000` | ブラウザからアクセスするローカルポート |
| `AI_PROVIDER` | `ollama` | `ollama`、`gemini`、`auto` のいずれか |
| `OLLAMA_URL` | `http://ollama:11434` | Backend から見た Ollama API |
| `OLLAMA_MODEL` | `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m` | 使用する Ollama モデル |
| `GEMINI_API_KEY` | 空 | Gemini をローカルで使う場合の API キー |
| `GEMINI_MODEL` | `gemini-3.7-flash` | Gemini モデル |
| `TARGET_URL` | `http://target:3000` | 代表 Target URL |
| `TARGET_URLS` | `http://target:3000,http://target2:3000,http://target3:3000` | リセット対象の Target 一覧 |
| `KALI_GUI_URL` | `http://kali:6080` | Backend から見た Kali noVNC |
| `TERMINAL_HISTORY_LIMIT` | `2000` | AI に渡すターミナル履歴の最大文字数 |
| `KALI_CONTAINER` | `terminalbox-kali` | ローカルリセット時に操作する Kali コンテナ名 |
| `WS_AUTH_TOKEN` | 空 | 将来の WebSocket 認証用トークン |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | WebSocket 接続を許可する Origin |
| `KALI_VNC_PASSWORD` | `student` | noVNC/TigerVNC のパスワード |
| `KALI_VNC_GEOMETRY` | `1440x900` | Kali GUI の初期解像度 |
| `KALI_MEMORY_LIMIT` | `2g` | Kali コンテナのメモリ上限 |
| `KALI_CPU_LIMIT` | `2.0` | Kali コンテナの CPU 上限 |

## Cloud Run デプロイ

Cloud Run では、Web と Lab を 2 つのサービスに分離します。

- `terminalbox`: 公開サービス。Web UI、Basic 認証、AI Backend、Gemini Secret を持ちます。Gemini API への外部通信はこのサービスだけが行います。
- `terminalbox-lab`: 非公開サービス。Kali/noVNC/WebSocket ターミナルと 3 つの Target を持ちます。受講者が入力したコマンドはこのサービス内で実行されます。

ブラウザは `terminalbox` にだけ接続します。Web Backend は Google 署名付き ID トークンを取得し、許可された HTTP/WebSocket パスだけを `terminalbox-lab` へプロキシします。Lab を呼び出せるのは Web 実行サービスアカウントだけです。Target サイトは公開 Web と同一オリジンのパスにプロキシされるため、ブラウザが `target` などの Lab 内部ホスト名へ直接接続することはありません。

必要な Secret Manager シークレット:

- `GEMINI_API_KEY`: Gemini API キー。Web サービスにだけ注入します。
- `terminalbox-access-password`: ブラウザ Basic 認証ユーザー `terminalbox` のパスワード。

Gemini API キーを初めて登録する場合は、Secret を作成してから値を追加します。入力したキーは画面に表示されません。

```powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
$geminiKey = Read-Host 'Gemini API key' -AsSecureString
$credential = [PSCredential]::new('unused', $geminiKey)
$plainGeminiKey = $credential.GetNetworkCredential().Password
$plainGeminiKey | gcloud secrets versions add GEMINI_API_KEY --data-file=-
Remove-Variable plainGeminiKey, credential, geminiKey
```

Secret がすでに存在する場合は、`gcloud secrets create` を省略して新しいバージョンを追加します。登録後に Cloud Build で再デプロイすると、Web サービスだけが最新のキーを参照します。画面に `Google Cloud Secret` と `相談できます` が表示されていれば、ブラウザ側への API キー入力は不要です。質問を入力すると送信ボタンが有効になり、Backend が Secret のキーを使って Gemini へ問い合わせます。

Basic 認証パスワードも初回に作成します。Gemini API キーと同様に、既存の Secret を更新する場合は `gcloud secrets create` を省略してください。

```powershell
gcloud secrets create terminalbox-access-password --replication-policy=automatic
$accessPassword = Read-Host 'TerminalBox password' -AsSecureString
$credential = [PSCredential]::new('unused', $accessPassword)
$plainAccessPassword = $credential.GetNetworkCredential().Password
$plainAccessPassword | gcloud secrets versions add terminalbox-access-password --data-file=-
Remove-Variable plainAccessPassword, credential, accessPassword
```

初回だけ、VPC、サブネット、実行サービスアカウント、Secret Manager 権限、Lab の外向き通信を拒否する firewall rule を作成します。

```powershell
./cloud/setup-infrastructure.ps1
```

その後、Cloud Build を実行します。

```bash
gcloud builds submit --config cloudbuild.yaml
```

`cloudbuild.yaml` は次の 2 つのイメージをビルドし、それぞれ Cloud Run へデプロイします。

- `Dockerfile.web.cloud`
- `Dockerfile.lab.cloud`

## Cloud Run の分離方針

- Web サービスは Gemini Secret を持ち、Cloud NAT 経由で Gemini API へ接続できます。
- Lab サービスには Gemini API キーや Basic 認証パスワードを渡しません。
- Lab サービスは全通信を `terminalbox-vpc` へ送る `vpc-access-egress: all-traffic` を使用します。
- Lab サービスは `terminalbox-lab-deny-egress` タグにより、`0.0.0.0/0` 宛ての全 IPv4 通信を優先度 100 の firewall rule で拒否します。
- Lab 実行サービスアカウントにはプロジェクトレベルの IAM ロールを付与しません。
- Target は Lab インスタンス内の loopback に bind します。

Lab 内の Target:

```text
target  -> 127.0.0.2:3000
target2 -> 127.0.0.3:3000
target3 -> 127.0.0.4:3000
```

## Lab の外部通信遮断

現在の構成では、TerminalBox のターミナルから一般の外部インターネットへ任意に接続できません。Cloud Run を 2 サービスに分けることだけで遮断しているのではなく、次の設定を組み合わせて実現しています。

- ターミナルのコマンドを非公開の `terminalbox-lab` で実行する。
- Lab の全外向き通信を Direct VPC egress で VPC に通す。
- Lab 専用ネットワークタグを対象に、全 IPv4 egress を firewall rule で拒否する。
- Lab に Secret を注入せず、Lab 実行サービスアカウントにもプロジェクト権限を与えない。
- Web サービスだけを egress 拒否ルールの対象外とし、Cloud NAT 経由の外部通信、Gemini Secret、Lab 呼び出し権限を利用できるようにする。

そのため、ターミナル内の `curl https://example.com`、`wget`、`git clone`、`apt update` など、一般の外部 IPv4 サービスへの新規通信は失敗します。一方、loopback 上の `target`、`target2`、`target3` には接続でき、確立済み WebSocket を通じたターミナル入出力も利用できます。

「一切のパケットが出ない」という意味の完全な無通信ではありません。Cloud Run の実行に必要なメタデータ、DNS、Google Cloud 基盤、WebSocket 応答などの内部通信は残ります。メタデータサービスから Lab のサービスアカウント情報を参照できる可能性を考慮し、そのアカウントにはプロジェクト権限を付与していません。また、現在の拒否範囲は IPv4 の `0.0.0.0/0` です。将来サブネットや Cloud Run をデュアルスタック化する場合は、IPv6 の `::/0` に対する拒否ルールも追加してください。

この境界が保証するのは、「受講者がターミナルから任意の外部 IPv4 サイトへ接続することを防ぐ」ことです。構成変更後は、以下のデプロイ後確認を必ず再実行してください。

詳しい Cloud Run 構成は [docs/cloud-run-web-lab.md](docs/cloud-run-web-lab.md) を参照してください。

## Cloud Run デプロイ後の確認

TerminalBox のターミナルで次を実行します。

```bash
curl -fsS http://target:3000/api/status
curl -fsS http://target2:3000/api/status
curl -fsS http://target3:3000/api/status
curl --connect-timeout 5 https://example.com/
env | grep -E 'GEMINI|TERMINALBOX_PASSWORD'
```

期待する結果:

- 3 つの Target API は成功する。
- `https://example.com/` への外部通信はタイムアウトまたは接続エラーで失敗する。
- `GEMINI` や `TERMINALBOX_PASSWORD` を含む環境変数は表示されない。

公開 Web 側では、画面表示と AI を確認します。

- ターミナルが接続され、コマンドの入力と出力ができる。
- 3 つの Target サイトが画面内に表示される。
- AI パネルに `Google Cloud Secret` と `相談できます` が表示される。
- 質問を入力すると送信ボタンが有効になり、Gemini から応答が返る。

確認時点の実装では、Target 接続、外部 IPv4 通信のタイムアウト、Secret 非注入、WebSocket ターミナル、Cloud Secret を使った Gemini 応答を実サービスで検証済みです。

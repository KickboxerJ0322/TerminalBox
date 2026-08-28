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
git clone <repository-url>
cd terminalbox
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

- `terminalbox`: 公開サービス。Web UI、Basic 認証、AI Backend、Gemini Secret を持ちます。
- `terminalbox-lab`: 非公開サービス。Kali/noVNC/terminal と 3 つの Target を持ちます。

ブラウザは `terminalbox` にだけ接続します。Web Backend は Google 署名付き ID トークンを取得し、許可された HTTP/WebSocket パスだけを `terminalbox-lab` へプロキシします。Lab を呼び出せるのは Web 実行サービスアカウントだけです。

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

Secret がすでに存在する場合は、`gcloud secrets create` を省略して新しいバージョンを追加します。登録後に Cloud Build で再デプロイすると、Web サービスだけが最新のキーを参照します。画面に `Google Cloud Secret` と `相談できます` が表示されていれば、ブラウザ側へのAPIキー入力は不要です。

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
- Lab サービスは `terminalbox-lab-deny-egress` タグにより、外向き IPv4 通信を firewall rule で拒否します。
- Target は Lab インスタンス内の loopback に bind します。

Lab 内の Target:

```text
target  -> 127.0.0.2:3000
target2 -> 127.0.0.3:3000
target3 -> 127.0.0.4:3000
```

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
- `https://example.com/` への外部通信は失敗する。
- `GEMINI` や `TERMINALBOX_PASSWORD` を含む環境変数は表示されない。

## 次にやるべきこと

1. `README.md` と差分を確認する。
2. 問題なければ変更をコミットする。
3. `./cloud/setup-infrastructure.ps1` を一度だけ実行する。
4. `gcloud builds submit --config cloudbuild.yaml` で本番デプロイする。
5. デプロイ後の確認コマンドで、Target 接続、Lab 外部通信遮断、Secret 非注入を確認する。

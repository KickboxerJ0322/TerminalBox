# TerminalBox

## Cloud Run deployment

Cloud Run uses `Dockerfile.cloud` to run the web UI, backend, Kali/noVNC, and the three training targets in one instance. `cloudbuild.yaml` builds the image and deploys it to `asia-northeast1` whenever the connected GitHub `main` branch changes.

Required Secret Manager secrets:

- `GEMINI_API_KEY`: Gemini API key used only by the backend.
- `terminalbox-access-password`: password for the browser Basic authentication user `terminalbox`.

The API key is injected into the Cloud Run revision and is never included in the image, GitHub repository, or browser JavaScript. The browser shows `Google Cloud Secret` instead of an API-key input when the managed secret is configured.

Cloud Run is configured with one maximum instance because this is a single-user, stateful training workspace. Kali files and target changes use the instance's ephemeral filesystem and disappear when Cloud Run replaces or stops the instance. WebSocket sessions can also reconnect because Cloud Run request timeouts are finite.

The cloud image can be checked locally with:

```bash
docker buildx build --load -f Dockerfile.cloud -t terminalbox-cloud:test .
docker run --rm -p 8080:8080 -e TERMINALBOX_PASSWORD=change-me terminalbox-cloud:test
```

TerminalBoxは、ブラウザ上でLinux/Kali Linuxを実際に操作しながら学べる、ローカル完結型のセキュリティ学習環境です。隔離されたKaliコンテナから演習専用Targetへコマンドを実行し、分からない結果はOllama上のLiquid AI LFMへ質問できます。AIはコマンドを自動実行しません。

## 必要環境

- Windows 11 + Docker Desktop（WSL 2 backend推奨）
- またはDocker Engine / Docker Composeが動くLinux（Google Compute Engineを含む）
- 初回モデル取得用に約1GB以上の空き容量（`LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`使用時）
- VS Code（開発する場合のみ）

## 起動

```bash
git clone <repository-url>
cd terminalbox
cp .env.example .env
docker compose up -d --build
```

Windows PowerShellではコピーを次のように実行できます。

```powershell
Copy-Item .env.example .env
```

ブラウザで <http://localhost:3000> を開いてください。既定では安全のためホストのlocalhostだけで待ち受けます。最初にKaliデスクトップが開き、デスクトップ上の「TerminalBox 練習環境」アイコンをダブルクリックすると、Kali内Firefoxで練習画面が開きます。

練習画面をホスト側ブラウザから直接開く場合は <http://localhost:3000/terminalbox/> を使用します。

## Kali GUI

TerminalBox上部の「KALI GUI」または <http://localhost:3000/kali-gui/?autoconnect=1&resize=remote> を開くと、XFCEデスクトップをブラウザで操作できます。noVNCの認証画面で既定パスワード `student` を入力してください。

GUIはKaliコンテナ内で非rootユーザー `student` として動作します。KaliのVNCポートはホストへ直接公開せず、TerminalBoxのnginxが `/kali-gui/` だけを内部ネットワーク経由で中継します。Kaliから外部インターネットへ接続できない既存の隔離は維持されます。

TerminalBoxのターミナル欄とKali GUIは、同じKaliコンテナへ接続する2つの操作画面です。ターミナル欄はコマンド操作に特化したシェルを、Kali GUIはXFCEデスクトップをそれぞれ別プロセスとして開きます。どちらも`student`ユーザー、ホームディレクトリ、Targetへの内部ネットワークを共有するため、一方で作成したファイルは同じコンテナが動作している間はもう一方からも参照できます。

Kali GUIの既定背景には、Kali公式デザインの `kali/assets/kali-net-default.jpg` を設定しています。TerminalBox用のオリジナル蛇モチーフ壁紙 `kali/assets/terminalbox-serpent-wallpaper.png` も背景選択画面から利用できます。

Kali公式の現行壁紙セット`kali-wallpapers-2026`もインストールしています。デスクトップを右クリックして「Desktop Settings」を開くと、公式壁紙またはTerminalBoxの壁紙へ変更できます。

Kaliのホームディレクトリは一時領域です。GUIで変更した設定や保存したファイルは、Kaliコンテナを再作成すると消去されます。永続化が必要な場合は、信頼できる演習ファイル専用のDocker Volumeを別途割り当ててください。

画面サイズやパスワードを変更した場合はKaliコンテナを再作成します。

```bash
docker compose up -d --build --force-recreate kali terminalbox-web
```

## Ollamaモデルの取得

初回だけ、Ollamaで提供されているLiquid AI LFM2.5 1.2B Instruct Q4_K_M（既定値 `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`）を取得します。

```bash
docker compose --profile model run --rm model-loader
```

モデルは`ollama-models` Docker Volumeへ保存され、コンテナを作り直しても再利用されます。GPU/RAM条件に合わせて `.env` の `OLLAMA_MODEL` を別のOllamaモデル名へ変更できます。変更後は同じ取得コマンドを実行してください。

## 動作確認

TerminalBoxのターミナルで次を試します。

```bash
whoami
curl http://target:3000/
curl http://target:3000/api/status
nmap target
```

`whoami` は `student`、TargetのAPIは `"status":"ok"` を返します。Kaliは内部Dockerネットワークだけに参加するため、演習中の外部インターネット通信は遮断されます。

状態とログの確認:

```bash
docker compose ps
docker compose logs -f
```

停止:

```bash
docker compose down
```

モデルも含めて削除する場合だけ、`docker compose down -v` を使用します（ダウンロード済みモデルは復元できません）。

## 設定

主な値は `.env` で変更できます。

| 変数 | 既定値 | 用途 |
|---|---|---|
| `PORT` | `3000` | ブラウザからアクセスするポート |
| `OLLAMA_URL` | `http://ollama:11434` | バックエンドから見たOllama API |
| `OLLAMA_MODEL` | `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m` | 使用するモデル |
| `TARGET_URL` | `http://target:3000` | 演習Target |
| `KALI_GUI_URL` | `http://kali:6080` | バックエンドから確認するKali GUI |
| `TERMINAL_HISTORY_LIMIT` | `2000` | AIへ送る端末履歴の最大文字数 |
| `WS_AUTH_TOKEN` | 空 | 将来の認証用トークン。設定時はWebSocket URLへの連携実装が必要 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | WebSocketで許可するOrigin（カンマ区切り） |
| `KALI_VNC_PASSWORD` | `student` | GUI接続パスワード（TigerVNCの制限により1～8文字） |
| `KALI_VNC_GEOMETRY` | `1440x900` | GUIの初期解像度 |
| `KALI_MEMORY_LIMIT` | `2g` | Kali GUIコンテナのメモリ上限 |
| `KALI_CPU_LIMIT` | `2.0` | Kali GUIコンテナのCPU上限 |

GCEでドメインやHTTPSを使う場合は、リバースプロキシを前段に置き、`ALLOWED_ORIGINS`を実際のOriginへ変更してください。
LANやインターネットへ公開する場合は、Composeのlocalhost限定ポートを意図的に変更したうえで、HTTPSとアプリケーション認証を前段に追加してください。既定のVNCパスワードのまま公開しないでください。

## セキュリティ境界

- Kaliは非rootユーザー、非privileged、全Capability削除（`NET_RAW`のみnmap用に追加）で動作します。
- KaliとTargetはread-only root filesystem、CPU/RAM/PID上限付きです。
- Kaliは`internal: true`の`lab`ネットワークだけに参加します。
- KaliのVNC、Target、Ollamaのポートはホストへ直接公開しません。Kali GUIはnginx経由だけで提供します。
- Docker socketはKaliではなくバックエンドだけにマウントされます。ホストごとにsocketのグループIDが異なるため、MVPのバックエンドプロセスはrootで動作します。socket自体がroot相当の権限を持つため、公開運用ではDocker Socket Proxyやユーザー別ランナーへの置換が必須です。
- 本Target以外への攻撃・スキャン用途を想定していません。

詳しい構成は [docs/architecture.md](docs/architecture.md) を参照してください。

# TerminalBox architecture

## Runtime flow

```text
Browser
  ├─ / ────────────────────> /kali-gui/ (Kali desktop entry)
  ├─ /terminalbox/ ────────> TerminalBox learning workspace
  ├─ HTTP ─────────────────> terminalbox-web (nginx)
  │                            ├─ /api/* ──────> terminalbox-backend
  │                            └─ /kali-gui/* ─> kali (noVNC/websockify)
  ├─ noVNC WebSocket ──────────┘                    └─ TigerVNC ─> XFCE
  └─ xterm.js WebSocket ───────┘ /ws/terminal
                                    ├─ Docker exec TTY ──> kali (student/bash)
                                    └─ Ollama API ───────> ollama (Liquid AI LFM)

kali ── lab network / Docker DNS ──> target:3000
Kali Firefox ── lab network ───────> terminalbox-web/terminalbox/
```

`terminalbox-web`だけがホストへポートを公開します。NginxはAPIとWebSocketをバックエンドへ中継します。ブラウザはOllamaやDocker APIへ直接アクセスしません。

## Networks

| Service | `edge` | internal `lab` | Host port |
|---|---:|---:|---:|
| terminalbox-web | yes | yes | 3000 (configurable) |
| terminalbox-backend | yes | yes | none |
| kali | no | yes | none |
| target | no | yes | none |
| ollama | yes | yes | none |

Kaliは`lab`にのみ接続するため、Dockerの外へ直接ルーティングされません。`target`というサービス名はDocker DNSで解決されます。`terminalbox-web`はKali GUIを中継するため両方のネットワークに参加しますが、nginxが公開する内部サービス経路は`/kali-gui/`に限定されます。Ollamaが`edge`にも接続するのはモデル取得のためです。

## GUI lifecycle

Kaliコンテナ起動時に`student`ユーザーでTigerVNC、XFCE、noVNC/websockifyを開始します。VNCはコンテナ内のlocalhostだけで待ち受け、ホストへポート公開しません。ブラウザからのHTTPとWebSocketは`terminalbox-web`が`/kali-gui/`からKaliのnoVNCへ中継します。ホームは`noexec`付きtmpfsのため、XFCE起動スクリプトは読み取り専用イメージ内に配置します。

## Terminal lifecycle

WebSocket接続ごとにバックエンドがKaliコンテナ内で、`student`ユーザーの `/bin/bash -l` をTTY付きで開始します。入力・出力・リサイズだけをJSONメッセージとして中継し、切断時にストリームを破棄します。この境界は将来、認証後にユーザー別コンテナ名を解決する実装へ置き換えられます。

## AI context

ブラウザはTTY出力とAI会話の直近履歴をメモリ上に保持します。「端末履歴を含める」が有効な場合はバックエンド側で `TERMINAL_HISTORY_LIMIT` に切り詰め、「AI会話履歴を含める」が有効な場合は直近4メッセージ・最大1000文字に制限します。設定ファイル `config/ai-system-prompt.txt`、選択された履歴、現在の質問をOllama `/api/chat`へ送信します。会話や端末履歴は永続化しません。

## Production migration notes

- GCEではDocker EngineとCompose pluginを導入し、同じ`compose.yaml`を使用できます。
- HTTPS終端、認証、レート制限を前段プロキシで追加してください。
- 単一の共有KaliはMVP向けです。複数ユーザー公開前にセッションごとの短命コンテナへ変更してください。
- Docker socketの直接マウントは信頼されたローカルMVPに限定し、公開環境では限定APIだけを許可するSocket Proxyまたは専用runnerへ変更してください。

# TerminalBox

TerminalBox は、ブラウザ上で Linux/Kali Linux を実際に操作しながら学べる、セキュリティ学習用の演習環境です。隔離された Kali 環境から演習専用の Target サイトへコマンドを実行し、分からない結果は AI へ質問できます。通常のAI（ローカル・オンライン）はコマンドを自動実行しません。AI Agentのみ、専用の安全ポリシーに従ってTerminalBox内のコマンドを実行できます。

## 主な構成

- Web UI: React/Vite 製のKaliワークスペース、学習パネル、Target表示、AIパネル。
- Backend: WebSocket ターミナル、AI 連携、状態確認、Lab リセット API。
- Kali/noVNC: ブラウザから操作できる Kali XFCE デスクトップ。
- Target: 既存の3つのWebサイトと、セキュリティツール・Web Attacks用の隔離Web/TCP Target。
- AI: Ollamaのローカルチャット、Geminiのオンラインチャット、Geminiと専用安全実行経路を使うAI Agent。

## 画面構成

画面は左右2列・上下2段を基本とし、次のパネルを同時に使えます。

- Kaliワークスペース: `_ Terminal`、`B Burp Suite`、`W Wireshark`、`🖥 Kali Desktop` の4タブ。初回接続後はnoVNCセッションを保持し、各GUIタブを選ぶと対応するツールを前面へ表示します。
- Live Training Target: 問題1～5の演習サイトを同一オリジンのiframeで確認します。「戻る」でiframe内の一つ前のページへ移動できます。
- 学習パネル: `基本操作`、`チュートリアル`、`ターゲット`、`セキュリティツール`、`Web Attacks` の5区分。ターゲットには問題1～3、セキュリティツールには問題4の10問、Web Attacksには問題5の8問を掲載します。各問題のヒントは初期状態で非表示になり、HINTボタンで開閉できます。Web Attacksの詳細ヒントは、初心者でも順に操作してFlag取得まで進める構成です。
- AIパネル: `AI（ローカル）`、`AI（オンライン）`、`AI Agent` の順に表示します。初期状態ではGeminiを使うAI（オンライン）が選択されます。

各問題にはクリア状態とクリア解除ボタンがあります。画面上部のRESETはTarget、Kaliホーム、ターミナル履歴、問題進捗、AI会話と保存済みAI設定を初期状態へ戻します。

## AIモードとAI Agent

TerminalBoxには3種類のAIモードがあります。

- `AI（ローカル）`: Ollamaを利用する通常チャットです。コマンドの質問、結果の解説、Linux・セキュリティ学習に使用し、コマンドは自動実行しません。
- `AI（オンライン）`: Gemini APIを利用する通常チャットです。初期状態ではこのモードが選択され、コマンドは自動実行しません。
- `AI Agent`: オンラインGeminiだけを利用します。自然言語の依頼から必要最小限のコマンドを構造化JSONで提案し、Backendのcommand-policyが独立して再判定した後、Kali内でstudentユーザーとして実行します。Ollamaや通常TerminalのWebSocketは使用しません。

AI Agentのコマンドは次の3種類に分類されます。コマンド名だけでなく、すべての引数、複合コマンド、パイプ、リダイレクトもBackendで検査します。

### 確認なしで実行できるREAD_ONLY

主な許可コマンドは次のとおりです。

```text
pwd whoami id hostname uname date uptime
ls stat file wc head tail cat grep find
sed（安全な表示・置換式のみ）
which whereis type env printenv
df du free ps top
ip addr / ip route / ss / netstat
ping traceroute dig nslookup
curl nmap tshark
git status / log / diff / show / branch / remote
systemctl status
```

ネットワーク系コマンドの通信先は `target`、`target2`、`target3`、`labtarget`、`localhost`、`127.0.0.1`、`kali` などTerminalBox内部に限定されます。例えば外部URLへのcurlは拒否されます。`find -exec`、sedの外部実行・スクリプトファイル、`ip ... exec`、`tshark -X`、nmap script、curl設定ファイルなど、別コマンドや設定を経由してポリシーを迂回できる形式も拒否されます。実行時はユーザー設定ファイル、pager、Git外部diffの影響も遮断します。

### 実行前に承認が必要なCONFIRM_REQUIRED

次のような作成・変更・削除・導入・停止操作は、画面にコマンドと理由を表示し、「実行を許可」を押すまで実行されません。

```text
touch mkdir cp mv rm rmdir
chmod chown ln tee truncate dd
sed -i / find -delete
apt apt-get / pip install / npm install
kill pkill killall
systemctl start stop restart
git commit checkout switch reset
curl -o / curl -O / curlによるPOST・upload
tshark -w / nmapのファイル出力
> >> < を含むリダイレクト
```

`ls && rm file` や `pwd ; touch file` のような複合コマンドは、含まれるすべての処理を評価し、変更操作が一つでもあれば承認対象になります。承認IDは約2分で期限切れになり、同じブラウザーセッションから1回だけ使用できます。承認時にFrontendからコマンドを再送することはありません。

### AI Agentから実行できないDENIED

次の操作は、ユーザーが承認しても実行されません。

```text
sudo su
shutdown reboot poweroff
mount umount fdisk mkfs parted
docker docker compose kubectl
gcloud aws az
bash -c / sh -c / eval / exec / source / .
$() / バッククォート / プロセス置換
許可リストにない実行ファイル
TerminalBox外部へのネットワークアクセス
ルートやホーム全体を対象とする広範な削除
```

Agentは最大5ステップ、1コマンド10秒、stdout・stderr各64KBまでです。実行履歴には時刻、コマンド、分類、承認有無、終了コード、所要時間だけを保持し、APIキーなどの秘密情報は履歴やログへ保存しません。ターミナル出力やファイル内容は命令ではなく、信頼できない観察データとしてオンラインAIへ渡します。

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

既定ではOllamaを起動しません。通常の起動では、AI（オンライン）とAI Agentだけを使用する軽量構成になります。

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

ローカルAIは任意機能です。使用するときは `.env` の `AI_PROVIDER=ollama` を設定し、初回だけモデルを取得します。このコマンドはOllamaも同時に起動します。

```bash
docker compose --profile model run --rm model-loader
```

取得済みモデルでOllamaだけを起動する場合は次を実行します。

```bash
docker compose --profile local-ai up -d ollama
```

停止する場合は次を実行します。モデルデータのvolumeは削除されません。

```bash
docker compose stop ollama
```

既定モデルは `.env` の `OLLAMA_MODEL` で変更できます。

```text
LiquidAI/lfm2.5-1.2b-instruct:q4_k_m
```

## Kali GUI

Kaliワークスペースの `Kali Desktop` タブ、または画面上部の `KALI DESKTOP` からKaliデスクトップを開けます。直接開く場合は次のURLです。

```text
http://localhost:3000/kali-gui/?autoconnect=1&resize=remote
```

noVNC のパスワードは既定で `student` です。`.env` の `KALI_VNC_PASSWORD` で変更できます。

Kali GUIとWebターミナルは同じKali環境を操作します。作成したファイルやTargetへの接続状態をどちらからでも確認できます。`Burp Suite` と `Wireshark` タブを選ぶと、対応するGUIツールを起動して同じnoVNC画面に表示します。ローカル構成ではKaliのホームディレクトリは一時領域なので、コンテナを作り直すと消えます。

## セキュリティツール演習

Kaliには次のツールを導入しています。

- Burp Suite Community、Wireshark / tshark、Gobuster、Nikto、sqlmap
- John the Ripper、Hashcat、Netcat、Hydra、Metasploit Framework

初回のKaliイメージビルドでは、大容量のパッケージを取得します。今回のローカル検証では取得アーカイブが約1.4 GB、完成した `terminalbox-kali` イメージが約2.27 GBでした。Dockerのキャッシュや既存イメージも使用するため、実行前にDockerデータ領域へ十分な空き容量を確保してください。

ローカル版ではDocker Engineへ最低6 GB、Burp Suite・Kali Desktop・Hashcatを同時利用する場合は8 GB以上のメモリ割り当てを推奨します。`KALI_MEMORY_LIMIT` はコンテナ上限であり、Docker Desktop / WSL全体のメモリ割り当てを増やす設定ではありません。Hashcat問題は他の重いツールを閉じ、配布した小規模辞書だけで実行してください。

学習パネルの「セキュリティツール」を選択すると、問題4の各ツールの手順、開閉式の詳しいヒント、回答欄を表示します。回答はFlagまたは復元したパスワードをBackendで照合し、正解した問題だけがクリアになります。クリア後はクリア状態の左にある「クリア解除」で再挑戦できます。教材は `~/TerminalBox-Labs` に配置され、RESET時に初期状態へ戻ります。

専用Targetは内部ネットワークの次のアドレスで利用できます。

```text
http://labtarget:3100   Webツール演習
labtarget:4100          Netcat TCP演習
```

Wireshark問題はローカル版とCloud版で同じPCAPをオフライン解析します。Applicationsとターミナルのどちらから起動してもnoVNC向けのQt実行環境を設定する専用ランチャーを経由します。HashcatはGPUを使用せず、配布した小規模辞書だけで短時間に完了する問題です。

Hydra問題でパスワードを確認した後は、次のコマンドでログインしてFlagを取得できます。

```bash
curl -d 'username=analyst&password=bluebird' http://labtarget:3100/hydra/login
```

Tool Labのナビゲーションとフォームは公開画面の `/tool-target/` プレフィックスと、Kali内の `http://labtarget:3100/` の両方に対応しています。

## Web Attacks 演習

学習パネル右端の「Web Attacks」を選択すると、問題5「Web Attacks 初級」とTBX Marketが連動して開きます。既存のツール演習Targetを拡張しているため、追加コンテナ・追加イメージ・追加依存パッケージはありません。

8問でParameter Tampering、IDOR、SQL Injection、安全なStored XSS模擬、仮想ファイルだけを使うPath Traversal、安全なメタデータ判定だけを行うFile Upload、外部通信を行わないSSRF模擬、署名なし研修トークンを扱うJWT演習を学習できます。各問題は詳細ヒントと回答欄を備え、BackendでFlagを照合します。

TBX Marketは次のURLで利用できます。

```text
http://labtarget:3100/web-attacks/   Kali・Terminalからの直接アクセス
/tool-target/web-attacks/            ブラウザiframe用プロキシパス
```

Stored XSSの入力は表示時にエスケープされ、JavaScriptは実行されません。File Uploadは内容を保存・実行せず、ファイル名・Content-Type・サイズだけをメモリDBへ記録します。Path Traversalは事前定義された仮想ファイルだけを返し、SSRFは完全一致する教材URLを固定レスポンスへ割り当てるだけでネットワーク接続しません。

画面の「HPを復元」または全体RESETを実行すると、コメント、アップロード履歴、研修DB、トークンnonceが初期化されます。RESET前に発行したトークンは再利用できません。

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
| `AI_PROVIDER` | `gemini` | `ollama`、`gemini`、`auto` のいずれか。ローカルAIを使う場合だけ`ollama`に変更 |
| `OLLAMA_URL` | `http://ollama:11434` | Backend から見た Ollama API |
| `OLLAMA_MODEL` | `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m` | 使用する Ollama モデル |
| `GEMINI_API_KEY` | 空 | Gemini をローカルで使う場合の API キー |
| `GEMINI_MODEL` | `gemini-3.7-flash` | Gemini モデル |
| `TARGET_URL` | `http://target:3000` | 代表 Target URL |
| `TARGET_URLS` | `http://target:3000,http://target2:3000,http://target3:3000,http://labtarget:3100` | リセット対象の Target 一覧 |
| `KALI_GUI_URL` | `http://kali:6080` | Backend から見た Kali noVNC |
| `TERMINAL_HISTORY_LIMIT` | `2000` | AI に渡すターミナル履歴の最大文字数 |
| `MAX_AGENT_STEPS` | `5` | AI Agentが1回の依頼で実行できる最大ステップ数 |
| `AGENT_COMMAND_TIMEOUT_MS` | `10000` | Agent専用executorの1コマンドのタイムアウト（ミリ秒） |
| `AGENT_SYSTEM_PROMPT_FILE` | `/app/config/agent-system-prompt.txt` | AI Agent専用System Prompt |
| `KALI_CONTAINER` | `terminalbox-kali` | ローカルリセット時に操作する Kali コンテナ名 |
| `WS_AUTH_TOKEN` | 空 | 将来の WebSocket 認証用トークン |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | WebSocket 接続を許可する Origin |
| `KALI_VNC_PASSWORD` | `student` | noVNC/TigerVNC のパスワード |
| `KALI_VNC_GEOMETRY` | `1440x900` | Kali GUI の初期解像度 |
| `KALI_MEMORY_LIMIT` | `6g` | Kali コンテナのメモリ上限 |
| `KALI_CPU_LIMIT` | `2.0` | Kali コンテナの CPU 上限 |

## Cloud Run デプロイ

Cloud Run では、Web と Lab を 2 つのサービスに分離します。

- `terminalbox`: 公開サービス。Web UI、Basic 認証、通常AI、AI Agent orchestration、command-policy、承認管理、Gemini Secretを持ちます。Gemini APIへの外部通信はこのサービスだけが行います。
- `terminalbox-lab`: 非公開サービス。Kali/noVNC/WebSocketターミナル、既存3 Target、ツール演習とWeb Attacksを収容する共通Target、Agent専用executorを持ちます。Agentコマンドはここでもcommand-policyを再適用し、student権限で実行します。Cloud Runでは4 CPU・8GiBを割り当て、コンテナ入口に8081を使用してBurp Proxy用の8080を確保します。

ブラウザは `terminalbox` にだけ接続します。Web Backend は Google 署名付き ID トークンを取得し、許可された HTTP/WebSocketパスと非公開のAgent実行リクエストだけを `terminalbox-lab` へ送ります。Labを呼び出せるのはWeb実行サービスアカウントだけです。Agent実行APIは公開プロキシ対象ではなく、LabからGeminiへ通信することもありません。Targetサイトは公開Webと同一オリジンのパスにプロキシされます。

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
labtarget -> 127.0.0.5:3100 (HTTP), 127.0.0.5:4100 (TCP)
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
curl -fsS http://labtarget:3100/api/status
curl --connect-timeout 5 https://example.com/
env | grep -E 'GEMINI|TERMINALBOX_PASSWORD'
```

期待する結果:

- 4つのTarget APIは成功する。
- `https://example.com/` への外部通信はタイムアウトまたは接続エラーで失敗する。
- `GEMINI` や `TERMINALBOX_PASSWORD` を含む環境変数は表示されない。

公開 Web 側では、画面表示と AI を確認します。

- ターミナルが接続され、コマンドの入力と出力ができる。
- 4つのTargetサイトが画面内に表示され、Tool LabのBurp、SQL、Loginリンクが404にならない。
- KaliワークスペースのBurp SuiteとWiresharkタブから各GUIツールを起動できる。
- AI パネルに `Google Cloud Secret` と `相談できます` が表示される。
- 質問を入力すると送信ボタンが有効になり、Gemini から応答が返る。

確認時点の実装では、Target 接続、外部 IPv4 通信のタイムアウト、Secret 非注入、WebSocket ターミナル、Cloud Secret を使った Gemini 応答を実サービスで検証済みです。

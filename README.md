# TerminalBox

TerminalBox is a browser-based security learning lab deployed only on Google Cloud Run. The former local Docker Compose edition has been retired: there is no supported local Docker startup path, no local Docker validation flow, and no Ollama/local LLM backend.

## Official Runtime

TerminalBox is deployed as two Cloud Run services by `cloudbuild.yaml`.

- `terminalbox`: public Web service. It serves the React UI, applies Basic authentication, holds the Gemini API Secret, orchestrates AI Agent requests, stores approval state, and proxies only allowed Lab HTTP/WebSocket paths.
- `terminalbox-lab`: private Lab service. It runs Kali/noVNC, the WebSocket terminal, training targets, tool targets, and the Agent executor inside the Cloud Run Lab container.

The browser connects only to `terminalbox`. The Web service obtains a Google-signed ID token and calls the private `terminalbox-lab` service. Lab does not receive the Gemini API key and does not call Gemini directly.

## Repository Layout

Cloud Run deployment depends on these files and directories:

- `cloudbuild.yaml`
- `Dockerfile.web.cloud`
- `Dockerfile.lab.cloud`
- `cloud/start-web.sh`
- `cloud/start-lab.sh`
- `cloud/nginx-web.conf`
- `cloud/nginx-lab.conf`
- `cloud/setup-infrastructure.ps1`
- `web/`
- `backend/`
- `kali/` scripts and assets referenced by `Dockerfile.lab.cloud`
- `target/`
- `challenge-target/`
- `challenges/`
- `config/`

Removed local-only files include `compose.yaml`, local service Dockerfiles, the legacy `Dockerfile.cloud`, local nginx config, and Ollama/local env examples.

## AI

TerminalBox uses Gemini for both normal AI chat and AI Agent planning.

- The Web service reads `GEMINI_API_KEY` from Secret Manager.
- `GEMINI_MODEL` defaults to `gemini-3.7-flash`.
- AI Agent command execution happens only in the Lab service, after backend command-policy classification.
- Read-only commands can execute immediately. Mutating commands require approval. Denied commands are never executed.

There is no Ollama, local model loader, local AI profile, Docker socket control, or Docker exec path in the supported runtime.

## Cloud Setup

Set the target project and region:

```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
$env:TERMINALBOX_REGION="asia-northeast1"
```

Create or update the required secrets:

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

If a secret already exists, skip `gcloud secrets create` and add a new version.

Provision or update infrastructure:

```powershell
./cloud/setup-infrastructure.ps1
```

Deploy:

```powershell
gcloud builds submit `
  --project=$env:GOOGLE_CLOUD_PROJECT `
  --config=cloudbuild.yaml
```

`cloudbuild.yaml` builds and deploys:

- `Dockerfile.web.cloud` -> Cloud Run service `terminalbox`
- `Dockerfile.lab.cloud` -> Cloud Run service `terminalbox-lab`

## Runtime Isolation

- `terminalbox-lab` is deployed with internal ingress and `--no-allow-unauthenticated`.
- Only the Web runtime service account has `roles/run.invoker` on Lab.
- Lab uses Direct VPC egress through `terminalbox-vpc`.
- Lab receives the `terminalbox-lab-deny-egress` network tag; `cloud/setup-infrastructure.ps1` creates a firewall rule denying IPv4 egress to `0.0.0.0/0`.
- Lab receives no Gemini or Basic auth secrets.
- Targets bind to loopback addresses inside the Lab container and are exposed to the browser only through the Web service proxy.

See [docs/cloud-run-web-lab.md](docs/cloud-run-web-lab.md) for additional deployment details.

## Post-Deploy Checks

Do not run local Docker Compose verification. After Cloud Build deployment, verify the live Cloud Run services:

- `terminalbox` is public and shows `/terminalbox/` behind Basic authentication.
- `terminalbox-lab` is private and callable only from the Web runtime service account.
- The UI status shows Terminal, Target, Kali Desktop, and AI readiness.
- The terminal can reach internal targets such as `http://target:3000/api/status` and `http://labtarget:3100/api/status`.
- External IPv4 requests from the Lab terminal time out or fail.
- AI shows `Google Cloud Secret` when the Gemini key is injected through Secret Manager.

## Required Files Checklist

Before deployment, make sure these Cloud Run files still exist:

```text
cloudbuild.yaml
Dockerfile.web.cloud
Dockerfile.lab.cloud
cloud/start-web.sh
cloud/start-lab.sh
cloud/nginx-web.conf
cloud/nginx-lab.conf
cloud/setup-infrastructure.ps1
web/package.json
backend/package.json
kali/start-gui.sh
kali/start-xfce.sh
kali/agent-executor.py
kali/activate-tool.sh
target/src/server.js
challenge-target/server.py
challenges/
config/ai-system-prompt.txt
config/agent-system-prompt.txt
```

# TerminalBox architecture

TerminalBox is Cloud Run only. The retired local Docker Compose runtime, Docker socket control, Docker exec terminal path, and Ollama/local AI backend are not part of the supported architecture.

## Runtime flow

```text
Browser
  |
  | HTTPS /terminalbox/, /api/*, /ws/*, /kali-gui/*, target proxy paths
  v
Cloud Run: terminalbox (public)
  - nginx serves the built React app
  - backend handles sessions, AI, AI Agent orchestration, approvals
  - backend obtains Google ID tokens for private Lab calls
  |
  | authenticated service-to-service HTTP/WebSocket
  v
Cloud Run: terminalbox-lab (private)
  - Kali terminal and noVNC desktop
  - training targets on loopback hostnames
  - challenge target and tool target
  - Agent executor running as student
```

## Services

| Service | Visibility | Main files | Responsibility |
|---|---|---|---|
| `terminalbox` | Public Cloud Run service | `Dockerfile.web.cloud`, `cloud/start-web.sh`, `cloud/nginx-web.conf` | Web UI, Basic auth, Gemini access, Lab proxy, AI Agent orchestration |
| `terminalbox-lab` | Private Cloud Run service | `Dockerfile.lab.cloud`, `cloud/start-lab.sh`, `cloud/nginx-lab.conf` | Kali/noVNC, terminal, targets, Lab reset, Agent command execution |

The browser never talks directly to Lab. All browser-visible Lab paths are proxied through the public Web service. Private internal Agent execution and target flag checks are service-to-service only.

## Lab Internals

`cloud/start-lab.sh` adds the internal hostnames to `/etc/hosts`:

```text
target    -> 127.0.0.2:3000
target2   -> 127.0.0.3:3000
target3   -> 127.0.0.4:3000
target4   -> 127.0.0.5:3000
target5   -> 127.0.0.6:3000
labtarget -> 127.0.0.7:3100 and 127.0.0.7:4100
```

The backend terminal, desktop manager, Lab reset, and Agent executor run local processes inside the Lab container as `student`. They do not use Docker Engine or `/var/run/docker.sock`.

## AI

Gemini is the only supported AI backend.

- `terminalbox` receives `GEMINI_API_KEY` from Secret Manager.
- `terminalbox-lab` receives no Gemini secret.
- Normal chat and AI Agent planning call Gemini from the Web service.
- AI Agent commands are rechecked by command-policy before execution in Lab.

## Networking

- Web service egress is allowed so it can call Gemini and private Lab.
- Lab service uses Direct VPC egress and the `terminalbox-lab-deny-egress` network tag.
- `cloud/setup-infrastructure.ps1` creates `terminalbox-lab-deny-all-egress`, denying Lab IPv4 egress to `0.0.0.0/0`.
- Lab still requires normal Cloud Run platform traffic such as metadata, DNS, and service infrastructure traffic.

## Build Inputs

Cloud Build requires:

- `cloudbuild.yaml`
- `Dockerfile.web.cloud`
- `Dockerfile.lab.cloud`
- `cloud/`
- `web/`
- `backend/`
- `kali/`
- `target/`
- `challenge-target/`
- `challenges/`
- `config/`

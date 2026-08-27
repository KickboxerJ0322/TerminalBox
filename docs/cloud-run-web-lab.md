# Cloud Run Web/Lab separation

TerminalBox is deployed as two Cloud Run services:

- `terminalbox`: public Web/UI, Basic authentication, AI backend, Gemini secret
- `terminalbox-lab`: private Kali/noVNC/terminal and three local training targets

The browser only connects to `terminalbox`. The Web backend obtains a Google-signed ID token and proxies the allowed HTTP and WebSocket paths to `terminalbox-lab`. Only the Web runtime service account has `roles/run.invoker` on Lab.

## Network boundary

Both services use Direct VPC egress and route all traffic through `terminalbox-vpc`. Cloud NAT permits the Web service to call Gemini. The Lab revision has the network tag `terminalbox-lab-deny-egress`; firewall rule `terminalbox-lab-deny-all-egress` denies all IPv4 egress for that tag at priority 100.

The targets bind to loopback addresses inside the Lab instance, so these still work without entering the VPC:

```text
target  -> 127.0.0.2:3000
target2 -> 127.0.0.3:3000
target3 -> 127.0.0.4:3000
```

Lab receives no Secret Manager values. Its runtime service account has no project-level IAM roles. Cloud Run's metadata endpoint can still identify and mint a token for the assigned service account, but that identity has no project permissions.

## Provision and deploy

Run once from PowerShell:

```powershell
./cloud/setup-infrastructure.ps1
```

Then submit `cloudbuild.yaml`, or push to the connected GitHub branch after updating the trigger to use this file.

## Required verification

From the TerminalBox shell:

```bash
curl -fsS http://target:3000/api/status
curl -fsS http://target2:3000/api/status
curl -fsS http://target3:3000/api/status
curl --connect-timeout 5 https://example.com/
env | grep -E 'GEMINI|TERMINALBOX_PASSWORD'
```

The three target calls must succeed. The external call must fail, and the environment search must print nothing.

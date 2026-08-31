#!/bin/sh
set -eu

: "${TERMINALBOX_PASSWORD:?TERMINALBOX_PASSWORD must be supplied by Secret Manager}"
: "${LAB_SERVICE_URL:?LAB_SERVICE_URL must be supplied}"

export PORT="${BACKEND_PORT:-3001}"
export SERVICE_ROLE=web
export AI_SYSTEM_PROMPT_FILE="${AI_SYSTEM_PROMPT_FILE:-/opt/terminalbox/config/ai-system-prompt.txt}"
export AGENT_SYSTEM_PROMPT_FILE="${AGENT_SYSTEM_PROMPT_FILE:-/opt/terminalbox/config/agent-system-prompt.txt}"

htpasswd -bc /tmp/terminalbox.htpasswd terminalbox "$TERMINALBOX_PASSWORD" >/dev/null
chmod 0644 /tmp/terminalbox.htpasswd

node /opt/terminalbox/backend/src/server.js &
backend_pid=$!

cleanup() {
  kill "$backend_pid" >/dev/null 2>&1 || true
  wait "$backend_pid" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

until node -e "fetch('http://127.0.0.1:${PORT}/api/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"; do
  if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
    echo "TerminalBox web backend exited before it became healthy" >&2
    wait "$backend_pid"
  fi
  sleep 1
done

exec nginx -g 'daemon off;'

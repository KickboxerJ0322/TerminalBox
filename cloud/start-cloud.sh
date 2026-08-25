#!/bin/sh
set -eu

: "${TERMINALBOX_PASSWORD:?TERMINALBOX_PASSWORD must be supplied by Secret Manager}"

htpasswd -bc /tmp/terminalbox.htpasswd terminalbox "$TERMINALBOX_PASSWORD" >/dev/null
chmod 0644 /tmp/terminalbox.htpasswd

pids=""
start_process() {
  "$@" &
  pids="$pids $!"
}

cleanup() {
  for pid in $pids; do kill "$pid" >/dev/null 2>&1 || true; done
  wait || true
}
trap cleanup INT TERM EXIT

start_process env PORT=3101 TARGET_PROFILE=1 node /opt/terminalbox/target/src/server.js
start_process env PORT=3102 TARGET_PROFILE=2 node /opt/terminalbox/target/src/server.js
start_process env PORT=3103 TARGET_PROFILE=3 node /opt/terminalbox/target/src/server.js
start_process su -s /bin/sh student -c 'HOME=/home/student USER=student LOGNAME=student KALI_VNC_PASSWORD="${KALI_VNC_PASSWORD:-student}" KALI_VNC_GEOMETRY="${KALI_VNC_GEOMETRY:-1440x900}" /usr/local/bin/start-gui'
start_process env \
  PORT=3001 \
  AI_PROVIDER=gemini \
  KALI_EXEC_MODE=local \
  TARGET_URL=http://127.0.0.1:3101 \
  TARGET_URLS=http://127.0.0.1:3101,http://127.0.0.1:3102,http://127.0.0.1:3103 \
  KALI_GUI_URL=http://127.0.0.1:6080 \
  AI_SYSTEM_PROMPT_FILE=/opt/terminalbox/config/ai-system-prompt.txt \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://localhost}" \
  node /opt/terminalbox/backend/src/server.js

exec nginx -g 'daemon off;'

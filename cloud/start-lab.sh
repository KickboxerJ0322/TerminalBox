#!/bin/sh
set -eu

printf '\n127.0.0.2 target\n127.0.0.3 target2\n127.0.0.4 target3\n' >> /etc/hosts

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

start_process env HOST=127.0.0.2 PORT=3000 TARGET_PROFILE=1 node /opt/terminalbox/target/src/server.js
start_process env HOST=127.0.0.3 PORT=3000 TARGET_PROFILE=2 node /opt/terminalbox/target/src/server.js
start_process env HOST=127.0.0.4 PORT=3000 TARGET_PROFILE=3 node /opt/terminalbox/target/src/server.js
start_process su -s /bin/sh student -c 'HOME=/home/student USER=student LOGNAME=student KALI_VNC_PASSWORD="${KALI_VNC_PASSWORD:-student}" KALI_VNC_GEOMETRY="${KALI_VNC_GEOMETRY:-1440x900}" /usr/local/bin/start-gui'
start_process env \
  PORT=3001 \
  SERVICE_ROLE=lab \
  AI_PROVIDER=gemini \
  KALI_EXEC_MODE=local \
  TARGET_URL=http://target:3000 \
  TARGET_URLS=http://target:3000,http://target2:3000,http://target3:3000 \
  KALI_GUI_URL=http://127.0.0.1:6080 \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://localhost}" \
  node /opt/terminalbox/backend/src/server.js

exec nginx -g 'daemon off;'

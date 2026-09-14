#!/bin/sh
set -eu

printf '\n127.0.0.2 target\n127.0.0.3 target2\n127.0.0.4 target3\n127.0.0.5 target4\n127.0.0.6 target5\n127.0.0.7 labtarget\n' >> /etc/hosts

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
start_process env HOST=127.0.0.5 PORT=3000 TARGET_PROFILE=4 node /opt/terminalbox/target/src/server.js
start_process env HOST=127.0.0.6 PORT=3000 TARGET_PROFILE=5 node /opt/terminalbox/target/src/server.js
start_process su -s /bin/sh student -c 'CHALLENGE_HTTP_HOST=127.0.0.7 CHALLENGE_TCP_HOST=127.0.0.7 python3 /opt/terminalbox/challenge-target/server.py'
start_process env \
  PORT=3001 \
  SERVICE_ROLE=lab \
  AI_PROVIDER=gemini \
  KALI_EXEC_MODE=local \
  TARGET_URL=http://target:3000 \
  TARGET_URLS=http://target:3000,http://target2:3000,http://target3:3000,http://target4:3000,http://target5:3000,http://labtarget:3100 \
  KALI_GUI_URL=http://127.0.0.1:6080 \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://localhost}" \
  node /opt/terminalbox/backend/src/server.js
backend_pid="${pids##* }"

until node -e "fetch('http://127.0.0.1:3001/api/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"; do
  if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
    echo "TerminalBox lab backend exited before it became healthy" >&2
    wait "$backend_pid"
  fi
  sleep 1
done

exec nginx -g 'daemon off;'

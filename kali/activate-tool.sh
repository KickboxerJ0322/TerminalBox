#!/bin/sh
set -eu

export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-${HOME:-/home/student}/.Xauthority}"

runtime_dir="${XDG_RUNTIME_DIR:-${HOME:-/home/student}/.terminalbox/run}"
log_dir="${TBX_SESSION_LOG_DIR:-${HOME:-/home/student}/.terminalbox/logs}"
tool_dir="$runtime_dir/terminalbox-tools"
mkdir -p "$tool_dir" "$log_dir"
chmod 700 "$tool_dir" "$log_dir" 2>/dev/null || true

wait_for_display() {
  attempts=0
  while [ "$attempts" -lt 60 ]; do
    if wmctrl -m >/dev/null 2>&1; then return 0; fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "Kali Desktop display $DISPLAY is not ready" >&2
  return 1
}

tool_running() {
  pid_file="$tool_dir/$1.pid"
  [ -f "$pid_file" ] || return 1
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  case "$pid" in ''|*[!0-9]*) rm -f "$pid_file"; return 1 ;; esac
  if kill -0 "$pid" 2>/dev/null; then return 0; fi
  rm -f "$pid_file"
  return 1
}

remember_pid() { printf '%s\n' "$2" > "$tool_dir/$1.pid"; }

activate_window() {
  window_class="$1"; window_title="$2"; alternate_title="${3:-$2}"
  wmctrl -k off 2>/dev/null || true
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if wmctrl -xa "$window_class" 2>/dev/null || wmctrl -a "$window_title" 2>/dev/null || wmctrl -a "$alternate_title" 2>/dev/null; then return 0; fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

case "${1:-}" in
  burp)
    wait_for_display
    burp_port="${TERMINALBOX_BURP_PROXY_PORT:-8080}"
    case "$burp_port" in ''|*[!0-9]*) echo "Invalid TERMINALBOX_BURP_PROXY_PORT" >&2; exit 2 ;; esac
    burp_config="$tool_dir/burp-project.json"
    cat > "$burp_config" <<EOF
{"project_options":{"proxy":{"request_listeners":[{"certificate_mode":"per_host","listen_mode":"loopback_only","listener_port":$burp_port,"running":true}]}}}
EOF
    if ! tool_running burp; then
      nohup burpsuite "--config-file=$burp_config" >"$log_dir/burp.log" 2>&1 &
      remember_pid burp "$!"
    fi
    printf 'Burp Proxy: 127.0.0.1:%s\n' "$burp_port"
    activate_window "burpsuite.BurpSuite" "Burp Suite"
    ;;
  wireshark)
    wait_for_display
    if ! tool_running wireshark; then
      nohup /usr/local/bin/wireshark "$HOME/TerminalBox-Labs/capture.pcapng" >"$log_dir/wireshark.log" 2>&1 &
      remember_pid wireshark "$!"
    fi
    activate_window "wireshark.Wireshark" "Wireshark" "capture.pcapng"
    ;;
  desktop)
    wait_for_display
    wmctrl -k on
    ;;
  *)
    echo "usage: terminalbox-activate-tool {burp|wireshark|desktop}" >&2
    exit 2
    ;;
esac

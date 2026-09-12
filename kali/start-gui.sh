#!/bin/sh
set -eu

display="${KALI_VNC_DISPLAY:-1}"
novnc_port="${KALI_NOVNC_PORT:-6080}"
geometry="${KALI_VNC_GEOMETRY:-1440x900}"
depth="${KALI_VNC_DEPTH:-24}"
password="${KALI_VNC_PASSWORD:-student}"
session_log_dir="${TBX_SESSION_LOG_DIR:-$HOME/.terminalbox/logs}"
runtime_dir="${XDG_RUNTIME_DIR:-$HOME/.terminalbox/run}"
tmp_dir="${TMPDIR:-$runtime_dir}"

mkdir -p "$session_log_dir" "$runtime_dir" "$tmp_dir" "$HOME/.config" "$HOME/.local/share"
chmod 700 "$runtime_dir" "$tmp_dir" "$session_log_dir" || true
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_RUNTIME_DIR="$runtime_dir"
export TMPDIR="$tmp_dir"
export DISPLAY=":$display"

case "$display" in
  ''|*[!0-9]*)
    echo "KALI_VNC_DISPLAY must be a positive integer" >&2
    exit 1
    ;;
esac

if [ "$display" -lt 1 ]; then
  echo "KALI_VNC_DISPLAY must be a positive integer" >&2
  exit 1
fi

case "$novnc_port" in
  ''|*[!0-9]*)
    echo "KALI_NOVNC_PORT must be a positive integer" >&2
    exit 1
    ;;
esac

if [ "$novnc_port" -lt 1 ] || [ "$novnc_port" -gt 65535 ]; then
  echo "KALI_NOVNC_PORT must be between 1 and 65535" >&2
  exit 1
fi

password_length=$(printf '%s' "$password" | wc -c)
if [ "$password_length" -lt 1 ] || [ "$password_length" -gt 8 ]; then
  echo "KALI_VNC_PASSWORD must contain 1 to 8 characters" >&2
  exit 1
fi

vnc_config_dir="$HOME/.config/tigervnc"
mkdir -p "$vnc_config_dir"
printf '%s\n' "$password" | vncpasswd -f > "$vnc_config_dir/passwd"
chmod 0600 "$vnc_config_dir/passwd"

tigervncserver ":$display" -kill >/dev/null 2>&1 || true
rm -f "/tmp/.X${display}-lock" "/tmp/.X11-unix/X${display}"

echo "starting websockify session=${TBX_SESSION_ID:-unknown} display=$display novnc_port=$novnc_port" >&2
websockify --web=/usr/share/novnc "$novnc_port" "127.0.0.1:$((5900 + display))" >> "$session_log_dir/websockify.log" 2>&1 &
websockify_pid=$!

cleanup() {
  kill "$websockify_pid" >/dev/null 2>&1 || true
  tigervncserver ":$display" -kill >/dev/null 2>&1 || true
  if [ -n "${vnc_pid:-}" ]; then
    kill "$vnc_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup INT TERM EXIT

echo "starting tigervnc session=${TBX_SESSION_ID:-unknown} display=$display vnc_port=$((5900 + display))" >&2
tigervncserver ":$display" -fg -localhost yes -SecurityTypes VncAuth \
  -geometry "$geometry" -depth "$depth" -xstartup /usr/local/bin/start-xfce >> "$session_log_dir/tigervnc.log" 2>&1 &
vnc_pid=$!

while kill -0 "$websockify_pid" >/dev/null 2>&1 \
  && kill -0 "$vnc_pid" >/dev/null 2>&1; do
  sleep 2
done

set -e
status=1
if ! kill -0 "$websockify_pid" >/dev/null 2>&1; then
  set +e
  wait "$websockify_pid"
  status=$?
  set -e
  echo "websockify exited with status $status" >&2
else
  set +e
  wait "$vnc_pid"
  status=$?
  set -e
  echo "TigerVNC exited with status $status" >&2
fi

exit "$status"

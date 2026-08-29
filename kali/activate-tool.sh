#!/bin/sh
set -eu

export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-${HOME:-/home/student}/.Xauthority}"

activate_window() {
  window_class="$1"
  window_title="$2"
  alternate_title="${3:-$2}"
  wmctrl -k off 2>/dev/null || true
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if wmctrl -xa "$window_class" 2>/dev/null \
      || wmctrl -a "$window_title" 2>/dev/null \
      || wmctrl -a "$alternate_title" 2>/dev/null; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

case "${1:-}" in
  burp)
    if ! pgrep -f '[b]urpsuite' >/dev/null; then
      nohup burpsuite >/tmp/burpsuite.log 2>&1 &
    fi
    activate_window "burpsuite.BurpSuite" "Burp Suite"
    ;;
  wireshark)
    if ! pgrep -x wireshark >/dev/null; then
      nohup wireshark "$HOME/TerminalBox-Labs/capture.pcapng" >/tmp/wireshark.log 2>&1 &
    fi
    activate_window "wireshark.Wireshark" "Wireshark" "capture.pcapng"
    ;;
  desktop)
    wmctrl -k on
    ;;
  *)
    echo "usage: terminalbox-activate-tool {burp|wireshark|desktop}" >&2
    exit 2
    ;;
esac

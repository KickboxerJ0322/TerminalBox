#!/bin/sh
set -eu
export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-${HOME:-/home/student}/.Xauthority}"
export QT_X11_NO_MITSHM=1
runtime_dir="${XDG_RUNTIME_DIR:-${HOME:-/home/student}/.terminalbox/run}"
mkdir -p "$runtime_dir"
chmod 0700 "$runtime_dir" 2>/dev/null || true
export XDG_RUNTIME_DIR="$runtime_dir"
exec /usr/bin/wireshark "$@"

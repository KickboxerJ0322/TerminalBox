#!/bin/sh
set -eu

export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-${HOME:-/home/student}/.Xauthority}"
export QT_X11_NO_MITSHM=1

runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ ! -d "$runtime_dir" ] || [ ! -w "$runtime_dir" ]; then
  runtime_dir="/tmp/terminalbox-runtime-$(id -u)"
  mkdir -p "$runtime_dir"
  chmod 0700 "$runtime_dir"
fi
export XDG_RUNTIME_DIR="$runtime_dir"

exec /usr/bin/wireshark "$@"

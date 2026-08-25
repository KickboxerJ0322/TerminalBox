#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
export LANG=ja_JP.UTF-8
export LANGUAGE=ja_JP:ja
export LC_ALL=ja_JP.UTF-8
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS="@im=fcitx"

fcitx_config_dir="$HOME/.config/fcitx5"
mkdir -p "$fcitx_config_dir"
cat > "$fcitx_config_dir/profile" <<'EOF'
[Groups/0]
Name=Default
Default Layout=us
DefaultIM=mozc

[Groups/0/Items/0]
Name=keyboard-us
Layout=

[Groups/0/Items/1]
Name=mozc
Layout=

[GroupOrder]
0=Default
EOF

desktop_dir="$HOME/Desktop"
mkdir -p "$desktop_dir"
cp /usr/local/share/applications/TerminalBox.desktop "$desktop_dir/TerminalBox.desktop"
chmod 0755 "$desktop_dir/TerminalBox.desktop"
xdg-mime default org.xfce.mousepad.desktop text/plain || true

exec dbus-launch --exit-with-session sh -c '
  fcitx5 -d >/tmp/fcitx5.log 2>&1 || true
  (
    attempt=0
    while [ "$attempt" -lt 30 ]; do
      if fcitx5-remote >/dev/null 2>&1; then
        fcitx5-remote -o >/tmp/fcitx5-remote.log 2>&1 || true
        fcitx5-remote -s mozc >>/tmp/fcitx5-remote.log 2>&1 || true
        exit 0
      fi
      attempt=$((attempt + 1))
      sleep 1
    done
    echo "Could not switch fcitx5 to mozc" >&2
  ) &
  (
    attempt=0
    while [ "$attempt" -lt 30 ]; do
      if /usr/local/bin/apply-wallpaper; then
        exit 0
      fi
      attempt=$((attempt + 1))
      sleep 1
    done
    echo "Could not apply the TerminalBox wallpaper" >&2
  ) &
  exec startxfce4
'

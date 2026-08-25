#!/bin/sh
set -eu

wallpaper=/usr/local/share/backgrounds/kali-net-default.jpg
monitor=$(xrandr --query | awk '$2 == "connected" { print $1; exit }')

if [ -z "$monitor" ] || [ ! -r "$wallpaper" ]; then
  exit 1
fi

property_base="/backdrop/screen0/monitor${monitor}/workspace0"

set_property() {
  property="$1"
  type="$2"
  value="$3"
  if xfconf-query -c xfce4-desktop -p "$property" >/dev/null 2>&1; then
    xfconf-query -c xfce4-desktop -p "$property" -s "$value"
  else
    xfconf-query -c xfce4-desktop -p "$property" -n -t "$type" -s "$value"
  fi
}

set_property "$property_base/last-image" string "$wallpaper"
set_property "$property_base/image-path" string "$wallpaper"
set_property "$property_base/image-style" int 5

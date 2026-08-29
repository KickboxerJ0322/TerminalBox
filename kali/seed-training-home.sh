#!/bin/sh
set -eu

home="${HOME:-/home/student}"
lab_dir="$home/TerminalBox-Labs"
mkdir -p "$lab_dir" "$home/.msf4/modules/auxiliary/scanner/http"
cp -R /opt/terminalbox/challenges/student/. "$lab_dir/"
cp /opt/terminalbox/challenges/metasploit/terminalbox_flag.rb "$home/.msf4/modules/auxiliary/scanner/http/terminalbox_flag.rb"
if command -v text2pcap >/dev/null 2>&1; then
  text2pcap -q -T 51514,80 "$lab_dir/capture.hex" "$lab_dir/capture.pcapng"
  rm -f "$lab_dir/capture.hex"
fi
chmod -R u+rwX,go-rwx "$lab_dir" "$home/.msf4"

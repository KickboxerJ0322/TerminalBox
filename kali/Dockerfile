FROM kalilinux/kali-rolling:latest

COPY terminalbox.bashrc /etc/terminalbox.bashrc

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      adwaita-icon-theme bash ca-certificates curl dbus-x11 dnsutils git iproute2 \
      mousepad netcat-openbsd nmap novnc python3 thunar tigervnc-standalone-server wget xdg-utils \
      websockify xfce4-panel xfce4-session xfce4-terminal xfdesktop4 xfwm4 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash --uid 1000 student \
    && chmod 0644 /etc/terminalbox.bashrc \
    && if [ ! -e /usr/share/novnc/index.html ]; then \
         ln -s vnc.html /usr/share/novnc/index.html; \
       fi

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      fcitx5 fcitx5-mozc firefox-esr fonts-noto-cjk im-config locales \
      kali-wallpapers-2026 tigervnc-tools \
    && sed -i 's/^# *ja_JP.UTF-8 UTF-8/ja_JP.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen ja_JP.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=0755 start-gui.sh /usr/local/bin/start-gui
COPY --chmod=0755 start-xfce.sh /usr/local/bin/start-xfce
COPY --chmod=0755 apply-wallpaper.sh /usr/local/bin/apply-wallpaper
COPY --chmod=0755 TerminalBox.desktop /usr/local/share/applications/TerminalBox.desktop
COPY assets/terminalbox-icon.png /usr/local/share/icons/hicolor/256x256/apps/terminalbox.png
COPY assets/terminalbox-serpent-wallpaper.png /usr/local/share/backgrounds/terminalbox-serpent-wallpaper.png
COPY assets/kali-net-default.jpg /usr/local/share/backgrounds/kali-net-default.jpg
RUN chmod 0755 /usr/local/share/backgrounds \
    && chmod 0644 /usr/local/share/icons/hicolor/256x256/apps/terminalbox.png \
      /usr/local/share/backgrounds/terminalbox-serpent-wallpaper.png \
      /usr/local/share/backgrounds/kali-net-default.jpg \
    && ln -sf /usr/local/share/backgrounds/terminalbox-serpent-wallpaper.png \
      /usr/share/backgrounds/kali/terminalbox-serpent-wallpaper.png \
    && ln -sf /usr/local/share/backgrounds/kali-net-default.jpg \
      /usr/share/backgrounds/kali/kali-net-default.jpg

USER student
WORKDIR /home/student
EXPOSE 6080
CMD ["/usr/local/bin/start-gui"]

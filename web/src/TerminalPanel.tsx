import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

interface PasteRequest {
  id: number;
  text: string;
}

interface Props {
  onHistoryChange: (history: string) => void;
  pasteRequest: PasteRequest | null;
}

const HISTORY_LIMIT = 12_000;

export function TerminalPanel({ onHistoryChange, pasteRequest }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPasteRef = useRef<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.35,
      scrollback: 3000,
      theme: {
        background: '#0a0e0c',
        foreground: '#dbe7df',
        cursor: '#62f6a6',
        selectionBackground: '#274c3b',
        green: '#62f6a6',
        brightGreen: '#8affbd',
        blue: '#4bb7a7',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;

    let history = '';
    let reconnectTimer: number | undefined;
    let disposed = false;

    const appendHistory = (value: string) => {
      history = (history + value).slice(-HISTORY_LIMIT);
      onHistoryChange(history);
    };

    const sendSize = () => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    };

    const sendInput = (text: string) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data: text }));
        terminal.focus();
        terminal.scrollToBottom();
        return true;
      }
      return false;
    };

    const flushPendingPaste = () => {
      if (!pendingPasteRef.current) return;
      if (!sendInput(pendingPasteRef.current)) return;
      pendingPasteRef.current = null;
    };

    const connect = () => {
      setConnection('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        sendSize();
        flushPendingPaste();
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'ready') {
          setConnection('connected');
          sendSize();
          flushPendingPaste();
        } else if (message.type === 'output') {
          terminal.write(message.data);
          appendHistory(message.data);
        } else if (message.type === 'error') {
          terminal.writeln(`\r\n\x1b[31m${message.message}\x1b[0m`);
        }
      });
      socket.addEventListener('close', () => {
        if (disposed) return;
        setConnection('disconnected');
        terminal.writeln('\r\n\x1b[33m[接続が切れました。3秒後に再接続します]\x1b[0m');
        reconnectTimer = window.setTimeout(connect, 3000);
      });
    };

    const inputSubscription = terminal.onData((data) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        sendSize();
      } catch {
        /* The terminal can be between layouts during teardown. */
      }
    });

    resizeObserver.observe(host);
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      resizeObserver.disconnect();
      inputSubscription.dispose();
      socketRef.current?.close();
      socketRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [onHistoryChange]);

  useEffect(() => {
    if (!pasteRequest) return;
    const terminal = terminalRef.current;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data: pasteRequest.text }));
      terminal?.focus();
      terminal?.scrollToBottom();
      return;
    }
    pendingPasteRef.current = pasteRequest.text;
  }, [pasteRequest]);

  return (
    <section className="panel terminal-panel" aria-labelledby="terminal-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">WORKSPACE / KALI</span>
          <h2 id="terminal-title">Terminal</h2>
        </div>
        <span className={`connection connection-${connection}`}>
          <span aria-hidden="true" />
          {connection === 'connected' ? '接続済み' : connection === 'connecting' ? '接続中' : '再接続中'}
        </span>
      </div>
      <div className="terminal-shell" onClick={() => terminalRef.current?.focus()}>
        <div className="window-controls" aria-hidden="true"><i /><i /><i /></div>
        <div className="terminal-host" ref={hostRef} />
      </div>
    </section>
  );
}

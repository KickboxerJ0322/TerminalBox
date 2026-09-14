import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentPanel } from './AgentPanel';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ChallengePanel } from './ChallengePanel';
import { CommandGuide } from './CommandGuide';
import { KaliWorkspacePanel } from './KaliWorkspacePanel';
import { TargetPanel } from './TargetPanel';
import { TutorialPanel } from './TutorialPanel';

interface Status {
  backend: boolean;
  kaliGui: boolean;
  target: boolean;
  ollama: boolean;
  model: string;
  modelInstalled: boolean;
  aiProvider?: string;
  aiReady?: boolean;
}

interface PasteRequest {
  id: number;
  text: string;
}

type LearningTab = 'tutorial' | 'targets' | 'tools' | 'web-attacks';

const TUTORIAL_STORAGE_KEY = 'terminalbox:tutorial-completed';
const CHALLENGE_STORAGE_KEY = 'terminalbox:challenge-completed';
const GEMINI_API_KEY_STORAGE_KEY = 'terminalbox:gemini-api-key';
const GEMINI_MODEL_STORAGE_KEY = 'terminalbox:gemini-model';
const KALI_GUI_URL = '/kali-gui/vnc.html?autoconnect=1&resize=remote&password=student&path=kali-gui/websockify';
const MIN_PANE_PERCENT = 24;
const MAX_PANE_PERCENT = 76;

type ResizeTarget = 'columns' | 'leftRows' | 'rightRows';

interface PaneSizes {
  leftColumn: number;
  leftTop: number;
  rightTop: number;
}

function clampPanePercent(value: number) {
  return Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, value));
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="info-overlay" role="presentation" onClick={onClose}>
      <section
        className="info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="info-heading">
          <div>
            <span className="eyebrow">ABOUT TERMINALBOX</span>
            <h2 id="info-title">TerminalBoxでできること</h2>
          </div>
          <button type="button" aria-label="閉じる" onClick={onClose}>x</button>
        </div>
        <div className="info-content">
          <p>
            TerminalBox は、匿名セッションごとにTerminal、Target、Challenge、AI Agentの状態を分けて使う学習Labです。
          </p>
          <div className="info-grid">
            <article><span>01</span><h3>Kaliワークスペース</h3><p>TerminalとKali Desktopを同じセッションの作業領域で利用できます。</p></article>
            <article><span>02</span><h3>ターゲット演習</h3><p>問題1から5の研修サイトを調査し、攻撃の体験から原因と防御まで学びます。</p></article>
            <article><span>03</span><h3>Web Attacks</h3><p>TBX Marketの演習で基本的なWeb脆弱性を確認します。</p></article>
            <article><span>04</span><h3>AI Agent</h3><p>オンラインAgentが承認ポリシーに沿ってTerminal操作を支援します。</p></article>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResetDialog({
  resetting,
  error,
  onCancel,
  onConfirm,
}: {
  resetting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="info-overlay" role="presentation" onClick={resetting ? undefined : onCancel}>
      <section
        className="info-dialog reset-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="info-heading">
          <div><span className="eyebrow">RESET WORKSPACE</span><h2 id="reset-title">このLabをリセット</h2></div>
        </div>
        <div className="reset-content">
          <p id="reset-description">
            現在のセッションのTerminal、Desktop、Target、Challenge、AI Agent状態を初期状態に戻します。他の利用者には影響しません。
          </p>
          <p className="reset-warning">この操作は取り消せません。</p>
          {error && <p className="reset-error" role="alert">{error}</p>}
          <div className="reset-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={resetting}>キャンセル</button>
            <button type="button" className="danger" onClick={onConfirm} disabled={resetting}>
              {resetting ? 'リセットしています...' : 'このLabをリセット'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [history, setHistory] = useState('');
  const [fullTerminalHistory, setFullTerminalHistory] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [learningTab, setLearningTab] = useState<LearningTab>('tutorial');
  const [infoOpen, setInfoOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [pasteRequest, setPasteRequest] = useState<PasteRequest | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [targetRefreshSignal, setTargetRefreshSignal] = useState(0);
  const [challengeTargetId, setChallengeTargetId] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [paneSizes, setPaneSizes] = useState<PaneSizes>({ leftColumn: 50, leftTop: 50, rightTop: 50 });
  const workspaceRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const targetEventCountRef = useRef(0);

  const updateHistory = useCallback((value: string) => setHistory(value), []);
  const updateFullHistory = useCallback((value: string) => setFullTerminalHistory(value), []);

  const loadStatus = useCallback(async () => {
    try {
      await fetch('/api/session', { method: 'POST', credentials: 'include', cache: 'no-store' });
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
      const nextStatus: Status = await response.json();
      setStatus(nextStatus);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const sessionResponse = await fetch('/api/session', { method: 'POST', credentials: 'include', cache: 'no-store' });
        if (!sessionResponse.ok) throw new Error(`Session request failed: ${sessionResponse.status}`);
        if (active) {
          setSessionReady(true);
          setSessionError('');
        }
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        const nextStatus: Status = await response.json();
        if (active) setStatus(nextStatus);
      } catch {
        if (active) {
          setStatus(null);
          setSessionReady(false);
          setSessionError('Session initialization failed');
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!infoOpen && !commandOpen && !resetOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
        setCommandOpen(false);
        if (!resetting) setResetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen, infoOpen, resetOpen, resetting]);

  useEffect(() => {
    const recentHistory = history.slice(-4000);
    const targetMatches = [
      { id: 1 as const, index: recentHistory.lastIndexOf('http://target:3000') },
      { id: 2 as const, index: recentHistory.lastIndexOf('http://target2:3000') },
      { id: 3 as const, index: recentHistory.lastIndexOf('http://target3:3000') },
      { id: 4 as const, index: recentHistory.lastIndexOf('http://target4:3000') },
      { id: 5 as const, index: recentHistory.lastIndexOf('http://target5:3000') },
    ];
    const latestTarget = targetMatches.reduce((latest, candidate) => (
      candidate.index > latest.index ? candidate : latest
    ));

    if (latestTarget.index >= 0) setChallengeTargetId(latestTarget.id);

    const eventCount = (history.match(/"status":"(?:updated|reset)"/g) ?? []).length;
    if (eventCount > targetEventCountRef.current) {
      setTargetRefreshSignal((value) => value + 1);
    }
    targetEventCountRef.current = eventCount;
  }, [history]);

  const queueTerminalPaste = useCallback((text: string) => {
    setPasteRequest({ id: Date.now(), text });
  }, []);

  const selectChallengeTarget = useCallback((targetId: 1 | 2 | 3 | 4 | 5) => {
    setChallengeTargetId(targetId);
    setLearningTab('targets');
  }, []);

  const applyClientReset = useCallback(() => {
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    window.localStorage.removeItem(CHALLENGE_STORAGE_KEY);
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    window.localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY);
    setHistory('');
    setFullTerminalHistory('');
    setPasteRequest(null);
    setLearningTab('tutorial');
    setChallengeTargetId(1);
    targetEventCountRef.current = 0;
    setResetSignal((value) => value + 1);
    void loadStatus();
  }, [loadStatus]);

  const resetWorkspace = useCallback(async () => {
    setResetting(true);
    setResetError('');
    try {
      const response = await fetch('/api/lab/reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-terminalbox-reset': 'confirmed' },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${response.status}`);
      }
      applyClientReset();
      setTargetRefreshSignal((value) => value + 1);
      setResetOpen(false);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'リセットに失敗しました。');
    } finally {
      setResetting(false);
    }
  }, [applyClientReset]);

  const systemReady = status?.backend === true
    && status.kaliGui
    && status.target
    && status.aiReady === true;

  const workspaceStyle = {
    '--workspace-left-fr': `${paneSizes.leftColumn}fr`,
    '--workspace-right-fr': `${100 - paneSizes.leftColumn}fr`,
  } as CSSProperties;

  const leftColumnStyle = {
    '--workspace-top-fr': `${paneSizes.leftTop}fr`,
    '--workspace-bottom-fr': `${100 - paneSizes.leftTop}fr`,
  } as CSSProperties;

  const rightColumnStyle = {
    '--workspace-top-fr': `${paneSizes.rightTop}fr`,
    '--workspace-bottom-fr': `${100 - paneSizes.rightTop}fr`,
  } as CSSProperties;

  const beginResize = (target: ResizeTarget, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const measureElement = target === 'columns'
      ? workspaceRef.current
      : target === 'leftRows' ? leftColumnRef.current : rightColumnRef.current;
    if (!measureElement) return;

    const move = (moveEvent: PointerEvent) => {
      const rect = measureElement.getBoundingClientRect();
      const rawPercent = target === 'columns'
        ? ((moveEvent.clientX - rect.left) / rect.width) * 100
        : ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const nextPercent = clampPanePercent(rawPercent);
      setPaneSizes((current) => target === 'columns'
        ? { ...current, leftColumn: nextPercent }
        : target === 'leftRows'
          ? { ...current, leftTop: nextPercent }
          : { ...current, rightTop: nextPercent });
    };

    const end = () => {
      document.body.classList.remove('is-resizing-pane');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };

    document.body.classList.add('is-resizing-pane');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };

  const resizeWithKeyboard = (target: ResizeTarget, event: ReactKeyboardEvent<HTMLDivElement>) => {
    const horizontalKeys = target === 'columns' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
    const verticalKeys = target !== 'columns' && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
    if (!horizontalKeys && !verticalKeys) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -4 : 4;
    setPaneSizes((current) => target === 'columns'
      ? { ...current, leftColumn: clampPanePercent(current.leftColumn + direction) }
      : target === 'leftRows'
        ? { ...current, leftTop: clampPanePercent(current.leftTop + direction) }
        : { ...current, rightTop: clampPanePercent(current.rightTop + direction) });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/terminalbox/" aria-label="TerminalBox ホーム">
          <span className="brand-mark" aria-hidden="true">&gt;_</span>
          <span>Terminal<span>Box</span></span>
        </a>
        <div className="header-meta">
          <span>ISOLATED LAB</span>
          <a
            className="gui-link"
            href={KALI_GUI_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            KALI DESKTOP
          </a>
          <button className="info-link" type="button" onClick={() => setInfoOpen(true)}>
            INFO
          </button>
          <button className="command-link" type="button" onClick={() => setCommandOpen(true)}>
            COMMAND
          </button>
          <button className="reset-link" type="button" onClick={() => { setResetError(''); setResetOpen(true); }}>
            RESET
          </button>
          <span className={systemReady ? 'system-online' : 'system-offline'}>
            <i /> {systemReady ? 'SYSTEM ONLINE' : 'SYSTEM CHECKING'}
          </span>
        </div>
      </header>

      <main className="workspace-main">
        <div className="workspace-grid four-pane-workspace" ref={workspaceRef} style={workspaceStyle}>
          <div className="workspace-column workspace-column-left" ref={leftColumnRef} style={leftColumnStyle}>
            <KaliWorkspacePanel
              key={`terminal-${resetSignal}`}
              onHistoryChange={updateHistory}
              onFullHistoryChange={updateFullHistory}
              pasteRequest={pasteRequest}
            />
            <div
              className="pane-resizer pane-resizer-horizontal"
              role="separator"
              aria-label="Terminal と Target の高さを調整"
              aria-orientation="horizontal"
              aria-valuemin={MIN_PANE_PERCENT}
              aria-valuemax={MAX_PANE_PERCENT}
              aria-valuenow={Math.round(paneSizes.leftTop)}
              tabIndex={0}
              onPointerDown={(event) => beginResize('leftRows', event)}
              onKeyDown={(event) => resizeWithKeyboard('leftRows', event)}
            />
            <TargetPanel
              key={`target-${resetSignal}`}
              refreshSignal={targetRefreshSignal}
              targetId={challengeTargetId}
              onTargetChange={selectChallengeTarget}
            />
          </div>
          <div
            className="pane-resizer pane-resizer-vertical"
            role="separator"
            aria-label="左右の画面幅を調整"
            aria-orientation="vertical"
            aria-valuemin={MIN_PANE_PERCENT}
            aria-valuemax={MAX_PANE_PERCENT}
            aria-valuenow={Math.round(paneSizes.leftColumn)}
            tabIndex={0}
            onPointerDown={(event) => beginResize('columns', event)}
            onKeyDown={(event) => resizeWithKeyboard('columns', event)}
          />
          <div className="workspace-column workspace-column-right" ref={rightColumnRef} style={rightColumnStyle}>
            <aside className="side-workspace learning-workspace" aria-label="学習パネル">
            <div className="workspace-tabs" role="tablist" aria-label="学習パネル">
              <button
                id="tutorial-tab"
                type="button"
                role="tab"
                aria-selected={learningTab === 'tutorial'}
                aria-controls="tutorial-panel"
                className={learningTab === 'tutorial' ? 'active' : ''}
                onClick={() => setLearningTab('tutorial')}
              >
                チュートリアル
              </button>
              <button
                id="targets-tab"
                type="button"
                role="tab"
                aria-selected={learningTab === 'targets'}
                aria-controls="challenge-panel"
                className={learningTab === 'targets' ? 'active' : ''}
                onClick={() => setLearningTab('targets')}
              >
                ターゲット
              </button>
              <button
                id="tools-tab"
                type="button"
                role="tab"
                aria-selected={learningTab === 'tools'}
                aria-controls="challenge-panel"
                className={learningTab === 'tools' ? 'active' : ''}
                onClick={() => setLearningTab('tools')}
              >
                セキュリティツール
              </button>
              <button
                id="web-attacks-tab"
                type="button"
                role="tab"
                aria-selected={learningTab === 'web-attacks'}
                aria-controls="challenge-panel"
                className={learningTab === 'web-attacks' ? 'active' : ''}
                onClick={() => setLearningTab('web-attacks')}
              >
                Web Attacks
              </button>
            </div>
            {learningTab === 'tutorial' && (
              <TutorialPanel onInsertCommand={queueTerminalPaste} resetSignal={resetSignal} />
            )}
            {learningTab === 'targets' && (
              <ChallengePanel
                onInsertCommand={queueTerminalPaste}
                resetSignal={resetSignal}
                targetId={challengeTargetId}
                onTargetChange={selectChallengeTarget}
                scope="targets"
              />
            )}
            {learningTab === 'tools' && (
              <ChallengePanel
                onInsertCommand={queueTerminalPaste}
                resetSignal={resetSignal}
                targetId={4}
                onTargetChange={selectChallengeTarget}
                scope="tools"
              />
            )}
            {learningTab === 'web-attacks' && (
              <ChallengePanel
                onInsertCommand={queueTerminalPaste}
                resetSignal={resetSignal}
                targetId={5}
                onTargetChange={selectChallengeTarget}
                scope="web-attacks"
              />
            )}
            </aside>

            <div
              className="pane-resizer pane-resizer-horizontal"
              role="separator"
              aria-label="学習パネルと AI Agent の高さを調整"
              aria-orientation="horizontal"
              aria-valuemin={MIN_PANE_PERCENT}
              aria-valuemax={MAX_PANE_PERCENT}
              aria-valuenow={Math.round(paneSizes.rightTop)}
              tabIndex={0}
              onPointerDown={(event) => beginResize('rightRows', event)}
              onKeyDown={(event) => resizeWithKeyboard('rightRows', event)}
            />

            <aside className="side-workspace assistant-workspace" aria-label="AI Agent">
            {!sessionReady && (
              <section className="panel assistant-panel" id="assistant-online-panel" role="tabpanel" aria-labelledby="assistant-online-title">
                <div className="panel-heading"><h2 id="assistant-online-title">AI Agent</h2></div>
                <div className="messages"><article className="message message-assistant"><span className="message-role">SYSTEM</span><div>{sessionError || 'Session を準備しています。'}</div></article></div>
              </section>
            )}
            {sessionReady && (
              <AgentPanel
                key={`assistant-online-${resetSignal}`}
                panelId="assistant-online-panel"
                tabId="assistant-online-title"
                provider="gemini"
                terminalHistory={history}
                fullTerminalHistory={fullTerminalHistory}
                status={status}
              />
            )}
            </aside>
          </div>
        </div>

      </main>

      {infoOpen && <InfoDialog onClose={() => setInfoOpen(false)} />}
      {commandOpen && <CommandGuide onClose={() => setCommandOpen(false)} />}
      {resetOpen && (
        <ResetDialog
          resetting={resetting}
          error={resetError}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => void resetWorkspace()}
        />
      )}
    </div>
  );
}

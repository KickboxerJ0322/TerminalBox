import { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantPanel } from './AssistantPanel';
import { BasicOperationsPanel } from './BasicOperationsPanel';
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

type LearningTab = 'operations' | 'tutorial' | 'targets' | 'tools';
type AssistantTab = 'assistant' | 'assistant-online';

const TUTORIAL_STORAGE_KEY = 'terminalbox:tutorial-completed';
const OPERATIONS_STORAGE_KEY = 'terminalbox:operations-completed';
const CHALLENGE_STORAGE_KEY = 'terminalbox:challenge-completed';
const GEMINI_API_KEY_STORAGE_KEY = 'terminalbox:gemini-api-key';
const GEMINI_MODEL_STORAGE_KEY = 'terminalbox:gemini-model';

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
          <button type="button" aria-label="閉じる" onClick={onClose}>×</button>
        </div>
        <div className="info-content">
          <p>
            TerminalBox は、隔離された Kali Linux 環境でLinuxの基本操作、Webターゲット調査、
            セキュリティツール演習を安全に学ぶためのアプリです。TerminalとKali Desktopは同じ環境を操作します。
          </p>
          <div className="info-grid">
            <article>
              <span>01</span>
              <h3>Kaliワークスペース</h3>
              <p>Terminal、Burp Suite、Wireshark、Kali Desktopをタブで切り替えられます。GUI接続を保持し、選択したツールを前面へ表示します。</p>
            </article>
            <article>
              <span>02</span>
              <h3>基本操作・チュートリアル</h3>
              <p>ファイル操作とLinuxコマンドをミッション形式で学べます。提示コマンドはTerminalへ貼り付けできます。</p>
            </article>
            <article>
              <span>03</span>
              <h3>ターゲット問題</h3>
              <p>問題1～3では研修サイト、オンラインストア、図書館サイトを調査し、隔離環境内でAPIの安全性を学びます。</p>
            </article>
            <article>
              <span>04</span>
              <h3>セキュリティツール問題</h3>
              <p>問題4ではBurp Suite、Wireshark/tshark、Gobuster、Nikto、sqlmap、John、Hashcat、Netcat、Hydra、Metasploitを使います。</p>
            </article>
            <article>
              <span>05</span>
              <h3>AIサポート</h3>
              <p>初期状態ではGeminiのAI（オンライン）が選択されます。「直近のターミナル履歴を含める」も初期状態で有効です。</p>
            </article>
            <article>
              <span>06</span>
              <h3>進捗とリセット</h3>
              <p>各問題は回答確認、クリア、クリア解除ができます。RESETはターゲット、Kaliホーム、履歴、進捗、AI設定を初期化します。</p>
            </article>
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
          <div><span className="eyebrow">RESET WORKSPACE</span><h2 id="reset-title">すべて初期化しますか？</h2></div>
        </div>
        <div className="reset-content">
          <p id="reset-description">
            4つの演習ターゲット、Kaliで作成した学習ファイル、ターミナル履歴、問題の進捗、AI会話と保存済みAPI設定を初期状態へ戻します。
          </p>
          <p className="reset-warning">この操作は取り消せません。</p>
          {error && <p className="reset-error" role="alert">{error}</p>}
          <div className="reset-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={resetting}>キャンセル</button>
            <button type="button" className="danger" onClick={onConfirm} disabled={resetting}>
              {resetting ? '初期化しています...' : 'すべて初期化する'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [history, setHistory] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [learningTab, setLearningTab] = useState<LearningTab>('operations');
  const [assistantTab, setAssistantTab] = useState<AssistantTab>('assistant-online');
  const [infoOpen, setInfoOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [pasteRequest, setPasteRequest] = useState<PasteRequest | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [targetRefreshSignal, setTargetRefreshSignal] = useState(0);
  const [challengeTargetId, setChallengeTargetId] = useState<1 | 2 | 3 | 4>(1);
  const targetEventCountRef = useRef(0);

  const updateHistory = useCallback((value: string) => setHistory(value), []);

  const loadStatus = useCallback(async () => {
    try {
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
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        const nextStatus: Status = await response.json();
        if (active) setStatus(nextStatus);
      } catch {
        if (active) setStatus(null);
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
      { id: 4 as const, index: recentHistory.lastIndexOf('labtarget') },
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

  const selectChallengeTarget = useCallback((targetId: 1 | 2 | 3 | 4) => {
    setChallengeTargetId(targetId);
    setLearningTab(targetId === 4 ? 'tools' : 'targets');
  }, []);

  const applyClientReset = useCallback(() => {
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    window.localStorage.removeItem(OPERATIONS_STORAGE_KEY);
    window.localStorage.removeItem(CHALLENGE_STORAGE_KEY);
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    window.localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY);
    setHistory('');
    setPasteRequest(null);
    setLearningTab('operations');
    setAssistantTab('assistant-online');
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
      setResetError(error instanceof Error ? error.message : '初期化に失敗しました。');
    } finally {
      setResetting(false);
    }
  }, [applyClientReset]);

  const systemReady = status?.backend === true
    && status.kaliGui
    && status.target
    && status.aiReady === true;

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
            href="/kali-gui/?autoconnect=1&resize=remote"
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
        <div className="workspace-grid four-pane-workspace">
          <div className="workspace-column workspace-column-left">
            <KaliWorkspacePanel
              key={`terminal-${resetSignal}`}
              onHistoryChange={updateHistory}
              pasteRequest={pasteRequest}
            />
            <TargetPanel
              key={`target-${resetSignal}`}
              refreshSignal={targetRefreshSignal}
              targetId={challengeTargetId}
              onTargetChange={selectChallengeTarget}
            />
          </div>
          <div className="workspace-column workspace-column-right">
            <aside className="side-workspace learning-workspace" aria-label="学習パネル">
            <div className="workspace-tabs" role="tablist" aria-label="学習パネル">
              <button
                id="operations-tab"
                type="button"
                role="tab"
                aria-selected={learningTab === 'operations'}
                aria-controls="operations-panel"
                className={learningTab === 'operations' ? 'active' : ''}
                onClick={() => setLearningTab('operations')}
              >
                基本操作
              </button>
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
                onClick={() => { setLearningTab('targets'); if (challengeTargetId === 4) setChallengeTargetId(1); }}
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
                onClick={() => { setLearningTab('tools'); setChallengeTargetId(4); }}
              >
                セキュリティツール
              </button>
            </div>
            {learningTab === 'operations' && (
              <BasicOperationsPanel onInsertCommand={queueTerminalPaste} resetSignal={resetSignal} />
            )}
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
            </aside>

            <aside className="side-workspace assistant-workspace" aria-label="AIパネル">
            <div className="workspace-tabs" role="tablist" aria-label="AIパネル">
              <button
                id="assistant-tab"
                type="button"
                role="tab"
                aria-selected={assistantTab === 'assistant'}
                aria-controls="assistant-panel"
                className={assistantTab === 'assistant' ? 'active' : ''}
                onClick={() => setAssistantTab('assistant')}
              >
                AIアシスタント
              </button>
              <button
                id="assistant-online-tab"
                type="button"
                role="tab"
                aria-selected={assistantTab === 'assistant-online'}
                aria-controls="assistant-online-panel"
                className={assistantTab === 'assistant-online' ? 'active' : ''}
                onClick={() => setAssistantTab('assistant-online')}
              >
                AI（オンライン）
              </button>
            </div>
            {assistantTab === 'assistant' && (
              <AssistantPanel
                key={`assistant-local-${resetSignal}`}
                panelId="assistant-panel"
                tabId="assistant-tab"
                mode="local"
                terminalHistory={history}
                status={status}
              />
            )}
            {assistantTab === 'assistant-online' && (
              <AssistantPanel
                key={`assistant-online-${resetSignal}`}
                panelId="assistant-online-panel"
                tabId="assistant-online-tab"
                mode="online"
                terminalHistory={history}
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

import { FormEvent, KeyboardEvent, useState } from 'react';
import { captureTerminalBoxScreen } from './ai-attachments';

interface Status {
  model: string;
  aiProvider?: string;
  aiReady?: boolean;
  geminiConfigured?: boolean;
}

interface AgentResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut?: boolean;
  truncated?: boolean;
}

interface AgentStep {
  step: number;
  command: string;
  reason: string;
  classification: 'READ_ONLY' | 'CONFIRM_REQUIRED' | 'DENIED';
  approved: boolean;
  result?: AgentResult;
}

interface AgentResponse {
  status: 'completed' | 'approval_required' | 'denied' | 'cancelled' | 'step_limit';
  message?: string;
  approvalId?: string;
  command?: string;
  reason?: string;
  expiresAt?: number;
  steps?: AgentStep[];
}

interface Entry {
  role: 'user' | 'agent';
  text?: string;
  response?: AgentResponse;
}

interface Props {
  panelId: string;
  tabId: string;
  terminalHistory: string;
  fullTerminalHistory: string;
  status: Status | null;
}

const GEMINI_API_KEY_STORAGE = 'terminalbox:gemini-api-key';
const GEMINI_MODEL_STORAGE = 'terminalbox:gemini-model';
const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

function storedValue(key: string, fallback: string) {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.error || `HTTP ${response.status}`);
  return body as AgentResponse;
}

function StepView({ step }: { step: AgentStep }) {
  return (
    <div className="agent-step">
      <div className="agent-step-heading">
        <strong>● Step {step.step}</strong>
        <span className={`agent-classification agent-${step.classification.toLowerCase()}`}>{step.classification}</span>
      </div>
      <p>{step.reason}</p>
      <pre><code>$ {step.command}</code></pre>
      {step.result && (
        <div className="agent-result">
          <strong>{step.result.exitCode === 0 ? '✓ 実行完了' : `終了コード ${step.result.exitCode}`}</strong>
          {step.result.stdout && <pre><code>{step.result.stdout}</code></pre>}
          {step.result.stderr && <pre className="agent-stderr"><code>{step.result.stderr}</code></pre>}
          <small>{step.result.durationMs} ms{step.result.truncated ? ' / 出力を省略しました' : ''}</small>
        </div>
      )}
    </div>
  );
}

function entryContent(entry: Entry) {
  if (entry.text) return entry.text;
  if (entry.response?.message) return entry.response.message;
  return entry.response?.steps?.map((step) => [
    `$ ${step.command}`,
    step.result?.stdout,
    step.result?.stderr,
  ].filter(Boolean).join('\n')).join('\n') ?? '';
}

export function AgentPanel({ panelId, tabId, terminalHistory, fullTerminalHistory, status }: Props) {
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [includeConversationHistory, setIncludeConversationHistory] = useState(true);
  const [includeTerminalHistory, setIncludeTerminalHistory] = useState(true);
  const [includeFullTerminalHistory, setIncludeFullTerminalHistory] = useState(false);
  const [includeScreenCapture, setIncludeScreenCapture] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey] = useState(() => storedValue(GEMINI_API_KEY_STORAGE, ''));
  const [geminiModel] = useState(() => storedValue(GEMINI_MODEL_STORAGE, DEFAULT_GEMINI_MODEL));
  const managedGemini = status?.aiProvider === 'gemini' && status?.geminiConfigured === true;
  const ready = managedGemini || apiKey.trim().length > 0;
  let pending: AgentResponse | undefined;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].response?.status === 'approval_required') {
      pending = entries[index].response;
      break;
    }
  }

  const updatePending = (response: AgentResponse) => {
    setEntries((current) => {
      const updated = [...current];
      let index = -1;
      for (let candidate = updated.length - 1; candidate >= 0; candidate -= 1) {
        if (updated[candidate].response?.status === 'approval_required') {
          index = candidate;
          break;
        }
      }
      if (index >= 0) updated[index] = { role: 'agent', response };
      else updated.push({ role: 'agent', response });
      return updated;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const typedMessage = question.trim();
    const hasTerminalAttachment = includeTerminalHistory || includeFullTerminalHistory;
    const message = typedMessage || (hasTerminalAttachment
      ? 'ターミナル記録を確認し、現在の状況に必要な操作を行ってください。'
      : includeScreenCapture ? '添付したTerminalBox画面を確認し、必要な操作を行ってください。' : '');
    if (!message || loading || pending || !ready) return;
    const conversationHistory = includeConversationHistory ? entries
      .map((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entryContent(entry),
      }))
      .filter((entry) => entry.content)
      .slice(-6) : [];
    setQuestion('');
    setEntries((current) => [...current, { role: 'user', text: message }]);
    setLoading(true);
    try {
      setCaptureMessage('');
      const screenCapture = includeScreenCapture ? await captureTerminalBoxScreen() : undefined;
      if (screenCapture) setCaptureMessage('画面を取得してAI Agentへ添付しました。');
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          terminalHistory: includeFullTerminalHistory
            ? fullTerminalHistory
            : includeTerminalHistory ? terminalHistory : '',
          terminalHistoryMode: includeFullTerminalHistory ? 'full' : 'recent',
          screenCapture,
          conversationHistory,
          geminiApiKey: managedGemini ? undefined : apiKey,
          geminiModel: managedGemini ? undefined : geminiModel || DEFAULT_GEMINI_MODEL,
        }),
      });
      const agentResponse = await responseJson(response);
      setEntries((current) => [...current, { role: 'agent', response: agentResponse }]);
    } catch (error) {
      setEntries((current) => [...current, { role: 'agent', text: `エラー: ${error instanceof Error ? error.message : 'Agent処理に失敗しました。'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const decideApproval = async (allow: boolean) => {
    if (!pending?.approvalId || loading) return;
    setLoading(true);
    try {
      const response = await fetch(allow ? '/api/agent/approve' : '/api/agent/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvalId: pending.approvalId }),
      });
      updatePending(await responseJson(response));
    } catch (error) {
      setEntries((current) => [...current, { role: 'agent', text: `エラー: ${error instanceof Error ? error.message : '承認処理に失敗しました。'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as typeof event.nativeEvent & { isComposing?: boolean; keyCode?: number };
    if (event.key !== 'Enter' || event.shiftKey || native.isComposing || native.keyCode === 229) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <section className="panel assistant-panel agent-panel" id={panelId} role="tabpanel" aria-labelledby={tabId}>
      <div className="panel-heading">
        <div><span className="eyebrow">ONLINE AI / SAFE EXECUTOR</span><h2>AI Agent</h2></div>
        <span className={`ai-badge ${ready ? '' : 'ai-badge-wait'}`}>{ready ? '実行できます' : '設定待ち'}</span>
      </div>
      <div className="agent-notice">
        オンラインAIを使用中。閲覧操作は自動実行し、変更操作は承認後にstudent権限で実行します。禁止操作は実行しません。
      </div>
      <div className="messages" aria-live="polite">
        {!ready && <article className="message message-assistant"><span className="message-role">SYSTEM</span><div>AI（オンライン）でGemini APIキーを設定してください。</div></article>}
        {entries.length === 0 && <article className="message message-assistant"><span className="message-role">AGENT</span><div>例:「今いるディレクトリとファイル一覧を確認して」と依頼できます。</div></article>}
        {entries.map((entry, index) => (
          <article className={`message message-${entry.role === 'user' ? 'user' : 'assistant'} agent-message`} key={index}>
            <span className="message-role">{entry.role === 'user' ? 'YOU' : 'AGENT'}</span>
            <div>
              {entry.text && <p>{entry.text}</p>}
              {entry.response?.steps?.map((step) => <StepView step={step} key={`${step.step}-${step.command}`} />)}
              {entry.response?.status === 'completed' && <p className="agent-final">{entry.response.message}</p>}
              {entry.response?.status === 'step_limit' && <p className="agent-final">{entry.response.message}</p>}
              {entry.response?.status === 'cancelled' && <p>コマンド実行をキャンセルしました。</p>}
              {entry.response?.status === 'denied' && (
                <div className="agent-denied"><strong>⛔ この操作はAI Agentから実行できません</strong><pre><code>$ {entry.response.command}</code></pre><p>{entry.response.reason}</p></div>
              )}
              {entry.response?.status === 'approval_required' && (
                <div className="agent-approval">
                  <strong>⚠ コマンド実行の確認</strong>
                  <pre><code>$ {entry.response.command}</code></pre>
                  <p>理由: {entry.response.reason}</p>
                  <p>この操作はファイル、設定、またはプロセスを変更する可能性があります。</p>
                  <div className="agent-approval-actions">
                    <button type="button" className="secondary" disabled={loading} onClick={() => void decideApproval(false)}>キャンセル</button>
                    <button type="button" disabled={loading} onClick={() => void decideApproval(true)}>実行を許可</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
        {loading && <div className="thinking"><i /><i /><i /><span>{pending ? '承認を処理しています...' : '計画・実行しています...'}</span></div>}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <label htmlFor={`${panelId}-question`}>TerminalBox内で行うことを依頼する</label>
        <textarea id={`${panelId}-question`} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKeyDown} placeholder="例: OSと現在のユーザーを確認して" rows={3} maxLength={2000} disabled={Boolean(pending)} />
        <div className="form-actions agent-form-actions">
          <div className="history-options">
            <label className="history-toggle">
              <input type="checkbox" checked={includeConversationHistory} onChange={(event) => setIncludeConversationHistory(event.target.checked)} />
              AI 会話履歴を含める
            </label>
            <label className="history-toggle">
              <input type="checkbox" checked={includeTerminalHistory} onChange={(event) => setIncludeTerminalHistory(event.target.checked)} />
              直近のターミナル履歴を含める
            </label>
            <label className="history-toggle">
              <input type="checkbox" checked={includeFullTerminalHistory} onChange={(event) => setIncludeFullTerminalHistory(event.target.checked)} />
              ターミナル全文
            </label>
            <label className="history-toggle history-toggle-capture">
              <input type="checkbox" checked={includeScreenCapture} onChange={(event) => setIncludeScreenCapture(event.target.checked)} />
              キャプチャ
            </label>
            {captureMessage && <p className="capture-note" role="status">{captureMessage}</p>}
          </div>
          <button type="submit" disabled={!ready || loading || Boolean(pending) || (!question.trim() && !includeTerminalHistory && !includeFullTerminalHistory && !includeScreenCapture)}>{loading ? '送信中' : '送信'} <span aria-hidden="true">→</span></button>
        </div>
      </form>
    </section>
  );
}

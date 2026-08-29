import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Status {
  ollama: boolean;
  model: string;
  modelInstalled: boolean;
  aiProvider?: string;
  aiReady?: boolean;
  geminiConfigured?: boolean;
}

interface Props {
  panelId: string;
  tabId: string;
  mode: 'local' | 'online';
  terminalHistory: string;
  status: Status | null;
}

const GEMINI_API_KEY_STORAGE = 'terminalbox:gemini-api-key';
const GEMINI_MODEL_STORAGE = 'terminalbox:gemini-model';
const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

function MessageContent({ content }: { content: string }) {
  const sections = content.split(/```/);
  return (
    <>
      {sections.map((section, index) => (index % 2 === 1
        ? <pre key={index}><code>{section.replace(/^(bash|sh|shell|text|json|console)\n/, '')}</code></pre>
        : <span key={index}>{section}</span>))}
    </>
  );
}

function getInitialMessage(mode: 'local' | 'online', managedGemini = false) {
  return mode === 'online'
    ? managedGemini
      ? 'Gemini に相談できます。API キーは Google Cloud Secret から安全に読み込まれます。'
      : 'Gemini に相談できます。API キーを入力してから質問してください。'
    : 'コマンドの意味や実行結果で迷ったら、ここで相談してください。必要なら直近のターミナル履歴も一緒に送れます。';
}

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : 'AI への問い合わせに失敗しました。';
  if (/aborted|timeout|timed out/i.test(message)) {
    return '応答がタイムアウトしました。少し待ってからもう一度試してください。';
  }
  return message;
}

function loadStoredValue(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeGeminiModel(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === 'gemini-1.5-flash' ? DEFAULT_GEMINI_MODEL : trimmed;
}

export function AssistantPanel({ panelId, tabId, mode, terminalHistory, status }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: getInitialMessage(mode) },
  ]);
  const [question, setQuestion] = useState('');
  const [includeTerminalHistory, setIncludeTerminalHistory] = useState(false);
  const [includeConversationHistory, setIncludeConversationHistory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => loadStoredValue(GEMINI_API_KEY_STORAGE, ''));
  const [geminiModel, setGeminiModel] = useState(() => normalizeGeminiModel(
    loadStoredValue(GEMINI_MODEL_STORAGE, DEFAULT_GEMINI_MODEL),
  ));
  const [clipboardMessage, setClipboardMessage] = useState('');

  useEffect(() => {
    const managedGemini = status?.aiProvider === 'gemini' && status?.geminiConfigured === true;
    setMessages([{ role: 'assistant', content: getInitialMessage(mode, managedGemini) }]);
    setQuestion('');
    setIncludeTerminalHistory(false);
    setIncludeConversationHistory(true);
    setLoading(false);
    setClipboardMessage('');
  }, [mode, status?.aiProvider, status?.geminiConfigured]);

  useEffect(() => {
    if (mode !== 'online') return;
    try {
      window.localStorage.setItem(GEMINI_API_KEY_STORAGE, apiKey);
      window.localStorage.setItem(GEMINI_MODEL_STORAGE, geminiModel);
    } catch {
      /* Local storage may be unavailable in hardened browsers. */
    }
  }, [apiKey, geminiModel, mode]);

  const localAiReady = status?.ollama === true && status.modelInstalled === true;
  const managedGemini = status?.aiProvider === 'gemini' && status?.geminiConfigured === true;
  const onlineAiReady = managedGemini || apiKey.trim().length > 0;
  const aiReady = mode === 'online' ? onlineAiReady : localAiReady;
  const providerLabel = mode === 'online' ? 'ONLINE AI / GEMINI' : 'LOCAL AI / LFM2.5';
  const title = mode === 'online' ? 'AI（オンライン）' : 'AI Assistant';

  const useRecommendedModel = () => {
    setGeminiModel(DEFAULT_GEMINI_MODEL);
    setClipboardMessage('推奨モデルを設定しました。');
  };

  const pasteApiKeyFromClipboard = async () => {
    if (!window.isSecureContext || !navigator.clipboard?.readText) {
      const manualValue = window.prompt('この画面では自動読み取りできません。ここに API キーを貼り付けてください。', apiKey);
      if (manualValue && manualValue.trim()) {
        setApiKey(manualValue.trim());
        setClipboardMessage('API キーを設定しました。');
      } else if (manualValue !== null) {
        setClipboardMessage('API キーが空です。');
      }
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardMessage('クリップボードが空です。');
        return;
      }
      setApiKey(text.trim());
      setClipboardMessage('API キーを貼り付けました。');
    } catch {
      const manualValue = window.prompt('クリップボードの読み取りが許可されていません。ここに API キーを貼り付けてください。', apiKey);
      if (manualValue && manualValue.trim()) {
        setApiKey(manualValue.trim());
        setClipboardMessage('API キーを設定しました。');
      } else if (manualValue !== null) {
        setClipboardMessage('API キーが空です。');
      }
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const typedMessage = question.trim();
    const canAnalyzeTerminalHistory = mode === 'online' && includeTerminalHistory;
    const message = typedMessage || (canAnalyzeTerminalHistory
      ? '直近のターミナル履歴を分析し、実行内容、結果、エラー、次に行うべきことを説明してください。'
      : '');
    if (!message || loading) return;
    if (mode === 'online' && !onlineAiReady) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: 'Gemini API キーを入力してから質問してください。',
      }]);
      return;
    }

    const conversationHistory = includeConversationHistory ? messages.slice(-4) : [];
    const selectedModel = normalizeGeminiModel(geminiModel);
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          terminalHistory: includeTerminalHistory ? terminalHistory : '',
          conversationHistory,
          provider: mode === 'online' ? 'gemini' : 'ollama',
          geminiApiKey: mode === 'online' && apiKey.trim() ? apiKey.trim() : undefined,
          geminiModel: mode === 'online' ? selectedModel : undefined,
        }),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        let errorMessage = `AI から応答を取得できませんでした (HTTP ${response.status})。`;
        try {
          const body = JSON.parse(rawBody) as { error?: string; detail?: string };
          if (body.error) errorMessage = body.detail ? `${body.error}\n${body.detail}` : body.error;
        } catch {
          /* Keep the HTTP error when a proxy returns HTML. */
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('AI の応答ストリームを取得できませんでした。');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let assistantStarted = false;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const streamEvent = JSON.parse(line) as { content?: string; error?: string };
        if (streamEvent.error) throw new Error(streamEvent.error);
        if (!streamEvent.content) return;
        answer += streamEvent.content;
        if (!assistantStarted) {
          assistantStarted = true;
          setMessages((current) => [...current, { role: 'assistant', content: answer }]);
          return;
        }
        setMessages((current) => {
          const updated = [...current];
          updated[updated.length - 1] = { role: 'assistant', content: answer };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          handleLine(buffer.slice(0, newlineIndex));
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');
        }
        if (done) break;
      }

      handleLine(buffer);
      if (!answer.trim()) throw new Error('AI の応答が空でした。');
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: `エラー: ${getFriendlyError(error)}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as KeyboardEvent<HTMLTextAreaElement>['nativeEvent'] & {
      isComposing?: boolean;
      keyCode?: number;
    };
    if (event.key !== 'Enter' || event.shiftKey || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <section className="panel assistant-panel" id={panelId} role="tabpanel" aria-labelledby={tabId}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{providerLabel}</span>
          <h2 id={`${panelId}-title`}>{title}</h2>
        </div>
        <span className={`ai-badge ${aiReady ? '' : 'ai-badge-wait'}`}>
          {aiReady ? '相談できます' : '設定待ち'}
        </span>
      </div>

      {mode === 'online' && managedGemini && (
        <div className="online-settings managed-ai-settings">
          <div className="online-setting online-setting-wide">
            <span>Gemini API key</span>
            <strong>Google Cloud Secret</strong>
          </div>
          <div className="online-setting">
            <span>Model</span>
            <strong>{status?.model || DEFAULT_GEMINI_MODEL}</strong>
          </div>
        </div>
      )}

      {mode === 'online' && !managedGemini && (
        <div className="online-settings">
          <label className="online-setting online-setting-wide">
            <span>Gemini API key</span>
            <div className="online-input-row">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="mini-action" onClick={pasteApiKeyFromClipboard}>
                貼り付け
              </button>
            </div>
          </label>
          <label className="online-setting">
            <span>Model</span>
            <div className="online-input-row">
              <input
                type="text"
                value={geminiModel}
                onChange={(event) => setGeminiModel(event.target.value)}
                placeholder={DEFAULT_GEMINI_MODEL}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="mini-action" onClick={useRecommendedModel}>
                3.7 Flash
              </button>
            </div>
          </label>
          {clipboardMessage && <p className="online-note">{clipboardMessage}</p>}
        </div>
      )}

      <div className="messages" aria-live="polite">
        {!aiReady && (
          <article className="message message-assistant">
            <span className="message-role">SYSTEM</span>
            <div>
              {mode === 'online'
                ? 'API キーを入力すると、Gemini へ質問できます。'
                : 'ローカル AI の準備を確認しています。表示が落ち着くまで少し待ってから質問してください。'}
            </div>
          </article>
        )}
        {messages.map((message, index) => (
          <article className={`message message-${message.role}`} key={index}>
            <span className="message-role">{message.role === 'user' ? 'YOU' : 'AI'}</span>
            <div><MessageContent content={message.content} /></div>
          </article>
        ))}
        {loading && <div className="thinking"><i /><i /><i /><span>考えています...</span></div>}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <label htmlFor={`${panelId}-question`}>ターミナルについて質問する</label>
        <textarea
          id={`${panelId}-question`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          placeholder={mode === 'online' ? '例: このコマンドの危険性を教えて' : '例: grep の結果を読み解いて'}
          rows={3}
          maxLength={4000}
          lang="ja"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="form-actions">
          <div className="history-options">
            <label className="history-toggle">
              <input
                type="checkbox"
                checked={includeConversationHistory}
                onChange={(event) => setIncludeConversationHistory(event.target.checked)}
              />
              AI 会話履歴を含める
            </label>
            <label className="history-toggle">
              <input
                type="checkbox"
                checked={includeTerminalHistory}
                onChange={(event) => setIncludeTerminalHistory(event.target.checked)}
              />
              直近のターミナル履歴を含める
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || (!question.trim() && !(mode === 'online' && includeTerminalHistory)) || (mode === 'online' && !onlineAiReady)}
          >
            {loading ? '送信中' : '送信'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </section>
  );
}

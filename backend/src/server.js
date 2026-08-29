import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { config, loadSystemPrompt, resolveAiProvider } from './config.js';
import { attachTerminalSocket } from './terminal.js';
import { getQuickReply } from './quick-replies.js';
import { sanitizeConversationHistory } from './conversation-history.js';
import { getAiStatus, getSystemStatus } from './status.js';
import { resetLab } from './lab-reset.js';
import { isAllowedWebSocketOrigin } from './origin.js';
import { createLabProxy, isLabHttpPath, isLabWebSocketPath } from './lab-proxy.js';
import { checkChallengeAnswer } from './challenge-check.js';

const isWebService = config.serviceRole === 'web';
const isLabService = config.serviceRole === 'lab';
const labProxy = isWebService ? createLabProxy(config) : null;

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
if (isWebService) {
  app.use((request, response, next) => {
    if (!isLabHttpPath(request.path)) {
      next();
      return;
    }
    void labProxy.proxyHttp(request, response);
  });
}
app.use(express.json({ limit: '32kb' }));

let systemPrompt = '';
if (!isLabService) {
  try {
    systemPrompt = await loadSystemPrompt();
  } catch (error) {
    console.error(`Could not load AI system prompt: ${error.message}`);
    process.exit(1);
  }
}

const writeNdjson = (response, payload) => {
  response.write(`${JSON.stringify(payload)}\n`);
};

function cleanTerminalHistory(value) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

function prepareContext(message, terminalHistory) {
  if (!terminalHistory) return message;
  const transcript = cleanTerminalHistory(terminalHistory).slice(-config.historyLimit);
  return [
    '以下は直近のターミナル記録です。ユーザーが入力したコマンドだけでなく、その直後に表示された標準出力・標準エラーも含まれます。',
    '質問に答えるときは、コマンドと実行結果の両方を読み、実際に表示された値を根拠に説明してください。',
    '',
    '--- ターミナル記録 開始 ---',
    transcript,
    '--- ターミナル記録 終了 ---',
    '',
    `ユーザー質問: ${message}`,
  ].join('\n');
}

function toGeminiContents(conversationHistory, context) {
  const history = conversationHistory.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }));
  return [...history, { role: 'user', parts: [{ text: context }] }];
}

function getRequestProvider(requestBody) {
  const requested = typeof requestBody?.provider === 'string' ? requestBody.provider.trim().toLowerCase() : '';
  if (requested === 'ollama' || requested === 'gemini') return requested;
  return resolveAiProvider(config);
}

function getGeminiOptions(requestBody) {
  return {
    apiKey: typeof requestBody?.geminiApiKey === 'string' && requestBody.geminiApiKey.trim()
      ? requestBody.geminiApiKey.trim()
      : config.geminiApiKey,
    model: typeof requestBody?.geminiModel === 'string' && requestBody.geminiModel.trim()
      ? requestBody.geminiModel.trim()
      : config.geminiModel,
    url: config.geminiUrl,
  };
}

async function sendGeminiChat(response, context, conversationHistory, options) {
  if (!options.apiKey) {
    throw new Error('Gemini API キーが設定されていません。');
  }

  const geminiResponse = await fetch(
    `${options.url}/v1beta/models/${options.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: toGeminiContents(conversationHistory, context),
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.4,
        },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );

  if (!geminiResponse.ok) {
    const detail = (await geminiResponse.text()).slice(0, 500);
    throw new Error(`Gemini returned ${geminiResponse.status}: ${detail}`);
  }

  const body = await geminiResponse.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned an empty response');

  writeNdjson(response, { content: text });
  writeNdjson(response, { done: true, model: options.model, provider: 'gemini' });
  response.end();
}

async function sendOllamaChat(response, context, conversationHistory) {
  const ollamaResponse = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      stream: true,
      think: false,
      keep_alive: '30m',
      options: {
        num_predict: 80,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: context },
      ],
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!ollamaResponse.ok) {
    const detail = (await ollamaResponse.text()).slice(0, 500);
    throw new Error(`Ollama returned ${ollamaResponse.status}: ${detail}`);
  }
  if (!ollamaResponse.body) throw new Error('Ollama returned an empty response stream');

  const reader = ollamaResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasContent = false;

  const forwardLine = (line) => {
    if (!line.trim()) return;
    const payload = JSON.parse(line);
    if (payload.error) throw new Error(payload.error);
    const content = payload.message?.content;
    if (typeof content === 'string' && content) {
      hasContent = true;
      writeNdjson(response, { content });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      forwardLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
    if (done) break;
  }

  forwardLine(buffer);
  if (!hasContent) writeNdjson(response, { error: 'AI の応答が空でした。' });
  writeNdjson(response, { done: true, model: config.ollamaModel, provider: 'ollama' });
  response.end();
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    serviceRole: config.serviceRole,
    model: resolveAiProvider(config) === 'gemini' ? config.geminiModel : config.ollamaModel,
    aiProvider: resolveAiProvider(config),
    target: config.targetUrl,
  });
});

app.get('/api/status', async (_request, response) => {
  if (!isWebService) {
    response.json(await getSystemStatus(config));
    return;
  }

  const [labResult, aiStatus] = await Promise.allSettled([
    labProxy.fetchJson('/api/status'),
    getAiStatus(config),
  ]);
  const labStatus = labResult.status === 'fulfilled'
    ? labResult.value
    : { backend: false, kaliGui: false, target: false };
  if (labResult.status === 'rejected') {
    console.error(`Could not read Lab status: ${labResult.reason.message}`);
  }
  response.json({
    ...labStatus,
    backend: true,
    ...(aiStatus.status === 'fulfilled' ? aiStatus.value : {
      ollama: false,
      model: resolveAiProvider(config) === 'gemini' ? config.geminiModel : config.ollamaModel,
      modelInstalled: false,
      aiProvider: resolveAiProvider(config),
      aiReady: false,
      geminiConfigured: Boolean(config.geminiApiKey),
    }),
    lab: labResult.status === 'fulfilled',
  });
});

app.post('/api/lab/reset', async (request, response) => {
  if (request.headers['x-terminalbox-reset'] !== 'confirmed') {
    response.status(400).json({ error: 'Reset confirmation is required' });
    return;
  }
  try {
    response.json(await resetLab(config));
  } catch (error) {
    console.error(`Lab reset failed: ${error.message}`);
    response.status(500).json({ error: 'Lab reset failed', detail: error.message });
  }
});

app.post('/api/challenges/check', (request, response) => {
  const result = checkChallengeAnswer(request.body?.id, request.body?.answer);
  response.status(result.status).json(result.body);
});

app.post('/api/chat', async (request, response) => {
  if (isLabService) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  const terminalHistory = typeof request.body?.terminalHistory === 'string'
    ? request.body.terminalHistory.slice(-(config.historyLimit * 2))
    : '';
  const conversationHistory = sanitizeConversationHistory(request.body?.conversationHistory);

  if (!message || message.length > 4000) {
    response.status(400).json({ error: '質問は 1 文字以上 4000 文字以内で入力してください。' });
    return;
  }

  const quickReply = getQuickReply(message);
  if (quickReply) {
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.end([
      JSON.stringify({ content: quickReply }),
      JSON.stringify({ done: true, source: 'quick-reply' }),
      '',
    ].join('\n'));
    return;
  }

  response.status(200);
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  const provider = getRequestProvider(request.body);
  const context = prepareContext(message, terminalHistory);

  try {
    if (provider === 'gemini') {
      await sendGeminiChat(response, context, conversationHistory, getGeminiOptions(request.body));
    } else {
      await sendOllamaChat(response, context, conversationHistory);
    }
  } catch (error) {
    console.error(`${provider} request failed:`, error.message);
    const errorPayload = {
      error: provider === 'gemini'
        ? 'Gemini API への問い合わせに失敗しました。API キー、モデル名、ネットワーク設定を確認してください。'
        : 'ローカル AI への問い合わせに失敗しました。Ollama の起動状態とモデルの読み込みを確認してください。',
      detail: error.message,
    };
    if (!response.writableEnded) response.end(`${JSON.stringify(errorPayload)}\n`);
  }
});

app.use((_request, response) => response.status(404).json({ error: 'Not found' }));

const server = http.createServer(app);
const terminalSockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const origin = request.headers.origin;
  const originAllowed = isAllowedWebSocketOrigin(origin, request.headers.host, config.allowedOrigins);
  if (!originAllowed) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  if (isWebService) {
    if (!isLabWebSocketPath(url.pathname)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    void labProxy.proxyWebSocket(request, socket, head);
    return;
  }

  if (url.pathname !== '/ws/terminal') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  terminalSockets.handleUpgrade(request, socket, head, (webSocket) => {
    terminalSockets.emit('connection', webSocket, request);
  });
});

terminalSockets.on('connection', (socket, request) => attachTerminalSocket(socket, request, config));

server.listen(config.port, '0.0.0.0', () => {
  console.log(`TerminalBox ${config.serviceRole} backend listening on port ${config.port}`);
  if (resolveAiProvider(config) !== 'ollama') return;
  fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaModel, prompt: '', stream: false, keep_alive: '30m' }),
    signal: AbortSignal.timeout(300_000),
  }).then((result) => {
    if (!result.ok) throw new Error(`Ollama returned ${result.status}`);
    console.log(`Preloaded Ollama model: ${config.ollamaModel}`);
  }).catch((error) => console.warn(`Could not preload Ollama model: ${error.message}`));
});

import { resolveAiProvider } from './config.js';

const STATUS_TIMEOUT_MS = 2000;
const timeoutResult = { ok: false, timedOut: true };

async function fetchWithTimeout(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    return await Promise.race([
      fetchImpl(url, { signal: controller.signal }),
      new Promise((resolve) => setTimeout(() => resolve(timeoutResult), STATUS_TIMEOUT_MS + 250)),
    ]);
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonWithTimeout(response) {
  try {
    return await Promise.race([
      response.json(),
      new Promise((resolve) => setTimeout(() => resolve(null), STATUS_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

const isReady = (result) => result.status === 'fulfilled' && result.value?.ok === true;

async function getOllamaStatus(config, fetchImpl) {
  const aiProvider = resolveAiProvider(config);
  if (aiProvider !== 'ollama') return { status: 'fulfilled', value: { ok: false } };
  return { status: 'fulfilled', value: await fetchWithTimeout(fetchImpl, `${config.ollamaUrl}/api/tags`) };
}

export async function getAiStatus(config, fetchImpl = fetch) {
  const aiProvider = resolveAiProvider(config);
  const ollamaResult = await getOllamaStatus(config, fetchImpl);
  let modelInstalled = false;
  if (isReady(ollamaResult)) {
    const body = await parseJsonWithTimeout(ollamaResult.value);
    modelInstalled = Array.isArray(body?.models)
      && body.models.some((item) => item.name === config.ollamaModel || item.model === config.ollamaModel);
  }

  const geminiConfigured = Boolean(config.geminiApiKey);
  const aiReady = aiProvider === 'gemini' ? geminiConfigured : isReady(ollamaResult) && modelInstalled;

  return {
    ollama: isReady(ollamaResult),
    model: aiProvider === 'gemini' ? config.geminiModel : config.ollamaModel,
    modelInstalled,
    aiProvider,
    aiReady,
    geminiConfigured,
  };
}

export async function getSystemStatus(config, fetchImpl = fetch) {
  const checksPromise = Promise.allSettled([
    fetchWithTimeout(fetchImpl, `${config.targetUrl}/api/status`),
    fetchWithTimeout(fetchImpl, `${config.kaliGuiUrl}/`),
  ]);

  const [aiStatus, [targetResult, kaliGuiResult]] = await Promise.all([
    getAiStatus(config, fetchImpl),
    Promise.race([
      checksPromise,
      new Promise((resolve) => setTimeout(() => resolve([
        { status: 'fulfilled', value: { ok: false } },
        { status: 'fulfilled', value: { ok: false } },
      ]), STATUS_TIMEOUT_MS + 500)),
    ]),
  ]);

  return {
    backend: true,
    kaliGui: isReady(kaliGuiResult),
    target: isReady(targetResult),
    ...aiStatus,
  };
}

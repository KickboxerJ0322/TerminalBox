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

const isReady = (result) => result.status === 'fulfilled' && result.value?.ok === true;

export async function getAiStatus(config) {
  const geminiConfigured = Boolean(config.geminiApiKey);
  return {
    model: config.geminiModel,
    aiProvider: 'gemini',
    aiReady: geminiConfigured,
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

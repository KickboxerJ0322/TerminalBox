import { readFile } from 'node:fs/promises';

const numberFromEnv = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

const providerFromEnv = () => {
  const value = (process.env.AI_PROVIDER ?? 'ollama').toLowerCase();
  return ['ollama', 'gemini', 'auto'].includes(value) ? value : 'ollama';
};

export const config = {
  port: numberFromEnv('PORT', 3001, 1, 65535),
  aiProvider: providerFromEnv(),
  ollamaUrl: (process.env.OLLAMA_URL ?? 'http://ollama:11434').replace(/\/$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL ?? 'LiquidAI/lfm2.5-1.2b-instruct:q4_k_m',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.7-flash',
  geminiUrl: (process.env.GEMINI_URL ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  targetUrl: process.env.TARGET_URL ?? 'http://target:3000',
  targetUrls: (process.env.TARGET_URLS ?? 'http://target:3000,http://target2:3000,http://target3:3000')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
  kaliGuiUrl: (process.env.KALI_GUI_URL ?? 'http://kali:6080').replace(/\/$/, ''),
  kaliContainer: process.env.KALI_CONTAINER ?? 'terminalbox-kali',
  kaliExecMode: process.env.KALI_EXEC_MODE === 'local' ? 'local' : 'docker',
  historyLimit: numberFromEnv('TERMINAL_HISTORY_LIMIT', 2000, 500, 8000),
  wsAuthToken: process.env.WS_AUTH_TOKEN ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  promptFile: process.env.AI_SYSTEM_PROMPT_FILE ?? '/app/config/ai-system-prompt.txt',
};

export function resolveAiProvider(currentConfig = config) {
  if (currentConfig.aiProvider === 'auto') return currentConfig.geminiApiKey ? 'gemini' : 'ollama';
  return currentConfig.aiProvider;
}

export async function loadSystemPrompt() {
  return readFile(config.promptFile, 'utf8');
}

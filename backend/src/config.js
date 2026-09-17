import { readFile } from 'node:fs/promises';

const numberFromEnv = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

export const config = {
  port: numberFromEnv('PORT', 3001, 1, 65535),
  serviceRole: (process.env.SERVICE_ROLE ?? 'web').toLowerCase(),
  publicDemoMode: (process.env.PUBLIC_DEMO_MODE ?? 'false').toLowerCase() === 'true',
  maxActiveSessions: numberFromEnv('MAX_ACTIVE_SESSIONS', 20, 1, 100),
  labServiceUrl: (process.env.LAB_SERVICE_URL ?? '').replace(/\/$/, ''),
  labServiceAudience: (process.env.LAB_SERVICE_AUDIENCE ?? process.env.LAB_SERVICE_URL ?? '').replace(/\/$/, ''),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.7-flash',
  geminiUrl: (process.env.GEMINI_URL ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  targetUrl: process.env.TARGET_URL ?? 'http://target:3000',
  targetUrls: (process.env.TARGET_URLS ?? 'http://target:3000,http://target2:3000,http://target3:3000,http://target4:3000,http://target5:3000')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
  kaliGuiUrl: (process.env.KALI_GUI_URL ?? 'http://kali:6080').replace(/\/$/, ''),
  historyLimit: numberFromEnv('TERMINAL_HISTORY_LIMIT', 2000, 500, 8000),
  agentMaxSteps: numberFromEnv('MAX_AGENT_STEPS', 15, 1, 15),
  agentCommandTimeoutMs: numberFromEnv('AGENT_COMMAND_TIMEOUT_MS', 10000, 1000, 30000),
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? '',
  wsAuthToken: process.env.WS_AUTH_TOKEN ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  promptFile: process.env.AI_SYSTEM_PROMPT_FILE ?? '/app/config/ai-system-prompt.txt',
  agentPromptFile: process.env.AGENT_SYSTEM_PROMPT_FILE ?? '/app/config/agent-system-prompt.txt',
};

export function resolveAiProvider() {
  return 'gemini';
}

export async function loadSystemPrompt() {
  return readFile(config.promptFile, 'utf8');
}

export async function loadAgentSystemPrompt() {
  return readFile(config.agentPromptFile, 'utf8');
}

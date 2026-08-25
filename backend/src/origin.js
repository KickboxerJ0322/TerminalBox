export function isAllowedWebSocketOrigin(origin, host, allowedOrigins = []) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

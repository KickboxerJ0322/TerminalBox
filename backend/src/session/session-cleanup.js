export function startSessionCleanup(sessionManager, { intervalMs = 60_000, onExpire } = {}) {
  const timer = setInterval(() => {
    sessionManager.cleanupExpired(onExpire).catch((error) => {
      console.error(`Session cleanup failed: ${error.message}`);
    });
  }, intervalMs);
  timer.unref?.();
  return timer;
}

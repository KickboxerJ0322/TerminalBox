export const SESSION_COOKIE_NAME = 'tbx_session';
export const SESSION_TTL_SECONDS = 30 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(value) {
  return UUID_PATTERN.test(value ?? '');
}

export function parseCookies(cookieHeader = '') {
  return Object.fromEntries(cookieHeader
    .split(';')
    .map((item) => {
      const [name, ...parts] = item.trim().split('=');
      return [name, decodeURIComponent(parts.join('='))];
    })
    .filter(([name]) => name));
}

export function readSessionCookie(request) {
  const cookies = parseCookies(request.headers.cookie ?? '');
  return isValidSessionId(cookies[SESSION_COOKIE_NAME]) ? cookies[SESSION_COOKIE_NAME] : null;
}

export function appendSessionCookie(request, response, sessionId) {
  const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  response.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

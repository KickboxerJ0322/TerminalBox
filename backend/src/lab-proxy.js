import { GoogleAuth } from 'google-auth-library';
import httpProxy from 'http-proxy';

const LAB_HTTP_PREFIXES = [
  '/api/lab/reset',
  '/target-site',
  '/target-site-2',
  '/target-site-3',
  '/kali-gui',
];

const LAB_WEBSOCKET_PREFIXES = ['/ws/terminal', '/kali-gui'];

function startsWithAllowedPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isLabHttpPath(pathname) {
  return startsWithAllowedPrefix(pathname, LAB_HTTP_PREFIXES);
}

export function isLabWebSocketPath(pathname) {
  return startsWithAllowedPrefix(pathname, LAB_WEBSOCKET_PREFIXES);
}

function toHeaderObject(headers) {
  if (typeof headers.entries === 'function') return Object.fromEntries(headers.entries());
  return { ...headers };
}

export function createLabProxy(config) {
  if (!config.labServiceUrl || !config.labServiceAudience) {
    throw new Error('LAB_SERVICE_URL and LAB_SERVICE_AUDIENCE are required for the web service');
  }

  const auth = new GoogleAuth();
  const clientPromise = auth.getIdTokenClient(config.labServiceAudience);
  const proxy = httpProxy.createProxyServer({
    target: config.labServiceUrl,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 3_600_000,
    timeout: 3_600_000,
  });

  proxy.on('error', (error, _request, responseOrSocket) => {
    console.error(`Lab proxy failed: ${error.message}`);
    if ('writeHead' in responseOrSocket) {
      if (!responseOrSocket.headersSent) responseOrSocket.writeHead(502, { 'content-type': 'application/json' });
      responseOrSocket.end(JSON.stringify({ error: 'Lab service is unavailable' }));
      return;
    }
    responseOrSocket.destroy();
  });

  async function authorizationHeaders() {
    const client = await clientPromise;
    const headers = await client.getRequestHeaders(config.labServiceUrl);
    return toHeaderObject(headers);
  }

  async function proxyHttp(request, response) {
    try {
      const headers = await authorizationHeaders();
      proxy.web(request, response, { headers });
    } catch (error) {
      console.error(`Could not authorize Lab request: ${error.message}`);
      response.status(502).json({ error: 'Could not authorize Lab request' });
    }
  }

  async function proxyWebSocket(request, socket, head) {
    try {
      const headers = await authorizationHeaders();
      // The public Origin was already validated by the Web service. The Lab
      // validates its internal hop against the rewritten Host header.
      headers.origin = config.labServiceUrl;
      proxy.ws(request, socket, head, { headers });
    } catch (error) {
      console.error(`Could not authorize Lab WebSocket: ${error.message}`);
      socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  }

  async function fetchJson(pathname) {
    const url = new URL(pathname, `${config.labServiceUrl}/`);
    const response = await fetch(url, {
      headers: await authorizationHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Lab returned ${response.status}`);
    return response.json();
  }

  return { fetchJson, proxyHttp, proxyWebSocket };
}

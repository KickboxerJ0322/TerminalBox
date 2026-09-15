import httpProxy from 'http-proxy';

const TARGET_ROUTES = [
  { prefix: '/target-site', index: 0 },
  { prefix: '/target-site-2', index: 1 },
  { prefix: '/target-site-3', index: 2 },
  { prefix: '/target-site-4', index: 3 },
  { prefix: '/target-site-5', index: 4 },
  { prefix: '/tool-target', index: 5 },
];

function routeForPath(pathname) {
  return TARGET_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) ?? null;
}

function rewriteTargetUrl(request, prefix) {
  const originalUrl = request.url;
  request.url = request.url.replace(new RegExp(`^${prefix}(?=/|\\?|$)`), '') || '/';
  return () => {
    request.url = originalUrl;
  };
}

export function createTargetProxy(config) {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 3_600_000,
    timeout: 3_600_000,
  });

  proxy.on('error', (error, _request, responseOrSocket) => {
    console.error(`Target proxy failed: ${error.message}`);
    if ('writeHead' in responseOrSocket) {
      if (!responseOrSocket.headersSent) responseOrSocket.writeHead(502, { 'content-type': 'application/json' });
      responseOrSocket.end(JSON.stringify({ error: 'Target service is unavailable' }));
      return;
    }
    responseOrSocket.destroy();
  });

  function proxyHttp(request, response, session) {
    const route = routeForPath(request.path);
    const target = route ? config.targetUrls[route.index] : null;
    if (!route || !target) {
      response.status(404).json({ error: 'Target route not found' });
      return;
    }

    delete request.headers['x-terminalbox-session'];
    const restoreUrl = rewriteTargetUrl(request, route.prefix);
    proxy.web(request, response, {
      target,
      headers: {
        'x-terminalbox-session': session.sessionId,
        'x-terminalbox-path-prefix': route.prefix,
      },
    });
    response.once('finish', restoreUrl);
    response.once('close', restoreUrl);
  }

  return { proxyHttp };
}

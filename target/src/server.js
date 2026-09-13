import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';

const PROFILE_ID = ['1', '2', '3'].includes(process.env.TARGET_PROFILE) ? process.env.TARGET_PROFILE : '1';
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
const HOST = process.env.HOST ?? '0.0.0.0';

const profiles = {
  '1': {
    service: 'terminalbox-target-1',
    brand: 'TERMINALBOX // セキュリティ研修サイト',
    adminKey: 'training-admin-2026',
    secretPath: '/backup/config.json',
    robots: 'User-agent: *\nDisallow: /backup/\n',
    defaultState: { headline: 'TerminalBox 演習サイト', theme: 'default', notice: '' },
  },
  '2': {
    service: 'terminalbox-target-2',
    brand: '青葉マルシェ // オンラインストア',
    robots: 'User-agent: *\nDisallow: /internal/\n',
    defaultState: { authenticated: false, solved: false },
  },
  '3': {
    service: 'terminalbox-target-3',
    brand: 'みなと市立図書館 // 公式サイト',
    adminKey: 'library-admin-2026',
    secretPath: '/debug/app-config.json',
    robots: 'User-agent: *\nDisallow: /debug/\n',
    defaultState: { headline: 'みなと市立図書館', theme: 'default', notice: '', event: '夏の読書週間を開催中です' },
  },
};

const target2InitialProducts = Object.freeze({
  2001: Object.freeze({ id: 2001, owner: 'student-store', ownerName: 'Student Store', name: 'Student Starter Box', price: 1800, stock: 8 }),
  2002: Object.freeze({ id: 2002, owner: 'partner-store', ownerName: 'Partner Store', name: 'Partner Premium Set', price: 5400, stock: 3 }),
});

const target2Orders = Object.freeze([
  { id: 7001, owner: 'student-store', total: 3600, item: 'Student Starter Box x2' },
  { id: 7002, owner: 'partner-store', total: 5400, item: 'Partner Premium Set x1' },
]);

const profile = profiles[PROFILE_ID];
const SESSION_HEADER = 'x-terminalbox-session';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const siteStates = new Map();

const getSessionId = (request) => {
  const value = request.headers[SESSION_HEADER];
  return UUID_PATTERN.test(value ?? '') ? value : 'anonymous';
};

const flagForSession = (prefix, sessionId) => {
  const salt = randomBytes(18).toString('hex');
  const digest = createHash('sha256').update(`${prefix}:${sessionId}:${salt}`).digest('hex').slice(0, 12);
  return { value: `TBX{${prefix}_${digest}}`, salt };
};

const makeTarget2Products = () => Object.fromEntries(
  Object.entries(target2InitialProducts).map(([id, product]) => [id, { ...product }]),
);

const makeInitialState = (sessionId) => {
  const state = { ...profile.defaultState };
  if (PROFILE_ID === '1') state.flag = flagForSession('target1', sessionId);
  if (PROFILE_ID === '2') {
    state.flag = flagForSession('target2', sessionId);
    state.products = makeTarget2Products();
    state.lastAction = '';
  }
  return state;
};

const getSiteState = (sessionId) => {
  if (!siteStates.has(sessionId)) siteStates.set(sessionId, makeInitialState(sessionId));
  return siteStates.get(sessionId);
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
};

const readBody = async (request, limit = 8192) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const readJson = async (request) => {
  try { return JSON.parse(await readBody(request) || '{}'); }
  catch (error) {
    if (error.message === 'payload_too_large') throw error;
    throw new Error('invalid_json');
  }
};

const readForm = async (request) => Object.fromEntries(new URLSearchParams(await readBody(request)));

const publicSiteState = (siteState) => {
  const { flag, ...rest } = siteState;
  if (rest.products) {
    const visibleProducts = rest.authenticated
      ? Object.fromEntries(Object.entries(rest.products).filter(([, product]) => product.owner === 'student-store').map(([id, product]) => [id, { ...product }]))
      : {};
    return {
      ...rest,
      products: visibleProducts,
    };
  }
  return rest;
};

const isModified = (siteState) => {
  if (PROFILE_ID === '1' || PROFILE_ID === '3') {
    const { flag, ...stateWithoutFlag } = siteState;
    return JSON.stringify(stateWithoutFlag) !== JSON.stringify(profile.defaultState);
  }
  return siteState.solved === true;
};

const target1Solved = (siteState) => PROFILE_ID === '1' && isModified(siteState);
const target2Solved = (siteState) => PROFILE_ID === '2' && siteState.solved === true;
const canRevealFlag = (siteState) => target1Solved(siteState) || target2Solved(siteState);

const themeColors = (siteState) => {
  const compromised = siteState.theme === 'compromised';
  const maintenance = siteState.theme === 'maintenance';
  return {
    compromised, maintenance,
    page: compromised ? '#1d0508' : maintenance ? '#fff8df' : '#f3f7f5',
    color: compromised ? '#fff1f1' : maintenance ? '#302600' : '#16231c',
    header: compromised ? '#8c1020' : maintenance ? '#9a6b00' : PROFILE_ID === '2' ? '#175b45' : PROFILE_ID === '3' ? '#234f78' : '#123c2b',
    card: compromised ? '#3b0a10' : maintenance ? '#fff4c2' : '#ffffff',
    border: compromised ? '#e34b5d' : maintenance ? '#c99a21' : '#cbd9d1',
  };
};

const sharedStyles = (colors) => `
*{box-sizing:border-box}body{margin:0;background:${colors.page};color:${colors.color};font-family:system-ui,"Yu Gothic",sans-serif}
header{padding:14px 22px;background:${colors.header};color:white;font-size:13px;letter-spacing:.08em}
main{min-height:330px;padding:36px 28px;text-align:center}h1{margin:0 0 16px;font-size:clamp(28px,5vw,46px)}
.lead{max-width:720px;margin:0 auto 22px;line-height:1.8;color:${colors.compromised ? '#ffd2d7' : '#52645b'}}
.card{max-width:760px;margin:18px auto;padding:20px;border:1px solid ${colors.border};border-radius:8px;background:${colors.card};text-align:left}
.card.center{text-align:center}.notice{max-width:760px;margin:0 auto 18px;padding:12px 18px;background:#b9102a;color:white;font-weight:800;text-align:center}
.meta{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:16px}.meta strong{display:block;font-size:24px}.meta span{font-size:12px;color:#64766d}
nav a,.link{margin:0 8px;color:${colors.compromised ? '#ff9dab' : '#147348'}}.alert{font-weight:700;color:#ffb1bb}
label{display:grid;gap:6px;margin:10px 0;color:#52645b;font-size:13px}input{width:100%;padding:10px;border:1px solid ${colors.border};border-radius:5px}
button{padding:10px 14px;border:0;border-radius:5px;background:#175b45;color:white;font-weight:700;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
code{padding:2px 5px;border-radius:4px;background:#eef6f1;color:#184832}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid ${colors.border};text-align:left}
`;

const renderTraining = (siteState) => {
  const colors = themeColors(siteState);
  const description = colors.compromised
    ? '<span class="alert">セキュリティ警告: 公開された管理APIを通じてサイトが改ざんされました。</span>'
    : colors.maintenance ? '現在、システムメンテナンスを実施しています。' : 'このサイトはTerminalBoxの隔離されたセキュリティ演習用ターゲットです。';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteState.headline)}</title><style>${sharedStyles(colors)}</style></head>
<body><header>${profile.brand}</header><main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">${description}</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card center"><strong>研修サイトへようこそ</strong><p>安全なサービス運用には、日々のセキュリティ対策が欠かせません。</p><nav><a href="about">サイト概要</a><a href="login">従業員ログイン</a><a href="api/status">API状態</a></nav></div></main></body></html>`;
};

const productRow = (product) => `<tr><th>ID</th><td><code>${product.id}</code></td></tr><tr><th>店舗</th><td>${escapeHtml(product.ownerName)}</td></tr><tr><th>商品</th><td>${escapeHtml(product.name)}</td></tr><tr><th>価格</th><td>¥${Number(product.price).toLocaleString('ja-JP')}</td></tr><tr><th>在庫</th><td>${escapeHtml(product.stock)}</td></tr>`;

const requireStoreLogin = (siteState, response) => {
  if (siteState.authenticated) return true;
  sendJson(response, 401, { error: 'login_required' });
  return false;
};

const renderStoreLogin = (siteState, message = '') => {
  const colors = themeColors(siteState);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青葉マルシェ ログイン</title><style>${sharedStyles(colors)}</style></head>
<body><header>${profile.brand}</header><main><h1>青葉マルシェ</h1><p class="lead">秘密情報は公開領域へ置いていない、認証付きの研修用ECサイトです。</p>
<div class="card"><h2>ログイン</h2>${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}<form method="post" action="login">
<label>username<input name="username" autocomplete="username" value="student"></label>
<label>password<input name="password" type="password" autocomplete="current-password" value="market123"></label>
<button type="submit">ログイン</button></form><p>研修用: <code>student</code> / <code>market123</code></p></div></main></body></html>`;
};

const renderStoreDashboard = (siteState) => {
  const colors = themeColors(siteState);
  const product = siteState.products[2001];
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青葉マルシェ Dashboard</title><style>${sharedStyles(colors)}</style></head>
<body><header>${profile.brand}</header><main><h1>Student Store Dashboard</h1><p class="lead">ログイン認証は成功しています。次は、サーバーが対象リソースの所有権を確認しているかを調べます。</p>
${siteState.lastAction ? `<div class="notice">${escapeHtml(siteState.lastAction)}</div>` : ''}
<div class="grid"><div class="card"><h2>自分の商品</h2><table>${productRow(product)}</table><p><a class="link" href="store/products/2001">商品 2001 を開く</a></p></div>
<div class="card"><h2>注文</h2><p>注文ID <code>7001</code> はStudent Storeの注文です。</p><p><a class="link" href="api/store/orders/7001">注文APIを見る</a></p></div>
<div class="card"><h2>プロフィール</h2><p>username: <code>student</code></p><p>store: <code>student-store</code></p></div></div>
${siteState.solved ? '<div class="card center"><strong>攻略条件達成</strong><p><a class="link" href="api/flag">Flagを取得する</a></p></div>' : ''}
</main></body></html>`;
};

const renderStoreProduct = (siteState, productId) => {
  const product = siteState.products[productId];
  if (!product) return null;
  const colors = themeColors(siteState);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>商品 ${product.id}</title><style>${sharedStyles(colors)}</style></head>
<body><header>${profile.brand}</header><main><h1>商品 ${product.id}</h1><p class="lead">URLのIDを変更すると、別店舗の商品にもアクセスできるか確認できます。</p>
${product.owner !== 'student-store' ? '<div class="notice">この商品は本来Student Storeの所有物ではありません。</div>' : ''}
<div class="card"><table>${productRow(product)}</table><form method="post" action="${product.id}/update">
<label>name<input name="name" value="${escapeHtml(product.name)}"></label>
<label>price<input name="price" type="number" value="${escapeHtml(product.price)}"></label>
<label>stock<input name="stock" type="number" value="${escapeHtml(product.stock)}"></label>
<button type="submit">商品を更新</button></form></div><p><a class="link" href="../../">Dashboardへ戻る</a></p></main></body></html>`;
};

const renderStore = (siteState, path = '/') => {
  if (!siteState.authenticated) return renderStoreLogin(siteState);
  const productMatch = path.match(/^\/store\/products\/(\d+)$/);
  if (productMatch) return renderStoreProduct(siteState, Number(productMatch[1]));
  return renderStoreDashboard(siteState);
};

const renderLibrary = (siteState) => {
  const colors = themeColors(siteState);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteState.headline)}</title><style>${sharedStyles(colors)}.event{font-size:19px;font-weight:700;color:#235f8c}</style></head>
<body><header>${profile.brand}</header><main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">本と人が出会い、地域の学びが広がる場所です。</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card center"><small>図書館からのお知らせ</small><p class="event">${escapeHtml(siteState.event)}</p><nav><a href="guide">利用案内</a><a href="calendar">開館カレンダー</a><a href="api/status">システム状態</a></nav></div></main></body></html>`;
};

const renderHome = (siteState, path) => PROFILE_ID === '2' ? renderStore(siteState, path) : PROFILE_ID === '3' ? renderLibrary(siteState) : renderTraining(siteState);

const requireAdmin = (request, response) => {
  if (request.headers['x-admin-key'] === profile.adminKey) return true;
  sendJson(response, 403, { error: 'forbidden' });
  return false;
};

const handleAdminRequest = async (request, response, path, siteState) => {
  if (PROFILE_ID === '2') return false;
  if (!requireAdmin(request, response)) return true;
  try {
    const body = await readJson(request);
    if (PROFILE_ID === '1' && path === '/api/admin/banner') {
      if (typeof body.headline !== 'string' || body.headline.length < 1 || body.headline.length > 60 || !['default', 'compromised', 'maintenance'].includes(body.theme)) throw new Error('invalid_site_state');
      Object.assign(siteState, { headline: body.headline, theme: body.theme });
    } else if (PROFILE_ID === '1' && path === '/api/admin/notice') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_notice');
      Object.assign(siteState, { notice: body.notice });
    } else if (PROFILE_ID === '3' && path === '/api/admin/hero') {
      if (typeof body.headline !== 'string' || body.headline.length < 1 || body.headline.length > 60 || !['default', 'compromised', 'maintenance'].includes(body.theme)) throw new Error('invalid_site_state');
      Object.assign(siteState, { headline: body.headline, theme: body.theme });
    } else if (PROFILE_ID === '3' && path === '/api/admin/alert') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_alert');
      Object.assign(siteState, { notice: body.notice });
    } else { return false; }
    sendJson(response, 200, { status: 'updated', site: publicSiteState(siteState) });
  } catch (error) {
    sendJson(response, error.message === 'payload_too_large' ? 413 : 400, { error: error.message });
  }
  return true;
};

const secretPayload = () => {
  if (PROFILE_ID === '1') return { environment: 'production', adminApi: '/api/admin/banner', noticeApi: '/api/admin/notice', adminKey: profile.adminKey, warning: 'TRAINING ONLY' };
  if (PROFILE_ID === '3') return { environment: 'production', heroApi: '/api/admin/hero', alertApi: '/api/admin/alert', adminKey: profile.adminKey, warning: 'TRAINING ONLY' };
  return null;
};

const loginTarget2 = async (request, response, siteState) => {
  const body = request.headers['content-type']?.includes('application/json') ? await readJson(request) : await readForm(request);
  if (body.username === 'student' && body.password === 'market123') {
    siteState.authenticated = true;
    siteState.lastAction = '';
    response.writeHead(303, { location: '/', 'cache-control': 'no-store' });
    response.end();
    return;
  }
  response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(renderStoreLogin(siteState, 'ログインに失敗しました。'));
};

const updateTarget2Product = (siteState, productId, body) => {
  const product = siteState.products[productId];
  if (!product) return null;
  if (typeof body.name === 'string' && body.name.trim().length >= 1 && body.name.length <= 60) product.name = body.name.trim();
  const price = Number.parseInt(body.price, 10);
  if (Number.isInteger(price) && price >= 0 && price <= 999999) product.price = price;
  const stock = Number.parseInt(body.stock, 10);
  if (Number.isInteger(stock) && stock >= 0 && stock <= 9999) product.stock = stock;
  if (product.owner !== 'student-store') {
    siteState.solved = true;
    siteState.lastAction = `本来権限のない商品 ${product.id} を更新しました。`;
  } else {
    siteState.lastAction = `商品 ${product.id} を更新しました。`;
  }
  return product;
};

const handleTarget2Api = async (request, response, path, siteState) => {
  if (request.method === 'POST' && path === '/login') {
    await loginTarget2(request, response, siteState);
    return true;
  }
  if (request.method === 'GET' && path === '/api/store/me') {
    if (!requireStoreLogin(siteState, response)) return true;
    sendJson(response, 200, { username: 'student', store: 'student-store', productIds: [2001], orderIds: [7001] });
    return true;
  }
  const productApiMatch = path.match(/^\/api\/store\/products\/(\d+)$/);
  if (productApiMatch) {
    if (!requireStoreLogin(siteState, response)) return true;
    const productId = Number(productApiMatch[1]);
    if (request.method === 'GET') {
      const product = siteState.products[productId];
      sendJson(response, product ? 200 : 404, product ? { product } : { error: 'not_found' });
      return true;
    }
    if (request.method === 'POST') {
      try {
        const product = updateTarget2Product(siteState, productId, await readJson(request));
        sendJson(response, product ? 200 : 404, product ? { status: 'updated', product, brokenAccessControl: product.owner !== 'student-store', solved: siteState.solved } : { error: 'not_found' });
      } catch (error) {
        sendJson(response, error.message === 'payload_too_large' ? 413 : 400, { error: error.message });
      }
      return true;
    }
  }
  const orderMatch = path.match(/^\/api\/store\/orders\/(\d+)$/);
  if (request.method === 'GET' && orderMatch) {
    if (!requireStoreLogin(siteState, response)) return true;
    const order = target2Orders.find((item) => item.id === Number(orderMatch[1]));
    sendJson(response, order ? 200 : 404, order ? { order } : { error: 'not_found' });
    return true;
  }
  return false;
};

const handleFlagRequest = async (request, response, siteState) => {
  if (request.method === 'GET') {
    if (!canRevealFlag(siteState)) {
      sendJson(response, 403, { error: 'flag_locked', detail: '攻略条件を満たすとFlagを取得できます。' });
      return true;
    }
    sendJson(response, 200, { flag: siteState.flag.value });
    return true;
  }
  if (request.method === 'POST') {
    try {
      const body = await readJson(request);
      const correct = canRevealFlag(siteState) && typeof body.answer === 'string' && body.answer.trim() === siteState.flag.value;
      sendJson(response, 200, {
        correct,
        message: correct ? '正解です。問題をクリアしました。' : '一致しません。入力をもう一度確認してください。',
      });
    } catch (error) {
      sendJson(response, error.message === 'payload_too_large' ? 413 : 400, { error: error.message });
    }
    return true;
  }
  return false;
};

const server = http.createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://target').pathname;
  const sessionId = getSessionId(request);
  const siteState = getSiteState(sessionId);

  if (request.method === 'GET' && path === '/api/status') {
    sendJson(response, 200, { status: 'ok', service: profile.service, profile: PROFILE_ID, modified: isModified(siteState), site: publicSiteState(siteState), time: new Date().toISOString() });
    return;
  }
  if (request.method === 'GET' && path === '/robots.txt') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    response.end(profile.robots);
    return;
  }
  if (profile.secretPath && request.method === 'GET' && path === profile.secretPath) {
    sendJson(response, 200, secretPayload());
    return;
  }
  if ((path === '/api/flag' || path === '/api/flag/check') && await handleFlagRequest(request, response, siteState)) return;
  if (request.method === 'POST' && path === '/api/lab/reset') {
    siteStates.set(sessionId, makeInitialState(sessionId));
    sendJson(response, 200, { status: 'reset', site: publicSiteState(siteStates.get(sessionId)) });
    return;
  }
  if (PROFILE_ID === '2' && await handleTarget2Api(request, response, path, siteState)) return;
  if (request.method === 'POST' && path.startsWith('/api/admin/')) {
    if (await handleAdminRequest(request, response, path, siteState)) return;
  }
  const storeProductUpdateMatch = PROFILE_ID === '2' ? path.match(/^\/store\/products\/(\d+)\/update$/) : null;
  if (PROFILE_ID === '2' && request.method === 'POST' && storeProductUpdateMatch) {
    if (!siteState.authenticated) {
      response.writeHead(303, { location: '/', 'cache-control': 'no-store' });
      response.end();
      return;
    }
    const product = updateTarget2Product(siteState, Number(storeProductUpdateMatch[1]), await readForm(request));
    response.writeHead(303, { location: product ? `/store/products/${product.id}` : '/', 'cache-control': 'no-store' });
    response.end();
    return;
  }
  if (request.method === 'GET' && (path === '/' || (PROFILE_ID === '2' && path.startsWith('/store/products/')))) {
    const html = renderHome(siteState, path);
    if (!html) {
      sendJson(response, 404, { error: 'not_found', path });
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-terminalbox-target': 'training-only' });
    response.end(html);
    return;
  }
  if (request.method === 'GET' && ['/about', '/login', '/guide', '/calendar'].includes(path)) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>ご案内</title></head><body><h1>ご案内</h1><p>このページはTerminalBoxの演習用コンテンツです。</p><a href="./">トップへ戻る</a></body></html>');
    return;
  }
  sendJson(response, 404, { error: 'not_found', path });
});

server.listen(PORT, HOST, () => console.log(`${profile.service} listening on ${HOST}:${PORT}`));

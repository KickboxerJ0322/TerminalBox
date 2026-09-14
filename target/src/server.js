import { createHash, createHmac, randomBytes } from 'node:crypto';
import http from 'node:http';

const PROFILE_ID = ['1', '2', '3', '4', '5'].includes(process.env.TARGET_PROFILE) ? process.env.TARGET_PROFILE : '1';
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
const HOST = process.env.HOST ?? '0.0.0.0';
const SESSION_HEADER = 'x-terminalbox-session';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const siteStates = new Map();

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
    brand: 'TBX Books // 商品検索',
    robots: 'User-agent: *\nDisallow: /internal/\n',
    defaultState: { solved: false, lastQuery: '', lastFinding: '' },
  },
  '4': {
    service: 'terminalbox-target-4',
    brand: 'TBX Portal // 認証ラボ',
    robots: 'User-agent: *\nDisallow: /internal/\n',
    defaultState: { authenticated: false, solved: false, lastAction: '' },
  },
  '5': {
    service: 'terminalbox-target-5',
    brand: 'TBX Secure Site // Defense in Depth',
    robots: 'User-agent: *\nDisallow:\n',
    defaultState: { authenticated: false, verified: false, checks: { secrets: false, authorization: false, input: false, session: false } },
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

const target3Products = Object.freeze([
  { id: 301, label: 'apple', value: 'Apple Keyboard' },
  { id: 302, label: 'book', value: 'Secure Coding Textbook' },
  { id: 303, label: 'mouse', value: 'Wireless Mouse' },
]);

const secureProducts = Object.freeze({
  5001: Object.freeze({ id: 5001, owner: 'student', name: 'Student Secure Notebook', price: 2400 }),
  5002: Object.freeze({ id: 5002, owner: 'partner', name: 'Partner Private Contract', price: 12000 }),
});

const profile = profiles[PROFILE_ID];

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

const makeSecureProducts = () => Object.fromEntries(
  Object.entries(secureProducts).map(([id, product]) => [id, { ...product }]),
);

const makeInitialState = (sessionId) => {
  const state = { ...profile.defaultState };
  if (state.checks) state.checks = { ...state.checks };
  if (PROFILE_ID === '1') state.flag = flagForSession('target1', sessionId);
  if (PROFILE_ID === '2') {
    state.flag = flagForSession('target2', sessionId);
    state.products = makeTarget2Products();
    state.lastAction = '';
  }
  if (PROFILE_ID === '3') state.flag = flagForSession('target3', sessionId);
  if (PROFILE_ID === '4') {
    state.flag = flagForSession('target4', sessionId);
    state.nonce = randomBytes(10).toString('hex');
  }
  if (PROFILE_ID === '5') {
    state.flag = flagForSession('secure_target_verified', sessionId);
    state.products = makeSecureProducts();
    state.authSecret = randomBytes(24).toString('hex');
    state.loginNonce = randomBytes(10).toString('hex');
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
const readInput = async (request) => request.headers['content-type']?.includes('application/json') ? readJson(request) : readForm(request);

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlJson = (value) => base64UrlEncode(JSON.stringify(value));
const decodeBase64UrlJson = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const issueWeakToken = (siteState) => base64UrlJson({
  sub: 'student',
  role: 'user',
  nonce: siteState.nonce,
  issuedAt: Date.now(),
});

const issueSecureToken = (siteState, role = 'user') => {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    sub: 'student',
    role,
    nonce: siteState.loginNonce,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  const signature = createHmac('sha256', siteState.authSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const verifySecureToken = (siteState, token) => {
  const [header, payload, signature] = String(token ?? '').split('.');
  if (!header || !payload || !signature) return null;
  const expected = createHmac('sha256', siteState.authSecret).update(`${header}.${payload}`).digest('base64url');
  if (signature !== expected) return null;
  try {
    const body = decodeBase64UrlJson(payload);
    if (body.nonce !== siteState.loginNonce || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
};

const publicSiteState = (siteState) => {
  const { flag, nonce, authSecret, loginNonce, ...rest } = siteState;
  if (rest.products && PROFILE_ID === '2') {
    return {
      ...rest,
      products: rest.authenticated
        ? Object.fromEntries(Object.entries(rest.products).filter(([, product]) => product.owner === 'student-store').map(([id, product]) => [id, { ...product }]))
        : {},
    };
  }
  if (rest.products && PROFILE_ID === '5') {
    return { ...rest, products: rest.authenticated ? { 5001: rest.products[5001] } : {} };
  }
  return rest;
};

const isModified = (siteState) => {
  if (PROFILE_ID === '1') {
    const { flag, ...stateWithoutFlag } = siteState;
    return JSON.stringify(stateWithoutFlag) !== JSON.stringify(profile.defaultState);
  }
  if (PROFILE_ID === '2') return siteState.solved === true;
  if (PROFILE_ID === '3') return siteState.solved === true;
  if (PROFILE_ID === '4') return siteState.solved === true;
  if (PROFILE_ID === '5') return siteState.verified === true;
  return false;
};

const canRevealFlag = (siteState) => isModified(siteState);

const themeColors = (siteState) => {
  const compromised = siteState.theme === 'compromised';
  const maintenance = siteState.theme === 'maintenance';
  return {
    compromised,
    maintenance,
    page: compromised ? '#1d0508' : maintenance ? '#fff8df' : '#f3f7f5',
    color: compromised ? '#fff1f1' : maintenance ? '#302600' : '#16231c',
    header: compromised ? '#8c1020' : maintenance ? '#9a6b00' : PROFILE_ID === '3' ? '#1f5f70' : PROFILE_ID === '4' ? '#4d416d' : PROFILE_ID === '5' ? '#17415f' : PROFILE_ID === '2' ? '#175b45' : '#123c2b',
    card: compromised ? '#3b0a10' : maintenance ? '#fff4c2' : '#ffffff',
    border: compromised ? '#e34b5d' : maintenance ? '#c99a21' : '#cbd9d1',
  };
};

const sharedStyles = (colors) => `
*{box-sizing:border-box}body{margin:0;background:${colors.page};color:${colors.color};font-family:system-ui,"Yu Gothic",sans-serif}
header{padding:14px 22px;background:${colors.header};color:white;font-size:13px;letter-spacing:.08em}
main{min-height:330px;padding:36px 28px;text-align:center}h1{margin:0 0 16px;font-size:clamp(28px,5vw,46px)}
.lead{max-width:760px;margin:0 auto 22px;line-height:1.8;color:${colors.compromised ? '#ffd2d7' : '#52645b'}}
.card{max-width:780px;margin:18px auto;padding:20px;border:1px solid ${colors.border};border-radius:8px;background:${colors.card};text-align:left}
.card.center{text-align:center}.notice{max-width:780px;margin:0 auto 18px;padding:12px 18px;background:#b9102a;color:white;font-weight:800;text-align:center}
.ok{max-width:780px;margin:0 auto 18px;padding:12px 18px;background:#0f7a4e;color:white;font-weight:800;text-align:center}
.meta{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:16px}.meta strong{display:block;font-size:24px}.meta span{font-size:12px;color:#64766d}
nav a,.link{margin:0 8px;color:${colors.compromised ? '#ff9dab' : '#147348'}}.alert{font-weight:700;color:#ffb1bb}
label{display:grid;gap:6px;margin:10px 0;color:#52645b;font-size:13px}input{width:100%;padding:10px;border:1px solid ${colors.border};border-radius:5px}
button{padding:10px 14px;border:0;border-radius:5px;background:${colors.header};color:white;font-weight:700;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
code{padding:2px 5px;border-radius:4px;background:#eef6f1;color:#184832}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid ${colors.border};text-align:left}
pre{white-space:pre-wrap;overflow:auto;padding:12px;background:#0d1713;color:#e9fff3;border-radius:6px}.checks li{margin:8px 0}
`;

const renderPage = (siteState, title, body) => {
  const colors = themeColors(siteState);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${sharedStyles(colors)}</style></head><body><header>${profile.brand}</header>${body}</body></html>`;
};

const renderTraining = (siteState) => {
  const description = siteState.theme === 'compromised'
    ? '<span class="alert">セキュリティ警告: 公開された管理APIを通じてサイトが改ざんされました。</span>'
    : siteState.theme === 'maintenance' ? '現在、システムメンテナンスを実施しています。' : 'このサイトはTerminalBoxの隔離されたセキュリティ演習用ターゲットです。';
  return renderPage(siteState, siteState.headline, `<main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">${description}</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card center"><strong>研修サイトへようこそ</strong><p>安全なサービス運用には、日々のセキュリティ対策が欠かせません。</p><nav><a href="about">サイト概要</a><a href="login">従業員ログイン</a><a href="api/status">API状態</a></nav></div></main>`);
};

const productRow = (product) => `<tr><th>ID</th><td><code>${product.id}</code></td></tr><tr><th>店舗</th><td>${escapeHtml(product.ownerName ?? product.owner)}</td></tr><tr><th>商品</th><td>${escapeHtml(product.name)}</td></tr><tr><th>価格</th><td>¥${Number(product.price).toLocaleString('ja-JP')}</td></tr>${'stock' in product ? `<tr><th>在庫</th><td>${escapeHtml(product.stock)}</td></tr>` : ''}`;

const requireStoreLogin = (siteState, response) => {
  if (siteState.authenticated) return true;
  sendJson(response, 401, { error: 'login_required' });
  return false;
};

const renderStoreLogin = (siteState, message = '') => renderPage(siteState, '青葉マルシェ ログイン', `<main><h1>青葉マルシェ</h1><p class="lead">秘密情報は公開領域へ置いていない、認証付きの研修用ECサイトです。</p>
<div class="card"><h2>ログイン</h2>${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}<form method="post" action="login">
<label>username<input name="username" autocomplete="username" value="student"></label>
<label>password<input name="password" type="password" autocomplete="current-password" value="market123"></label>
<button type="submit">ログイン</button></form><p>研修用: <code>student</code> / <code>market123</code></p></div></main>`);

const renderStoreDashboard = (siteState) => {
  const product = siteState.products[2001];
  return renderPage(siteState, '青葉マルシェ Dashboard', `<main><h1>Student Store Dashboard</h1><p class="lead">ログイン認証は成功しています。次は、サーバーが対象リソースの所有権を確認しているかを調べます。</p>
${siteState.lastAction ? `<div class="notice">${escapeHtml(siteState.lastAction)}</div>` : ''}
<div class="grid"><div class="card"><h2>自分の商品</h2><table>${productRow(product)}</table><p><a class="link" href="store/products/2001">商品 2001 を開く</a></p></div>
<div class="card"><h2>注文</h2><p>注文ID <code>7001</code> はStudent Storeの注文です。</p><p><a class="link" href="api/store/orders/7001">注文APIを見る</a></p></div>
<div class="card"><h2>プロフィール</h2><p>username: <code>student</code></p><p>store: <code>student-store</code></p></div></div>
${siteState.solved ? '<div class="card center"><strong>攻略条件達成</strong><p><a class="link" href="api/flag">Flagを取得する</a></p></div>' : ''}
</main>`);
};

const renderStoreProduct = (siteState, productId) => {
  const product = siteState.products[productId];
  if (!product) return null;
  return renderPage(siteState, `商品 ${product.id}`, `<main><h1>商品 ${product.id}</h1><p class="lead">URLのIDを変更すると、別店舗の商品にもアクセスできるか確認できます。</p>
${product.owner !== 'student-store' ? '<div class="notice">この商品は本来Student Storeの所有物ではありません。</div>' : ''}
<div class="card"><table>${productRow(product)}</table><form method="post" action="${product.id}/update">
<label>name<input name="name" value="${escapeHtml(product.name)}"></label>
<label>price<input name="price" type="number" value="${escapeHtml(product.price)}"></label>
<label>stock<input name="stock" type="number" value="${escapeHtml(product.stock)}"></label>
<button type="submit">商品を更新</button></form></div><p><a class="link" href="../../">Dashboardへ戻る</a></p></main>`);
};

const renderStore = (siteState, path = '/') => {
  if (!siteState.authenticated) return renderStoreLogin(siteState);
  const productMatch = path.match(/^\/store\/products\/(\d+)$/);
  if (productMatch) return renderStoreProduct(siteState, Number(productMatch[1]));
  return renderStoreDashboard(siteState);
};

const renderInputLab = (siteState) => renderPage(siteState, 'TBX Books Search', `<main><h1>TBX Books Search</h1><p class="lead">外部入力を信用せず、安全な方法で処理することを学ぶ検索サービスです。</p>
${siteState.lastFinding ? `<div class="notice">${escapeHtml(siteState.lastFinding)}</div>` : ''}
<div class="card"><form method="get" action="search"><label>商品検索<input name="q" value="${escapeHtml(siteState.lastQuery || 'apple')}"></label><button>検索</button></form><p>通常検索例: <code>apple</code> / <code>book</code></p></div>
<div class="card"><h2>API</h2><p><a class="link" href="api/search?q=apple">/api/search?q=apple</a></p>${siteState.solved ? '<p><a class="link" href="api/flag">Flagを取得する</a></p>' : ''}</div></main>`);

const renderAuthLab = (siteState) => renderPage(siteState, 'TBX Portal Login', `<main><h1>TBX Portal</h1><p class="lead">ログインできることだけでなく、その後のトークン検証が重要であることを学ぶ認証ラボです。</p>
${siteState.lastAction ? `<div class="notice">${escapeHtml(siteState.lastAction)}</div>` : ''}
<div class="card"><h2>ログイン</h2><form method="post" action="login"><label>username<input name="username" value="student"></label><label>password<input name="password" type="password" value="portal123"></label><button>ログイン</button></form><p>研修用: <code>student</code> / <code>portal123</code></p></div>
<div class="card"><h2>API</h2><p><code>POST /api/login</code> で研修用トークンを取得し、Base64URLのJSON内の <code>role</code> を観察します。</p>${siteState.solved ? '<p><a class="link" href="api/flag">Flagを取得する</a></p>' : ''}</div></main>`);

const renderSecureSite = (siteState) => {
  const checks = siteState.checks;
  return renderPage(siteState, 'TBX Secure Site', `<main><h1>TBX Secure Site</h1><p class="lead">Target 1〜4で試した代表的な攻撃が防御されることを確認する最終演習です。</p>
${siteState.verified ? '<div class="ok">DEFENSE VERIFIED</div>' : ''}
<div class="card"><h2>防御チェック</h2><ul class="checks">
<li>${checks.secrets ? '✓' : '□'} 秘密情報は公開領域から取得できない</li>
<li>${checks.authorization ? '✓' : '□'} 他ユーザーIDへ変更しても403になる</li>
<li>${checks.input ? '✓' : '□'} SQL Injection相当の入力は通常文字列として処理される</li>
<li>${checks.session ? '✓' : '□'} トークン改変は認証エラーになる</li>
</ul>${siteState.verified ? '<p><a class="link" href="api/flag">防御確認Flagを取得する</a></p>' : ''}</div>
<div class="card"><h2>通常ログイン</h2><form method="post" action="login"><label>username<input name="username" value="student"></label><label>password<input name="password" type="password" value="secure123"></label><button>ログイン</button></form><p>研修用: <code>student</code> / <code>secure123</code></p></div></main>`);
};

const renderHome = (siteState, path) => {
  if (PROFILE_ID === '2') return renderStore(siteState, path);
  if (PROFILE_ID === '3') return renderInputLab(siteState);
  if (PROFILE_ID === '4') return renderAuthLab(siteState);
  if (PROFILE_ID === '5') return renderSecureSite(siteState);
  return renderTraining(siteState);
};

const requireAdmin = (request, response) => {
  if (request.headers['x-admin-key'] === profile.adminKey) return true;
  sendJson(response, 403, { error: 'forbidden' });
  return false;
};

const handleAdminRequest = async (request, response, path, siteState) => {
  if (PROFILE_ID !== '1') return false;
  if (!requireAdmin(request, response)) return true;
  try {
    const body = await readJson(request);
    if (path === '/api/admin/banner') {
      if (typeof body.headline !== 'string' || body.headline.length < 1 || body.headline.length > 60 || !['default', 'compromised', 'maintenance'].includes(body.theme)) throw new Error('invalid_site_state');
      Object.assign(siteState, { headline: body.headline, theme: body.theme });
    } else if (path === '/api/admin/notice') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_notice');
      Object.assign(siteState, { notice: body.notice });
    } else { return false; }
    sendJson(response, 200, { status: 'updated', site: publicSiteState(siteState) });
  } catch (error) {
    sendJson(response, error.message === 'payload_too_large' ? 413 : 400, { error: error.message });
  }
  return true;
};

const secretPayload = () => ({ environment: 'production', adminApi: '/api/admin/banner', noticeApi: '/api/admin/notice', adminKey: profile.adminKey, warning: 'TRAINING ONLY' });

const loginTarget2 = async (request, response, siteState) => {
  const body = await readInput(request);
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

const vulnerableSearch = (query, siteState) => {
  siteState.lastQuery = query;
  const sql = `SELECT id,label,value FROM products WHERE label LIKE '%${query}%'`;
  const rows = target3Products.filter((product) => product.label.includes(query.toLowerCase()) || product.value.toLowerCase().includes(query.toLowerCase()));
  if (/union\s+select/i.test(query) && /training_secrets/i.test(query)) {
    siteState.solved = true;
    siteState.lastFinding = '研修用のtraining_secretsテーブルが検索結果へ混入しました。';
    rows.push({ id: 399, label: 'training_flag', value: siteState.flag.value });
  }
  return { query, sql, rows, warning: siteState.solved ? 'SQL文字列への直接連結により、想定外のSELECTが混入しました。' : undefined };
};

const handleTarget3Api = async (request, response, path, siteState) => {
  if (request.method === 'GET' && (path === '/api/search' || path === '/search')) {
    const url = new URL(request.url ?? '/', 'http://target');
    const result = vulnerableSearch(url.searchParams.get('q') ?? '', siteState);
    if (path === '/api/search') {
      sendJson(response, 200, result);
      return true;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(renderPage(siteState, 'Search Result', `<main><h1>検索結果</h1><p class="lead">実行された研修用SQL:</p><pre>${escapeHtml(result.sql)}</pre><div class="card"><table>${result.rows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`).join('')}</table></div><p><a class="link" href="/">戻る</a></p></main>`));
    return true;
  }
  return false;
};

const handleTarget4Api = async (request, response, path, siteState) => {
  if (request.method === 'POST' && (path === '/login' || path === '/api/login')) {
    const body = await readInput(request);
    if (body.username !== 'student' || body.password !== 'portal123') {
      sendJson(response, 401, { error: 'invalid_credentials' });
      return true;
    }
    siteState.authenticated = true;
    const token = issueWeakToken(siteState);
    if (path === '/login') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(renderPage(siteState, 'Login Success', `<main><h1>ログイン成功</h1><p class="lead">この研修トークンは署名がなく、Base64URLのJSONだけで構成されています。</p><div class="card"><pre>${escapeHtml(token)}</pre></div><p><a class="link" href="/">戻る</a></p></main>`));
      return true;
    }
    sendJson(response, 200, { token, note: 'training token: unsigned base64url JSON' });
    return true;
  }
  if (request.method === 'GET' && path === '/api/me') {
    sendJson(response, siteState.authenticated ? 200 : 401, siteState.authenticated ? { user: 'student', role: 'user' } : { error: 'login_required' });
    return true;
  }
  if (request.method === 'GET' && path === '/api/admin') {
    try {
      const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      const payload = decodeBase64UrlJson(token);
      if (payload.nonce !== siteState.nonce) {
        sendJson(response, 401, { error: 'invalid_token' });
        return true;
      }
      if (payload.role === 'admin') {
        siteState.solved = true;
        siteState.lastAction = '署名検証のないトークン改変が管理者APIで受理されました。';
        sendJson(response, 200, { status: 'admin', flag: siteState.flag.value });
        return true;
      }
      sendJson(response, 403, { error: 'admin_role_required' });
    } catch {
      sendJson(response, 401, { error: 'invalid_token' });
    }
    return true;
  }
  return false;
};

const updateSecureVerification = (siteState) => {
  siteState.verified = Object.values(siteState.checks).every(Boolean);
};

const markSecureCheck = (siteState, key) => {
  siteState.checks[key] = true;
  updateSecureVerification(siteState);
};

const handleTarget5Api = async (request, response, path, siteState) => {
  if (request.method === 'GET' && ['/backup/config.json', '/debug/app-config.json', '/internal/config.json'].includes(path)) {
    markSecureCheck(siteState, 'secrets');
    sendJson(response, 404, { error: 'not_found', defense: 'secret_not_in_web_root' });
    return true;
  }
  if (request.method === 'POST' && (path === '/login' || path === '/api/login')) {
    const body = await readInput(request);
    if (body.username !== 'student' || body.password !== 'secure123') {
      sendJson(response, 401, { error: 'invalid_credentials' });
      return true;
    }
    siteState.authenticated = true;
    siteState.loginNonce = randomBytes(10).toString('hex');
    const token = issueSecureToken(siteState);
    if (path === '/login') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(renderPage(siteState, 'Secure Login', `<main><h1>ログイン成功</h1><div class="card"><pre>${escapeHtml(token)}</pre></div><p><a class="link" href="/">戻る</a></p></main>`));
      return true;
    }
    sendJson(response, 200, { token, expiresIn: 600 });
    return true;
  }
  const productMatch = path.match(/^\/api\/products\/(\d+)$/);
  if (request.method === 'GET' && productMatch) {
    const product = siteState.products[Number(productMatch[1])];
    if (!siteState.authenticated) {
      sendJson(response, 401, { error: 'login_required' });
      return true;
    }
    if (!product) {
      sendJson(response, 404, { error: 'not_found' });
      return true;
    }
    if (product.owner !== 'student') {
      markSecureCheck(siteState, 'authorization');
      sendJson(response, 403, { error: 'forbidden', defense: 'resource_owner_checked' });
      return true;
    }
    sendJson(response, 200, { product });
    return true;
  }
  if (request.method === 'GET' && path === '/api/search') {
    const url = new URL(request.url ?? '/', 'http://target');
    const query = url.searchParams.get('q') ?? '';
    const normalized = query.toLowerCase();
    const rows = /^[\p{L}\p{N}\s_-]{0,40}$/u.test(query)
      ? Object.values(siteState.products).filter((product) => product.name.toLowerCase().includes(normalized))
      : [];
    if (/('|--|union|select|training_secrets)/i.test(query)) markSecureCheck(siteState, 'input');
    sendJson(response, 200, { query, rows, parameterized: true, escaped: true });
    return true;
  }
  if (request.method === 'GET' && path === '/api/admin') {
    const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const payload = verifySecureToken(siteState, token);
    if (!payload) {
      markSecureCheck(siteState, 'session');
      sendJson(response, 401, { error: 'invalid_token', defense: 'signature_or_expiry_failed' });
      return true;
    }
    if (payload.role !== 'admin') {
      sendJson(response, 403, { error: 'admin_role_required' });
      return true;
    }
    sendJson(response, 200, { status: 'admin' });
    return true;
  }
  if (request.method === 'GET' && path === '/api/defense/status') {
    updateSecureVerification(siteState);
    sendJson(response, 200, { checks: siteState.checks, verified: siteState.verified });
    return true;
  }
  return false;
};

const handleFlagRequest = async (request, response, siteState) => {
  if (request.method === 'GET') {
    if (!canRevealFlag(siteState)) {
      sendJson(response, 403, { error: 'flag_locked', detail: PROFILE_ID === '5' ? 'すべての防御確認を完了するとFlagを取得できます。' : '攻略条件を満たすとFlagを取得できます。' });
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

  try {
    if (request.method === 'GET' && path === '/api/status') {
      sendJson(response, 200, { status: 'ok', service: profile.service, profile: PROFILE_ID, modified: isModified(siteState), site: publicSiteState(siteState), time: new Date().toISOString() });
      return;
    }
    if (request.method === 'GET' && path === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      response.end(profile.robots);
      return;
    }
    if (PROFILE_ID === '1' && request.method === 'GET' && path === profile.secretPath) {
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
    if (PROFILE_ID === '3' && await handleTarget3Api(request, response, path, siteState)) return;
    if (PROFILE_ID === '4' && await handleTarget4Api(request, response, path, siteState)) return;
    if (PROFILE_ID === '5' && await handleTarget5Api(request, response, path, siteState)) return;
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
  } catch (error) {
    sendJson(response, error.message === 'payload_too_large' ? 413 : 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => console.log(`${profile.service} listening on ${HOST}:${PORT}`));

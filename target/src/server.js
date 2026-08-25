import http from 'node:http';

const PROFILE_ID = ['1', '2', '3'].includes(process.env.TARGET_PROFILE) ? process.env.TARGET_PROFILE : '1';
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;

const profiles = {
  '1': {
    service: 'terminalbox-target-1', brand: 'TERMINALBOX // セキュリティ研修サイト', adminKey: 'training-admin-2026',
    secretPath: '/backup/config.json', robots: 'User-agent: *\nDisallow: /backup/\n',
    defaultState: { headline: 'TerminalBox 演習サイト', theme: 'default', notice: '' },
  },
  '2': {
    service: 'terminalbox-target-2', brand: '青葉マルシェ // オンラインストア', adminKey: 'store-admin-2026',
    secretPath: '/backup/store-config.json', robots: 'User-agent: *\nDisallow: /backup/\n',
    defaultState: { headline: '青葉マルシェ', theme: 'default', notice: '', product: '季節の果物セット', price: 2800, stock: 12 },
  },
  '3': {
    service: 'terminalbox-target-3', brand: 'みなと市立図書館 // 公式サイト', adminKey: 'library-admin-2026',
    secretPath: '/debug/app-config.json', robots: 'User-agent: *\nDisallow: /debug/\n',
    defaultState: { headline: 'みなと市立図書館', theme: 'default', notice: '', event: '夏の読書週間を開催中です' },
  },
};

const profile = profiles[PROFILE_ID];
let siteState = { ...profile.defaultState };

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
};

const readJson = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new Error('invalid_json'); }
};

const isModified = () => JSON.stringify(siteState) !== JSON.stringify(profile.defaultState);

const themeColors = () => {
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
main{min-height:330px;padding:46px 34px;text-align:center}h1{margin:0 0 16px;font-size:clamp(28px,5vw,46px)}
.lead{max-width:650px;margin:0 auto 22px;line-height:1.8;color:${colors.compromised ? '#ffd2d7' : '#52645b'}}
.card{max-width:650px;margin:24px auto;padding:20px;border:1px solid ${colors.border};border-radius:8px;background:${colors.card}}
.notice{max-width:720px;margin:0 auto 18px;padding:12px 18px;background:#b9102a;color:white;font-weight:800;text-align:center}
.meta{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:16px}.meta strong{display:block;font-size:24px}.meta span{font-size:12px;color:#64766d}
nav a{margin:0 8px;color:${colors.compromised ? '#ff9dab' : '#147348'}}.alert{font-weight:700;color:#ffb1bb}
`;

const renderTraining = () => {
  const colors = themeColors();
  const description = colors.compromised
    ? '<span class="alert">セキュリティ警告: 公開された管理APIを通じてサイトが改ざんされました。</span>'
    : colors.maintenance ? '現在、システムメンテナンスを実施しています。' : 'このサイトはTerminalBoxの隔離されたセキュリティ演習用ターゲットです。';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteState.headline)}</title><style>${sharedStyles(colors)}</style></head>
<body><header>${profile.brand}</header><main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">${description}</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card"><strong>研修サイトへようこそ</strong><p>安全なサービス運用には、日々のセキュリティ対策が欠かせません。</p><nav><a href="about">サイト概要</a><a href="login">従業員ログイン</a><a href="api/status">API状態</a></nav></div></main></body></html>`;
};

const renderStore = () => {
  const colors = themeColors();
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteState.headline)}</title><style>${sharedStyles(colors)}.price{color:#b5232d;font-size:28px;font-weight:800}</style></head>
<body><header>${profile.brand}</header><main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">産地から届いた旬の食材を、毎日の食卓へお届けします。</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card"><small>今週のおすすめ</small><h2>${escapeHtml(siteState.product)}</h2><div class="price">¥${Number(siteState.price).toLocaleString('ja-JP')}</div><div class="meta"><div><strong>${escapeHtml(siteState.stock)}</strong><span>在庫数</span></div><div><strong>送料無料</strong><span>5,000円以上</span></div></div></div></main></body></html>`;
};

const renderLibrary = () => {
  const colors = themeColors();
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteState.headline)}</title><style>${sharedStyles(colors)}.event{font-size:19px;font-weight:700;color:#235f8c}</style></head>
<body><header>${profile.brand}</header><main><h1>${escapeHtml(siteState.headline)}</h1><p class="lead">本と人が出会い、地域の学びが広がる場所です。</p>
${siteState.notice ? `<div class="notice">${escapeHtml(siteState.notice)}</div>` : ''}
<div class="card"><small>図書館からのお知らせ</small><p class="event">${escapeHtml(siteState.event)}</p><nav><a href="guide">利用案内</a><a href="calendar">開館カレンダー</a><a href="api/status">システム状態</a></nav></div></main></body></html>`;
};

const renderHome = () => PROFILE_ID === '2' ? renderStore() : PROFILE_ID === '3' ? renderLibrary() : renderTraining();

const requireAdmin = (request, response) => {
  if (request.headers['x-admin-key'] === profile.adminKey) return true;
  sendJson(response, 403, { error: 'forbidden' });
  return false;
};

const handleAdminRequest = async (request, response, path) => {
  if (!requireAdmin(request, response)) return true;
  try {
    const body = await readJson(request);
    if (PROFILE_ID === '1' && path === '/api/admin/banner') {
      if (typeof body.headline !== 'string' || body.headline.length < 1 || body.headline.length > 60 || !['default', 'compromised', 'maintenance'].includes(body.theme)) throw new Error('invalid_site_state');
      siteState = { ...siteState, headline: body.headline, theme: body.theme };
    } else if (PROFILE_ID === '1' && path === '/api/admin/notice') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_notice');
      siteState = { ...siteState, notice: body.notice };
    } else if (PROFILE_ID === '2' && path === '/api/admin/product') {
      if (typeof body.product !== 'string' || body.product.length < 1 || body.product.length > 50 || !Number.isInteger(body.price) || body.price < 0 || body.price > 999999 || !Number.isInteger(body.stock) || body.stock < 0 || body.stock > 9999) throw new Error('invalid_product');
      siteState = { ...siteState, product: body.product, price: body.price, stock: body.stock };
    } else if (PROFILE_ID === '2' && path === '/api/admin/campaign') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_campaign');
      siteState = { ...siteState, notice: body.notice };
    } else if (PROFILE_ID === '3' && path === '/api/admin/hero') {
      if (typeof body.headline !== 'string' || body.headline.length < 1 || body.headline.length > 60 || !['default', 'compromised', 'maintenance'].includes(body.theme)) throw new Error('invalid_site_state');
      siteState = { ...siteState, headline: body.headline, theme: body.theme };
    } else if (PROFILE_ID === '3' && path === '/api/admin/alert') {
      if (typeof body.notice !== 'string' || body.notice.length < 1 || body.notice.length > 100) throw new Error('invalid_alert');
      siteState = { ...siteState, notice: body.notice };
    } else { return false; }
    sendJson(response, 200, { status: 'updated', site: siteState });
  } catch (error) {
    sendJson(response, error.message === 'payload_too_large' ? 413 : 400, { error: error.message });
  }
  return true;
};

const secretPayload = () => {
  if (PROFILE_ID === '1') return { environment: 'production', adminApi: '/api/admin/banner', adminKey: profile.adminKey, warning: 'TRAINING ONLY' };
  if (PROFILE_ID === '2') return { environment: 'production', productApi: '/api/admin/product', campaignApi: '/api/admin/campaign', adminKey: profile.adminKey, warning: 'TRAINING ONLY' };
  return { environment: 'production', heroApi: '/api/admin/hero', alertApi: '/api/admin/alert', adminKey: profile.adminKey, warning: 'TRAINING ONLY' };
};

const server = http.createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://target').pathname;
  if (request.method === 'GET' && path === '/api/status') {
    sendJson(response, 200, { status: 'ok', service: profile.service, profile: PROFILE_ID, modified: isModified(), site: siteState, time: new Date().toISOString() });
    return;
  }
  if (request.method === 'GET' && path === '/robots.txt') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    response.end(profile.robots);
    return;
  }
  if (request.method === 'GET' && path === profile.secretPath) { sendJson(response, 200, secretPayload()); return; }
  if (request.method === 'POST' && path === '/api/lab/reset') {
    siteState = { ...profile.defaultState };
    sendJson(response, 200, { status: 'reset', site: siteState });
    return;
  }
  if (request.method === 'POST' && path.startsWith('/api/admin/')) {
    if (await handleAdminRequest(request, response, path)) return;
  }
  if (request.method === 'GET' && path === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-terminalbox-target': 'training-only' });
    response.end(renderHome());
    return;
  }
  if (request.method === 'GET' && ['/about', '/login', '/guide', '/calendar'].includes(path)) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>ご案内</title></head><body><h1>ご案内</h1><p>このページはTerminalBoxの演習用コンテンツです。</p><a href="./">トップへ戻る</a></body></html>');
    return;
  }
  sendJson(response, 404, { error: 'not_found', path });
});

server.listen(PORT, '0.0.0.0', () => console.log(`${profile.service} listening on port ${PORT}`));

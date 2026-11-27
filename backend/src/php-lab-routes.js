import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isValidSessionId } from './session/session-cookie.js';
import { checkPhpAnswer, createPhpState, phpState, phpSummary, simulatePhpMemory, runPhpLesson, PHP_SIMULATION_NOTICE } from './php-lab.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const digest = value => createHash('sha256').update(String(value)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
const COOKIE_TTL = 15 * 60 * 1000;

function document(body, mode = 'vulnerable', suffix = '') {
  const siteTitle = mode === 'secure' ? '顧客情報管理サイト（修正後）' : '顧客情報管理サイト';
  const title = siteTitle + suffix;
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
    :root{color-scheme:dark;font-family:system-ui,sans-serif;color:#e7f2ed;background:#0d151b}
    *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:rgba(137,172,156,.4) transparent}
    *:hover{scrollbar-color:rgba(157,198,178,.65) transparent}
    ::-webkit-scrollbar{width:7px;height:7px;background:transparent}::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}
    ::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:rgba(137,172,156,.4);background-clip:padding-box}
    ::-webkit-scrollbar-thumb:hover{background-color:rgba(157,198,178,.65)}::-webkit-scrollbar-button{display:none}
    /* Chromium native scrollbar-color can override the transparent pseudo-elements. */
    @supports selector(::-webkit-scrollbar){html,body,*{scrollbar-width:auto!important;scrollbar-color:auto!important}}
    html{background:#0d151b;color-scheme:dark}html::-webkit-scrollbar-track,body::-webkit-scrollbar-track{background:transparent!important}
    html,body{height:100%;overflow:hidden!important}
    .php-page-scroll{height:100vh;height:100dvh;width:100%;overflow:auto;overscroll-behavior:contain;background:#0d151b;color-scheme:dark;scrollbar-width:thin!important;scrollbar-color:rgba(137,172,156,.4) transparent!important}
    .php-page-scroll:hover{scrollbar-color:rgba(157,198,178,.65) transparent!important}
    .php-page-scroll::-webkit-scrollbar{width:7px;height:7px;background:transparent}
    .php-page-scroll::-webkit-scrollbar-track,.php-page-scroll::-webkit-scrollbar-corner{background:transparent}
    .php-page-scroll::-webkit-scrollbar-thumb{background:rgba(137,172,156,.4);border:2px solid transparent;border-radius:999px;background-clip:padding-box}
    .php-page-scroll:focus-visible{outline:1px solid #3b9b68;outline-offset:-1px}
    body{margin:0;line-height:1.7}main{width:min(880px,100%);margin:auto;padding:24px}
    .site-intro{width:min(880px,100%);margin:auto;padding:20px 24px 0}.simulation-notice{font-size:12px;color:#a7c1b2;border-left:3px solid #3b9b68;padding:8px 12px;background:#12241c}.login{min-height:300px;display:grid;place-items:center;padding:24px}.login form{width:min(320px,100%);display:grid;gap:18px}
    label{display:grid;gap:6px;font-size:13px;color:#a2b7ac}input{width:100%;padding:11px 12px;color:#e7f2ed;background:#111f25;border:1px solid #2b453b;border-radius:6px;font:inherit}
    button{padding:10px 16px;color:#07140d;background:#62f6a6;border:1px solid #3b9b68;border-radius:6px;font:inherit;cursor:pointer}
    input:focus-visible,button:focus-visible{outline:2px solid #62f6a6;outline-offset:3px}button:hover{filter:brightness(1.08)}
    .error{margin:0;color:#ffadb6;font-size:13px}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}h1{font-size:22px}
    .table-wrap{overflow:auto;border:1px solid #294139;border-radius:8px}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #20332b}th{background:#15271f}small{color:#9eb5a8}pre{white-space:pre-wrap;overflow-wrap:anywhere}
  </style><body><div class="php-page-scroll" role="region" aria-label="顧客情報管理サイト" tabindex="0"><section class="site-intro"><h1>${siteTitle}</h1><p class="simulation-notice">${escape(PHP_SIMULATION_NOTICE)}</p></section>${body}</div></body></html>`;
}

function loginPage(mode, error = '') {
  return document(`<div class="login"><form method="post" action="login" aria-label="顧客管理ログイン"><label>ID<input name="id" autocomplete="username" required maxlength="80"></label><label>パスワード<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label><button type="submit">ログイン</button>${error ? `<p class="error" role="alert">${escape(error)}</p>` : ''}</form></div>`, mode, '｜ログイン');
}

function customerPage(csv, mode) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift() !== 'customer_id,name,birth_date,email') throw new Error('顧客データの形式が不正です。');
  const rows = lines.map(line => line.split(',')).map(row => `<tr><td>${escape(row[1])}</td><td>${escape(row[2])}</td><td>${escape(row[3])}</td></tr>`).join('');
  return document(`<main><header><h1>顧客情報一覧</h1><form method="post" action="logout"><button type="submit">ログアウト</button></form></header><p><small>phpstudentでログイン中。この一覧はすべて架空の教材データです。</small></p><div class="table-wrap"><table><thead><tr><th>氏名</th><th>生年月日</th><th>メールアドレス</th></tr></thead><tbody>${rows}</tbody></table></div></main>`, mode);
}

function cookieValue(req, name) {
  const entries = String(req.headers.cookie ?? '').split(';');
  const match = entries.find(entry => entry.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : '';
}

function authenticated(req, state, mode) {
  const auth = state.auth[mode];
  const value = cookieValue(req, 'tbx_php_auth_' + mode);
  return Boolean(auth && auth.expiresAt > Date.now() && value && same(value, auth.token));
}

async function formBody(req) {
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > 4096) throw new Error('入力が長すぎます。');
    return req.body;
  }
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 4096) throw new Error('入力が長すぎます。');
  }
  if (String(req.headers['content-type'] ?? '').includes('application/json')) {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('入力が不正です。');
    return body;
  }
  return Object.fromEntries(new URLSearchParams(text));
}

export function installPhpRoutes(app, { isWebService, isLabService, labProxy, sessionManager, terminalBoxSession, internalApiSession, execute = runPhpLesson, runtimePort = 3300, runtimeHost = '127.0.0.9' }) {
  let active = 0;
  const busySessions = new Set();
  const control = async (session, action, body = {}) => {
    if (isWebService) return labProxy.requestJson('/internal/php-lab', { action, ...body }, session.sessionId);
    if (action === 'status') return phpSummary(session);
    if (action === 'reset') { session.phpLab = createPhpState(); return phpSummary(session); }
    if (action === 'check') return checkPhpAnswer(session, body.stage, String(body.answer ?? '').slice(0, 200));
    if (action === 'unclear') { phpState(session).completed = []; phpState(session).normalViewed = false; return phpSummary(session); }
    throw new Error('不明な操作です。');
  };

  app.post('/internal/php-lab', async (req, res) => {
    try { const session = await internalApiSession(req, res); if (session) res.json(await control(session, req.body?.action, req.body)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  if (isWebService) {
    app.get('/api/php-lab', async (req, res) => {
      try { res.json(await control(await terminalBoxSession(req, res), 'status')); }
      catch (error) { res.status(503).json({ error: error.message }); }
    });
    app.post('/api/php-lab/:action', async (req, res) => {
      try {
        if (!['reset', 'check', 'unclear'].includes(req.params.action)) return res.status(404).json({ error: 'Not found' });
        res.json(await control(await terminalBoxSession(req, res), req.params.action, { stage: req.body?.stage, answer: req.body?.answer }));
      } catch (error) { res.status(400).json({ error: error.message }); }
    });
  }

  const serve = async (req, res, session, path, prefix = '') => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'");
    const send = (status, body, html = false) => { res.statusCode = status; res.setHeader('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'); res.end(html ? body : JSON.stringify(body)); };
    const redirect = path => { res.statusCode = 303; res.setHeader('Location', path); res.end(); };
    if (!session) return send(401, { error: '有効なTerminalBoxセッションが必要です。' });
    const url = new URL(path, 'http://php.local');
    const match = url.pathname.match(/^\/(vulnerable|secure)\/(login|logout|customers|api\/customers|api\/memory-demo)?$/);
    if (!match) return send(404, { error: 'Not found' });
    const [, mode, endpoint = ''] = match;
    const base = `${prefix}/${mode}/`;
    const state = phpState(session);
    const loggedIn = authenticated(req, state, mode);
    const cookie = (token, age) => {
      const https = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
      const existing = res.getHeader('Set-Cookie');
      const cookies = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
      res.setHeader('Set-Cookie', [...cookies, `tbx_php_auth_${mode}=${token}; Path=${base}; HttpOnly; SameSite=Strict; Max-Age=${age}${https ? '; Secure' : ''}`]);
    };
    if (endpoint === 'login' && req.method === 'POST') {
      const body = await formBody(req);
      if (session.phpLab !== state) return send(409, { error: '演習がRESETされました。' });
      const now = Date.now();
      state.loginAttempts = state.loginAttempts.filter(time => now - time < 30_000);
      if (state.loginAttempts.length >= 5) return send(429, loginPage(mode, '少し待ってから再試行してください。'), true);
      state.loginAttempts.push(now);
      if (typeof body.id !== 'string' || typeof body.password !== 'string' || body.id.length > 80 || body.password.length > 200 || body.id !== 'phpstudent' || !same(body.password, state.loginPassword)) return send(401, loginPage(mode, 'IDまたはパスワードが違います。'), true);
      state.loginAttempts = [];
      state.normalViewed = true;
      const token = randomBytes(32).toString('base64url');
      state.auth[mode] = { token, expiresAt: now + COOKIE_TTL };
      cookie(token, COOKIE_TTL / 1000);
      return redirect(base + 'customers');
    }
    if (endpoint === 'logout' && req.method === 'POST') {
      delete state.auth[mode]; cookie('', 0); return redirect(base);
    }
    const simulation = endpoint === 'api/memory-demo';
    if (simulation ? req.method !== 'POST' : req.method !== 'GET') return send(405, { error: 'この操作方法は使えません。' });
    if (!endpoint || endpoint === 'login') return loggedIn ? redirect(base + 'customers') : send(200, loginPage(mode), true);
    if (simulation && loggedIn) return send(409, { simulation: true, notice: PHP_SIMULATION_NOTICE, error: '模擬演習のリクエストにはログインCookieを付けずに送信してください。' });
    const customers = endpoint === 'customers' || endpoint === 'api/customers';
    if (customers && !loggedIn) return send(401, endpoint === 'customers' ? loginPage(mode, '顧客情報の閲覧にはログインが必要です。') : { error: 'ログインが必要です。' }, endpoint === 'customers');
    let body;
    if (simulation) {
      body = await formBody(req);
      if (Object.keys(body).some(key => key !== 'step')) return send(400, { simulation: true, error: '教材ではstepだけを指定してください。', notice: PHP_SIMULATION_NOTICE });
      if (session.phpLab !== state) return send(409, { error: '演習が初期化されました。' });
    }
    if (active >= 2 || busySessions.has(session.sessionId)) return send(429, { error: 'PHP教材は実行中です。少し待って再試行してください。' });
    active += 1; busySessions.add(session.sessionId);
    try {
      if (simulation) {
        const result = await simulatePhpMemory(session, mode, body.step, execute);
        return send(result.status, result);
      }
      const raw = await execute();
      if (session.phpLab !== state) return send(409, { error: '演習がRESETされました。やり直してください。' });
      if (!authenticated(req, state, mode)) return send(401, { error: 'ログインの有効期限が切れました。' });
      if (raw.status !== 200 || typeof raw.output !== 'string' || !raw.output.startsWith('customer_id,name,birth_date,email')) throw new Error('顧客データを読み取れません。');
      state.normalViewed = true;
      return endpoint === 'customers' ? send(200, customerPage(raw.output, mode), true) : send(200, { output: raw.output });
    } catch (error) {
      console.error(`PHP lesson failed: ${error.message}`);
      return send(503, { error: 'PHP教材を実行できません。LabのPHPインストールと専用ユーザー設定を確認してください。' });
    } finally { active -= 1; busySessions.delete(session.sessionId); }

  };
  if (isLabService) {
    app.use('/php-site', async (req, res) => {
      try { const session = await terminalBoxSession(req, res, { allowHeader: true }); await serve(req, res, session, req.url, '/php-site'); }
      catch { res.status(400).json({ error: 'リクエストが不正です。' }); }
    });
    const server = http.createServer(async (req, res) => {
      try {
        const id = req.headers['x-terminalbox-session'];
        const session = isValidSessionId(id) ? sessionManager.get(id) : null;
        if (session) await sessionManager.touch(id);
        await serve(req, res, session, req.url);
      } catch { res.statusCode = 400; res.end('リクエストが不正です。'); }
    });
    server.listen(runtimePort, runtimeHost);
    return server;
  }
}

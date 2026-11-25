import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { checkPhpAnswer, createPhpState, phpState, phpSummary, recordPhpResult } from '../src/php-lab.js';
import { installPhpRoutes } from '../src/php-lab-routes.js';
import { isLabHttpPath } from '../src/lab-proxy.js';

test('PHP answers require observed identity, data retrieval and actual secure rejection', () => {
  const session = {};
  const state = phpState(session);
  assert.equal(phpSummary(session).flag, undefined);
  assert.equal(checkPhpAnswer(session, 'attack', state.flag).correct, false);
  assert.equal(checkPhpAnswer(session, 'understand', 'web-user').correct, false);
  recordPhpResult(session, state, 'vulnerable', 'summary; whoami', { status: 200, identityObserved: true });
  const data = recordPhpResult(session, state, 'vulnerable', 'summary; cat data/customers.csv', { status: 200, dataRead: true });
  assert.equal(data.flag, state.flag);
  assert.equal(checkPhpAnswer(session, 'attack', 'wrong').correct, false);
  assert.equal(checkPhpAnswer(session, 'attack', state.flag).correct, true);
  assert.equal(checkPhpAnswer(session, 'understand', 'web-user').correct, true);
  assert.equal(checkPhpAnswer(session, 'defend', 'business-input').correct, false);
  recordPhpResult(session, state, 'secure', 'summary; whoami', { status: 400, blocked: true });
  assert.equal(state.secureBlocked, false);
  recordPhpResult(session, state, 'secure', 'summary; cat data/customers.csv', { status: 400, blocked: true });
  assert.equal(checkPhpAnswer(session, 'defend', 'business-input').cleared, true);
});

test('PHP progress is session scoped and an in-flight result cannot undo RESET', () => {
  const a = {}, b = {};
  const old = phpState(a);
  recordPhpResult(a, old, 'vulnerable', 'summary; whoami', { status: 200, identityObserved: true });
  assert.equal(phpSummary(b).identityObserved, false);
  const before = phpSummary(a).epoch;
  a.phpLab = createPhpState();
  assert.notEqual(phpSummary(a).epoch, before);
  assert.equal(recordPhpResult(a, old, 'vulnerable', '', { status: 200, dataRead: true }), null);
  assert.equal(phpSummary(a).dataRead, false);
});

test('browser and Kali PHP routes share state, reject missing sessions and preserve secure failures', async t => {
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const sessions = new Map([[id, { sessionId: id }], [other, { sessionId: other }]]);
  const app = express(); app.use(express.json());
  const execute = async (mode, topic) => ({ status: mode === 'secure' ? 400 : 200, runtime: 'PHP 8.4', output: mode === 'secure' ? 'blocked' : 'demo001@example.invalid', identityObserved: mode === 'vulnerable' && topic === 'summary; whoami', dataRead: mode === 'vulnerable' && topic === 'summary; cat data/customers.csv', blocked: mode === 'secure' });
  const runtime = installPhpRoutes(app, {
    isWebService: false, isLabService: true, execute, runtimeHost: '127.0.0.1', runtimePort: 0,
    sessionManager: { get: key => sessions.get(key), touch: async () => {} },
    terminalBoxSession: async req => sessions.get(req.headers['x-terminalbox-session']),
    internalApiSession: async (req, res) => { if (req.headers['x-terminalbox-internal-token'] !== 'secret') { res.status(403).end(); return null; } return sessions.get(req.headers['x-terminalbox-session']); },
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => runtime.close(resolve))]));
  await Promise.all([new Promise(resolve => server.once('listening', resolve)), new Promise(resolve => runtime.once('listening', resolve))]);
  const base = `http://127.0.0.1:${server.address().port}`;
  const kali = `http://127.0.0.1:${runtime.address().port}`;
  const headers = { 'x-terminalbox-session': id };
  const query = topic => new URLSearchParams({ topic });
  assert.equal((await fetch(kali + '/vulnerable/api/report?topic=summary')).status, 401);
  assert.equal((await fetch(base + '/internal/php-lab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"status"}' })).status, 403);
  const page = await fetch(base + '/php-site/vulnerable/', { headers });
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal((await fetch(kali + '/vulnerable/data/customers.csv', { headers })).status, 404);
  await fetch(kali + '/vulnerable/api/report?' + query('summary; whoami'), { headers });
  const read = await fetch(kali + '/vulnerable/api/report?' + query('summary; cat data/customers.csv'), { headers }).then(r => r.json());
  assert.match(read.flag, /^TBX\{php_[a-f0-9]{2}\}$/);
  const secure = await fetch(kali + '/secure/api/report?' + query('summary; cat data/customers.csv'), { headers });
  assert.equal(secure.status, 400); assert.equal((await secure.json()).flag, undefined);
  assert.equal(phpSummary(sessions.get(id)).secureBlocked, true);
  assert.equal(phpSummary(sessions.get(other)).dataRead, false);
  const control = action => fetch(base + '/internal/php-lab', { method: 'POST', headers: { ...headers, 'x-terminalbox-internal-token': 'secret', 'content-type': 'application/json' }, body: JSON.stringify({ action }) }).then(r => r.json());
  const before = await control('status'); assert.equal(before.flag, undefined);
  const reset = await control('reset'); assert.notEqual(reset.epoch, before.epoch); assert.equal(reset.dataRead, false);
});

test('PHP public proxy, private controls, dedicated user and tab order are wired', async () => {
  assert.equal(isLabHttpPath('/php-site/secure/'), true);
  assert.equal(isLabHttpPath('/internal/php-lab'), false);
  const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
  const [app, docker, nginx, runner, session] = await Promise.all(['web/src/App.tsx', 'Dockerfile.lab.cloud', 'cloud/nginx-lab.conf', 'backend/src/php-lab.js', 'backend/src/session/session-manager.js'].map(read));
  assert.ok(app.indexOf('id="php-tab"') > app.indexOf('id="mock-site-tab"'));
  assert.match(docker, /useradd.*--uid 1001.*phpstudent/);
  assert.match(docker, /test_lesson\.py/);
  assert.match(runner, /--clear-groups.*--no-new-privs/);
  assert.match(nginx, /location \/php-site\//);
  assert.match(nginx, /location = \/internal\/php-lab/);
  assert.match(session, /session\.phpLab = null/);
});

test('PHP login and reset protect normal customer data; only the bounded unauthenticated lesson bypasses it', async t => {
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const sessions = new Map([[id, { sessionId: id }], [other, { sessionId: other }]]);
  const csv = await readFile(new URL('../../php-target/data/customers.csv', import.meta.url), 'utf8');
  const calls = [];
  const execute = async (mode, topic, action) => {
    calls.push({ mode, topic, action });
    if (action === 'customers') return { status: 200, runtime: 'PHP 8.4', output: csv };
    return { status: mode === 'secure' ? 400 : 200, runtime: 'PHP 8.4', output: mode === 'secure' ? 'blocked' : topic.includes('cat data/customers.csv') ? csv : 'phpstudent', identityObserved: mode === 'vulnerable' && topic === 'summary; whoami', dataRead: mode === 'vulnerable' && topic === 'summary; cat data/customers.csv', blocked: mode === 'secure' };
  };
  const app = express(); app.use(express.json());
  const runtime = installPhpRoutes(app, { isWebService: false, isLabService: true, execute, runtimeHost: '127.0.0.1', runtimePort: 0,
    sessionManager: { get: key => sessions.get(key), touch: async () => {} }, terminalBoxSession: async (req, res) => { res.setHeader('Set-Cookie', 'tbx_session=existing; Path=/; HttpOnly'); return sessions.get(req.headers['x-terminalbox-session']); }, internalApiSession: async () => sessions.get(id) });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => runtime.close(resolve))]));
  await Promise.all([new Promise(resolve => server.once('listening', resolve)), new Promise(resolve => runtime.once('listening', resolve))]);
  const base = `http://127.0.0.1:${server.address().port}/php-site`;
  const kali = `http://127.0.0.1:${runtime.address().port}`;
  const headers = { 'x-terminalbox-session': id };
  const get = (path, extra = {}) => fetch(base + path, { headers: { ...headers, ...extra }, redirect: 'manual' });
  const post = (path, body, extra = {}) => fetch(base + path, { method: 'POST', headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams(body), redirect: 'manual' });
  const home = await (await get('/vulnerable/')).text();
  assert.equal((home.match(/<input /g) ?? []).length, 2); assert.match(home, /type="password"/);
  assert.doesNotMatch(home, /レポート種別|name="topic"|demo001|<h1/); assert.match(home, /scrollbar-color:rgba/);
  for (const mode of ['vulnerable', 'secure']) {
    assert.equal((await get(`/${mode}/api/customers`)).status, 401);
    const page = await get(`/${mode}/customers`); assert.equal(page.status, 401); assert.doesNotMatch(await page.text(), /demo001|1990-04-15/);
  }
  assert.equal(calls.length, 0);
  assert.equal((await post('/vulnerable/login', { id: 'phpstudent', password: 'wrong' })).status, 401);
  const credentials = phpSummary(sessions.get(id)).login;
  const login = await post('/vulnerable/login', credentials, { 'x-forwarded-proto': 'https' });
  assert.equal(login.status, 303); assert.equal(login.headers.get('location'), '/php-site/vulnerable/customers');
  assert.ok(login.headers.getSetCookie().some(value => value.startsWith('tbx_session=existing;')));
  const setCookie = login.headers.getSetCookie().find(value => value.startsWith('tbx_php_auth_')); assert.match(setCookie, /Path=\/php-site\/vulnerable\//); assert.match(setCookie, /HttpOnly; SameSite=Strict/); assert.match(setCookie, /; Secure/);
  const cookie = setCookie.split(';')[0];
  const list = await get('/vulnerable/customers', { cookie }); assert.equal(list.status, 200);
  const html = await list.text(); assert.match(html, /氏名/); assert.match(html, /生年月日/); assert.match(html, /メールアドレス/); assert.match(html, /1990-04-15/); assert.match(html, /demo001@example.invalid/); assert.doesNotMatch(html, /TBX\{/);
  assert.equal(phpSummary(sessions.get(id)).dataRead, false);
  assert.equal((await get('/vulnerable/api/customers', { cookie: 'tbx_php_auth_vulnerable=forged' })).status, 401);
  assert.equal((await get('/vulnerable/api/customers', { cookie, 'x-terminalbox-session': other })).status, 401);
  assert.equal((await get('/secure/api/customers', { cookie: cookie.replace('auth_vulnerable', 'auth_secure') })).status, 401);
  const secureLogin = await post('/secure/login', credentials); const secureCookie = secureLogin.headers.getSetCookie().find(value => value.startsWith('tbx_php_auth_')).split(';')[0];
  assert.equal((await get('/secure/api/customers', { cookie: secureCookie })).status, 200);
  const directLogin = await fetch(kali + '/vulnerable/login', { method: 'POST', headers, body: new URLSearchParams(credentials), redirect: 'manual' }); assert.match(directLogin.headers.get('set-cookie'), /Path=\/vulnerable\//);
  await get('/vulnerable/api/report?' + new URLSearchParams({ topic: 'summary; whoami' }));
  const payload = await (await get('/vulnerable/api/report?' + new URLSearchParams({ topic: 'summary; cat data/customers.csv' }))).json();
  assert.equal(payload.output, csv); assert.match(payload.flag, /^TBX\{php_/);
  const blocked = await get('/secure/api/report?' + new URLSearchParams({ topic: 'summary; cat data/customers.csv', action: 'customers' }));
  assert.equal(blocked.status, 400); assert.doesNotMatch(JSON.stringify(await blocked.json()), /demo001|1990-04-15|TBX\{/); assert.equal(calls.at(-1).action, 'report');
  sessions.get(id).phpLab.auth.secure.expiresAt = Date.now() - 1;
  assert.equal((await get('/secure/api/customers', { cookie: secureCookie })).status, 401);
  await post('/secure/logout', {}, { cookie: secureCookie }); assert.equal((await get('/secure/api/customers', { cookie: secureCookie })).status, 401);
  sessions.get(id).phpLab = createPhpState();
  assert.equal((await get('/vulnerable/api/customers', { cookie })).status, 401); assert.equal((await post('/vulnerable/login', credentials)).status, 401);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { checkPhpAnswer, createPhpState, phpState, phpSummary, simulatePhpMemory, PHP_SIMULATION_NOTICE } from '../src/php-lab.js';
import { installPhpRoutes } from '../src/php-lab-routes.js';
import { isLabHttpPath } from '../src/lab-proxy.js';
const csv = 'customer_id,name,birth_date,email\nDEMO001,教材 太郎,1990-04-15,demo001@example.invalid\n';
const load = async () => ({ status: 200, output: csv, runtime: 'PHP 8.4' });
const steps = ['allocate', 'abort', 'reuse', 'inspect'];

async function sequence(session, mode) {
  let result;
  for (const step of steps) result = await simulatePhpMemory(session, mode, step, load);
  return result;
}

test('memory simulation requires prior authenticated viewing and ordered steps', async () => {
  const session = {};
  assert.equal((await simulatePhpMemory(session, 'vulnerable', 'allocate', load)).status, 409);
  phpState(session).normalViewed = true;
  assert.equal((await simulatePhpMemory(session, 'vulnerable', 'inspect', load)).status, 409);
  for (const step of steps.slice(0, 3)) {
    const result = await simulatePhpMemory(session, 'vulnerable', step, load);
    assert.equal(result.status, 200); assert.equal(result.simulation, true);
    assert.equal(result.memoryFragment, undefined); assert.equal(result.flag, undefined);
    assert.doesNotMatch(JSON.stringify(phpSummary(session)), /demo001|1990-04-15|TBX\{/);
  }
  const leaked = await simulatePhpMemory(session, 'vulnerable', 'inspect', load);
  assert.match(leaked.memoryFragment, /demo001@example.invalid/);
  assert.match(leaked.flag, /^TBX\{php_[a-f0-9]{2}\}$/);
  assert.equal(leaked.notice, PHP_SIMULATION_NOTICE);
  assert.equal(checkPhpAnswer(session, 'understand', 'stale-reference').correct, false);
  assert.equal(checkPhpAnswer(session, 'attack', leaked.flag).correct, true);
  assert.equal(checkPhpAnswer(session, 'understand', 'stale-reference').correct, true);
  assert.equal(checkPhpAnswer(session, 'defend', 'update-php').correct, false);
  const safe = await sequence(session, 'secure');
  assert.equal(safe.blocked, true); assert.equal(safe.staleReference, false);
  assert.equal(safe.memoryFragment, undefined); assert.equal(safe.flag, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /demo001|1990-04-15|TBX\{/);
  assert.equal(checkPhpAnswer(session, 'defend', 'update-php').cleared, true);
});

test('model state and Flags are session scoped and reset discards in-flight fixture reads', async () => {
  const a = {}, b = {};
  phpState(a).normalViewed = true;
  await simulatePhpMemory(a, 'vulnerable', 'allocate', load);
  await simulatePhpMemory(a, 'vulnerable', 'abort', load);
  let release;
  const pending = simulatePhpMemory(a, 'vulnerable', 'reuse', () => new Promise(resolve => { release = resolve; }));
  const epoch = phpSummary(a).epoch;
  a.phpLab = createPhpState();
  release(await load());
  assert.equal((await pending).status, 409);
  assert.notEqual(phpSummary(a).epoch, epoch);
  assert.equal(phpSummary(a).normalViewed, false);
  assert.equal(phpSummary(b).memory.vulnerable.phase, 'idle');
  assert.equal(phpSummary(b).dataRead, false);
  assert.equal((await simulatePhpMemory(b, 'vulnerable', 'inspect', load)).status, 409);
  assert.equal((await simulatePhpMemory(a, 'vulnerable', 'whoami', load)).status, 400);
});

test('login preview, no-cookie model, fixed comparison, private controls, and cookie invalidation work over HTTP', async t => {
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const sessions = new Map([[id, { sessionId: id }], [other, { sessionId: other }]]);
  const app = express(); app.use(express.json());
  const runtime = installPhpRoutes(app, { isWebService: false, isLabService: true, execute: load, runtimeHost: '127.0.0.1', runtimePort: 0,
    sessionManager: { get: key => sessions.get(key), touch: async () => {} },
    terminalBoxSession: async (req, res) => { res.setHeader('Set-Cookie', 'tbx_session=existing; Path=/; HttpOnly'); return sessions.get(req.headers['x-terminalbox-session']); },
    internalApiSession: async (req, res) => { if (req.headers['x-terminalbox-internal-token'] !== 'secret') { res.status(403).end(); return null; } return sessions.get(req.headers['x-terminalbox-session']); },
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => runtime.close(resolve))]));
  await Promise.all([new Promise(resolve => server.once('listening', resolve)), new Promise(resolve => runtime.once('listening', resolve))]);
  const base = `http://127.0.0.1:${server.address().port}`;
  const kali = `http://127.0.0.1:${runtime.address().port}`;
  const headers = { 'x-terminalbox-session': id };
  const get = (path, extra = {}) => fetch(base + '/php-site' + path, { headers: { ...headers, ...extra }, redirect: 'manual' });
  const post = (path, body, extra = {}) => fetch(base + '/php-site' + path, { method: 'POST', headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams(body), redirect: 'manual' });
  const control = (action, extra = {}) => fetch(base + '/internal/php-lab', { method: 'POST', headers: { ...headers, 'x-terminalbox-internal-token': 'secret', 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
  assert.equal((await fetch(base + '/internal/php-lab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"status"}' })).status, 403);
  const home = await (await get('/vulnerable/')).text();
  assert.match(home, /<h1>顧客情報管理サイト<\/h1>/); assert.ok(home.includes(PHP_SIMULATION_NOTICE));
  assert.equal((home.match(/<input /g) ?? []).length, 2); assert.match(home, /type="password"/); assert.match(home, /scrollbar-color:rgba/);
  assert.doesNotMatch(home, /name="topic"|demo001|1990-04-15/);
  assert.equal((await get('/vulnerable/api/customers')).status, 401);
  assert.equal((await get('/vulnerable/api/report?topic=summary')).status, 404);
  assert.equal((await post('/vulnerable/api/memory-demo', { step: 'allocate' })).status, 409);
  const login = await post('/vulnerable/login', phpSummary(sessions.get(id)).login, { 'x-forwarded-proto': 'https' });
  assert.equal(login.status, 303); assert.equal(login.headers.get('location'), '/php-site/vulnerable/customers');
  assert.ok(login.headers.getSetCookie().some(value => value.startsWith('tbx_session=existing;')));
  const setCookie = login.headers.getSetCookie().find(value => value.startsWith('tbx_php_auth_'));
  assert.match(setCookie, /Path=\/php-site\/vulnerable\//); assert.match(setCookie, /HttpOnly; SameSite=Strict/); assert.match(setCookie, /; Secure/);
  const cookie = setCookie.split(';')[0];
  const list = await get('/vulnerable/customers', { cookie }); assert.equal(list.status, 200);
  const html = await list.text(); assert.match(html, /1990-04-15/); assert.match(html, /demo001@example.invalid/); assert.ok(html.includes(PHP_SIMULATION_NOTICE)); assert.doesNotMatch(html, /TBX\{/);
  assert.equal(phpSummary(sessions.get(id)).normalViewed, true); assert.equal(phpSummary(sessions.get(id)).dataRead, false);
  assert.equal((await get('/vulnerable/api/customers', { cookie, 'x-terminalbox-session': other })).status, 401);
  assert.equal((await get('/secure/api/customers', { cookie: cookie.replace('auth_vulnerable', 'auth_secure') })).status, 401);
  assert.equal((await post('/vulnerable/api/memory-demo', { step: 'allocate' }, { cookie })).status, 409);
  await post('/vulnerable/logout', {}, { cookie });
  assert.equal((await get('/vulnerable/api/customers', { cookie })).status, 401);
  let leaked;
  for (const step of steps) {
    const response = await fetch(kali + '/vulnerable/api/memory-demo', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ step }) });
    assert.equal(response.status, 200); leaked = await response.json(); assert.equal(leaked.simulation, true);
  }
  assert.match(leaked.memoryFragment, /demo001/); assert.match(leaked.flag, /^TBX\{php_/);
  for (const [stage, answer] of [['attack', leaked.flag], ['understand', 'stale-reference']]) assert.equal((await (await control('check', { stage, answer })).json()).correct, true);
  for (const step of steps) { const response = await post('/secure/api/memory-demo', { step }); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.flag, undefined); assert.equal(result.memoryFragment, undefined); }
  assert.equal((await (await control('check', { stage: 'defend', answer: 'update-php' })).json()).cleared, true);
  assert.equal((await post('/secure/api/memory-demo', { step: 'inspect', command: 'id' })).status, 400);
  const before = phpSummary(sessions.get(id)).epoch;
  await control('reset'); assert.notEqual(phpSummary(sessions.get(id)).epoch, before);
  assert.equal(phpSummary(sessions.get(id)).normalViewed, false); assert.equal(phpSummary(sessions.get(other)).dataRead, false);
  assert.equal((await post('/vulnerable/api/memory-demo', { step: 'allocate' })).status, 409);
});

test('PHP page and learner panel identify a conceptual model and remove the old command dispatcher', async () => {
  assert.equal(isLabHttpPath('/php-site/secure/'), true); assert.equal(isLabHttpPath('/internal/php-lab'), false);
  const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
  const [panel, php, runner, app, session] = await Promise.all(['web/src/PhpPanel.tsx', 'php-target/lesson.php', 'backend/src/php-lab.js', 'web/src/App.tsx', 'backend/src/session/session-manager.js'].map(read));
  assert.ok(panel.includes(PHP_SIMULATION_NOTICE)); assert.match(panel, /useState<Stage>\('prepare'\)/);
  assert.match(panel, /Web画面でログイン/); assert.match(panel, /api\/memory-demo/);
  assert.doesNotMatch(panel, /summary;|whoami|cat data/); assert.doesNotMatch(php, /proc_open\(/);
  assert.match(runner, /disable_functions=[^']*proc_open/); assert.match(runner, /--clear-groups.*--no-new-privs/);
  assert.ok(app.indexOf('id="php-tab"') > app.indexOf('id="mock-site-tab"')); assert.match(session, /session\.phpLab = null/);
});

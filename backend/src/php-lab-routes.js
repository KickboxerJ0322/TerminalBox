import http from 'node:http';
import { isValidSessionId } from './session/session-cookie.js';
import { checkPhpAnswer, createPhpState, phpState, phpSummary, recordPhpResult, runPhpLesson } from './php-lab.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function page(mode, result) {
  const safe = mode === 'secure';
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PHP研修レポート</title><style>body{font:15px sans-serif;background:#101820;color:#e7f2ed;padding:24px;line-height:1.7}input,button{padding:10px;border-radius:5px}input{width:min(90%,480px)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#172b2c;padding:16px}a{color:#7de0bb}</style><h1>PHP研修レポート</h1><p>架空の会社の顧客管理・レポート集計サイトです。公開用サマリーを表示します。業務用の顧客CSVはサーバー内に保管し、直接ダウンロードするURLは設けていません。</p><p>${safe ? 'Secure版：業務上の入力値だけを受け付けます。' : '脆弱性学習版：入力と操作の境界を学ぶ教材です。'}</p><p>実際のPHP・OSコマンドを使いますが、実行は教材専用の4操作だけに限定しています。管理者権限や任意シェルの取得は行いません。</p><form method="get" action="report"><label>レポート種別 <input name="topic" value="summary" maxlength="200"></label><button>レポート表示</button></form><p>通常入力は summary。個別データは公開レポートに含めません。</p><p><a href="../vulnerable/">学習版</a> / <a href="../secure/">Secure版</a></p>${result ? `<h2>処理結果</h2><p>${escape(result.runtime ?? '')}</p><pre>${escape(result.output ?? result.error ?? '')}${result.flag ? '\n' + escape(result.flag) : ''}</pre>` : ''}<p>登場する氏名・メール・電話番号はすべて架空の教材データです。</p></html>`;
}

export function installPhpRoutes(app, { isWebService, isLabService, labProxy, sessionManager, terminalBoxSession, internalApiSession, execute = runPhpLesson, runtimePort = 3300, runtimeHost = '127.0.0.9' }) {
  let active = 0;
  const busySessions = new Set();
  const control = async (session, action, body = {}) => {
    if (isWebService) return labProxy.requestJson('/internal/php-lab', { action, ...body }, session.sessionId);
    if (action === 'status') return phpSummary(session);
    if (action === 'reset') { session.phpLab = createPhpState(); return phpSummary(session); }
    if (action === 'check') return checkPhpAnswer(session, body.stage, String(body.answer ?? '').slice(0, 200));
    if (action === 'unclear') { phpState(session).completed = []; return phpSummary(session); }
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

  const serve = async (req, res, session, path) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'");
    const send = (status, body, html = false) => { res.statusCode = status; res.setHeader('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'); res.end(html ? body : JSON.stringify(body)); };
    if (!session) return send(401, { error: '有効なTerminalBoxセッションが必要です。' });
    const url = new URL(path, 'http://php.local');
    const match = url.pathname.match(/^\/(vulnerable|secure)\/(report|api\/report)?$/);
    if (!match) return send(404, { error: 'Not found' });
    if (req.method !== 'GET') return send(405, { error: 'GETを使ってください。' });
    const [, mode, endpoint] = match;
    if (!endpoint) return send(200, page(mode), true);
    const topic = url.searchParams.get('topic') ?? '';
    if (topic.length > 200 || /[\r\n\0]/.test(topic)) return send(400, { error: '入力は改行なし200文字以内です。' });
    if (active >= 2 || busySessions.has(session.sessionId)) return send(429, { error: 'PHP教材は実行中です。少し待って再試行してください。' });
    active += 1; busySessions.add(session.sessionId);
    const state = phpState(session);
    try {
      const result = recordPhpResult(session, state, mode, topic, await execute(mode, topic));
      if (!result) return send(409, { error: '演習がRESETされました。やり直してください。' });
      return send(result.status, endpoint === 'report' ? page(mode, result) : result, endpoint === 'report');
    } catch (error) {
      console.error(`PHP lesson failed: ${error.message}`);
      return send(503, { error: 'PHP教材を実行できません。LabのPHPインストールと専用ユーザー設定を確認してください。' });
    } finally { active -= 1; busySessions.delete(session.sessionId); }
  };
  if (isLabService) {
    app.use('/php-site', async (req, res) => {
      try { const session = await terminalBoxSession(req, res, { allowHeader: true }); await serve(req, res, session, req.url); }
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

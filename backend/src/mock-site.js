import { randomBytes } from 'node:crypto';
export const THEMES = ['input', 'auth', 'authorization', 'web'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateDefinition(value) {
  const text = (v, fallback, max = 100) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g,'').slice(0,max) : fallback;
  return { name: text(value?.name,'Training Market'), description: text(value?.description,'架空の学習用ショッピングサイト',300), color: /^#[0-9a-f]{6}$/i.test(value?.color ?? '') ? value.color : '#a32035', products: Array.isArray(value?.products) && value.products.length ? value.products.slice(0,12).map((p,i)=>({ id:i+1,name:text(p.name,`商品${i+1}`),price:Math.min(999999,Math.max(1,Number(p.price)||1000)) })) : [{id:1,name:'学習用ノート',price:1000}] };
}
export function createMockSite(definition, themes, difficulty, source) {
  return { id:randomBytes(8).toString('hex'), definition:validateDefinition(definition), themes, difficulty, source, solved:new Set(), flag:`TBX{mock_${randomBytes(12).toString('hex')}}`, checks:[] };
}
export function mockSummary(site) {
  return site ? { id:site.id, definition:site.definition,themes:site.themes,difficulty:site.difficulty,source:site.source,solved:[...site.solved],checks:site.checks } : null;
}
export function mockResponse(site, mode, path, query, body = {}, method = 'GET') {
  const secure = mode === 'secure';
  const done = theme => { if (!secure && site.themes.includes(theme)) site.solved.add(theme); };
  if (path === '/api/search') {
    const q=query.get('q') ?? '';
    const injected = /'\s*or\s+1\s*=\s*1/i.test(q);
    if (!secure && site.themes.includes('input') && injected) { done('input'); return {status:200,json:{simulated:true,trainingSecret:'入力値が検索条件を変えました',products:site.definition.products}}; }
    return {status:200,json:{products:site.definition.products.filter(p=>p.name.includes(q))}};
  }
  if (path.startsWith('/api/orders/')) {
    const other = path !== '/api/orders/1001';
    if (other && (secure || !site.themes.includes('authorization'))) return {status:403,json:{error:'注文の所有者が異なります'}};
    if(other) done('authorization');
    return {status:200,json:{id:other?1002:1001,owner:other?'other-user':'student',item:'架空の注文',simulated:true}};
  }
  if(path === '/api/login') return {status:200,json:{token:Buffer.from(JSON.stringify({role:'student'})).toString('base64url'),note:'模擬トークン。/api/admin?token= に指定してください。'}};
  if(path === '/api/admin') {
    let role=''; try { role=JSON.parse(Buffer.from(query.get('token')??'','base64url').toString()).role; } catch {}
    if(role==='admin' && !secure && site.themes.includes('auth')) {done('auth');return {status:200,json:{admin:true,simulated:true}};}
    return {status:403,json:{error:'管理者トークンの検証に失敗しました'}};
  }
  if(path === '/api/checkout' && method==='POST') {
    const price=Number(body.price);const expected=site.definition.products[0].price;
    if(!secure && site.themes.includes('web') && price===1){done('web');return {status:200,json:{paid:1,simulated:true}};}
    return {status:200,json:{paid:expected,simulated:true}};
  }
  if(path === '/api/flag') return !secure && site.themes.every(t=>site.solved.has(t)) ? {status:200,json:{flag:site.flag}} : {status:403,json:{error:'選択した全テーマのMISSIONを達成してください',solved:[...site.solved]}};
  if(path === '/') {
    const d=site.definition;
    return {status:200,html:`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(d.name)}</title><style>body{font-family:sans-serif;margin:0;background:#f5f5f5;color:#222}header{background:${d.color};padding:24px;color:white}main{padding:20px}article{display:inline-block;background:white;padding:20px;margin:8px;border:1px solid #ddd}a{color:${d.color}}input,button{padding:10px}code{overflow-wrap:anywhere}</style><header><small>TerminalBox 模擬サイト / ${secure?'Secure版':'脆弱版'} / 実際のサービスではありません</small><h1>${esc(d.name)}</h1><p>${esc(d.description)}</p></header><main><form action="api/search"><input name="q" placeholder="商品検索"><button>検索</button></form><h2>おすすめ商品</h2>${d.products.map(p=>`<article><h3>${esc(p.name)}</h3><p>¥${p.price.toLocaleString()}</p><form method="post" action="api/checkout"><input type="hidden" name="price" value="${p.price}"><button>疑似購入</button></form></article>`).join('')}<h2>会員メニュー（studentとして疑似ログイン済み）</h2><p><a href="api/orders/1001">自分の注文</a> / <a href="api/login">研修用トークン</a> / <a href="api/flag">Flag取得</a></p><p>データ・決済・認証は教材用です。入力値処理はSQLの挙動を再現したシミュレーションです。</p></main></html>`};
  }
  return {status:404,json:{error:'Not found'}};
}
export function compareMockSite(site) {
  const scenarios={input:['/api/search',new URLSearchParams({q:"' OR 1=1 --"}),{},'GET'],authorization:['/api/orders/1002',new URLSearchParams(),{},'GET'],auth:['/api/admin',new URLSearchParams({token:Buffer.from('{"role":"admin"}').toString('base64url')}),{},'GET'],web:['/api/checkout',new URLSearchParams(),{price:1},'POST']};
  site.checks=site.themes.map(theme=>{const args=scenarios[theme];const copy={...site,solved:new Set()};const vulnerable=mockResponse(copy,'vulnerable',...args);const secure=mockResponse(copy,'secure',...args);return {theme,vulnerable:vulnerable.json,secure:secure.json,blocked:theme==='web'?secure.json.paid!==1:theme==='input'?!secure.json.trainingSecret:secure.status===403};});
  return site.checks;
}

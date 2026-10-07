import { randomBytes } from 'node:crypto';
import { mockHints } from './mock-site-hints.js';
import { renderMockPage } from './mock-site-view.js';
export const THEMES = ['input', 'auth', 'authorization', 'web'];
export function validateDefinition(value) {
  const text = (v, fallback, max = 100) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g,'').slice(0,max) : fallback;
  const type = ['commerce','research','media','portal'].includes(value?.type) ? value.type : 'commerce';
  const color = (v,fallback) => /^#[0-9a-f]{6}$/i.test(v ?? '') ? v : fallback;
  const items = value?.items ?? value?.products;
  return { type, name:text(value?.name,'Training Site'), description:text(value?.description,'架空のセキュリティ学習サイト',300), color:color(value?.color,'#a32035'), background:color(value?.background,'#f5f5f5'), surface:color(value?.surface,'#ffffff'), foreground:color(value?.foreground,'#222222'), layout:['dashboard','cards','sidebar'].includes(value?.layout)?value.layout:'cards', searchLabel:text(value?.searchLabel,type==='commerce'?'商品検索':'キーワード検索'), sectionTitle:text(value?.sectionTitle,type==='commerce'?'おすすめ商品':'調査結果・コンテンツ'), categories:Array.isArray(value?.categories)?value.categories.slice(0,6).map(v=>text(v,'テーマ',30)):[], products:Array.isArray(items)&&items.length?items.slice(0,12).map((p,i)=>({id:i+1,name:text(p?.name,`教材${i+1}`),summary:text(p?.summary,'架空の学習用データです。',240),price:Math.min(999999,Math.max(1,Number(p?.price)||1000))})):[{id:1,name:'学習用データ',summary:'架空の学習用データです。',price:1000}] };
}
export function createMockSite(definition, themes, difficulty, source) {
  return { id:randomBytes(8).toString('hex'), definition:validateDefinition(definition), themes, difficulty, source, solved:new Set(), flag:`TBX{mock_${randomBytes(12).toString('hex')}}`, checks:[] };
}
export function mockSummary(site) {
  return site ? { id:site.id, definition:site.definition,themes:site.themes,difficulty:site.difficulty,source:site.source,missions:mockMissions(site),hints:mockHints(site),solved:[...site.solved],checks:site.checks } : null;
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
  if (path.startsWith('/api/orders/') || path.startsWith('/api/reports/')) {
    const other = !['/api/orders/1001','/api/reports/1001'].includes(path);
    if (other && (secure || !site.themes.includes('authorization'))) return {status:403,json:{error:'データの所有者が異なります'}};
    if(other) done('authorization');
    return {status:200,json:{id:other?1002:1001,owner:other?'other-user':'student',item:site.definition.type==='commerce'?'架空の注文':'保存レポート',simulated:true}};
  }
  if(path === '/api/login') return {status:200,json:{token:Buffer.from(JSON.stringify({role:'student'})).toString('base64url'),note:'模擬トークン。/api/admin?token= に指定してください。'}};
  if(path === '/api/admin') {
    let role=''; try { role=JSON.parse(Buffer.from(query.get('token')??'','base64url').toString()).role; } catch {}
    if(role==='admin' && !secure && site.themes.includes('auth')) {done('auth');return {status:200,json:{admin:true,simulated:true}};}
    return {status:403,json:{error:'管理者トークンの検証に失敗しました'}};
  }
  if(path === '/api/publish' && method==='POST' && site.definition.type!=='commerce') {
    const allowed = !secure && site.themes.includes('web') && body.visibility === 'public';
    if (allowed) done('web');
    return {status:200,json:{visibility:allowed?'public':'private',simulated:true}};
  }
  if(path === '/api/checkout' && method==='POST' && site.definition.type==='commerce') {
    const price=Number(body.price);const expected=site.definition.products[0].price;
    if(!secure && site.themes.includes('web') && price===1){done('web');return {status:200,json:{paid:1,simulated:true}};}
    return {status:200,json:{paid:expected,simulated:true}};
  }
  if(path === '/api/flag') return !secure && site.themes.every(t=>site.solved.has(t)) ? {status:200,json:{flag:site.flag}} : {status:403,json:{error:'選択した全テーマのMISSIONを達成してください',solved:[...site.solved]}};
  if(path === '/') return {status:200,html:renderMockPage(site.definition,secure)};
  return {status:404,json:{error:'Not found'}};
}
export function compareMockSite(site) {
  const scenarios={input:['/api/search',new URLSearchParams({q:"' OR 1=1 --"}),{},'GET'],authorization:['/api/orders/1002',new URLSearchParams(),{},'GET'],auth:['/api/admin',new URLSearchParams({token:Buffer.from('{"role":"admin"}').toString('base64url')}),{},'GET'],web:['/api/checkout',new URLSearchParams(),{price:1},'POST']};
  if(site.definition.type!=='commerce') { scenarios.authorization[0]='/api/reports/1002'; scenarios.web=['/api/publish',new URLSearchParams(),{visibility:'public'},'POST']; }
  site.checks=site.themes.map(theme=>{const args=scenarios[theme];const copy={...site,solved:new Set()};const vulnerable=mockResponse(copy,'vulnerable',...args);const secure=mockResponse(copy,'secure',...args);return {theme,vulnerable:vulnerable.json,secure:secure.json,blocked:theme==='web'?(site.definition.type==='commerce'?secure.json.paid!==1:secure.json.visibility==='private'):theme==='input'?!secure.json.trainingSecret:secure.status===403};});
  return site.checks;
}

export function mockMissions(site) {
  const commerce=site.definition.type==='commerce';
  return {input:' /api/search?q= の入力が検索条件に影響するか確認してください。',auth:' /api/login のトークンと /api/admin?token= の権限検証を調べてください。',authorization:`自分の${commerce?'注文':'保存レポート'} /api/${commerce?'orders':'reports'}/1001 と別のIDへのアクセスを調べてください。`,web:commerce?'POST /api/checkout の price と実際の請求額を確認してください。':'POST /api/publish の visibility を変更して、非公開レポートの公開制限を確認してください。'};
}

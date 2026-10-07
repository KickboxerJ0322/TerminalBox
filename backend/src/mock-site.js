import { randomBytes } from 'node:crypto';
import { mockHints } from './mock-site-hints.js';
import { renderMockPage } from './mock-site-view.js';
export const THEMES = ['backup', 'deface'];
export function validateDefinition(value) {
  const text = (v, fallback, max = 100) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g,'').slice(0,max) : fallback;
  const type = ['commerce','research','media','portal'].includes(value?.type) ? value.type : 'commerce';
  const color = (v,fallback) => /^#[0-9a-f]{6}$/i.test(v ?? '') ? v : fallback;
  const items = value?.items ?? value?.products;
  return { type, name:text(value?.name,'Training Site'), description:text(value?.description,'架空のセキュリティ学習サイト',300), color:color(value?.color,'#a32035'), background:color(value?.background,'#f5f5f5'), surface:color(value?.surface,'#ffffff'), foreground:color(value?.foreground,'#222222'), layout:['dashboard','cards','sidebar'].includes(value?.layout)?value.layout:'cards', searchLabel:text(value?.searchLabel,type==='commerce'?'商品検索':'キーワード検索'), sectionTitle:text(value?.sectionTitle,type==='commerce'?'おすすめ商品':'調査結果・コンテンツ'), categories:Array.isArray(value?.categories)?value.categories.slice(0,6).map(v=>text(v,'テーマ',30)):[], products:Array.isArray(items)&&items.length?items.slice(0,12).map((p,i)=>({id:i+1,name:text(p?.name,`教材${i+1}`),summary:text(p?.summary,'架空の学習用データです。',240),price:Math.min(999999,Math.max(1,Number(p?.price)||1000))})):[{id:1,name:'学習用データ',summary:'架空の学習用データです。',price:1000}] };
}
export function createMockSite(definition, themes, difficulty, source) {
  return { id:randomBytes(8).toString('hex'), definition:validateDefinition(definition), themes:[...THEMES], source, adminKey:randomBytes(16).toString('hex'), originalDefinition:validateDefinition(definition), solved:new Set(), flag:`TBX{mock_${randomBytes(12).toString('hex')}}`, checks:[] };
}
export function mockSummary(site) {
  return site ? { id:site.id, definition:site.definition,themes:site.themes,difficulty:site.difficulty,source:site.source,missions:mockMissions(site),hints:mockHints(site),solved:[...site.solved],checks:site.checks } : null;
}
export function mockResponse(site, mode, path, query, body = {}, method = 'GET') {
  const secure = mode === 'secure';
  if(path==='/robots.txt')return {status:200,json:{content:secure?'User-agent: *':'User-agent: *\nDisallow: /backup/config.json'}};
  if(path==='/backup/config.json') {
    if(secure)return {status:404,json:{error:'対策版はバックアップを公開しません'}};
    site.solved.add('backup');
    return {status:200,json:{adminApi:'/api/admin/banner',adminKey:site.adminKey,note:'このキーは模擬サイト専用です。'}};
  }
  if(path==='/api/admin/banner' && method==='POST') {
    if(secure || body.adminKey!==site.adminKey)return {status:403,json:{error:'管理APIへのアクセスを拒否しました'}};
    if(typeof body.title!=='string'||!body.title.trim())return {status:400,json:{error:'titleを指定してください'}};
    site.definition={...site.definition,name:body.title.slice(0,100),description:'学習用の管理APIで表示を変更しました。'};
    site.solved.add('deface');
    return {status:200,json:{updated:true,title:site.definition.name,note:'模擬サイト表示の再読み込みで確認できます。'}};
  }
  if(path==='/api/flag')return !secure&&THEMES.every(t=>site.solved.has(t))?{status:200,json:{flag:site.flag}}:{status:403,json:{error:'手順1〜3を順に実行してからFlagを取得してください',solved:[...site.solved]}};
  if(path==='/api/search')return {status:200,json:{items:site.definition.products.filter(p=>p.name.includes(query.get('q')??''))}};
  if(path==='/')return {status:200,html:renderMockPage(secure?site.originalDefinition:site.definition,secure)};
  return {status:404,json:{error:'Not found'}};
}
export function compareMockSite(site) {
  const copy={...site,definition:{...site.definition},solved:new Set()};
  const query=new URLSearchParams();
  const body={adminKey:site.adminKey,title:'学習用に表示を変更しました'};
  site.checks=[{theme:'backup',vulnerable:mockResponse(copy,'vulnerable','/backup/config.json',query).json,secure:mockResponse(copy,'secure','/backup/config.json',query).json,blocked:true},{theme:'deface',vulnerable:mockResponse(copy,'vulnerable','/api/admin/banner',query,body,'POST').json,secure:mockResponse(copy,'secure','/api/admin/banner',query,body,'POST').json,blocked:true}];
  return site.checks;
}
export function mockMissions() {return {backup:'公開バックアップから管理APIと管理キーを取得する',deface:'管理APIで模擬サイトのタイトルを変更する'};}

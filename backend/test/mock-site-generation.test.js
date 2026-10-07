import test from 'node:test';
import assert from 'node:assert/strict';
import { screenshotPart, generationPrompt } from '../src/mock-site-generation.js';
import { createMockSite, mockResponse, mockSummary, compareMockSite } from '../src/mock-site.js';
import { readFile } from 'node:fs/promises';

test('image validation accepts supported signatures and rejects spoofed or oversized input', () => {
  const image='data:image/png;base64,iVBORw0KGgo=';
  assert.equal(screenshotPart(image).inlineData.mimeType,'image/png');
  assert.equal(screenshotPart(null),null);
  for(const bad of ['data:image/png;base64,aGVsbG8=', 'https://example.com/x.png', 'data:image/svg+xml;base64,aGVsbG8=', 'a'.repeat(2100001)])assert.throws(()=>screenshotPart(bad));
  assert.match(generationPrompt({title:'コメント調査'}),/commerce\/research\/media\/portal/);
});
test('research screenshot definition renders reports and all missions work in both versions', () => {
  const site=createMockSite({type:'research',name:'Comment Lab',layout:'dashboard',color:'#223344',background:'#101010',surface:'#202020',foreground:'#eeeeee',categories:['IT','経済'],items:[{name:'コメント調査',summary:'架空の分析結果'}]},['input','auth','authorization','web'],'初級',{});
  const html=mockResponse(site,'vulnerable','/',new URLSearchParams()).html;
  assert.match(html,/保存レポート/);assert.match(html,/コメント調査/);assert.match(html,/background:#101010/);assert.doesNotMatch(html,/疑似購入|おすすめ商品|¥/);
  assert.match(mockSummary(site).missions.web,/visibility/);
  assert.ok(compareMockSite(site).every(c=>c.blocked));assert.equal(site.solved.size,0);
  mockResponse(site,'vulnerable','/api/search',new URLSearchParams({q:"' OR 1=1 --"}));
  mockResponse(site,'vulnerable','/api/reports/1002',new URLSearchParams());
  mockResponse(site,'vulnerable','/api/admin',new URLSearchParams({token:Buffer.from('{"role":"admin"}').toString('base64url')}));
  mockResponse(site,'vulnerable','/api/publish',new URLSearchParams(),{visibility:'public'},'POST');
  assert.equal(mockResponse(site,'vulnerable','/api/flag',new URLSearchParams()).json.flag,site.flag);
  assert.equal(mockResponse(site,'secure','/api/reports/1002',new URLSearchParams()).status,403);
  assert.equal(mockResponse(site,'secure','/api/publish',new URLSearchParams(),{visibility:'public'},'POST').json.visibility,'private');
});
test('AI layout and palette cannot inject code or network requests', () => {
  const site=createMockSite({type:'research',layout:'evil" onclick="x',background:'red; background:url(https://evil)',items:[{name:'<script>x</script>',summary:'<img src="https://evil">'}]},['input'],'初級',{});
  const html=mockResponse(site,'secure','/',new URLSearchParams()).html;
  assert.doesNotMatch(html,/<script>|<img|onclick|background:url/);
});
test('public web startup no longer depends on Basic credentials; Lab remains private', async () => {
  for(const path of ['cloud/nginx-web.conf','cloud/nginx.conf','cloud/start-web.sh','cloud/start-cloud.sh']) {
    const text=await readFile(new URL('../../'+path,import.meta.url),'utf8');assert.doesNotMatch(text,/auth_basic|htpasswd|TERMINALBOX_PASSWORD/);
  }
  const build=await readFile(new URL('../../cloudbuild.yaml',import.meta.url),'utf8');assert.match(build,/--no-allow-unauthenticated/);assert.match(build,/INTERNAL_API_TOKEN/);assert.doesNotMatch(build,/TERMINALBOX_PASSWORD/);
});

test('generation sends screenshot as Gemini image; image-only fallback installs type-specific site', async () => {
  const { default: express } = await import('express');
  const { installMockRoutes } = await import('../src/mock-site-routes.js');
  const app=express();app.use(express.json({limit:'3mb'}));
  const session={sessionId:'test'};let installed;let parts;
  installMockRoutes(app,{config:{geminiApiKey:'test',geminiUrl:'https://ai.test',geminiModel:'test'},isWebService:true,isLabService:false,sessionManager:{get:()=>session},terminalBoxSession:async()=>session,labProxy:{requestJson:async(path,payload)=>{installed=payload;return mockSummary(createMockSite(payload.definition,payload.themes,payload.difficulty,payload.source));}}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://ai.test/')) {
      parts=JSON.parse(options.body).contents[0].parts;
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({type:'research',name:'Report Lab',items:[{name:'調査'}]})}]}}]}));
    }
    return original(url,options);
  };
  try {
    const result=await original(`http://127.0.0.1:${server.address().port}/api/mock-site/generate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://not-allowed.example/',screenshot:'data:image/png;base64,iVBORw0KGgo=',themes:['authorization','web'],difficulty:'初級'})});
    assert.equal(result.status,200);const data=await result.json();assert.equal(data.site.definition.type,'research');assert.match(data.site.missions.authorization,/reports/);
    assert.equal(parts[1].inlineData.mimeType,'image/png');assert.equal(parts[1].inlineData.data,'iVBORw0KGgo=');
    assert.equal(installed.source.url,'');assert.ok(!JSON.stringify(installed).includes('iVBORw0KGgo='));
  } finally {globalThis.fetch=original;await new Promise(r=>server.close(r));}
});

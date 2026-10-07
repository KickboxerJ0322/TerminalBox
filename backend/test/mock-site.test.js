import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES,createMockSite,mockResponse,compareMockSite,validateDefinition,mockSummary } from '../src/mock-site.js';
import {publicIPv4,fetchPublicPage} from '../src/mock-site-fetch.js';
const site=()=>createMockSite({name:'Test',products:[{name:'Book',price:1200}]},THEMES,'初級',{});
test('backup key and admin change unlock flag; comparisons do not change progress or display',()=>{
 const s=site();const other=site();const q=new URLSearchParams();
 assert.equal(mockResponse(s,'vulnerable','/api/flag',q).status,403);
 const original=s.definition.name;assert.ok(compareMockSite(s).every(c=>c.blocked));assert.equal(s.solved.size,0);assert.equal(s.definition.name,original);
 const key=mockResponse(s,'vulnerable','/backup/config.json',q).json.adminKey;
 assert.equal(mockResponse(s,'vulnerable','/api/admin/banner',q,{adminKey:key,title:'Updated'},'POST').status,200);
 assert.equal(mockResponse(s,'vulnerable','/api/flag',q).json.flag,s.flag);
 assert.match(mockResponse(s,'vulnerable','/',q).html,/改ざんしました/);assert.equal(s.definition.color,'#b91c1c');assert.notEqual(s.originalDefinition.color,s.definition.color);
 assert.ok(!mockResponse(s,'secure','/',q).html.includes('<h1>改ざんしました</h1>'));
 assert.equal(mockResponse(s,'secure','/backup/config.json',q).status,404);
 assert.equal(mockResponse(s,'secure','/api/admin/banner',q,{adminKey:key,title:'Updated'},'POST').status,403);
 assert.notEqual(other.adminKey,key);assert.match(s.flag,/^TBX\{mock_[0-9a-f]{2}\}$/);
 assert.ok(!JSON.stringify({...mockSummary(s),checks:[]}).includes(key));
});
test('missing or other-session admin keys cannot modify the site',()=>{
 const s=site();const other=site();const q=new URLSearchParams();
 for(const adminKey of ['',other.adminKey])assert.equal(mockResponse(s,'vulnerable','/api/admin/banner',q,{adminKey,title:'Changed'},'POST').status,403);
 assert.equal(s.solved.size,0);
});
test('AI text escaped and styles validated',()=>{
 const d=validateDefinition({name:'<script>alert(1)</script>',color:'red; background:url(https://evil)',products:[{name:'<img onerror=alert(1)>',price:-1}]});
 assert.equal(d.color,'#a32035');const s=createMockSite(d,['auth'],'初級',{});const html=mockResponse(s,'vulnerable','/',new URLSearchParams()).html;
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.equal(s.definition.products[0].price,1);
});
test('URL rejects private/reserved addresses and unsafe schemes',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','198.18.0.1','203.0.113.1','::1','224.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('8.8.8.8'),true);
 for(const url of ['http://example.com','https://user:pass@example.com','https://example.com:3001','https://127.0.0.1'])await assert.rejects(fetchPublicPage(url));
});

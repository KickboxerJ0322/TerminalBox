import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES,createMockSite,mockResponse,compareMockSite,validateDefinition,mockSummary } from '../src/mock-site.js';
import {publicIPv4,fetchPublicPage} from '../src/mock-site-fetch.js';
const site=()=>createMockSite({name:'Test',products:[{name:'Book',price:1200}]},THEMES,'初級',{});
test('all missions required; secure comparisons cannot unlock flag',()=>{
 const s=site();const other=site();assert.equal(mockResponse(s,'vulnerable','/api/flag',new URLSearchParams()).status,403);
 const result=compareMockSite(s);assert.ok(result.every(c=>c.blocked));assert.equal(s.solved.size,0);
 mockResponse(s,'vulnerable','/api/search',new URLSearchParams({q:"' OR 1=1 --"}));
 mockResponse(s,'vulnerable','/api/orders/1002',new URLSearchParams());
 mockResponse(s,'vulnerable','/api/admin',new URLSearchParams({token:Buffer.from('{"role":"admin"}').toString('base64url')}));
 mockResponse(s,'vulnerable','/api/checkout',new URLSearchParams(),{price:1},'POST');
 assert.equal(mockResponse(s,'vulnerable','/api/flag',new URLSearchParams()).json.flag,s.flag);
 assert.equal(mockResponse(s,'secure','/api/flag',new URLSearchParams()).status,403);
 assert.equal(other.solved.size,0);assert.notEqual(other.flag,s.flag);assert.ok(!JSON.stringify(mockSummary(s)).includes(s.flag));
});
test('disabled themes never expose simulated weakness',()=>{
 const s=createMockSite({},['auth'],'初級',{});
 assert.equal(mockResponse(s,'vulnerable','/api/orders/1002',new URLSearchParams()).status,403);
 assert.equal(mockResponse(s,'vulnerable','/api/checkout',new URLSearchParams(),{price:1},'POST').json.paid,1000);
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

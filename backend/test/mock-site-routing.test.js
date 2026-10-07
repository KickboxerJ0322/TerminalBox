import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installMockRoutes } from '../src/mock-site-routes.js';
import { createMockSite } from '../src/mock-site.js';
import { isLabHttpPath } from '../src/lab-proxy.js';
import { readFile } from 'node:fs/promises';
test('private controls and browser/Kali runtime share session state without exposing other sessions',async()=>{
 const a={sessionId:'a',mockSite:createMockSite({},['authorization'],'初級',{})};const b={sessionId:'b',mockSite:createMockSite({},['authorization'],'初級',{})};const sessions=new Map([['a',a],['b',b]]);
 const app=express();app.use(express.json());
 const runtime=installMockRoutes(app,{config:{},isWebService:false,isLabService:true,sessionManager:{get:id=>sessions.get(id)},internalApiSession:async(req,res)=>{if(req.headers['x-terminalbox-internal-token']!=='secret'){res.status(403).end();return null;}return sessions.get(req.headers['x-terminalbox-session']);},runtimePort:0,runtimeHost:'127.0.0.1'});
 const web=app.listen(0,'127.0.0.1');await Promise.all([new Promise(r=>web.once('listening',r)),new Promise(r=>runtime.once('listening',r))]);
 const base=`http://127.0.0.1:${web.address().port}`;const kali=`http://127.0.0.1:${runtime.address().port}`;
 try{
  assert.equal((await fetch(base+'/internal/mock-site',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"status"}'})).status,403);
  assert.equal((await fetch(kali+'/vulnerable/api/orders/1002')).status,404);
  assert.equal((await fetch(kali+'/vulnerable/api/orders/1002',{headers:{'x-terminalbox-session':'a'}})).status,200);
  const control=await fetch(base+'/internal/mock-site',{method:'POST',headers:{'content-type':'application/json','x-terminalbox-session':'a','x-terminalbox-internal-token':'secret'},body:'{"action":"check","answer":"'+a.mockSite.flag+'"}'}).then(r=>r.json());assert.equal(control.correct,true);
  assert.equal((await fetch(kali+'/vulnerable/api/flag',{headers:{'x-terminalbox-session':'b'}})).status,403);
  const previousFlag=a.mockSite.flag;
  const restored=await fetch(base+'/internal/mock-site',{method:'POST',headers:{'content-type':'application/json','x-terminalbox-session':'a','x-terminalbox-internal-token':'secret'},body:'{"action":"reset"}'}).then(r=>r.json());
  assert.equal(restored.site.solved.length,0);assert.notEqual(a.mockSite.flag,previousFlag);assert.equal(b.mockSite.solved.size,0);
  const page=await fetch(base+'/simulation-site/secure/',{headers:{'x-terminalbox-session':'a'}});assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);
 }finally{await Promise.all([new Promise(r=>web.close(r)),new Promise(r=>runtime.close(r))]);}
});
test('cloud proxy exposes simulation but not internal controls',async()=>{
 assert.equal(isLabHttpPath('/simulation-site/secure/'),true);assert.equal(isLabHttpPath('/internal/mock-site'),false);
 const web=await readFile(new URL('../../cloud/nginx-web.conf',import.meta.url),'utf8');const lab=await readFile(new URL('../../cloud/nginx-lab.conf',import.meta.url),'utf8');assert.match(web,/simulation-site/);assert.match(lab,/location = \/internal\/mock-site/);assert.match(lab,/location \/simulation-site\//);
});

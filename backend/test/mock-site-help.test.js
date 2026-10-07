import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSite, mockSummary, mockResponse, THEMES } from '../src/mock-site.js';
import { gemini } from '../src/mock-site-routes.js';

test('copy-only hint commands work end to end for commerce and research',async()=>{
  const { default: express }=await import('express');
  const { installMockRoutes }=await import('../src/mock-site-routes.js');
  const { execFile }=await import('node:child_process');
  const { promisify }=await import('node:util');const execute=promisify(execFile);
  for(const type of ['commerce','research']) {
    const site=createMockSite({type},THEMES,'初級',{});const session={sessionId:'hint-test',mockSite:site};
    const server=installMockRoutes(express(),{config:{},isWebService:false,isLabService:true,sessionManager:{get:id=>id==='hint-test'?session:null},runtimePort:0,runtimeHost:'127.0.0.1'});
    await new Promise(r=>server.once('listening',r));
    try {
      let output='';
      for(const hint of mockSummary(site).hints)for(const step of hint.steps) {
        if(!step.command)continue;
        const command=step.command.replaceAll('http://mocksite:3200',`http://127.0.0.1:${server.address().port}`);
        output=(await execute('bash',['-c',command],{env:{...process.env,TERMINALBOX_SESSION_ID:'hint-test'}})).stdout;
      }
      assert.ok(output.includes(site.flag));assert.equal(site.definition.name,'改ざんしました');
    } finally {await new Promise(r=>server.close(r));}
  }
});
test('empty or truncated AI replies retry, while safety blocks report the actual reason',async()=>{
  const original=globalThis.fetch;const config={geminiApiKey:'test',geminiUrl:'https://test',geminiModel:'test'};
  try {
    let count=0;
    globalThis.fetch=async()=>new Response(JSON.stringify(++count===1?{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{thought:true,text:'thinking'}]}}]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"name":"Recovered"}'}]}}]}));
    assert.equal((await gemini(config,'test',true)).name,'Recovered');assert.equal(count,2);
    globalThis.fetch=async()=>new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}}));
    await assert.rejects(gemini(config,'test'),/安全判定/);
    globalThis.fetch=async()=>new Response('{}');
    await assert.rejects(gemini(config,'test'),/自動再試行/);
  }finally{globalThis.fetch=original;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSite, mockSummary, mockResponse, THEMES } from '../src/mock-site.js';
import { gemini } from '../src/mock-site-routes.js';

test('documented hint commands unlock every selected mission for commerce and research',()=>{
  for(const type of ['commerce','research']) {
    const site=createMockSite({type},THEMES,'上級',{});
    assert.equal(mockResponse(site,'vulnerable','/api/flag',new URLSearchParams()).status,403);
    for(const hint of mockSummary(site).hints)for(const step of hint.steps){
      if(!step.command)continue;
      const path=step.command.match(/http:\/\/mocksite:3200\/vulnerable([^" ]+)/)[1];
      const url=new URL(path,'http://mock.local');
      const data=step.command.match(/-d '([^']+)'/)?.[1];
      mockResponse(site,'vulnerable',url.pathname,url.searchParams,data?Object.fromEntries(new URLSearchParams(data)):{},data?'POST':'GET');
    }
    assert.equal(mockResponse(site,'vulnerable','/api/flag',new URLSearchParams()).json.flag,site.flag);
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

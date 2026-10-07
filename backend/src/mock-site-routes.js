import http from 'node:http';
import { screenshotPart, generationPrompt } from './mock-site-generation.js';
import { fetchPublicPage } from './mock-site-fetch.js';
import { THEMES, createMockSite, mockSummary, mockResponse, compareMockSite } from './mock-site.js';

export async function gemini(config,prompt,json=false,image=null) {
  if(!config.geminiApiKey) throw new Error('Gemini APIキーが設定されていません。');
  for(let attempt=0;attempt<2;attempt++) {
    const r=await fetch(`${config.geminiUrl}/v1beta/models/${config.geminiModel}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':config.geminiApiKey},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...(image?[image]:[])]}],generationConfig:{maxOutputTokens:attempt?16384:8192,...(json?{responseMimeType:'application/json'}:{})}}),signal:AbortSignal.timeout(90000)});
    if(!r.ok) throw new Error(`AIへの通信に失敗しました（${r.status}）。`);
    const data=await r.json();const candidate=data.candidates?.[0];
    if(data.promptFeedback?.blockReason || ['SAFETY','PROHIBITED_CONTENT','RECITATION'].includes(candidate?.finishReason)) throw new Error('AIの安全判定で応答が制限されました。参考画像や入力を見直してください。');
    const text=candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text??'').join('').trim();
    if(text && candidate?.finishReason!=='MAX_TOKENS') {
      try{return json?JSON.parse(text):text;}catch{if(attempt)throw new Error('AIの生成データを読み取れませんでした。再度生成してください。');}
    }
    if(attempt) throw new Error(candidate?.finishReason==='MAX_TOKENS'?'AIの生成量が上限に達しました。再度お試しください。':'AIから表示用の応答を取得できませんでした。自動再試行にも失敗しました。');
  }
}
export function installMockRoutes(app,{config,isWebService,isLabService,labProxy,sessionManager,terminalBoxSession,internalApiSession,runtimePort=3200,runtimeHost='127.0.0.8'}) {
  const control=async(session,action,payload={})=>{
    if(isWebService) return labProxy.requestJson('/internal/mock-site',{action,...payload},session.sessionId);
    if(action==='install'){session.mockSite=createMockSite(payload.definition,payload.themes,payload.difficulty,payload.source);return mockSummary(session.mockSite);}
    const site=session.mockSite;
    if(action==='status')return mockSummary(site);
    if(!site) throw new Error('模擬サイトを先に生成してください。');
    if(action==='reset'){session.mockSite=createMockSite(site.originalDefinition,THEMES,'初級',site.source);return {site:mockSummary(session.mockSite)};}
    if(action==='check'){const correct=site.themes.every(t=>site.solved.has(t))&&payload.answer.trim()===site.flag;if(correct)site.cleared=true;return {correct,cleared:site.cleared};}
    if(action==='unclear'){site.cleared=false;return {cleared:false};}
    if(action==='compare')return {checks:compareMockSite(site)};
    throw new Error('不明な操作です。');
  };
  app.post('/internal/mock-site',async(req,res)=>{try{const session=await internalApiSession(req,res);if(!session)return;const b=req.body; if(b.action==='install' && (!Array.isArray(b.themes)||!b.themes.length||b.themes.some(t=>!THEMES.includes(t))))throw new Error('テーマが不正です');res.json(await control(session,b.action,b));}catch(e){res.status(400).json({error:e.message});}});
  if(isWebService){
    app.get('/api/mock-site',async(req,res)=>{try{const s=await terminalBoxSession(req,res);res.json({site:await control(s,'status')});}catch(e){res.status(400).json({error:e.message});}});
    app.post('/api/mock-site/:action',async(req,res)=>{
      let session; let ownsGeneration = false; let generationEpoch;
      try{
        session=await terminalBoxSession(req,res);const action=req.params.action;
        if(action==='generate'){
          if(session.mockGenerating) return res.status(409).json({error:'生成中です。'});
          if((session.mockGenerationCount??0)>=3) return res.status(429).json({error:'模擬サイトの生成は1セッション3回までです。'});
          const themes=THEMES;const difficulty='初級';
          const image = screenshotPart(req.body.screenshot);
          generationEpoch = session.mockEpoch ?? 0;
          ownsGeneration = true; session.mockGenerating=true;session.mockGenerationCount=(session.mockGenerationCount??0)+1;
          let source;
          try { source=await fetchPublicPage(req.body.url); }
          catch (error) { if (!image) throw error; source={url:'',title:'スクショを参考に生成',text:'URLを取得できなかったため、画像のみを参考にしてください。'}; }
          const definition=await gemini(config,generationPrompt(source),true,image);
          if ((session.mockEpoch ?? 0) !== generationEpoch || sessionManager.get(session.sessionId) !== session) throw new Error('セッションが初期化・終了されました。再度生成してください。');
          const site=await control(session,'install',{definition,themes:[...new Set(themes)],difficulty,source:{url:source.url,title:source.title}});
          res.json({site});return;
        }
        if(!['check','compare','reset','unclear'].includes(action)) return res.status(404).json({error:'Not found'});
        res.json(await control(session,action,{answer:String(req.body.answer??'').slice(0,200)}));
      }catch(e){res.status(400).json({error:e.message});}finally{if(session && ownsGeneration && (session.mockEpoch ?? 0) === generationEpoch)session.mockGenerating=false;}
    });
  }
  const serve=async(req,res,session,path)=>{
    if(!session?.mockSite){res.statusCode=404;res.end('模擬サイトを先に生成してください');return;}
    const url=new URL(path,'http://mock.local');const parts=url.pathname.split('/').filter(Boolean);const mode=parts.shift();
    if(!['vulnerable','secure'].includes(mode)){res.statusCode=404;res.end('版を指定してください');return;}
    let body={}; if(req.method==='POST'){
      let text='';for await(const chunk of req){text+=chunk;if(text.length>16000){res.statusCode=413;res.end();return;}}
      try{body=(req.headers['content-type']??'').includes('application/json')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text));}catch{res.statusCode=400;res.end();return;}
    }
    const result=mockResponse(session.mockSite,mode,'/'+parts.join('/'),url.searchParams,body,req.method);
    res.statusCode=result.status;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'");res.setHeader('Content-Type',result.html?'text/html; charset=utf-8':'application/json');res.end(result.html??JSON.stringify(result.json));
  };
  if(isLabService){
    app.use('/simulation-site',async(req,res)=>{try{const id=req.headers['x-terminalbox-session'];await serve(req,res,sessionManager.get(id),req.url);}catch{res.status(400).end('リクエストが不正です');}});
    const server=http.createServer(async(req,res)=>{try{await serve(req,res,sessionManager.get(req.headers['x-terminalbox-session']),req.url);}catch{res.statusCode=400;res.end('リクエストが不正です');}});
    server.listen(runtimePort,runtimeHost);
    return server;
  }
}

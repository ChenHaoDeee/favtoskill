import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { douyinShareUrl } from '../server/imports.js';

test('text import previews first, isolates workspaces, deduplicates, validates category and supports undo without resurrection',async()=>{
  const app=await createApp(createStore(':memory:'),createStore(':memory:'));
  const post=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,payload});
  try{
    const preview=(await post('/api/imports/preview',{kind:'text',title:'新方法',text:'先明确目标，再记录行动和结果。'})).json();
    assert.equal(preview.status,'preview');assert.equal(preview.item.summary,'');assert.equal(preview.item.completeness,'fragment');
    assert.deepEqual((await app.inject('/api/knowledge')).json().items,[]);
    assert.equal((await app.inject(`/api/demo/imports/preview/${preview.id}`)).statusCode,404);
    assert.equal((await post(`/api/imports/preview/${preview.id}/confirm`,{categoryId:'missing'})).statusCode,400);
    const path=`/api/imports/preview/${preview.id}/confirm`;
    const [a,b]=await Promise.all([post(path,{}),post(path,{})]);
    const saved=a.json();assert.equal(saved.knowledgeId,b.json().knowledgeId);assert.ok(saved.undoId);
    const duplicate=(await post('/api/imports/preview',{kind:'text',title:'不同标题',text:preview.item.originalText})).json();
    const match=(await post(`/api/imports/preview/${duplicate.id}/confirm`,{})).json();assert.equal(match.duplicate,true);assert.equal(match.knowledgeId,saved.knowledgeId);
    assert.equal((await app.inject('/api/knowledge')).json().items.length,1);assert.equal((await app.inject('/api/demo/knowledge')).json().items.length,0);
    assert.equal((await post(`/api/undo/${saved.undoId}`,{})).statusCode,200);
    assert.equal((await post(path,{})).statusCode,409);assert.equal((await app.inject('/api/knowledge')).json().items.length,0);
    assert.equal((await post('/api/imports/preview',{kind:'text',title:'空',text:'  '})).statusCode,400);
  }finally{await app.close()}
});

test('import previews survive restart without saving unconfirmed data',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fav-import-'));const file=join(dir,'store.sqlite');let app=await createApp(createStore(file));
  try{
    const draft=(await app.inject({method:'POST',url:'/api/imports/preview',payload:{kind:'text',title:'重启测试',text:'只保留用户提供的内容'}})).json();
    await app.close();app=await createApp(createStore(file));
    assert.equal((await app.inject(`/api/imports/preview/${draft.id}`)).json().status,'preview');
    assert.equal((await app.inject('/api/knowledge')).json().items.length,0);
    const saved=await app.inject({method:'POST',url:`/api/imports/preview/${draft.id}/confirm`,payload:{}});assert.equal(saved.statusCode,200);
    await app.close();app=await createApp(createStore(file));
    assert.equal((await app.inject('/api/knowledge')).json().items.length,1);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});

test('TikHub adapter is gated, restricts URLs, handles unavailable posts and stores captions without claiming transcription',async()=>{
  const before=process.env.TIKHUB_API_KEY;delete process.env.TIKHUB_API_KEY;
  const app=await createApp(createStore(':memory:'));let calls=0,reply:unknown={code:200,data:{aweme_detail:{aweme_id:'123456789',desc:'视频中的三种项目表达方法'}}};let status=200;
  const provider=mock.method(globalThis,'fetch',async(url:unknown,options?:RequestInit)=>{calls++;assert.match(String(url),/^https:\/\/api\.tikhub\.io\/api\/v1\/douyin\/web\/fetch_one_video_by_share_url\?/);assert.equal(options?.redirect,'error');assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer fixture-only');return new Response(JSON.stringify(reply),{status})});
  const preview=()=>app.inject({method:'POST',url:'/api/imports/preview',payload:{kind:'link',shareText:'看看这个 https://v.douyin.com/abc123/ 内容'}});
  try{
    assert.equal((await preview()).json().error.code,'IMPORT_NOT_CONFIGURED');assert.equal(calls,0);
    for(const url of ['http://127.0.0.1/video/1','https://v.douyin.com.evil.test/a','https://user:pass@v.douyin.com/abc/','https://www.douyin.com/user/123','https://v.douyin.com:8443/a','https://www.douyin.com/video/1 https://v.douyin.com/a'])assert.throws(()=>douyinShareUrl(url));
    process.env.TIKHUB_API_KEY='fixture-only';const response=await preview();assert.equal(response.statusCode,200);
    const draft=response.json();assert.equal(draft.item.provenance.textKind,'post_caption');assert.match(draft.warnings[0],/未提取视频语音/);assert.equal((await app.inject('/api/knowledge')).json().items.length,0);
    assert.equal((await app.inject({method:'POST',url:`/api/imports/preview/${draft.id}/confirm`,payload:{}})).statusCode,200);
    const again=(await preview()).json();const saved=(await app.inject({method:'POST',url:`/api/imports/preview/${again.id}/confirm`,payload:{}})).json();assert.equal(saved.duplicate,true);
    reply={code:200,data:null};assert.equal((await preview()).json().error.code,'IMPORT_CONTENT_UNAVAILABLE');
    status=401;assert.equal((await preview()).json().error.code,'IMPORT_PROVIDER_ERROR');
    status=200;reply={code:403,data:null};assert.equal((await preview()).json().error.code,'IMPORT_PROVIDER_ERROR');
    assert.equal((await app.inject('/api/knowledge')).json().items.length,1);
    const capabilities=(await app.inject('/api/capabilities')).json();assert.equal(capabilities.imports.douyin.configured,true);assert.equal(capabilities.imports.videoTranscription,false);assert.ok(!JSON.stringify(capabilities).includes('fixture-only'));
  }finally{provider.mock.restore();await app.close();if(before===undefined)delete process.env.TIKHUB_API_KEY;else process.env.TIKHUB_API_KEY=before}
});

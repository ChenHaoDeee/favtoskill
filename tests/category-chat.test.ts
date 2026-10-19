import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';
import { retrieve } from '../server/workflows.js';

test('folder overview shortcuts retrieve scoped records without keyword overlap or unrelated fallback',async()=>{
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  try{
    for(const categoryId of ['game','tech','food','unfiled']){
      for(const query of ['这个分类有哪些实用方法？','总结这个分类','查找这个分类里的内容']){
        const hits=retrieve(demo,query,{page:'knowledge',categoryId});assert.ok(hits.length,categoryId+query);
        assert.ok(hits.every(h=>categoryId==='unfiled'?!h.item.categoryId:h.item.categoryId===categoryId));
        const result=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:query,context:{page:'knowledge',categoryId},mode:'demo'}});
        assert.equal(result.statusCode,200);assert.ok(result.json().message.sources.length);assert.doesNotMatch(result.json().message.content,/没有找到相关收藏/);
      }
    }
    assert.deepEqual(retrieve(demo,'qzzzzneverfound123',{page:'knowledge',categoryId:'game'}),[]);
    assert.deepEqual(retrieve(demo,'这个分类有哪些实用方法？',{page:'knowledge',categoryId:'missing'}),[]);
    assert.deepEqual(retrieve(demo,'这个分类有哪些量子通讯技术？',{page:'knowledge',categoryId:'game'}),[]);
  }finally{await app.close()}
});

test('real folder overview supplies current folder evidence and does not rewrite it as a follow-up',async()=>{
  const keys=['AI_API_KEY','AI_MODEL','AI_EMBEDDING_MODEL'] as const;const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.AI_API_KEY='test-only';process.env.AI_MODEL='test-model';delete process.env.AI_EMBEDDING_MODEL;
  const demo=createStore(':memory:');seedDemo(demo);const source=demo.knowledge().find(k=>k.categoryId==='game')!;
  const app=await createApp(createStore(':memory:'),demo);let request='';
  const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{request=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'根据分类内的资料整理。',citations:[source.id],suggestSkill:true})}}]}))});
  try{
    const first=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'这个分类有哪些实用方法？',context:{page:'knowledge',categoryId:'game'},mode:'real'}});
    assert.equal(first.statusCode,200);assert.deepEqual(first.json().message.sources,[source.id]);assert.match(request,/原文片段/);
    const second=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'这个分类有哪些实用方法？',conversationId:first.json().conversationId,context:{page:'knowledge',categoryId:'game'},mode:'real'}});
    assert.equal(second.statusCode,200);assert.equal(provider.mock.callCount(),2);
    const system=JSON.parse(request).messages[0].content;assert.ok(!system.includes('[tech_favorites--'));
  }finally{provider.mock.restore();await app.close();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}}
});

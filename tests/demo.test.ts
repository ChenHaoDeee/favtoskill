import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';
import type { Knowledge,Skill } from '../shared/contracts.js';

test('demo workspace: seed, grounded retrieval, Skill lifecycle, management and undo',async()=>{
  const personal=createStore(':memory:'),demo=createStore(':memory:');seedDemo(demo);seedDemo(demo);
  const app=await createApp(personal,demo);
  const call=(method:'POST'|'PATCH'|'DELETE'|'GET',path:string,payload?:unknown)=>app.inject({method,url:'/api/demo'+path,payload:payload as never});
  try{
    assert.equal(demo.knowledge().length,36);assert.equal(demo.categories().length,7);assert.equal(demo.skills().length,18);
    assert.equal(new Set(demo.knowledge().map(k=>k.id)).size,36);
    assert.equal(demo.knowledge().filter(k=>!k.categoryId).length,3);
    assert.ok(demo.knowledge().every(k=>k.sourcePlatform==='抖音'));
    assert.equal(personal.knowledge().length,0);assert.deepEqual((await app.inject('/api/knowledge')).json(),{items:[]});
    const chat=await call('POST','/chat',{content:'关键词联想陷阱',context:{page:'knowledge'},mode:'demo'});
    assert.equal(chat.statusCode,200);assert.match(chat.json().message.content,/未调用模型/);assert.ok(chat.json().message.sources.length>0);
    for(const id of chat.json().message.sources)assert.ok(demo.knowledge().some(k=>k.id===id));
    assert.equal((await call('GET',`/conversations/${chat.json().conversationId}/messages`)).json().items.length,2);
    const noHit=await call('POST','/chat',{content:'qzzzzunrelated987654',context:{page:'knowledge'},mode:'demo'});assert.deepEqual(noHit.json().message.sources,[]);
    const sources=demo.knowledge().filter(k=>k.categoryId==='tech').slice(0,2).map(k=>k.id);
    const response=await call('POST','/skills/draft',{goal:'AI工具入门方法',knowledgeIds:sources,mode:'demo'});assert.equal(response.statusCode,200);const draft=response.json().draft;
    assert.equal(draft.origin,'template');assert.ok(draft.steps.some((s:string)=>s.includes('参考')));
    assert.equal((await call('POST','/skills/draft',{goal:'目标',knowledgeIds:['missing'],mode:'demo'})).statusCode,400);
    const save=await call('POST','/skills',{draft,origin:'template'});assert.equal(save.statusCode,200);const saved=save.json().item as Skill;
    assert.ok(demo.skills().some(s=>s.id===saved.id));assert.equal(personal.skills().length,0);
    const edited={...draft,name:'已编辑的AI学习助手',steps:['只给出三条有来源的建议。']};assert.equal((await call('PATCH',`/skills/${saved.id}`,edited)).statusCode,200);
    const trial=await call('POST','/skills/trial',{draft:edited,input:'我刚开始学习AI',mode:'demo'});assert.equal(trial.statusCode,200);assert.match(trial.json().output,/只给出三条/);
    const blocked=await call('POST','/skills/trial',{draft:{...edited,externalDependencies:['第三方应用权限']},input:'执行',mode:'demo'});assert.equal(blocked.statusCode,422);
    const exportResult=await call('GET',`/skills/${saved.id}/export`);assert.equal(exportResult.statusCode,200);assert.equal(exportResult.json().bundle.references.length,2);assert.match(exportResult.json().markdown,/MIT License/);assert.match(exportResult.json().markdown,/外部平台兼容性未经验证/);
    const item=demo.knowledge().find(k=>k.id===sources[0])!;
    assert.equal((await call('PATCH',`/knowledge/${item.id}`,{categoryId:'not-a-category'})).statusCode,400);
    const move=await call('PATCH',`/knowledge/${item.id}`,{categoryId:null});assert.equal(move.statusCode,200);assert.equal(demo.knowledge().find(k=>k.id===item.id)?.categoryId,null);
    const plan=(await call('POST','/organize/plans',{mode:'demo'})).json();
    const unfiledPlan=await call('POST','/organize/plans',{mode:'demo',categoryId:'unfiled'});
    assert.equal(unfiledPlan.statusCode,200);assert.ok(unfiledPlan.json().duplicates.every((pair:{firstId:string;secondId:string})=>demo.knowledge().some(k=>!k.categoryId&&(k.id===pair.firstId||k.id===pair.secondId))));
    assert.ok(unfiledPlan.json().moves.every((m:{knowledgeId:string})=>demo.knowledge().some(k=>k.id===m.knowledgeId&&!k.categoryId)));
    assert.equal((await call('POST','/organize/plans',{mode:'demo',categoryId:'food'})).statusCode,200);
    const newer=await call('PATCH',`/knowledge/${item.id}`,{title:item.title+'（测试）'});assert.equal(newer.statusCode,200);
    assert.equal((await call('POST',`/organize/plans/${plan.id}/apply`,{confirmed:true,moves:plan.moves})).statusCode,409);
    const undoNew=await call('POST',`/undo/${newer.json().undoId}`,{});assert.equal(undoNew.statusCode,200);
    assert.equal((await call('POST',`/undo/${move.json().undoId}`,{})).statusCode,409); // cannot overwrite newer work
    const newPlan=(await call('POST','/organize/plans',{mode:'demo'})).json();
    assert.equal((await call('POST',`/organize/plans/${newPlan.id}/apply`,{moves:newPlan.moves})).statusCode,400);
    const applied=await call('POST',`/organize/plans/${newPlan.id}/apply`,{confirmed:true,moves:newPlan.moves});assert.equal(applied.statusCode,200);
    assert.equal((await call('POST',`/undo/${applied.json().undoId}`,{})).statusCode,200);
    const deleted=await call('DELETE',`/knowledge/${item.id}`,{confirmed:true});assert.equal(deleted.statusCode,200);
    assert.equal((await call('GET',`/skills/${saved.id}/export`)).statusCode,409);
    assert.equal((await call('POST',`/undo/${deleted.json().undoId}`,{})).statusCode,200);
    const removedCategory=await call('DELETE','/categories/tech',{confirmed:true});assert.equal(removedCategory.statusCode,200);assert.ok(!demo.knowledge().some(k=>k.categoryId==='tech'));assert.equal((await call('POST',`/undo/${removedCategory.json().undoId}`,{})).statusCode,200);
    const duplicate:Knowledge={...item,id:'duplicate-test'};demo.mutate(()=>{demo.putKnowledge(duplicate)});
    const reminders=(await call('GET','/suggestions')).json().items;const reminder=reminders.find((n:{kind:string})=>n.kind==='duplicate');assert.ok(reminder);
    assert.equal((await call('POST',`/suggestions/${reminder.id}/dismiss`,{})).statusCode,200);assert.ok(!(await call('GET','/suggestions')).json().items.some((n:{id:string})=>n.id===reminder.id));
  }finally{await app.close()}
});

test('real AI path sends source text, rejects invented citations, and has no demo fallback',async()=>{
  const key=process.env.AI_API_KEY,model=process.env.AI_MODEL;
  process.env.AI_API_KEY='test-not-a-real-key';process.env.AI_MODEL='test-model';
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  let providerBody='';const source=demo.knowledge().find(k=>k.title.includes('底层逻辑'))!;
  const fake=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{providerBody=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'依据提供的片段。',citations:[source.id],suggestSkill:true})}}]}),{status:200})});
  try{
    const result=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'关键词联想陷阱',mode:'real',context:{page:'knowledge',knowledgeId:source.id}}});assert.equal(result.statusCode,200);assert.match(providerBody,/关键词联想陷阱/);assert.match(providerBody,/原文片段/);assert.equal(result.json().mode,'real');
    fake.mock.mockImplementation(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"answer":"虚构回答","citations":["invented"],"suggestSkill":false}'}}]}),{status:200}));
    const invalid=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'关键词联想陷阱',mode:'real',context:{page:'knowledge'}}});assert.equal(invalid.statusCode,502);
    fake.mock.mockImplementation(async()=>new Response('unavailable',{status:503}));
    const failed=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'关键词联想陷阱',mode:'real',context:{page:'knowledge'}}});assert.equal(failed.statusCode,503);assert.equal(failed.json().error.code,'AI_PROVIDER_ERROR');
    delete process.env.AI_API_KEY;
    const missing=await app.inject({method:'POST',url:'/api/demo/chat',payload:{content:'关键词联想陷阱',mode:'real',context:{page:'knowledge'}}});assert.equal(missing.json().error.code,'AI_NOT_CONFIGURED');
  }finally{fake.mock.restore();await app.close();if(key===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=key;if(model===undefined)delete process.env.AI_MODEL;else process.env.AI_MODEL=model}
});


test('demo source migration preserves user edits and runs only when needed',()=>{
  const store=createStore(':memory:');
  try{
    seedDemo(store);const [legacy,custom]=store.knowledge();
    store.mutate(()=>{store.putKnowledge({...legacy,title:'用户改过的标题',categoryId:null,sourcePlatform:'旧项目演示资料'});store.putKnowledge({...custom,sourcePlatform:'小红书'})});
    const before=store.revision();seedDemo(store);
    assert.equal(store.knowledge().find(k=>k.id===legacy.id)?.sourcePlatform,'抖音');
    assert.equal(store.knowledge().find(k=>k.id===legacy.id)?.title,'用户改过的标题');
    assert.equal(store.knowledge().find(k=>k.id===legacy.id)?.categoryId,null);
    assert.equal(store.knowledge().find(k=>k.id===custom.id)?.sourcePlatform,'小红书');
    assert.equal(store.revision(),before+1);seedDemo(store);assert.equal(store.revision(),before+1);
  }finally{store.db.close()}
});


test('unclassified demo examples migrate once and preserve subsequent user classification',()=>{
  const store=createStore(':memory:');
  try{
    seedDemo(store);const sample=store.knowledge().find(k=>k.id==='tech_favorites--ai_05')!;
    const changed=store.knowledge().find(k=>k.id==='food_favorites--food_05')!;
    store.db.prepare("DELETE FROM state WHERE key='unfiled_examples_v1'").run();
    store.mutate(()=>{store.putKnowledge({...sample,categoryId:'tech'});store.putKnowledge({...changed,title:'用户编辑的收藏',categoryId:'food',updatedAt:new Date().toISOString()})});
    seedDemo(store);
    assert.equal(store.knowledge().find(k=>k.id===sample.id)?.categoryId,null);
    assert.equal(store.knowledge().find(k=>k.id===changed.id)?.categoryId,'food');
    store.mutate(()=>store.putKnowledge({...sample,categoryId:'tech',updatedAt:new Date().toISOString()}));
    const revision=store.revision();seedDemo(store);
    assert.equal(store.knowledge().find(k=>k.id===sample.id)?.categoryId,'tech');
    assert.equal(store.revision(),revision);assert.equal(store.knowledge().length,36);
  }finally{store.db.close()}
});

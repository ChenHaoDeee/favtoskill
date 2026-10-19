import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('useful category overview caches by content, isolates scope, updates after edits and never fakes provider success',async()=>{
  const keys=['AI_API_KEY','AI_MODEL'] as const;const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.AI_API_KEY='test-only';process.env.AI_MODEL='test-model';
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  const call=(id:string,mode='real')=>app.inject({method:'POST',url:`/api/demo/categories/${id}/overview`,payload:{mode}});
  let body='';
  const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{body=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({overview:'保存了AI工具使用与提示词调整方法，可在选择工具或尝试图像生成时回顾具体操作。'})}}]}))});
  try{
    const first=await Promise.all([call('tech'),call('tech')]);assert.ok(first.every(r=>r.statusCode===200));assert.equal(provider.mock.callCount(),1,'deduplicate concurrent requests');
    assert.match(body,/使用场景/);const references=JSON.parse(JSON.parse(body).messages[1].content).references;
    assert.ok(references.every((r:{id:string})=>demo.knowledge().some(k=>k.id===r.id&&k.categoryId==='tech')));
    await call('tech');assert.equal(provider.mock.callCount(),1,'cache reused');
    const item=demo.knowledge().find(k=>k.categoryId==='tech')!;demo.mutate(()=>demo.putKnowledge({...item,title:'用户新标题'}));await call('tech');assert.equal(provider.mock.callCount(),2);
    assert.equal((await call('missing')).statusCode,404);
    assert.equal((await call('tech','demo')).json().mode,'demo');assert.equal(provider.mock.callCount(),2);
    provider.mock.mockImplementation(async()=>new Response('unavailable',{status:503}));assert.equal((await call('food')).statusCode,503);
    assert.ok(!demo.db.prepare("SELECT value FROM state WHERE key='category_overview_v1:food'").get());
    const revision=demo.revision();seedDemo(demo);assert.equal(demo.revision(),revision);
    assert.ok(demo.knowledge().every(k=>k.sourcePlatform==='抖音'));assert.ok(demo.knowledge().some(k=>k.demoPlatform==='小红书'));assert.ok(demo.knowledge().some(k=>k.demoPlatform==='B站'));
  }finally{provider.mock.restore();await app.close();for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}}
});

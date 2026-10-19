import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('knowledge analysis uses original evidence, caches, preserves originals and reports failures',async()=>{
  const before={key:process.env.AI_API_KEY,model:process.env.AI_MODEL};process.env.AI_API_KEY='test-only';process.env.AI_MODEL='test-model';
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);const item=demo.knowledge()[0];let body='';
  const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{body=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'依据原文提炼的摘要',points:[{title:'关键方法',description:'原文中的做法说明'}]})}}]}))});
  const call=(id=item.id,mode='real')=>app.inject({method:'POST',url:`/api/demo/knowledge/${id}/analysis`,payload:{mode}});
  try{
    const initial=JSON.stringify(item);const responses=await Promise.all([call(),call()]);assert.ok(responses.every(r=>r.statusCode===200));assert.equal(provider.mock.callCount(),1);
    const input=JSON.parse(JSON.parse(body).messages[1].content);assert.equal(input.originalText,item.originalText.slice(0,12000));assert.equal(responses[0].json().points.length,1);assert.equal(JSON.stringify(demo.knowledge().find(k=>k.id===item.id)),initial);
    await call();assert.equal(provider.mock.callCount(),1);assert.equal((await call('missing')).statusCode,404);
    assert.equal((await call(item.id,'demo')).json().mode,'demo');assert.equal(provider.mock.callCount(),1);
    demo.mutate(()=>demo.putKnowledge({...item,originalText:item.originalText+'补充原文'}));await call();assert.equal(provider.mock.callCount(),2);
    const blank={...item,id:'blank',originalText:''};demo.putKnowledge(blank);assert.equal((await call(blank.id)).statusCode,422);
    const other=demo.knowledge().find(k=>k.id!==item.id&&k.id!==blank.id)!;provider.mock.mockImplementation(async()=>new Response('failed',{status:503}));assert.equal((await call(other.id)).statusCode,503);assert.ok(!demo.db.prepare('SELECT value FROM state WHERE key=?').get('knowledge_analysis_v1:'+other.id));
  }finally{provider.mock.restore();await app.close();if(before.key===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=before.key;if(before.model===undefined)delete process.env.AI_MODEL;else process.env.AI_MODEL=before.model}
});

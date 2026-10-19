import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('AI readiness, conversation-to-Skill context, edits, trial and provider errors',async()=>{
  const keys=['AI_API_KEY','AI_MODEL','AI_EMBEDDING_MODEL'] as const;
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  delete process.env.AI_API_KEY;delete process.env.AI_EMBEDDING_MODEL;process.env.AI_MODEL='test-model';
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  const call=(path:string,payload:unknown)=>app.inject({method:'POST',url:'/api/demo'+path,payload:payload as never});
  let body='';let reply='OK';
  const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{body=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:reply}}]}))});
  try{
    assert.equal((await call('/ai/check',{})).json().error.code,'AI_NOT_CONFIGURED');assert.equal(provider.mock.callCount(),0);
    process.env.AI_API_KEY='not-a-real-secret';
    const health=(await app.inject('/api/demo/health')).json();assert.equal(health.model,'test-model');assert.equal(health.embeddingConfigured,false);assert.ok(!JSON.stringify(health).includes('not-a-real-secret'));
    assert.equal((await call('/ai/check',{})).json().ok,true);
    const chat=await call('/chat',{content:'帮我总结最近收藏的内容',mode:'demo',context:{page:'knowledge'}});
    assert.match(chat.json().message.content,/36 条资料中的 8 条片段/);
    const source=demo.knowledge()[0];
    const initial=await call('/skills/draft',{goal:'我的任务',knowledgeIds:[source.id],mode:'demo'});
    const edited={...initial.json().draft,name:'保留手动名称',steps:['手动添加的步骤'],scenarios:['入门场景']};
    const adjusted=await call('/skills/draft',{goal:'我的任务',knowledgeIds:[source.id],mode:'demo',currentDraft:edited,adjustment:'再简洁一点'});
    assert.equal(adjusted.json().draft.name,edited.name);assert.deepEqual(adjusted.json().draft.steps,edited.steps);
    reply=JSON.stringify({...edited,origin:undefined});
    const real=await call('/skills/draft',{goal:'我的任务',knowledgeIds:[source.id],mode:'real',currentDraft:edited,adjustment:'再简洁一点',conversationId:chat.json().conversationId});
    assert.equal(real.statusCode,200);assert.match(body,/手动添加的步骤/);assert.match(body,/帮我总结最近收藏的内容/);assert.match(body,/再简洁一点/);
    const stored=await call('/skills',{draft:real.json().draft,origin:'ai'});assert.equal(stored.statusCode,200);
    reply='这是模型执行的任务结果';
    const trial=await call('/skills/trial',{draft:real.json().draft,input:'我的示例任务',mode:'real'});assert.equal(trial.json().output,reply);assert.match(body,/手动添加的步骤/);assert.match(body,/我的示例任务/);
    assert.equal((await app.inject('/api/demo/skills/'+stored.json().item.id+'/export')).statusCode,200);
    reply=JSON.stringify({...edited,knowledgeIds:[source.id,source.id]});assert.equal((await call('/skills/draft',{goal:'任务',knowledgeIds:[source.id],mode:'real'})).statusCode,502);
    provider.mock.mockImplementation(async()=>new Response('bad gateway'));
    assert.equal((await call('/ai/check',{})).json().error.code,'INVALID_AI_RESPONSE');
  }finally{provider.mock.restore();await app.close();for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]}}
});

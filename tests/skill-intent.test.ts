import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('conversational Skill intent clarifies only when needed, persists turns and generates after source confirmation',async()=>{
  const before={key:process.env.AI_API_KEY,model:process.env.AI_MODEL};process.env.AI_API_KEY='test-only';process.env.AI_MODEL='test-model';
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  const post=(path:string,payload:unknown)=>app.inject({method:'POST',url:'/api/demo'+path,payload:payload as never});
  let answer:unknown={ready:false,goal:'',reply:'你希望它重复帮你完成什么任务？',options:['优化AI生图提示词']};let request='';
  const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{request=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]}))});
  try{
    const vague=await post('/skills/intent',{messages:[{role:'user',content:'帮我创建一个 Skill'}],context:{page:'knowledge',categoryId:'tech'},mode:'real'});assert.equal(vague.statusCode,200);assert.equal(vague.json().ready,false);const conversationId=vague.json().conversationId;assert.equal(demo.messages(conversationId).length,2);assert.match(request,/年度好用AI/);
    answer={ready:true,goal:'根据收藏优化AI生图提示词',reply:'目标明确，接下来确认要引用的收藏。',options:[]};
    const ready=await post('/skills/intent',{conversationId,messages:[{role:'user',content:'帮我创建一个 Skill'},{role:'assistant',content:'你希望完成什么任务？'},{role:'user',content:'根据收藏优化AI生图提示词'}],context:{page:'knowledge'},mode:'real'});assert.equal(ready.json().ready,true);assert.equal(demo.messages(conversationId).length,4);assert.equal(demo.skills().length,18,'intent does not create a Skill');
    const source=demo.knowledge().find(k=>k.categoryId==='tech')!;
    answer={name:'提示词助手',description:'根据原文方法优化提示词',scenarios:['AI生图'],inputRequirements:'原始提示词',steps:['参考原文，检查关键词'],outputFormat:'优化后的提示词',knowledgeIds:[source.id],limitations:['仅依据提供资料'],externalDependencies:[]};
    const generated=await post('/skills/draft',{goal:ready.json().goal,knowledgeIds:[source.id],conversationId,recordConversation:true,mode:'real'});assert.equal(generated.statusCode,200);assert.equal(demo.messages(conversationId).length,6);assert.match(demo.messages(conversationId)[5].content,/提示词助手/);assert.equal(demo.skills().length,18,'draft still requires explicit save');
    let repairs=0;const validDraft=answer;provider.mock.mockImplementation(async(_url:unknown,options?:RequestInit)=>{assert.equal(JSON.parse(String(options?.body)).response_format.type,'json_object');repairs++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(repairs===1?{...(validDraft as object),inputRequirements:['错误数组']}:validDraft)}}]}))});
    const repaired=await post('/skills/draft',{goal:'优化提示词',knowledgeIds:[source.id],mode:'real'});assert.equal(repaired.statusCode,200);assert.equal(repairs,2,'one bounded repair for model schema mismatch');
    provider.mock.mockImplementation(async()=>new Response(JSON.stringify({choices:[{message:{content:'执行结果：优化后的提示词。'}}]})));
    const trial=await post('/skills/trial',{draft:validDraft,input:'原始提示词',mode:'real',conversationId,recordConversation:true});assert.equal(trial.statusCode,200);assert.equal(demo.messages(conversationId).length,8);assert.match(demo.messages(conversationId)[7].content,/优化后的提示词/);
    assert.equal((await post('/skills/intent',{messages:[{role:'assistant',content:'不能作为用户目标'}],context:{page:'knowledge'},mode:'real'})).statusCode,400);
    provider.mock.mockImplementation(async()=>new Response('failed',{status:503}));const count=demo.messages(conversationId).length;assert.equal((await post('/skills/intent',{conversationId,messages:[{role:'user',content:'新目标'}],context:{page:'knowledge'},mode:'real'})).statusCode,503);assert.equal(demo.messages(conversationId).length,count);
  }finally{provider.mock.restore();await app.close();if(before.key===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=before.key;if(before.model===undefined)delete process.env.AI_MODEL;else process.env.AI_MODEL=before.model}
});

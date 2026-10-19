import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('demo data defaults to real AI; unified assistant routes ordinary questions during Skill creation without changing records',async()=>{
  const before={key:process.env.AI_API_KEY,model:process.env.AI_MODEL};process.env.AI_API_KEY='test-only';process.env.AI_MODEL='test-model';
  const store=createStore(':memory:');seedDemo(store);const app=await createApp(createStore(':memory:'),store);
  let calls=0,content:unknown={ready:false,goal:'',reply:'希望这个助手帮你完成什么任务？',options:[]};
  const provider=mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}))});
  const post=(path:string,payload:unknown)=>app.inject({method:'POST',url:'/api/demo'+path,payload:payload as never});
  try{
    const intent=await post('/skills/intent',{messages:[{role:'user',content:'根据收藏创建 Skill'}],context:{page:'knowledge'}});
    assert.equal(intent.statusCode,200,intent.body);assert.equal(calls,1,'omitting mode must call the configured provider, even in demo workspace');
    const id=intent.json().conversationId,count=store.messages(id).length;
    content={intent:'chat'};const route=await post('/assistant/intent',{stage:'goal',goal:'',text:'先不创建，什么是RAG？'});assert.equal(route.statusCode,200);assert.equal(route.json().intent,'chat');assert.equal(calls,2);assert.equal(store.messages(id).length,count,'classification does not create extra messages');
    content={intent:'skill'};assert.equal((await post('/assistant/intent',{stage:'sources',goal:'优化提示词',text:'确认这些收藏'})).json().intent,'skill');
    content={intent:'trial'};assert.equal((await post('/assistant/intent',{stage:'trial',goal:'优化提示词',text:'帮我优化这个提示词：海边日落'})).json().intent,'trial');
    const beforeDemo=calls;await post('/skills/intent',{messages:[{role:'user',content:'根据收藏创建 Skill'}],context:{page:'knowledge'},mode:'demo'});assert.equal(calls,beforeDemo,'offline mode remains explicit');
    assert.equal((await post('/assistant/intent',{stage:'draft',goal:'目标',text:'另外，找找收藏中的资料',mode:'demo'})).json().intent,'chat');
    provider.mock.mockImplementation(async()=>new Response('unavailable',{status:503}));assert.equal((await post('/assistant/intent',{stage:'draft',goal:'目标',text:'另一个问题'})).statusCode,503);
    delete process.env.AI_API_KEY;assert.equal((await post('/skills/intent',{messages:[{role:'user',content:'创建 Skill'}],context:{page:'knowledge'}})).statusCode,503,'missing config never silently enables mock mode');
  }finally{provider.mock.restore();await app.close();if(before.key===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=before.key;if(before.model===undefined)delete process.env.AI_MODEL;else process.env.AI_MODEL=before.model}
});

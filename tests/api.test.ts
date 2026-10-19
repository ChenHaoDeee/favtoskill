import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
test('API returns real empty state; validates input and never fakes an AI response',async()=>{
  const savedKey=process.env.AI_API_KEY;delete process.env.AI_API_KEY;
  const app=await createApp(createStore(':memory:'));
  try{
    assert.equal((await app.inject('/api/health')).json().aiConfigured,false);
    for(const resource of ['categories','knowledge','skills','conversations'])assert.deepEqual((await app.inject(`/api/${resource}`)).json(),{items:[]});
    const invalid=await app.inject({method:'POST',url:'/api/chat',payload:{content:'',context:{page:'knowledge'}}});assert.equal(invalid.statusCode,400);
    const unavailable=await app.inject({method:'POST',url:'/api/chat',payload:{content:'总结我的收藏',context:{page:'knowledge'}}});assert.equal(unavailable.statusCode,503);assert.equal(unavailable.json().error.code,'AI_NOT_CONFIGURED');
    assert.deepEqual((await app.inject('/api/conversations')).json(),{items:[]});
    assert.equal((await app.inject('/api/conversations/missing/messages')).statusCode,404);
  }finally{await app.close();if(savedKey!==undefined)process.env.AI_API_KEY=savedKey}
});

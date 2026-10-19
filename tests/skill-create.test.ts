import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.js';
import {createStore} from '../server/store.js';
import {seedDemo} from '../server/seed.js';

test('confirmed generated Skill save is idempotent; retries do not duplicate or restore removed Skills',async()=>{
  const store=createStore(':memory:');seedDemo(store);const app=await createApp(createStore(':memory:'),store);
  const post=(payload:unknown)=>app.inject({method:'POST',url:'/api/demo/skills',payload:payload as never});
  try{
    const {id,createdAt,updatedAt,origin,...draft}=store.skills()[0];const count=store.skills().length,requestId=randomUUID();
    const one=await post({draft,origin:'ai',requestId});assert.equal(one.statusCode,200,one.body);assert.equal(store.skills().length,count+1);
    const two=await post({draft,origin:'ai',requestId});assert.equal(two.statusCode,200);assert.equal(two.json().item.id,one.json().item.id);assert.equal(store.skills().length,count+1);
    const conflict=await post({draft:{...draft,name:'different'},origin:'ai',requestId});assert.equal(conflict.statusCode,409);assert.equal(store.skills().length,count+1);
    const undo=await app.inject({method:'POST',url:`/api/demo/undo/${one.json().undoId}`,payload:{}});assert.equal(undo.statusCode,200);assert.equal(store.skills().length,count);
    assert.equal((await post({draft,origin:'ai',requestId})).statusCode,409);assert.equal(store.skills().length,count);
  }finally{await app.close()}
});

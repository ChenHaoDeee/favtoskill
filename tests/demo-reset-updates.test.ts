import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';
import type { OrganizePlan } from '../shared/contracts.js';

test('explicit demo refresh rearms classification, duplication and updates; joint apply and undo restore all three',async()=>{
  const personal=createStore(':memory:'),demo=createStore(':memory:');const app=await createApp(personal,demo);
  const post=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,payload});
  const plan=async()=>(await post('/api/demo/organize/plans',{mode:'demo'})).json<OrganizePlan>();
  try{
    const custom=(await post('/api/demo/categories',{name:'保留我的修改'})).json().item;
    assert.equal((await post('/api/demo/demo/reset',{})).statusCode,400);
    assert.equal((await post('/api/demo/reset',{confirmed:true})).statusCode,404);
    const reset=await post('/api/demo/demo/reset',{confirmed:true});assert.equal(reset.statusCode,200,reset.body);
    await post(`/api/demo/undo/${reset.json().undoId}`,{});assert.ok(demo.categories().some(c=>c.id===custom.id));assert.equal(demo.knowledge().length,0);
    await post('/api/demo/demo/reset',{confirmed:true});
    const first=await plan();assert.equal(demo.knowledge().filter(k=>!k.categoryId).length,3);assert.equal(first.moves.length,3);assert.ok(first.duplicateGroups!.length>0);assert.equal(first.updates!.length,1);
    const before=JSON.stringify(demo.knowledge());seedDemo(demo);assert.equal(JSON.stringify(demo.knowledge()),before,'restart seed preserves refreshed scenarios');
    const bad=await post(`/api/demo/organize/plans/${first.id}/apply`,{confirmed:true,moves:[],updates:['not-in-plan']});assert.equal(bad.statusCode,400);
    const group=first.duplicateGroups!.find(g=>g.knowledgeIds.includes('demo-duplicate-copy'))!;
    const apply=await post(`/api/demo/organize/plans/${first.id}/apply`,{confirmed:true,moves:first.moves,duplicates:[{groupId:group.id,keepId:group.recommendedKeepId}],updates:first.updates!.map(u=>u.id)});
    assert.equal(apply.statusCode,200,apply.body);assert.equal(apply.json().applied.updates,1);
    assert.equal((await plan()).updates!.length,0);assert.equal((await plan()).moves.length,0);
    const changed=demo.knowledge().find(k=>k.id===first.updates![0].knowledgeId)!;assert.equal(changed.originalText,first.updates![0].afterText);assert.equal(changed.summary,'');assert.deepEqual(changed.keyPoints,[]);
    await post(`/api/demo/undo/${apply.json().undoId}`,{});assert.equal(JSON.stringify(demo.knowledge()),before);
    assert.equal((await plan()).updates!.length,1);
    const refreshed=await post('/api/demo/demo/reset',{confirmed:true});const second=await plan();assert.ok(second.moves.length>=3);assert.ok(second.duplicateGroups!.length);assert.equal(second.updates!.length,1);
    await post(`/api/demo/undo/${refreshed.json().undoId}`,{});assert.equal(JSON.stringify(demo.knowledge()),before);
    for(let i=0;i<6;i++){await post('/api/demo/demo/reset',{confirmed:true});assert.equal(demo.knowledge().filter(k=>!k.categoryId).length,3);const ready=await plan();assert.equal(ready.moves.length,3);assert.equal(ready.updates!.length,1);}
    assert.equal(personal.categories().length,0);assert.equal(personal.knowledge().length,0);
    assert.ok(!demo.categories().some(c=>c.id===custom.id));
  }finally{await app.close()}
});

test('manual original changes are staged, scoped, confirmed, invalidated by new writes and undoable',async()=>{
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  const post=(path:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url:'/api/demo'+path,payload});
  try{
    const item=demo.knowledge().find(k=>k.categoryId==='tech')!;const next=item.originalText+'\n新补充的操作步骤。';
    const staged=await post(`/knowledge/${item.id}/updates/preview`,{kind:'text',text:next});assert.equal(staged.statusCode,200);
    assert.equal(demo.knowledge().find(k=>k.id===item.id)!.originalText,item.originalText);
    const scoped=(await post('/organize/plans',{mode:'demo',categoryId:'food'})).json();assert.deepEqual(scoped.updates,[]);
    const plan=(await post('/organize/plans',{mode:'demo',categoryId:'tech'})).json();assert.equal(plan.updates.length,1);
    assert.equal((await post(`/organize/plans/${plan.id}/apply`,{confirmed:true,moves:[],updates:[staged.json().id,staged.json().id]})).statusCode,400);
    const applied=await post(`/organize/plans/${plan.id}/apply`,{confirmed:true,moves:[],updates:[staged.json().id]});assert.equal(applied.statusCode,200,applied.body);
    assert.equal(demo.knowledge().find(k=>k.id===item.id)!.originalText,next);
    await post(`/undo/${applied.json().undoId}`,{});assert.equal(demo.knowledge().find(k=>k.id===item.id)!.originalText,item.originalText);
    const fresh=(await post('/organize/plans',{mode:'demo'})).json();await post(`/knowledge/${item.id}/updates/preview`,{kind:'text',text:next+'第二次补充'});
    assert.equal((await post(`/organize/plans/${fresh.id}/apply`,{confirmed:true,moves:[],updates:[staged.json().id]})).statusCode,409);
    assert.equal((await post(`/knowledge/${item.id}/updates/preview`,{kind:'source'})).statusCode,422);
  }finally{await app.close()}
});

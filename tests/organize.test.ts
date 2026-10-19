import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import type { Knowledge,OrganizePlan,Skill } from '../shared/contracts.js';
import { duplicates } from '../server/workflows.js';

async function fixture(){
  const personal=createStore(':memory:'),store=createStore(':memory:');
  store.db.prepare('INSERT INTO categories(id,name,created_at) VALUES(?,?,?)').run('a','AI效率','2026-01-01');
  store.db.prepare('INSERT INTO categories(id,name,created_at) VALUES(?,?,?)').run('b','AI工具','2026-01-02');
  for(const [id,categoryId,text,date] of [['a1','a','完整原文一','2026-01-01'],['a2','a','完整原文二','2026-01-02'],['b1','b','完整原文一','2026-02-01'],['b2','b','完整原文二','2026-02-02'],['u',null,'尚未归类的新资料','2026-03-01']] as const){
    const item:Knowledge={id,title:id,categoryId,originalText:text,summary:text,keyPoints:[],tags:['AI','效率'],completeness:'complete',createdAt:date,updatedAt:date};store.putKnowledge(item);
  }
  const skill:Skill={id:'skill',name:'已引用副本',description:'检查引用',scenarios:[],inputRequirements:'问题',steps:['回答'],outputFormat:'文本',knowledgeIds:['b1','a1'],limitations:[],externalDependencies:[],createdAt:'2026-01-01',updatedAt:'2026-01-01'};store.putSkill(skill);
  const app=await createApp(personal,store);const plan=async(categoryId?:string)=>(await app.inject({method:'POST',url:'/api/demo/organize/plans',payload:{mode:'demo',categoryId}})).json<OrganizePlan>();
  return {store,personal,app,plan,close:async()=>{await app.close()}};
}
test('organize selected moves, duplicate retention and folder merge are atomic, rebind Skills and undo together',async()=>{
  const f=await fixture();try{
    const plan=await f.plan();assert.equal(plan.analyzedCount,5);assert.equal(plan.duplicateGroups?.length,2);assert.equal(plan.categoryMerges?.length,1);
    const group=plan.duplicateGroups!.find(g=>g.knowledgeIds.includes('a1'))!;assert.equal(group.recommendedKeepId,'b1');
    const result=await f.app.inject({method:'POST',url:`/api/demo/organize/plans/${plan.id}/apply`,payload:{confirmed:true,moves:plan.moves,duplicates:[{groupId:group.id,keepId:'a1'}],merges:plan.categoryMerges!.map(({sourceId,targetId})=>({sourceId,targetId}))}});
    assert.equal(result.statusCode,200,result.body);assert.equal(f.store.knowledge().length,4);assert.equal(f.store.categories().length,1);
    assert.ok(f.store.knowledge().every(k=>k.categoryId==='b'));assert.deepEqual(f.store.skills()[0].knowledgeIds,['a1']);
    assert.ok(f.store.db.prepare('SELECT body FROM knowledge WHERE id=? AND deleted_at IS NOT NULL').get('b1'));
    assert.equal((await f.app.inject({method:'POST',url:`/api/demo/undo/${result.json().undoId}`,payload:{}})).statusCode,200);
    assert.equal(f.store.knowledge().length,5);assert.equal(f.store.categories().length,2);assert.deepEqual(f.store.skills()[0].knowledgeIds,['b1','a1']);assert.equal(f.store.knowledge().find(k=>k.id==='u')!.categoryId,null);
  }finally{await f.close()}
});
test('organize rejects unpreviewed/duplicated operations and stale plans without partial changes',async()=>{
  const f=await fixture();try{
    const p=await f.plan(),g=p.duplicateGroups![0],revision=f.store.revision();
    const invalid=[{duplicates:[{groupId:g.id,keepId:'u'}]},{duplicates:[{groupId:g.id,keepId:g.recommendedKeepId},{groupId:g.id,keepId:g.recommendedKeepId}]},{merges:[{sourceId:'b',targetId:'a'}]},{moves:[{knowledgeId:'a1',categoryId:'b',reason:'not proposed'}]}];
    for(const extra of invalid){const response=await f.app.inject({method:'POST',url:`/api/demo/organize/plans/${p.id}/apply`,payload:{confirmed:true,moves:[],...extra}});assert.equal(response.statusCode,400,response.body);assert.equal(f.store.revision(),revision)}
    assert.equal((await f.app.inject({method:'POST',url:`/api/demo/organize/plans/${p.id}/apply`,payload:{moves:[]}})).statusCode,400);
    f.store.mutate(()=>f.store.putKnowledge({...f.store.knowledge()[0],title:'changed'}));
    assert.equal((await f.app.inject({method:'POST',url:`/api/demo/organize/plans/${p.id}/apply`,payload:{confirmed:true,moves:[]}})).statusCode,409);assert.equal(f.store.knowledge().length,5);
  }finally{await f.close()}
});
test('folder-only plans do not propose changing or merging other folders; empty originals are not duplicates',async()=>{
  const f=await fixture();try{
    const p=await f.plan('a');assert.equal(p.analyzedCount,2);assert.deepEqual(p.duplicateGroups,[]);assert.deepEqual(p.categoryMerges,[]);
    const unfiled=await f.plan('unfiled');assert.equal(unfiled.analyzedCount,1);assert.deepEqual(unfiled.duplicates,[]);assert.deepEqual(unfiled.categoryMerges,[]);
    for(const id of ['empty1','empty2'])f.store.putKnowledge({...f.store.knowledge()[0],id,sourceUrl:null,originalText:''});
    assert.ok(duplicates(f.store).every(d=>!d.firstId.startsWith('empty')&&!d.secondId.startsWith('empty')));
  }finally{await f.close()}
});


import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.js';
import {createStore} from '../server/store.js';
import {seedDemo} from '../server/seed.js';
import type {ShareImportJob} from '../shared/shareDemo.js';

test('simulated external share runs in the background, persists real records, deduplicates and supports undo/cancel',async()=>{
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);const originalCount=demo.knowledge().length;
  const post=(path:string,payload:unknown)=>app.inject({method:'POST',url:'/api/demo'+path,payload:payload as never});
  try{
    assert.equal((await app.inject({method:'POST',url:'/api/imports/demo',payload:{fixtureId:'story-branches'}})).statusCode,404);
    assert.equal((await post('/imports/demo',{fixtureId:'invented'})).statusCode,400);
    const start=await post('/imports/demo',{fixtureId:'story-branches'});assert.equal(start.statusCode,200);const job=start.json() as ShareImportJob;assert.equal(job.status,'receiving');assert.equal(job.simulated,true);
    assert.equal((await post('/imports/demo',{fixtureId:'story-branches'})).json().id,job.id,'concurrent repeated share uses same task');
    await new Promise(resolve=>setTimeout(resolve,4400));
    assert.equal(demo.knowledge().length,originalCount+1,'save completes without client polling');
    const saved=(await app.inject('/api/demo/imports/demo/'+job.id)).json() as ShareImportJob;assert.equal(saved.status,'saved');assert.equal(saved.categoryName,'科技');assert.ok(saved.undoId);
    const record=demo.knowledge().find(k=>k.id===saved.knowledgeId)!;assert.equal(record.provenance?.kind,'share-demo');assert.match(record.originalText,/演示预设文字/);assert.equal(record.sourceUrl,null);
    const duplicate=(await post('/imports/demo',{fixtureId:'story-branches'})).json();assert.equal(duplicate.status,'saved');assert.equal(duplicate.duplicate,true);assert.equal(duplicate.knowledgeId,saved.knowledgeId);assert.equal(duplicate.undoId,undefined);assert.equal(demo.knowledge().length,originalCount+1);
    assert.equal((await post('/imports/demo/'+job.id+'/cancel',{})).statusCode,409);
    assert.equal((await post('/undo/'+saved.undoId,{})).statusCode,200);assert.equal(demo.knowledge().length,originalCount);
    const again=(await post('/imports/demo',{fixtureId:'story-branches'})).json();assert.equal(again.status,'receiving');assert.notEqual(again.id,job.id);
    const cancelled=(await post('/imports/demo/'+again.id+'/cancel',{})).json();assert.equal(cancelled.status,'cancelled');assert.equal((await app.inject('/api/demo/imports/demo/'+again.id)).json().status,'cancelled');
    assert.equal((await app.inject('/api/demo/imports/demo/missing')).statusCode,404);
  }finally{await app.close()}
});

test('pending simulated imports recover after backend registration',async()=>{
  const demo=createStore(':memory:');seedDemo(demo);demo.db.exec('CREATE TABLE demo_import_jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
  const job:ShareImportJob={id:randomUUID(),fixtureId:'character-motivation',createdAt:new Date(Date.now()-10000).toISOString(),status:'receiving',simulated:true};demo.db.prepare('INSERT INTO demo_import_jobs VALUES(?,?)').run(job.id,JSON.stringify(job));
  const app=await createApp(createStore(':memory:'),demo);
  try{await app.ready();await new Promise(resolve=>setTimeout(resolve,30));const result=(await app.inject('/api/demo/imports/demo/'+job.id)).json();assert.equal(result.status,'saved');assert.ok(demo.knowledge().some(k=>k.id===result.knowledgeId))}finally{await app.close()}
});

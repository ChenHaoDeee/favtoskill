import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { shareDemoPosts,type ShareImportJob } from '../shared/shareDemo.js';
import type { Store } from './store.js';
import { ServiceError } from './ai.js';
export function registerShareDemo(app:FastifyInstance,store:Store){
  store.db.exec('CREATE TABLE IF NOT EXISTS demo_import_jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
  const timers=new Map<string,ReturnType<typeof setTimeout>>();
  const read=(id:string)=>{const row=store.db.prepare('SELECT body FROM demo_import_jobs WHERE id=?').get(id);if(!row)throw new ServiceError('NOT_FOUND','演示导入任务不存在。',404);return JSON.parse(row.body as string) as ShareImportJob};
  const put=(job:ShareImportJob)=>store.db.prepare('INSERT INTO demo_import_jobs(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(job.id,JSON.stringify(job));
  const imported=(fixtureId:string)=>store.knowledge().find(k=>k.provenance?.kind==='share-demo'&&k.provenance.originalId===fixtureId);
  function finish(id:string){
    timers.delete(id);const job=read(id);if(['saved','failed','cancelled'].includes(job.status))return;
    try{
      const post=shareDemoPosts.find(p=>p.id===job.fixtureId)!;const existing=imported(post.id);
      if(existing){put({...job,status:'saved',knowledgeId:existing.id,categoryId:existing.categoryId,categoryName:store.categories().find(c=>c.id===existing.categoryId)?.name||'未分类',duplicate:true});return}
      const category=store.categories().find(c=>new RegExp(post.categoryPattern,'i').test(c.name));const now=new Date().toISOString();const knowledgeId=randomUUID();
      const undoId=store.mutate(()=>store.putKnowledge({id:knowledgeId,title:post.title,originalText:post.originalText,imagePath:post.cover,sourcePlatform:'抖音',sourceUrl:null,summary:post.summary,keyPoints:[...post.keyPoints],categoryId:category?.id||null,tags:[...post.tags],completeness:'fragment',createdAt:now,updatedAt:now,provenance:{kind:'share-demo',repository:'用户提供的接着演 Demo',commit:'local-snapshot',file:'shared/shareDemo.ts',originalId:post.id,textKind:'preset_share_transcript'}}));
      put({...job,status:'saved',knowledgeId,categoryId:category?.id||null,categoryName:category?.name||'未分类',undoId});
    }catch{put({...job,status:'failed',error:'演示资料保存失败，请重试。'})}
  }
  function schedule(job:ShareImportJob){if(timers.has(job.id))return;const timer=setTimeout(()=>finish(job.id),Math.max(0,4200-(Date.now()-Date.parse(job.createdAt))));timer.unref();timers.set(job.id,timer)}
  for(const row of store.db.prepare('SELECT body FROM demo_import_jobs').all()){const job=JSON.parse(row.body as string) as ShareImportJob;if(!['saved','failed','cancelled'].includes(job.status))schedule(job)}
  app.addHook('onClose',async()=>{for(const timer of timers.values())clearTimeout(timer);timers.clear()});
  app.post('/imports/demo',async req=>{
    const {fixtureId}=z.object({fixtureId:z.enum(['story-branches','character-motivation'])}).parse(req.body);
    const current=store.db.prepare('SELECT body FROM demo_import_jobs').all().map(row=>JSON.parse(row.body as string) as ShareImportJob).find(job=>job.fixtureId===fixtureId&&!['saved','failed','cancelled'].includes(job.status));if(current)return current;
    const existing=imported(fixtureId);const job:ShareImportJob={id:randomUUID(),fixtureId,createdAt:new Date().toISOString(),status:existing?'saved':'receiving',simulated:true,...(existing?{knowledgeId:existing.id,categoryId:existing.categoryId,categoryName:store.categories().find(c=>c.id===existing.categoryId)?.name||'未分类',duplicate:true}:{})};put(job);if(!existing)schedule(job);return job;
  });
  app.get('/imports/demo/:id',async req=>{const job=read((req.params as {id:string}).id);if(['saved','failed','cancelled'].includes(job.status))return job;const elapsed=Date.now()-Date.parse(job.createdAt);return {...job,status:elapsed<900?'receiving':elapsed<2600?'parsing':'classifying'}});
  app.post('/imports/demo/:id/cancel',async req=>{const job=read((req.params as {id:string}).id);if(job.status==='saved')throw new ServiceError('ALREADY_SAVED','资料已保存，请使用撤回操作。',409);clearTimeout(timers.get(job.id));timers.delete(job.id);const updated={...job,status:'cancelled' as const};put(updated);return updated});
}

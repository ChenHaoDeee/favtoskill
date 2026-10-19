import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Category,Knowledge,Skill } from '../shared/contracts.js';
import type { Store } from './store.js';
import { stageUpdate } from './knowledgeUpdates.js';
export function resetDemo(store:Store){
  const data=JSON.parse(readFileSync(new URL('./fixtures/demo.json',import.meta.url),'utf8')) as {categories:Category[];knowledge:Knowledge[];skills:Skill[]};
  const now=new Date().toISOString();const round=store.revision()+1;
  const homes:Record<string,string>={tech_favorites:'tech',food_favorites:'food',lvyou:'trip'};
  data.knowledge=data.knowledge.map(k=>({...k,categoryId:k.categoryId||homes[k.id.split('--')[0]]||null,createdAt:Number.isFinite(Date.parse(k.createdAt))?k.createdAt:now,updatedAt:Number.isFinite(Date.parse(k.updatedAt))?k.updatedAt:now}));
  const undoId=store.mutate(()=>{
    for(const table of ['skills','knowledge','categories'])store.db.exec(`DELETE FROM ${table}`);
    for(const c of data.categories)store.db.prepare('INSERT INTO categories(id,name,created_at) VALUES(?,?,?)').run(c.id,c.name,c.createdAt);
    data.knowledge.forEach((k,i)=>store.putKnowledge({...k,demoPlatform:['抖音','小红书','B站'][(i+round)%3]}));
    for(const s of data.skills)store.putSkill(s);
    for(const [key,value] of [['seed_version','upstream-2719a69-v2'],['unfiled_examples_v1','1'],['demo_platforms_v1','1']])store.db.prepare('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);
    if(store.db.prepare("SELECT name FROM sqlite_master WHERE name='demo_import_jobs'").get())for(const row of store.db.prepare('SELECT id,body FROM demo_import_jobs').all()){const job=JSON.parse(row.body as string);if(!['saved','failed','cancelled'].includes(job.status))store.db.prepare('UPDATE demo_import_jobs SET body=? WHERE id=?').run(JSON.stringify({...job,status:'cancelled'}),row.id);}
    // Seed three genuine, independently selectable scenarios on every explicit reset.
    for(const categoryId of ['tech','food','trip']){
      const peers=data.knowledge.filter(k=>k.categoryId===categoryId);const base=peers[(round%Math.max(1,peers.length-1))];
      if(!base)continue;
      const tags=[...new Set([...base.tags,'演示主题',categoryId])];
      store.putKnowledge({...base,tags});
      const unfiled=peers.find(k=>k.id!==base.id)!;
      store.putKnowledge({...unfiled,categoryId:null,tags,updatedAt:now});
    }
    const base=data.knowledge.find(k=>k.categoryId==='tech')!;
    store.putKnowledge({...store.knowledge().find(k=>k.id===base.id)!,id:'demo-duplicate-copy',categoryId:'tech',createdAt:now,updatedAt:now});
    const updateItem=data.knowledge.find(k=>k.categoryId==='trip')!;
    const current=store.knowledge().find(k=>k.id===updateItem.id)!;
    stageUpdate(store,current.id,current.originalText+`\n\n【模拟补充 · 第 ${round} 轮】出行前按交通、住宿和预约清单逐项核对；临时调整时记录替代路线。本段为演示新增资料，不是重新抓取原帖。`,'demo','预设的新旧版本差异，用于体验资料更新，不是联网获取。');
  });
  return {undoId,round,knowledgeCount:store.knowledge().length,skillCount:store.skills().length};
}
export function registerDemoReset(app:FastifyInstance,store:Store){
  app.post('/demo/reset',async req=>{z.object({confirmed:z.literal(true)}).parse(req.body);return resetDemo(store)});
}

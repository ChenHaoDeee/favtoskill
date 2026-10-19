import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Store } from './store.js';
import type { Category,Knowledge,Skill } from '../shared/contracts.js';
export function seedDemo(store:Store){
  // The user confirmed the demo corpus represents Douyin posts. Preserve all other edits.
  const legacy=store.knowledge().filter(k=>k.provenance?.kind==='demo'&&k.sourcePlatform==='旧项目演示资料');
  if(legacy.length)store.mutate(()=>{for(const k of legacy)store.putKnowledge({...k,sourcePlatform:'抖音'})});
  const current=store.db.prepare("SELECT value FROM state WHERE key='seed_version'").get();
  if(current&&(current.value==='upstream-2719a69-v2'||store.revision()>0)){seedUnfiledExamples(store);seedDemoPlatforms(store);return}
  const data=JSON.parse(readFileSync(new URL('./fixtures/demo.json',import.meta.url),'utf8')) as {categories:Category[];knowledge:Knowledge[];skills:Skill[]};
  store.db.exec('BEGIN IMMEDIATE');
  try {for(const c of data.categories)store.db.prepare('INSERT OR IGNORE INTO categories(id,name,created_at) VALUES(?,?,?)').run(c.id,c.name,c.createdAt);for(const k of data.knowledge)store.putKnowledge(k);for(const s of data.skills)store.putSkill(s);store.db.prepare("INSERT INTO state VALUES('seed_version','upstream-2719a69-v2') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();store.db.exec('COMMIT')}catch(e){store.db.exec('ROLLBACK');throw e}
  seedUnfiledExamples(store);seedDemoPlatforms(store);
}

function seedUnfiledExamples(store:Store){
  if(store.db.prepare("SELECT value FROM state WHERE key='unfiled_examples_v1'").get())return;
  const samples=new Map([['tech_favorites--ai_05','tech'],['food_favorites--food_05','food'],['lvyou--lvyou-05','trip']]);
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/demo.json',import.meta.url),'utf8')) as {knowledge:Knowledge[]};
  const unchanged=store.knowledge().filter(k=>samples.get(k.id)===k.categoryId&&fixture.knowledge.some(original=>original.id===k.id&&original.title===k.title&&original.updatedAt===k.updatedAt));
  // Apply once to untouched demo records; later launches must preserve user reclassification.
  store.mutate(()=>{
    for(const k of unchanged)store.putKnowledge({...k,categoryId:null});
    store.db.prepare("INSERT INTO state VALUES('unfiled_examples_v1','1')").run();
  });
}

function seedDemoPlatforms(store:Store){
  if(store.db.prepare("SELECT value FROM state WHERE key='demo_platforms_v1'").get())return;
  const items=store.knowledge().filter(k=>k.provenance?.kind==='demo'&&k.sourcePlatform==='抖音'&&!k.demoPlatform).sort((a,b)=>createHash('sha256').update(a.id).digest('hex').localeCompare(createHash('sha256').update(b.id).digest('hex')));
  const platforms=['抖音','小红书','抖音','B站','抖音'];
  store.mutate(()=>{items.forEach((item,i)=>store.putKnowledge({...item,demoPlatform:platforms[i%platforms.length]}));store.db.prepare("INSERT INTO state VALUES('demo_platforms_v1','1')").run()});
}

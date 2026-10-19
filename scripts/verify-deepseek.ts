import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';
const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
const report:{model:string|undefined;checks:unknown[]}={model:process.env.AI_MODEL,checks:[]};
async function post(path:string,payload:unknown){const start=Date.now();const r=await app.inject({method:'POST',url:'/api/demo'+path,payload:payload as never});const data=r.json();report.checks.push({path,status:r.statusCode,durationMs:Date.now()-start,result:data});console.log(JSON.stringify({path,status:r.statusCode,durationMs:Date.now()-start,error:data.error?.code}));if(r.statusCode!==200)throw new Error(data.error?.message||'Request failed');return data}
try{
 const item=demo.knowledge().find(k=>k.title.includes('底层逻辑'))||demo.knowledge().find(k=>k.categoryId==='tech')!;
 const chat=await post('/chat',{content:'提取这篇内容里可以重复使用的方法，说明适用场景，并引用来源。',mode:'real',context:{page:'knowledge',knowledgeId:item.id}});
 if(!chat.message.sources.includes(item.id))throw new Error('Missing expected citation');
 const draft=(await post('/skills/draft',{goal:'根据这条收藏创建一个可复用的方法实践助手，帮助新手应用其中的方法',knowledgeIds:[item.id],conversationId:chat.conversationId,mode:'real'})).draft;
 const adjusted=(await post('/skills/draft',{goal:'方法实践助手',knowledgeIds:[item.id],currentDraft:{...draft,name:'方法实践助手'},adjustment:'保留名称，将输出限制为三条可执行建议。',mode:'real'})).draft;
 const saved=await post('/skills',{draft:adjusted,origin:'ai'});
 await post('/skills/trial',{draft:adjusted,input:'我是新手，请基于所引用的资料，给我一个今天可以开始尝试的练习。',mode:'real'});
 const exported=await app.inject('/api/demo/skills/'+saved.item.id+'/export');report.checks.push({path:'export',status:exported.statusCode,hasReference:exported.json().bundle.references.length>0});
 if(exported.statusCode!==200)throw new Error('Export failed');
 await post('/organize/plans',{mode:'real',categoryId:'unfiled'});
 console.log('Live DeepSeek core flow passed; user database untouched.');
}catch(e){report.checks.push({failure:(e as Error).message});process.exitCode=1}
finally{writeFileSync('artifacts/deepseek-live-qa.json',JSON.stringify(report,null,2));await app.close()}

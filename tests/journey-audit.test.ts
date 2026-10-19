import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';

test('new text import travels through model classification, summary, grounded chat, conversational Skill, trial and export',async()=>{
  const keys=['AI_API_KEY','AI_MODEL','AI_EMBEDDING_MODEL'] as const;
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.AI_API_KEY='isolated-test-only';process.env.AI_MODEL='test-model';delete process.env.AI_EMBEDDING_MODEL;
  const personal=createStore(':memory:'),demo=createStore(':memory:');const app=await createApp(personal,demo);
  const post=(path:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url:'/api/demo'+path,payload});
  let reply='',request='';const provider=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{request=String(options?.body);return new Response(JSON.stringify({choices:[{message:{content:reply}}]}))});
  try{
    const category=(await post('/categories',{name:'面试'})).json().item;
    const original='面试项目讲述方法：先说明背景与目标，再说明个人行动和关键取舍，最后用结果及反馈证明价值。';
    const preview=(await post('/imports/preview',{kind:'text',title:'面试项目讲述方法',text:original})).json();
    assert.equal(demo.knowledge().length,0);assert.equal(provider.mock.callCount(),0);
    const saved=(await post(`/imports/preview/${preview.id}/confirm`,{})).json();const id=saved.knowledgeId;
    assert.equal(demo.knowledge()[0].categoryId,null);
    reply=JSON.stringify({moves:[{knowledgeId:id,categoryId:category.id,reason:'原文是面试项目讲述方法'}]});
    const plan=(await post('/organize/plans',{mode:'real',categoryId:'unfiled'})).json();
    assert.equal(demo.knowledge()[0].categoryId,null,'preview must not mutate classification');
    const applied=await post(`/organize/plans/${plan.id}/apply`,{confirmed:true,moves:plan.moves});assert.equal(applied.statusCode,200,applied.body);
    assert.equal(demo.knowledge()[0].categoryId,category.id);
    reply=JSON.stringify({overview:'保存了面试项目表达中的背景、行动、结果组织方法，可在准备项目讲述时回顾。'});
    const overview=await post(`/categories/${category.id}/overview`,{mode:'real'});assert.equal(overview.statusCode,200);assert.equal(overview.json().sampleCount,1);assert.ok(request.includes(original));
    reply=JSON.stringify({summary:'按背景、行动、结果组织面试项目讲述。',points:[{title:'用结果证明价值',description:'结合实际反馈，说明个人行动的价值。'}]});
    assert.equal((await post(`/knowledge/${id}/analysis`,{mode:'real'})).statusCode,200);assert.equal(demo.knowledge()[0].originalText,original);
    reply=JSON.stringify({answer:`可以按背景、行动、结果组织表达。[${id}]`,citations:[id],suggestSkill:true});
    const chat=(await post('/chat',{content:'面试项目怎么讲？',context:{page:'knowledge',categoryId:category.id},mode:'real'})).json();
    assert.deepEqual(chat.message.sources,[id]);assert.ok(request.includes(original));
    reply=JSON.stringify({ready:true,goal:'基于收藏优化面试项目讲述，输出清晰的回答和修改依据',reply:'请确认这次使用的收藏。',options:[]});
    const intent=(await post('/skills/intent',{context:{page:'knowledge',categoryId:category.id},mode:'real',conversationId:chat.conversationId,messages:[{role:'user',content:'把这些面试表达方法做成优化项目讲述的Skill'}]})).json();
    assert.equal(intent.ready,true);assert.equal(intent.conversationId,chat.conversationId);
    const sources=(await post('/skills/sources',{goal:intent.goal,context:{page:'knowledge',categoryId:category.id},mode:'real'})).json();assert.deepEqual(sources.items.map((k:{id:string})=>k.id),[id]);
    const definition={name:'项目讲述优化助手',description:'根据收藏的方法优化面试项目讲述。',scenarios:['准备面试项目讲述'],inputRequirements:'项目背景、个人行动和结果',steps:['核对背景和目标','突出个人行动','补充结果与反馈'],outputFormat:'优化回答及修改说明',knowledgeIds:[id],limitations:['仅依据当前收藏片段'],externalDependencies:[]};
    reply=JSON.stringify(definition);const generated=await post('/skills/draft',{goal:intent.goal,knowledgeIds:[id],mode:'real',conversationId:chat.conversationId,recordConversation:true});assert.equal(generated.statusCode,200,generated.body);
    assert.ok(request.includes('面试项目怎么讲'),'generation retains the original chat context');
    const skill=(await post('/skills',{draft:generated.json().draft,origin:'ai'})).json().item;
    reply='请把项目回答组织为背景、行动、结果，并补充可验证反馈。';
    const trial=await post('/skills/trial',{draft:generated.json().draft,input:'我负责改版，完成了三个页面，怎么讲？',mode:'real',conversationId:chat.conversationId,recordConversation:true});assert.equal(trial.json().output,reply);assert.ok(request.includes(original));
    const zip=await app.inject(`/api/demo/skills/${skill.id}/export?format=zip`);assert.equal(zip.statusCode,200);assert.equal(zip.rawPayload.subarray(0,2).toString(),'PK');
    assert.equal(personal.knowledge().length,0);assert.equal(personal.skills().length,0);
    assert.ok(demo.messages(chat.conversationId).some(m=>m.content===trial.json().output));
    assert.equal(demo.knowledge()[0].originalText,original);
  }finally{provider.mock.restore();await app.close();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}}
});

import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.js';
import { cosine,semanticRetrieve,embeddingConfig,isEmbeddingConfigured } from '../server/semantic.js';

test('semantic retrieval caches original chunks, respects scope and rejects malformed embeddings',async()=>{
  const store=createStore(':memory:');
  const keys=['AI_API_KEY','AI_EMBEDDING_MODEL','AI_BASE_URL','AI_SIMILARITY_THRESHOLD'] as const;
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const endpoint=process.env.AI_EMBEDDING_BASE_URL;
  process.env.AI_API_KEY='test-only';process.env.AI_EMBEDDING_MODEL='test-vector';process.env.AI_BASE_URL='https://example.invalid/v1';process.env.AI_SIMILARITY_THRESHOLD='0.8';delete process.env.AI_EMBEDDING_BASE_URL;
  const now=new Date().toISOString();
  for(const [id,categoryId,originalText] of [['a','one','面试回答需要说明任务与行动'],['b','two','旅行路线和交通安排']])store.putKnowledge({id,categoryId,originalText,title:id,summary:'摘要',keyPoints:[],tags:[],completeness:'fragment',createdAt:now,updatedAt:now});
  const batches:string[][]=[];
  const fetchMock=mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{
    const input=(JSON.parse(String(options?.body)) as {input:string[]}).input;batches.push(input);
    return new Response(JSON.stringify({data:input.map((text,index)=>({index,embedding:text.includes('旅行')?[0,1]:[1,0]}))}),{status:200});
  });
  try{
    const first=await semanticRetrieve(store,'如何回答面试',{page:'knowledge'});
    assert.deepEqual(first.map(h=>h.item.id),['a']);assert.match(batches[0][0],/面试回答需要说明任务与行动/);
    assert.equal(batches.length,2);
    await semanticRetrieve(store,'任务怎么说',{page:'knowledge'});assert.equal(batches.length,3,'second query uses cached document vectors');
    assert.deepEqual(await semanticRetrieve(store,'任务怎么说',{page:'knowledge',categoryId:'two'}),[]);
    fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({data:[{index:0,embedding:[]}]}),{status:200}));
    await assert.rejects(semanticRetrieve(store,'新的问题',{page:'knowledge'}),/向量模型返回格式/);
    assert.equal(cosine([1,0],[0,1]),0);assert.equal(cosine([1,0],[1,0]),1);
  }finally{
    fetchMock.mock.restore();store.db.close();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}
    if(endpoint===undefined)delete process.env.AI_EMBEDDING_BASE_URL;else process.env.AI_EMBEDDING_BASE_URL=endpoint;
  }
});

test('independent embedding provider uses its own key, validates vectors and refuses to leak chat credentials',async()=>{
  const keys=['AI_API_KEY','AI_BASE_URL','AI_EMBEDDING_API_KEY','AI_EMBEDDING_BASE_URL','AI_EMBEDDING_MODEL','AI_SIMILARITY_THRESHOLD'] as const;
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const store=createStore(':memory:');
  const now=new Date().toISOString();store.putKnowledge({id:'a',title:'方法',originalText:'具体方法',summary:'',keyPoints:[],tags:[],categoryId:null,completeness:'fragment',createdAt:now,updatedAt:now});
  let calls=0;let data:unknown=[{index:0,embedding:[1,0]}];
  const provider=mock.method(globalThis,'fetch',async(url:unknown,options?:RequestInit)=>{calls++;assert.equal(String(url),'https://vectors.example.invalid/v1/embeddings');assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer vector-only');return new Response(JSON.stringify({data}))});
  try{
    process.env.AI_API_KEY='chat-only';process.env.AI_BASE_URL='https://chat.example.invalid/v1';process.env.AI_EMBEDDING_BASE_URL='https://vectors.example.invalid/v1';process.env.AI_EMBEDDING_MODEL='vector';process.env.AI_SIMILARITY_THRESHOLD='0.3';delete process.env.AI_EMBEDDING_API_KEY;
    assert.equal(isEmbeddingConfigured(),false);assert.throws(embeddingConfig,/AI_EMBEDDING_API_KEY/);await assert.rejects(semanticRetrieve(store,'方法',{page:'knowledge'}),/AI_EMBEDDING_API_KEY/);assert.equal(calls,0);
    process.env.AI_EMBEDDING_API_KEY='vector-only';assert.equal(isEmbeddingConfigured(),true);assert.equal((await semanticRetrieve(store,'方法',{page:'knowledge'})).length,1);
    data=[{index:0,embedding:[1,0,0]}];await assert.rejects(semanticRetrieve(store,'另一个查询',{page:'knowledge'}),/维度/);
    for(const invalid of [[null],[{index:0,embedding:[0,0]}],[{index:1,embedding:[1,0]}]]){data=invalid;await assert.rejects(semanticRetrieve(store,'方法',{page:'knowledge'}),/返回格式/)}
    process.env.AI_SIMILARITY_THRESHOLD='bad';assert.throws(embeddingConfig,/阈值/);
    process.env.AI_SIMILARITY_THRESHOLD='0.3';process.env.AI_EMBEDDING_BASE_URL='https://user:pass@vectors.example.invalid/v1';assert.throws(embeddingConfig,/HTTPS/);
  }finally{provider.mock.restore();store.db.close();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}}
});

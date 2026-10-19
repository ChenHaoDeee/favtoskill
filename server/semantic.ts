import { createHash } from 'node:crypto';
import type { ChatContext } from '../shared/contracts.js';
import type { Store } from './store.js';
import type { Hit } from './workflows.js';
import { ServiceError } from './ai.js';

export function embeddingConfig(){
  const model=process.env.AI_EMBEDDING_MODEL?.trim();
  if(!model)return null;
  const base=(process.env.AI_EMBEDDING_BASE_URL||process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  let url:URL;try{url=new URL(base)}catch{throw new ServiceError('INVALID_EMBEDDING_CONFIG','向量模型地址格式不正确。')}
  if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1')))throw new ServiceError('INVALID_EMBEDDING_CONFIG','向量模型服务需要 HTTPS 或本机地址。');
  const chatBase=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  // Never send a chat-provider secret to a separately configured embedding provider.
  const key=process.env.AI_EMBEDDING_API_KEY?.trim()||(base===chatBase?process.env.AI_API_KEY?.trim():undefined);
  if(!key)throw new ServiceError('EMBEDDING_NOT_CONFIGURED','请配置 AI_EMBEDDING_API_KEY；独立向量服务不会沿用其他平台的密钥。');
  const cutoff=Number(process.env.AI_SIMILARITY_THRESHOLD||0.3);
  if(!Number.isFinite(cutoff)||cutoff< -1||cutoff>1)throw new ServiceError('INVALID_EMBEDDING_CONFIG','向量相似度阈值需要是 -1 到 1 之间的数值。');
  return {model,base,key,cutoff};
}
export function isEmbeddingConfigured(){try{return Boolean(embeddingConfig())}catch{return false}}

export function cosine(a:number[],b:number[]){
  if(a.length!==b.length||!a.length)return 0;
  const dot=a.reduce((n,v,i)=>n+v*b[i],0),norm=Math.sqrt(a.reduce((n,v)=>n+v*v,0)*b.reduce((n,v)=>n+v*v,0));
  return norm?dot/norm:0;
}
async function embed(input:string[],config:NonNullable<ReturnType<typeof embeddingConfig>>):Promise<number[][]>{
  const {base,model,key}=config;
  let response:Response;
  try{response=await fetch(base+'/embeddings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,input}),redirect:'error',signal:AbortSignal.timeout(30000)})}catch{throw new ServiceError('EMBEDDING_UNAVAILABLE','语义索引连接失败，请重试。')}
  if(!response.ok)throw new ServiceError('EMBEDDING_UNAVAILABLE','语义索引服务不可用，请检查模型配置。');
  const json=await response.json().catch(()=>{throw new ServiceError('INVALID_EMBEDDING','向量模型返回格式不正确。',502)}) as {data?:{index:number;embedding:number[]}[]};
  if(!json||!Array.isArray(json.data)||json.data.some(r=>!r||!Number.isInteger(r.index)))throw new ServiceError('INVALID_EMBEDDING','向量模型返回格式不正确。',502);
  const rows=json.data?.sort((a,b)=>a.index-b.index);
  if(rows?.length!==input.length||rows.some((r,i)=>!r||r.index!==i||!Array.isArray(r.embedding)||!r.embedding.length||r.embedding.some(n=>!Number.isFinite(n))||!r.embedding.some(n=>n!==0)))throw new ServiceError('INVALID_EMBEDDING','向量模型返回格式不正确。',502);
  const size=rows[0].embedding.length;if(rows.some(r=>r.embedding.length!==size))throw new ServiceError('INVALID_EMBEDDING','向量维度不一致。',502);
  return rows.map(r=>r.embedding);
}
export async function semanticRetrieve(store:Store,query:string,context:ChatContext):Promise<Hit[]>{
  const config=embeddingConfig();if(!config)return [];
  const identity=config.base+'::'+config.model;
  store.db.exec('CREATE TABLE IF NOT EXISTS embeddings(hash TEXT PRIMARY KEY,model TEXT NOT NULL,vector TEXT NOT NULL)');
  const items=store.knowledge().filter(k=>context.knowledgeId?k.id===context.knowledgeId:context.categoryId?(context.categoryId==='unfiled'?!k.categoryId:k.categoryId===context.categoryId):true);
  const chunks=items.flatMap(item=>{
    const text=item.originalText||item.summary;const result=[];
    for(let start=0;start<text.length;start+=700){const body=text.slice(start,start+800);const hash=createHash('sha256').update(identity+'\0'+item.title+'\0'+body).digest('hex');result.push({item,text:body,hash,vector:undefined as number[]|undefined})}return result;
  });
  if(!chunks.length)return [];
  const uncached=chunks.filter(chunk=>{const row=store.db.prepare('SELECT vector FROM embeddings WHERE hash=? AND model=?').get(chunk.hash,identity);if(row)chunk.vector=JSON.parse(row.vector as string);return !chunk.vector});
  for(let i=0;i<uncached.length;i+=24){const batch=uncached.slice(i,i+24);const vectors=await embed(batch.map(c=>c.item.title+'\n'+c.text),config);batch.forEach((chunk,j)=>{chunk.vector=vectors[j];store.db.prepare('INSERT OR REPLACE INTO embeddings VALUES(?,?,?)').run(chunk.hash,identity,JSON.stringify(chunk.vector))})}
  const [q]=await embed([query],config);const {cutoff}=config;
  if(chunks.some(c=>c.vector?.length!==q.length))throw new ServiceError('INVALID_EMBEDDING','向量维度与已有索引不一致，请检查模型配置。',502);
  const scored=chunks.map(c=>({item:c.item,text:c.text,score:cosine(q,c.vector!)})).filter(h=>h.score>=cutoff).sort((a,b)=>b.score-a.score);
  const seen=new Set<string>();return scored.filter(h=>{if(seen.has(h.item.id))return false;seen.add(h.item.id);return true}).slice(0,5);
}

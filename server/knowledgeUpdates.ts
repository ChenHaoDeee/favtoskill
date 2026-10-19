import { createHash,randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Store } from './store.js';
import { ServiceError } from './ai.js';
import { parseDouyin } from './imports.js';
import type { KnowledgeUpdate } from '../shared/contracts.js';
export const sourceHash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function initUpdates(store:Store){store.db.exec('CREATE TABLE IF NOT EXISTS knowledge_updates(id TEXT PRIMARY KEY,body TEXT NOT NULL)')}
export function stageUpdate(store:Store,knowledgeId:string,afterText:string,source:KnowledgeUpdate['source'],note:string){
  initUpdates(store);const item=store.knowledge().find(k=>k.id===knowledgeId);
  if(!item)throw new ServiceError('NOT_FOUND','资料不存在。',404);
  if(item.originalText===afterText)throw new ServiceError('NO_CONTENT_CHANGE','原文没有变化，无需更新。',409);
  const update:KnowledgeUpdate={id:randomUUID(),knowledgeId,beforeText:item.originalText,afterText,source,note};
  store.db.prepare('INSERT INTO knowledge_updates VALUES(?,?)').run(update.id,JSON.stringify(update));return update;
}
export function pendingUpdates(store:Store,categoryId?:string){
  initUpdates(store);const items=store.knowledge().filter(k=>!categoryId||(categoryId==='unfiled'?!k.categoryId:k.categoryId===categoryId));
  const latest=new Map<string,KnowledgeUpdate>();
  for(const row of store.db.prepare('SELECT body FROM knowledge_updates ORDER BY rowid').all()){
    const update=JSON.parse(row.body as string) as KnowledgeUpdate;
    latest.set(update.knowledgeId,update);
  }
  return [...latest.values()].filter(u=>items.some(k=>k.id===u.knowledgeId&&sourceHash(k.originalText)===sourceHash(u.beforeText)&&k.originalText!==u.afterText));
}
export function registerUpdates(app:FastifyInstance,store:Store){
  initUpdates(store);
  app.post('/knowledge/:id/updates/preview',async req=>{
    const body=z.discriminatedUnion('kind',[z.object({kind:z.literal('text'),text:z.string().trim().min(1).max(100000)}),z.object({kind:z.literal('source')})]).parse(req.body);
    const id=(req.params as {id:string}).id;const item=store.knowledge().find(k=>k.id===id);
    if(!item)throw new ServiceError('NOT_FOUND','资料不存在。',404);
    if(body.kind==='text'){let update;const undoId=store.mutate(()=>{update=stageUpdate(store,id,body.text,'manual','用户提供的新原文，请核对后更新。')});return {...update!,undoId}}
    if(item.provenance?.kind!=='tikhub'||!item.sourceUrl)throw new ServiceError('UNSUPPORTED_UPDATE_SOURCE','这条资料不是 TikHub 导入文案，请先手动补充原文。',422);
    const parsed=await parseDouyin(item.sourceUrl);
    if(parsed.id!==item.provenance.originalId)throw new ServiceError('UPDATE_SOURCE_MISMATCH','返回的作品与原资料不一致，未生成更新。',502);
    let update;const undoId=store.mutate(()=>{update=stageUpdate(store,id,parsed.text,'tikhub','重新读取的帖子文案，未提取视频语音或图片文字。')});return {...update!,undoId};
  });
}

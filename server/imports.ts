import { createHash,randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Knowledge } from '../shared/contracts.js';
import { ServiceError } from './ai.js';
import type { Store } from './store.js';

const textInput=z.object({kind:z.literal('text'),title:z.string().trim().min(1).max(200),text:z.string().trim().min(1).max(100000)});
const linkInput=z.object({kind:z.literal('link'),shareText:z.string().trim().min(1).max(5000)});
const inputSchema=z.discriminatedUnion('kind',[textInput,linkInput]);
type Draft={id:string;status:'preview'|'saved';item:Knowledge;warnings:string[];createdAt:string;knowledgeId?:string;undoId?:string;duplicate?:boolean};
export const isLinkImportConfigured=()=>Boolean(process.env.TIKHUB_API_KEY?.trim());

export function douyinShareUrl(text:string){
  const links=text.match(/https?:\/\/[^\s<>"'，。！？）】]+/g)||[];
  if(links.length!==1)throw new ServiceError('INVALID_SHARE_URL','请提供一条抖音作品分享链接。',400);
  let url:URL;try{url=new URL(links[0])}catch{throw new ServiceError('INVALID_SHARE_URL','分享链接格式不正确。',400)}
  const hosts=['v.douyin.com','www.douyin.com','douyin.com','www.iesdouyin.com','iesdouyin.com'];
  if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname))throw new ServiceError('UNSUPPORTED_IMPORT_URL','目前仅支持 HTTPS 抖音作品分享链接。',400);
  if(url.hostname==='v.douyin.com'?!/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname):!/^\/(?:video|note|share\/video)\/\d+\/?$/.test(url.pathname))throw new ServiceError('INVALID_SHARE_URL','请使用作品链接，不支持用户主页或搜索链接。',400);
  url.hash='';return url.toString();
}

// This adapter imports post captions only. Video ASR/OCR must be a separate capability.
export async function parseDouyin(shareText:string):Promise<{id:string;text:string}>{
  const shareUrl=douyinShareUrl(shareText);
  if(!isLinkImportConfigured())throw new ServiceError('IMPORT_NOT_CONFIGURED','抖音链接解析尚未配置，请在服务端填写 TIKHUB_API_KEY；也可以先导入文本。');
  const url=new URL('https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url');url.searchParams.set('share_url',shareUrl);
  let response:Response;
  try{response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.TIKHUB_API_KEY!.trim()}`},redirect:'error',signal:AbortSignal.timeout(30000)})}catch{throw new ServiceError('IMPORT_PROVIDER_UNAVAILABLE','链接解析服务连接失败或超时，请稍后重试。')}
  if(!response.ok)throw new ServiceError('IMPORT_PROVIDER_ERROR',`链接解析服务请求失败（${response.status}），请检查配置或额度。`);
  const envelope=z.object({code:z.number(),data:z.unknown()}).safeParse(await response.json().catch(()=>null));
  if(!envelope.success)throw new ServiceError('INVALID_IMPORT_RESPONSE','链接解析返回格式不正确。',502);
  if(envelope.data.code!==200)throw new ServiceError('IMPORT_PROVIDER_ERROR','链接解析服务未成功返回作品，请检查权限或额度。');
  const data=envelope.data.data;
  const candidate=data&&typeof data==='object'&&'aweme_detail' in data?data.aweme_detail:data;
  const post=z.object({aweme_id:z.string().regex(/^\d+$/),desc:z.string().trim().min(1).max(100000)}).safeParse(candidate);
  if(!post.success)throw new ServiceError('IMPORT_CONTENT_UNAVAILABLE','作品不可用或缺少可导入的文案；未保存任何资料。',422);
  return {id:post.data.aweme_id,text:post.data.desc};
}

export function registerImports(app:FastifyInstance,store:Store){
  store.db.exec('CREATE TABLE IF NOT EXISTS import_previews(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
  const read=(id:string)=>{const row=store.db.prepare('SELECT body FROM import_previews WHERE id=?').get(id);if(!row)throw new ServiceError('NOT_FOUND','导入预览不存在。',404);return JSON.parse(row.body as string) as Draft};
  const put=(draft:Draft)=>store.db.prepare('INSERT INTO import_previews VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(draft.id,JSON.stringify(draft));
  const existing=(item:Knowledge)=>store.knowledge().find(k=>item.provenance?.kind==='tikhub'?k.sourcePlatform==='抖音'&&k.sourceUrl===item.sourceUrl:k.originalText===item.originalText);
  app.post('/imports/preview',async req=>{
    const input=inputSchema.parse(req.body);const now=new Date().toISOString();
    let title:string,text:string,originalId:string,sourceUrl:string|null=null;
    if(input.kind==='link'){const parsed=await parseDouyin(input.shareText);text=parsed.text;title=text.slice(0,200);originalId=parsed.id;sourceUrl=`https://www.douyin.com/video/${parsed.id}`}
    else{title=input.title;text=input.text;originalId=createHash('sha256').update(text).digest('hex')}
    const kind=input.kind==='link'?'tikhub':'manual-text';
    const item:Knowledge={id:randomUUID(),title,originalText:text,sourceUrl,sourcePlatform:input.kind==='link'?'抖音':'文本',summary:'',keyPoints:[],tags:[],categoryId:null,completeness:'fragment',createdAt:now,updatedAt:now,provenance:{kind,repository:input.kind==='link'?'TikHub Douyin Web API':'用户主动导入文本',commit:'',file:input.kind==='link'?'/api/v1/douyin/web/fetch_one_video_by_share_url':'text',originalId,textKind:input.kind==='link'?'post_caption':'user_supplied_text'}};
    const draft:Draft={id:randomUUID(),status:'preview',item,createdAt:now,warnings:input.kind==='link'?['仅导入帖子文案，未提取视频语音、字幕或图片文字。']:['保存的是用户提供的文本，未验证其是否为完整原文。']};put(draft);return draft;
  });
  app.get('/imports/preview/:id',async req=>read((req.params as {id:string}).id));
  app.post('/imports/preview/:id/confirm',async req=>{
    const {categoryId=null}=z.object({categoryId:z.string().nullable().optional()}).parse(req.body||{});
    const draft=read((req.params as {id:string}).id);
    if(draft.status==='saved'){
      if(!store.knowledge().some(k=>k.id===draft.knowledgeId))throw new ServiceError('IMPORT_REMOVED','已导入的资料已移除或撤回，请重新预览后再保存。',409);
      return draft;
    }
    if(categoryId&&!store.categories().some(c=>c.id===categoryId))throw new ServiceError('INVALID_CATEGORY','分类不存在，请重新选择。',400);
    const found=existing(draft.item);
    if(found){const saved:Draft={...draft,status:'saved',item:found,knowledgeId:found.id,duplicate:true};put(saved);return saved}
    const item={...draft.item,categoryId,updatedAt:new Date().toISOString()};let saved:Draft;
    store.mutate(undoId=>{store.putKnowledge(item);saved={...draft,status:'saved',item,knowledgeId:item.id,duplicate:false,undoId};put(saved)});
    return saved!;
  });
}

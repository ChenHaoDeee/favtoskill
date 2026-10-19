import type { AiMode,ApiError, Category, ChatRequest, ChatResponse, Conversation, Health, Knowledge, Message, Skill,OrganizePlan,Suggestion } from '../shared/contracts';
const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
export const isDemo=new URLSearchParams(location.search).get('workspace')==='demo';
export const AI_MODE_KEY='favtoskill-ai-mode-v2';
// Old demo defaults are intentionally not migrated as an explicit offline choice.
export const getMode=():AiMode=>isDemo&&localStorage.getItem(AI_MODE_KEY)==='demo'?'demo':'real';
async function requestResponse(path:string,options?:RequestInit,workspace:'demo'|'personal'=isDemo?'demo':'personal'):Promise<Response> {
  let response:Response;
  try {response=await fetch(`${base}/api${workspace==='demo'?'/demo':''}${path}`,{...options,headers:{'Content-Type':'application/json',...options?.headers},signal:AbortSignal.timeout(150000)})}
  catch {throw new Error('无法连接服务，请检查后端是否启动后重试。')}
  if(!response.ok){const data=await response.json().catch(()=>null) as ApiError|null;throw new Error(data?.error.message||`请求失败（${response.status}）`)}
  return response;
}
export async function request<T>(path:string,options?:RequestInit,workspace:'demo'|'personal'=isDemo?'demo':'personal'):Promise<T>{
  return (await requestResponse(path,options,workspace)).json() as Promise<T>;
}
export const write=<T>(path:string,body:unknown,method='POST')=>request<T>(path,{method,body:JSON.stringify(body)});
export const api={health:()=>request<Health>('/health'),categories:()=>request<{items:Category[]}>('/categories'),knowledge:()=>request<{items:Knowledge[]}>('/knowledge'),skills:()=>request<{items:Skill[]}>('/skills'),conversations:()=>request<{items:Conversation[]}>('/conversations'),messages:(id:string)=>request<{items:Message[]}>(`/conversations/${id}/messages`),chat:(body:ChatRequest)=>write<ChatResponse>('/chat',{...body,mode:getMode()}),suggestions:()=>request<{items:Suggestion[]}>('/suggestions'),organize:(categoryId?:string)=>write<OrganizePlan>('/organize/plans',{mode:getMode(),categoryId})};
export function downloadText(name:string,content:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function exportSkill(id:string,format:'markdown'|'json'='markdown'){
  const result=await request<{filename:string;markdown:string;bundle:unknown}>(`/skills/${id}/export`);
  downloadText(result.filename+(format==='markdown'?'.md':'.json'),format==='markdown'?result.markdown:JSON.stringify(result.bundle,null,2),format==='markdown'?'text/markdown;charset=utf-8':'application/json');
}

export async function exportSkillArchive(id:string){
  const response=await requestResponse(`/skills/${encodeURIComponent(id)}/export?format=zip`);
  const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`favtoskill-${id.replace(/[^a-zA-Z0-9_-]/g,'-')}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

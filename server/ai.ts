export class ServiceError extends Error {
  constructor(public code:string,message:string,public status=503){super(message)}
}
export const isAiConfigured=()=>Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_MODEL?.trim());
export async function complete(messages:{role:'system'|'user'|'assistant';content:string}[],format?:'json') {
  if(!isAiConfigured()) throw new ServiceError('AI_NOT_CONFIGURED','AI 服务尚未配置。请在服务端 .env 中设置模型密钥和模型名称。');
  const base=process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  if(!base.startsWith('https://') && !base.startsWith('http://127.0.0.1:')) throw new ServiceError('INVALID_AI_ENDPOINT','模型服务地址需要使用 HTTPS。');
  let response:Response;
  try {
    response=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_API_KEY}`},body:JSON.stringify({model:process.env.AI_MODEL,messages,temperature:0.3,...(format==='json'?{response_format:{type:'json_object'}}:{})}),signal:AbortSignal.timeout(45000)});
  } catch {throw new ServiceError('AI_UNAVAILABLE','模型服务连接失败或超时，请稍后重试。')}
  if(!response.ok) throw new ServiceError('AI_PROVIDER_ERROR',`模型服务请求失败（${response.status}），请检查服务端配置或稍后重试。`);
  const data=await response.json().catch(()=>{throw new ServiceError('INVALID_AI_RESPONSE','模型服务未返回有效 JSON，请检查服务地址。',502)}) as {choices?:{message?:{content?:string}}[]};
  const content=data.choices?.[0]?.message?.content;
  if(!content?.trim()) throw new ServiceError('AI_EMPTY_RESPONSE','模型未返回有效内容，请重试。');
  return content;
}

import { useState } from 'react';
import { api,write } from '../api';
import type { Health } from '../../shared/contracts';
import { Modal } from './WorkspaceTools';

export default function AiStatus(){
  const [open,setOpen]=useState(false);const [health,setHealth]=useState<Health|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState('');
  async function refresh(){setBusy(true);setError('');setResult('');try{setHealth(await api.health())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function check(){setBusy(true);setError('');setResult('');try{const r=await write<{ok:boolean;latencyMs:number}>('/ai/check',{});setResult(`模型已响应 · ${(r.latencyMs/1000).toFixed(1)} 秒。可以开始真实 AI 问答与 Skill 试运行。`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <><button className="text-button" onClick={()=>{setOpen(true);void refresh()}}>AI 连接</button>{open&&<Modal title="AI 服务连接" onClose={()=>setOpen(false)}>
    {health&&<><p className="mode-note">{health.aiConfigured?'已填写模型配置，尚需检测连接':'尚未配置模型密钥'}<br/>模型：{health.model||'未设置'}<br/>检索：{health.embeddingConfigured?'关键词 + 语义检索':'关键词检索（可选启用语义检索）'}</p><p className="muted">在项目根目录的 .env 中设置 AI_API_KEY、AI_BASE_URL 和 AI_MODEL，保存后重启后端。密钥仅保存在服务端，无需输入到网页。</p><p className="mode-note">演示资料也默认使用真实 AI；仅手动选择离线演示时不调用模型。检测会向已配置的模型发送一条简短请求，可能产生少量 API 费用，不发送收藏内容。</p></>}
    {error&&<p className="error-box" role="alert">{error}</p>}{result&&<p className="flow-output" role="status">{result}</p>}{busy&&<p role="status">正在检查服务…</p>}
    <div className="flow-buttons"><button className="secondary-button" disabled={busy} onClick={()=>void refresh()}>刷新配置</button><button className="primary-button" disabled={busy||!health?.aiConfigured} onClick={()=>void check()}>检测模型连接</button></div>
  </Modal>}</>;
}

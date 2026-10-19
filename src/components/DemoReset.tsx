import { useState } from 'react';
import { AI_MODE_KEY,write } from '../api';
import { Modal } from './WorkspaceTools';
export default function DemoReset({onReset}:{onReset:(undoId:string)=>void}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[offline,setOffline]=useState(true),[error,setError]=useState('');
  async function reset(){setBusy(true);setError('');try{const result=await write<{undoId:string}>('/demo/reset',{confirmed:true});if(offline)localStorage.setItem(AI_MODE_KEY,'demo');setOpen(false);onReset(result.undoId)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <><button className="text-button" onClick={()=>{setError('');setOpen(true)}}>刷新演示数据</button>{open&&<Modal title="重新准备演示" onClose={()=>{if(!busy)setOpen(false)}}><p className="flow-output">恢复预设收藏与 Skill，重新准备未分类、重复收藏和资料更新三个场景。演示库里新增或修改的资料会被替换；个人库和模型配置不受影响。历史对话保留，旧的自建资料引用可能失效。</p><label className="demo-reset-option"><input type="checkbox" checked={offline} disabled={busy} onChange={e=>setOffline(e.target.checked)}/>同时切换离线演示，不调用模型</label><p className="muted">本次刷新可从完成提示中撤回；普通浏览器刷新仍会保留当前数据。</p>{error&&<p className="error-box" role="alert">{error}</p>}<div className="flow-buttons"><button className="secondary-button" disabled={busy} onClick={()=>setOpen(false)}>取消</button><button className="primary-button" disabled={busy} onClick={()=>void reset()}>{busy?'准备中…':'确认刷新演示'}</button></div></Modal>}</>;
}

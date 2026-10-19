import { useState } from 'react';
import type { Knowledge,Skill } from '../../shared/contracts';
import { Download,Edit } from './Icons';
import SkillIdentity from './SkillIdentity';
import { CollectionCard } from './ContentCards';
import { exportSkillArchive,write } from '../api';
import { Modal } from './WorkspaceTools';

export function SkillEditor({skill,knowledge,onMutation,onRemoved}:{skill:Skill;knowledge:Knowledge[];onMutation:(id:string,message:string)=>void;onRemoved:()=>void}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(skill),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState(false);
  async function save(){setBusy(true);setError('');try{const result=await write<{undoId:string}>(`/skills/${skill.id}`,draft,'PATCH');onMutation(result.undoId,'Skill 已更新，可撤回。');setOpen(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function remove(){setBusy(true);setError('');try{const result=await write<{undoId:string}>(`/skills/${skill.id}`,{confirmed:true},'DELETE');onMutation(result.undoId,'Skill 已删除，可撤回。');setOpen(false);onRemoved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <><button className="header-edit-button" aria-label="编辑 Skill" onClick={()=>{setDraft({...skill,knowledgeIds:skill.knowledgeIds.filter(id=>knowledge.some(k=>k.id===id))});setDeleting(false);setError('');setOpen(true)}}><Edit size={20}/></button>{open&&<Modal title={deleting?'删除 Skill':'编辑 Skill'} onClose={()=>{if(!busy)setOpen(false)}}>{deleting?<p className="flow-output">删除「{skill.name}」？关联收藏会保留，完成后可从提示中撤回。</p>:<>
    <label className="field">名称<input maxLength={80} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label className="field">简介<textarea maxLength={1000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    {(['scenarios','steps','limitations','externalDependencies'] as const).map(field=><label className="field" key={field}>{{scenarios:'适用场景',steps:'执行步骤',limitations:'使用限制',externalDependencies:'外部依赖'}[field]}（每行一项）<textarea value={draft[field].join('\n')} onChange={e=>setDraft({...draft,[field]:e.target.value.split('\n').filter(Boolean)})}/></label>)}
    {(['inputRequirements','outputFormat'] as const).map(field=><label className="field" key={field}>{field==='inputRequirements'?'输入要求':'输出形式'}<textarea value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}
    <details className="skill-edit-sources"><summary>关联收藏 · 已选 {draft.knowledgeIds.length} 条</summary><div className="source-picker">{knowledge.map(k=><label key={k.id}><input type="checkbox" checked={draft.knowledgeIds.includes(k.id)} disabled={!draft.knowledgeIds.includes(k.id)&&draft.knowledgeIds.length>=36} onChange={e=>setDraft({...draft,knowledgeIds:e.target.checked?[...draft.knowledgeIds,k.id]:draft.knowledgeIds.filter(id=>id!==k.id)})}/>{k.title}</label>)}</div></details>
    <button className="text-button danger" disabled={busy} onClick={()=>setDeleting(true)}>删除 Skill</button>
    </>}{error&&<p className="error-box" role="alert">{error}</p>}<div className="flow-buttons"><button className="secondary-button" disabled={busy} onClick={()=>deleting?setDeleting(false):setOpen(false)}>{deleting?'返回编辑':'取消'}</button><button className="primary-button" disabled={busy||(!deleting&&(!draft.name.trim()||!draft.description.trim()||!draft.knowledgeIds.length))} onClick={()=>void(deleting?remove():save())}>{busy?'正在保存…':deleting?'确认删除':'保存修改'}</button></div></Modal>}</>;
}

export default function SkillDetail({skill,knowledge,onSource}:{skill:Skill;knowledge:Knowledge[];onSource:(id:string)=>void}){
  const sources=knowledge.filter(k=>skill.knowledgeIds.includes(k.id));
  const [exporting,setExporting]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
  async function download(){setExporting(true);setError('');setSuccess(false);try{await exportSkillArchive(skill.id);setSuccess(true)}catch(e){setError((e as Error).message)}finally{setExporting(false)}}
  return <article className="skill-detail skill-detail-refined">
    <section className="skill-introduction"><SkillIdentity skill={skill}/>
      <div className="skill-detail-facts"><div><strong>{sources.length}</strong><span>关联收藏</span></div><div><strong>{new Date(skill.updatedAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}</strong><span>最近更新</span></div></div>
      {skill.scenarios.length>0&&<div className="tags">{skill.scenarios.map((s,i)=><span key={i}>{s}</span>)}</div>}
      <button className="primary-button skill-export-primary" disabled={exporting} onClick={()=>void download()}><span>{exporting?'正在打包…':'导出 Skill'}</span><Download size={21}/></button>
      {error&&<p className="skill-export-feedback error-box" role="alert">{error}</p>}{success&&<p className="skill-export-feedback" role="status">已生成 ZIP，包含 Skill 规则、结构化定义和关联原文。</p>}
    </section>
    <section className="skill-full-definition" aria-label="Skill 完整定义"><h2>Skill 完整定义</h2><div><h3>适用场景</h3>{skill.scenarios.length?<ul>{skill.scenarios.map((s,i)=><li key={i}>{s}</li>)}</ul>:<p>按任务需要使用。</p>}</div><div><h3>输入要求</h3><p>{skill.inputRequirements}</p></div><div><h3>执行步骤</h3><ol>{skill.steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div><div><h3>输出形式</h3><p>{skill.outputFormat}</p></div><div><h3>使用限制</h3>{skill.limitations.length?<ul>{skill.limitations.map((s,i)=><li key={i}>{s.replace(/^旧项目预设\s*Skill[；;]\s*/i,'')}</li>)}</ul>:<p>未设置额外限制。</p>}</div>{skill.externalDependencies.length>0&&<div><h3>外部依赖</h3><ul>{skill.externalDependencies.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}</section>
    <section className="skill-related" aria-label="关联收藏"><h2>关联收藏 <span>{sources.length}</span></h2>{sources.length?<div className="collection-grid">{sources.map(k=><CollectionCard key={k.id} item={k} onOpen={()=>onSource(k.id)}/>)}</div>:<p className="muted">关联资料暂不可用，可从右上角编辑重新选择。</p>}{sources.length<skill.knowledgeIds.length&&<p className="muted">有 {skill.knowledgeIds.length-sources.length} 条关联资料已移除，请编辑引用后再导出。</p>}</section>
  </article>;
}

import { useEffect,useState } from 'react';
import type { Knowledge } from '../../shared/contracts';
import { AiStar } from './Icons';
import { getMode,write } from '../api';

export function CategoryOverview({items,categoryId}:{items:Knowledge[];categoryId:string}){
  const [overview,setOverview]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);const [coverage,setCoverage]=useState('');
  const signature=JSON.stringify(items.map(k=>[k.id,k.title,k.updatedAt,k.summary,k.originalText]));
  const mode=getMode();
  useEffect(()=>{
    let cancelled=false;setOverview('');setError('');setCoverage('');
    if(!items.length||mode!=='real'){setBusy(false);return}
    setBusy(true);
    void write<{overview:string;sampleCount:number;totalCount:number}>(`/categories/${encodeURIComponent(categoryId)}/overview`,{mode}).then(result=>{if(!cancelled){setOverview(result.overview);if(result.sampleCount<result.totalCount)setCoverage(`依据其中 ${result.sampleCount} 条资料概括`)}}).catch(e=>{if(!cancelled)setError((e as Error).message)}).finally(()=>{if(!cancelled)setBusy(false)});
    return()=>{cancelled=true};
  },[categoryId,signature,mode,attempt]);
  const fallback=!items.length?'这里还没有收藏。把相关内容放进来，方便下次遇到问题时找到。':`这里保存了${items.slice(0,2).map(k=>`「${k.title}」`).join('、')}等资料，可从具体内容中回顾方法，或向 AI 提问。`;
  return <section className="category-overview" aria-label="分类内容摘要"><div><h2><AiStar size={16}/>分类摘要{busy&&<span className="overview-state" role="status">正在概括…</span>}</h2><p>{overview||fallback}</p>{coverage&&<small>{coverage}</small>}{error&&<div className="overview-feedback"><small>AI 摘要暂不可用，以上为资料概览</small><button className="text-button" title={error} onClick={()=>setAttempt(n=>n+1)}>重试</button></div>}</div></section>;
}

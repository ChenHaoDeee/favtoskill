import { useEffect,useState } from 'react';
import type { Knowledge } from '../../shared/contracts';
import PlatformMark,{platformName } from './PlatformMark';
import { ArrowUpRight,FileText } from './Icons';
import { getMode,write } from '../api';
type Analysis={summary:string;points:{title:string;description:string}[];truncated:boolean};
export default function KnowledgeDetail({item}:{item:Knowledge}){
  const [expanded,setExpanded]=useState(false);const [analysis,setAnalysis]=useState<Analysis|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
  const mode=getMode();
  useEffect(()=>{let cancelled=false;setAnalysis(null);setError('');if(mode!=='real'||!item.originalText.trim()){setBusy(false);return}setBusy(true);
    void write<Analysis>(`/knowledge/${encodeURIComponent(item.id)}/analysis`,{mode}).then(result=>{if(!cancelled)setAnalysis(result)}).catch(e=>{if(!cancelled)setError((e as Error).message)}).finally(()=>{if(!cancelled)setBusy(false)});
    return()=>{cancelled=true};
  },[item.id,item.title,item.originalText,mode,attempt]);
  const sourceUrl=item.sourceUrl&&/^https?:\/\//.test(item.sourceUrl)?item.sourceUrl:null;
  const original=item.originalText;const long=original.length>300;
  return <article className="knowledge-detail detail-reading">
    <section className="knowledge-media" aria-label="收藏图片">{item.imagePath?<img src={item.imagePath} alt={item.title}/>:<div className="knowledge-media-empty"><FileText size={32}/><span>这条收藏没有图片</span></div>}</section>
    <div className="knowledge-title"><h1>{item.title}</h1><div className="knowledge-meta"><span><PlatformMark platform={platformName(item)}/>{platformName(item)} · {item.provenance?.textKind==='repository_transcript'?'视频文字稿':'已保存资料'}</span><time dateTime={item.createdAt}>收藏于 {new Date(item.createdAt).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}</time></div></div>

    <section className="reading-card analysis-card" aria-label="AI 解析"><header className="analysis-heading"><img src="/brand/mascot-transparent.png" alt=""/><h2>AI 帮你划重点</h2></header>
      <p className="analysis-lead">{analysis?.summary||item.summary||'暂无摘要，可以围绕原文向 AI 提问。'}</p>
      {!analysis&&busy&&<p className="reading-note" role="status">AI 解析生成中，上方暂显示已保存摘要。</p>}
      {mode==='demo'&&<p className="reading-note">已保存摘要 · 未调用模型</p>}
      {error&&<div className="analysis-error" role="alert"><span>AI 解析暂不可用，上方为已保存摘要。</span><button className="text-button" title={error} onClick={()=>setAttempt(n=>n+1)}>重试</button></div>}
      <div className="analysis-points">{(analysis?.points||item.keyPoints.map(text=>({title:text,description:''}))).map((point,index)=><div className="analysis-point" key={index}><span className="point-index">{index+1}</span><span><strong>{point.title}</strong>{point.description&&<small>{point.description}</small>}</span></div>)}</div>
      {analysis?.truncated&&<p className="reading-note">本次解析依据原文前 12000 字。</p>}

    </section>
    <section className="reading-card original-card" aria-label="原始内容"><header><h2>原始内容</h2>{sourceUrl?<a className="original-link" href={sourceUrl} target="_blank" rel="noreferrer">查看原文<ArrowUpRight size={16}/></a>:<small>原帖链接未提供</small>}</header><p className="saved-original">{original?(expanded?original:original.slice(0,300)+(long?'…':'')):'尚未保存文字原文。'}</p>{long&&<button className="text-button expand-original" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起原文':'展开全部原文'}</button>}{item.completeness!=='complete'&&<p className="reading-note">仅保存了内容片段，可能有转录遗漏。</p>}</section>
    {item.provenance?.kind==='share-demo'&&<p className="reading-note demo-provenance">分享流程演示预设资料：文字、摘要和初始分类为示例，不是从抖音或视频解析得到。</p>}
    {item.provenance?.kind==='demo'&&<p className="reading-note demo-provenance">演示资料：来自预设演示模板；平台分配用于展示，不代表真实跨平台导入。</p>}
  </article>;
}

import SkillConversationCard from './SkillConversationCard';
import type {ChatTurn,CardAction} from './conversationCards';
import type { ReactNode } from 'react';
import type { Knowledge } from '../../shared/contracts';
import PlatformMark,{platformName} from './PlatformMark';
import { FileText } from './Icons';

// Render a small, safe Markdown subset as React nodes, never raw model HTML.
function Answer({content,sources,onSource}:{content:string;sources:Knowledge[];onSource:(id:string)=>void}){
  function inline(text:string):ReactNode[]{
    return text.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\])/g).map((part,i)=>{
      if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
      if(part.startsWith('[')&&part.endsWith(']')){
        const ref=part.slice(1,-1);const index=sources.findIndex(s=>s.id===ref);
        const numeric=/^\d+$/.test(ref)?Number(ref)-1:-1;const found=index>=0?index:numeric;
        if(found>=0&&found<sources.length)return <button className="citation-chip" key={i} aria-label={`查看来源 ${found+1}：${sources[found].title}`} onClick={()=>onSource(sources[found].id)}>{found+1}</button>;
      }
      return part;
    });
  }
  return <div className="answer-text">{content.replace(/([；;])\s*(?=\d+[）).、])/g,'$1\n\n').split(/\n\s*\n/).filter(Boolean).map((block,i)=>{
    const lines=block.split('\n');
    if(lines.length>=2&&/^\s*\|/.test(lines[0])&&/^\s*\|?[\s:|-]+\|\s*$/.test(lines[1])){
      const cells=(line:string)=>line.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
      return <div className="answer-table-scroll" key={i}><table><thead><tr>{cells(lines[0]).map((cell,j)=><th key={j}>{inline(cell)}</th>)}</tr></thead><tbody>{lines.slice(2).map((line,j)=><tr key={j}>{cells(line).map((cell,k)=><td key={k}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
    }
    return <div className="answer-block" key={i} style={{animationDelay:`${Math.min(i*65,260)}ms`}}>{lines.map((line,j)=>{
      const heading=line.match(/^#{1,6}\s+(.+)/);const bullet=line.match(/^(?:[-*]\s+|\d+[.、)）]\s*)(.+)/);
      return heading?<h3 key={j}>{inline(heading[1])}</h3>:bullet?<p className="answer-list-item" key={j}><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></p>:<p key={j}>{inline(line)}</p>;
    })}</div>;
  })}</div>;
}
export default function ChatMessage({message,knowledge,onSource,onCardAction,onSkillOpen,busy=false}:{message:ChatTurn;knowledge:Knowledge[];onSource:(id:string)=>void;onCardAction?:(action:CardAction)=>void;onSkillOpen?:(id:string)=>void;busy?:boolean}){
  const sources=message.sources.map(id=>knowledge.find(k=>k.id===id)).filter((k):k is Knowledge=>Boolean(k));
  if(message.role==='user')return <article className="message user" aria-label="用户提问"><div className="user-bubble">{message.content}</div></article>;
  return <article className="message assistant" aria-label="AI 回答">
    <img className="message-avatar" src="/brand/mascot-transparent.png" alt="藏点本事 AI"/>
    <div className="assistant-content">{message.card?<SkillConversationCard message={message} knowledge={knowledge} busy={busy} onAction={onCardAction} onSkillOpen={onSkillOpen}/>:<div className="answer-bubble"><Answer content={message.content} sources={sources} onSource={onSource}/></div>}
      {sources.length>0&&<section className="answer-sources" aria-label="回答参考来源"><h3>参考来源 <span>({sources.length})</span></h3><div className="source-strip">{sources.map((item,i)=><button className="answer-source-card" key={item.id} onClick={()=>onSource(item.id)}>{item.imagePath?<img src={item.imagePath} alt="" loading="lazy"/>:<span className="source-placeholder"><FileText size={24}/></span>}<strong>{i+1}. {item.title}</strong><small><PlatformMark platform={platformName(item)}/>{platformName(item)} · {item.completeness==='complete'?'已保存':'已保存片段'}</small></button>)}</div></section>}
    </div>
  </article>;
}

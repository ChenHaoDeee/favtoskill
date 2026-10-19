import PlatformMark,{platformName} from './PlatformMark';
import { useId } from 'react';
import { ArrowUpRight, Blocks, ChevronRight, FileText,Video } from './Icons';
import { skillAppearance } from './skillAppearance';
import { categoryAppearance } from './categoryAppearance';
import type { Category, Knowledge, Skill } from '../../shared/contracts';
export function SourceCover({item}:{item:Knowledge}){
  return item.imagePath?<img className="source-cover" src={item.imagePath} alt={item.title} loading="lazy"/>:<div className="text-cover"><FileText size={20}/><span>{item.title}</span><small>{item.sourcePlatform||'文字收藏'}</small></div>;
}
export function CategoryCard({category,items,onOpen,preview=false}:{category:Category;items:Knowledge[];onOpen:()=>void;preview?:boolean}){
  const {Icon,tone}=categoryAppearance(category);
  const fillId='folder-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const covers=items.filter(item=>Boolean(item.imagePath)).slice(0,3);
  const Surface=preview?'div':'button';
  return <Surface className={`category-card tone-${tone}`} onClick={preview?undefined:onOpen}>
    <div className="folder-covers" aria-hidden="true">
      {covers.map((item,i)=><div className={`folder-cover folder-cover-${i+1}`} key={item.id}><img src={item.imagePath!} alt="" loading="lazy"/></div>)}
      {!covers.length&&<span className="folder-empty-sheet"><FileText size={26}/></span>}
    </div>
    <div className="folder-front">
      {/* Decorative folder surface; all semantic icons remain IconPark. */}
      <svg className="folder-surface" viewBox="0 0 320 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={fillId} x1="0" y1="0" x2="0.8" y2="1"><stop offset="0%" stopColor="var(--stack-light)"/><stop offset="100%" stopColor="#fff"/></linearGradient></defs><path d="M3 49Q3 9 43 9H82Q101 9 114 26L121 34Q132 46 151 46L277 39Q317 37 317 78V134Q317 167 284 167H36Q3 167 3 134Z" fill={`url(#${fillId})`} stroke="white" strokeWidth="4"/></svg>
      <div className="category-caption"><span className="folder-topic-icon" aria-hidden="true"><Icon size={26} theme="filled" strokeWidth={3}/></span><div className="folder-label"><h3>{category.name}</h3><p>{items.length} 条收藏</p></div><span className="category-chevron" aria-hidden="true"><ChevronRight size={22} strokeWidth={4}/></span></div>
    </div>
  </Surface>;
}
export function CollectionCard({item,onOpen}:{item:Knowledge;onOpen:()=>void}){
  return <button className="collection-card" onClick={onOpen}><SourceCover item={item}/><h3>{item.title}</h3><p className="collection-source"><PlatformMark platform={platformName(item)}/><span>{platformName(item)}</span></p></button>;
}
export function SkillCard({skill,sourceCount,onOpen}:{skill:Skill;sourceCount:number;onOpen:()=>void}){
  const {Icon,tone}=skillAppearance(skill);
  return <button className="skill-card" onClick={onOpen}><span className={`skill-icon skill-tone-${tone}`}><Icon size={26}/></span><div><h3>{skill.name}</h3><p>{skill.description}</p><small>关联 {sourceCount} 条收藏</small></div><ChevronRight size={19}/></button>;
}
export function SourceLink({item,onOpen}:{item:Knowledge;onOpen:()=>void}){return <button className="source-link" onClick={onOpen}><FileText size={18}/><span>{item.title}</span><ArrowUpRight size={17}/></button>}

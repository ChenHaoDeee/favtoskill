import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Blocks, Bookmark, FilePlus2, Settings, Search, Sparkles, X } from './components/Icons';
import { api,getMode,isDemo,write,AI_MODE_KEY } from './api';
import type { Category, Health, Knowledge, Skill,Suggestion,AiMode } from '../shared/contracts';
import ChatPanel, { type ChatLaunch } from './components/ChatPanel';
import KnowledgeDetail from './components/KnowledgeDetail';
import SkillDetail,{SkillEditor} from './components/SkillDetail';
import ShareImportDemo from './components/ShareImportDemo';
import AiStatus from './components/AiStatus';
import DemoReset from './components/DemoReset';
import BrandMark from './components/BrandMark';
import { CategoryCard, CollectionCard, SkillCard } from './components/ContentCards';
import { useVisualViewport } from './hooks/useVisualViewport';
import { CategoryOverview } from './components/CategoryOverview';
import WorkspaceTools,{OrganizePanel} from './components/WorkspaceTools';

type View={page:'knowledge'|'skills';categoryId?:string;skillId?:string;knowledgeId?:string};
function readView():View {
  const [page,id]=location.hash.slice(1).split('/');
  return page==='skills'?{page:'skills',skillId:id?decodeURIComponent(id):undefined}:page==='category'?{page:'knowledge',categoryId:id?decodeURIComponent(id):undefined}:page==='item'?{page:'knowledge',knowledgeId:id?decodeURIComponent(id):undefined}:{page:'knowledge'};
}
export default function App(){
  useVisualViewport();
  const [importOpen,setImportOpen]=useState(()=>location.hash==='#share-demo');
  const [view,setView]=useState<View>(readView);
  const [categories,setCategories]=useState<Category[]>([]);const [knowledge,setKnowledge]=useState<Knowledge[]>([]);const [skills,setSkills]=useState<Skill[]>([]);
  const [health,setHealth]=useState<Health|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [filter,setFilter]=useState('全部');const [query,setQuery]=useState('');const [searchOpen,setSearchOpen]=useState(false);
  const [workspaceEpoch,setWorkspaceEpoch]=useState(0);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [launch,setLaunch]=useState<ChatLaunch|null>(null);const [notice,setNotice]=useState('');
  const [undoId,setUndoId]=useState<string>();const [organizing,setOrganizing]=useState(false);const [suggestions,setSuggestions]=useState<Suggestion[]>([]);const [aiMode,setAiMode]=useState<AiMode>(getMode());
  useEffect(()=>{const sync=()=>setAiMode(getMode());sync();addEventListener('storage',sync);addEventListener('focus',sync);return()=>{removeEventListener('storage',sync);removeEventListener('focus',sync)}},[]);
  function openAi(prompt?:string){if(prompt&&/深度整理|整理知识库|预览方案/.test(prompt)){setOrganizing(true);return}setLaunch({prompt,nonce:Date.now()})}
  function navigate(hash:string){location.hash=hash}
  const phoneUrl=new URL(location.href);phoneUrl.searchParams.set('presentation','phone');
  const openImportDemo=()=>setImportOpen(true);
  function mutation(id:string,message:string){setUndoId(id);setNotice(message);void load()}
  async function undo(){if(!undoId)return;try{await write(`/undo/${undoId}`,{});setUndoId(undefined);setNotice('已撤回。');await load()}catch(e){setNotice((e as Error).message)}}

  async function load(){
    setLoading(true);setError('');
    try {const [h,c,k,s,n]=await Promise.all([api.health(),api.categories(),api.knowledge(),api.skills(),api.suggestions()]);setHealth(h);setCategories(c.items);setKnowledge(k.items);setSkills(s.items);setSuggestions(n.items)}
    catch(e){setError((e as Error).message);setHealth(null)}finally{setLoading(false)}
  }
  useEffect(()=>{void load();const change=()=>{if(location.hash==='#share-demo')setImportOpen(true);setView(readView());setQuery('');setFilter('全部');setSearchOpen(false);window.scrollTo({top:0,behavior:'instant'})};addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change)},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>{setNotice('');setUndoId(undefined)},15000);return()=>clearTimeout(timer)},[notice]);
  useEffect(()=>{const id=view.knowledgeId||view.categoryId||view.skillId;if(id)void write('/activity',{id}).catch(()=>{})},[view]);
  const allCategories=categories, allKnowledge=knowledge, allSkills=skills;
  const category=view.categoryId?allCategories.find(c=>c.id===view.categoryId):undefined;
  const skill=view.skillId?allSkills.find(s=>s.id===view.skillId):undefined;
  const item=view.knowledgeId?allKnowledge.find(k=>k.id===view.knowledgeId):undefined;
  const categoryItems=allKnowledge.filter(k=>view.categoryId==='unfiled'?!k.categoryId:k.categoryId===view.categoryId);
  const themes=[...new Set(allSkills.flatMap(s=>s.knowledgeIds.map(id=>allCategories.find(c=>c.id===allKnowledge.find(k=>k.id===id)?.categoryId)?.name).filter((name):name is string=>Boolean(name))))];
  const shownSkills=allSkills.filter(s=>(filter==='全部'||s.knowledgeIds.some(id=>allKnowledge.some(k=>k.id===id&&allCategories.some(c=>c.id===k.categoryId&&c.name===filter))))&&`${s.name} ${s.description}`.includes(query));
  const detail=Boolean(view.categoryId||view.skillId||view.knowledgeId);
  const title=category?.name||(view.categoryId==='unfiled'?'未分类':skill?.name||item?.title||'内容不存在');
  const unfiledCount=allKnowledge.filter(k=>!k.categoryId).length;
  const organizeCopy=suggestions.some(s=>s.kind==='duplicate')
    ?{title:'发现重复收藏',description:'查看去重与分类建议'}
    :unfiledCount?{title:`${unfiledCount} 条知识待分类`,description:'找到合适分类，整理更轻松'}
    :{title:'让收藏更有条理',description:'分类与内容，一次理清'};
  const empty=(heading:string,description:string,action?:string,onClick?:()=>void)=><div className="empty-state"><span className="empty-mark">{view.page==='skills'?<Blocks size={28}/>:<Bookmark size={28}/>}</span><h2>{heading}</h2><p>{description}</p>{action&&<button className="primary-button" onClick={onClick}>{action}<ArrowRight size={17}/></button>}</div>;
  return <div className={`app-shell ${view.categoryId?'category-view':''} ${view.knowledgeId?'knowledge-detail-view':''} ${view.skillId?'skill-detail-view':''}`}>

    {!view.categoryId&&!view.knowledgeId&&!view.skillId&&<header className={`topbar ${detail?'detail-topbar':''}`}>
      <a className="brand" href="#knowledge" aria-label="藏点本事知识库"><span className="brand-mark"><BrandMark/></span><strong>藏点本事</strong><span>favtoskill</span></a>
      <nav aria-label="主导航"><a href="#knowledge" aria-current={view.page==='knowledge'?'page':undefined} className={view.page==='knowledge'?'active':''}>知识库</a><a href="#skills" aria-current={view.page==='skills'?'page':undefined} className={view.page==='skills'?'active':''}>我的 Skill</a></nav>
      <div className="top-actions"><button className="icon-button settings-toggle" aria-label="服务设置" title={settingsOpen?'收起服务设置':'展开服务设置'} aria-expanded={settingsOpen} aria-controls="workspace-settings" onClick={()=>setSettingsOpen(!settingsOpen)}><Settings size={20}/></button><button className="icon-button" aria-label="搜索" aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><Search size={20}/></button><button className="icon-button" aria-label="导入知识" title="体验站外分享导入演示" onClick={openImportDemo}><FilePlus2 size={20}/></button></div>
    </header>}
    {view.categoryId&&<header className="category-topbar"><div className="category-nav-leading"><button className="icon-button" aria-label="返回知识库" onClick={()=>navigate('knowledge')}><ArrowLeft size={24}/></button></div><h1>{title}</h1><div className="category-nav-actions"><button className="icon-button" aria-label="搜索分类收藏" aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><Search size={20}/></button>{category&&<WorkspaceTools key={category.id} settingsOnly category={category} categories={categories} onMutation={mutation} onRemoved={()=>navigate('knowledge')}/>}</div></header>}
    {!view.categoryId&&!view.knowledgeId&&!view.skillId&&settingsOpen&&(isDemo?<aside id="workspace-settings" className="preview-banner demo-banner"><span>预设演示模板 · 修改会保存</span><label>模式<select aria-label="AI 模式" value={aiMode} onChange={e=>{const value=e.target.value as AiMode;localStorage.setItem(AI_MODE_KEY,value);setAiMode(value)}}><option value="demo">离线演示（不调用模型）</option><option value="real">真实 AI</option></select></label><a href={phoneUrl.href} target="_top">手机演示</a><AiStatus/><DemoReset onReset={undoId=>{setAiMode(getMode());setOrganizing(false);setImportOpen(false);setLaunch(null);setWorkspaceEpoch(n=>n+1);setFilter('全部');setQuery('');mutation(undoId,'演示已刷新，三类整理场景已就绪，可撤回。');navigate('knowledge')}}/><a href="/#knowledge">个人库</a></aside>:<aside id="workspace-settings" className="preview-banner"><span>个人知识库</span><a href={phoneUrl.href} target="_top">手机演示</a><AiStatus/><a href="/?workspace=demo#knowledge">体验预设演示模板</a></aside>)}
    {view.knowledgeId&&<header className="knowledge-topbar"><button className="icon-button" aria-label="返回所属分类" onClick={()=>navigate(item?`category/${item.categoryId||'unfiled'}`:'knowledge')}><ArrowLeft size={24}/></button><span>收藏详情</span><div>{item&&<WorkspaceTools key={item.id} settingsOnly item={item} onUpdateStaged={()=>setOrganizing(true)} categories={categories} onMutation={mutation} onRemoved={()=>navigate(`category/${item.categoryId||'unfiled'}`)}/>}</div></header>}
    {view.skillId&&<header className="skill-topbar"><button className="icon-button" aria-label="返回我的 Skill" onClick={()=>navigate('skills')}><ArrowLeft size={24}/></button><h1>{title}</h1><div>{skill&&<SkillEditor key={skill.id} skill={skill} knowledge={allKnowledge} onMutation={mutation} onRemoved={()=>navigate('skills')}/>}</div></header>}
    <main>

      {searchOpen&&<label className="search"><Search size={20}/><input aria-label="搜索当前列表" placeholder="搜索你的收藏与本事…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button" aria-label="关闭搜索" onClick={()=>{setSearchOpen(false);setQuery('')}}><X size={18}/></button></label>}
      {loading?<div className="loading-state" role="status"><span className="spinner"/>正在打开收藏…</div>:error?empty('暂时连接不上',error,'重试',()=>void load()):view.skillId?(skill?<SkillDetail key={skill.id+skill.updatedAt} skill={skill} knowledge={allKnowledge} onSource={id=>navigate(`item/${id}`)}/>:empty('没有找到这个 Skill','返回列表查看已有本事。','返回列表',()=>navigate('skills'))):view.knowledgeId?(item?<KnowledgeDetail key={item.id} item={item}/>:empty('没有找到这条收藏','返回知识库查看内容。','返回知识库',()=>navigate('knowledge'))):view.categoryId? <>
        {view.categoryId==='unfiled'?<section className="unfiled-classify"><img src="/brand/mascot-transparent.png" alt=""/><div><h2>给收藏找个合适的位置</h2><p>{unfiledCount?`${unfiledCount} 条资料待分类，先看看 AI 的归类建议。`:'这里已整理完，新的未分类收藏会出现在这里。'}</p></div><button className="organize-action" disabled={!unfiledCount} onClick={()=>setOrganizing(true)}><Sparkles size={16}/>AI 一键分类</button></section>:<CategoryOverview key={view.categoryId} categoryId={view.categoryId} items={categoryItems}/>}
        <div className="collection-toolbar"><div className="filters" aria-label="内容类型">{['全部','视频','文字','链接'].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
        {categoryItems.filter(k=>k.title.includes(query)&&(filter==='全部'||filter==='视频'&&k.provenance?.textKind==='repository_transcript'||filter==='链接'&&k.sourceUrl||filter==='文字'&&k.provenance?.textKind!=='repository_transcript'&&!k.sourceUrl)).length?<div className="collection-grid">{categoryItems.filter(k=>k.title.includes(query)&&(filter==='全部'||filter==='视频'&&k.provenance?.textKind==='repository_transcript'||filter==='链接'&&k.sourceUrl||filter==='文字'&&k.provenance?.textKind!=='repository_transcript'&&!k.sourceUrl)).map(k=><CollectionCard key={k.id} item={k} onOpen={()=>navigate(`item/${k.id}`)}/>)}</div>:empty('这里还没藏东西','换个筛选，或继续收藏好内容。')}
      </>:view.page==='knowledge'?<>
        <section className="knowledge-inbox" aria-label="未分类知识">
          <button onClick={()=>navigate('category/unfiled')}><div><h2>未分类 <span className="inbox-count">{unfiledCount}</span></h2></div><span className="inbox-cover" aria-hidden="true">{allKnowledge.find(k=>!k.categoryId&&k.imagePath)?.imagePath?<img src={allKnowledge.find(k=>!k.categoryId&&k.imagePath)!.imagePath!} alt=""/>:<Bookmark size={24}/>}</span><ArrowRight size={18}/></button>
        </section>
        <section className="organize-feature" aria-label="知识整理建议"><img src="/brand/mascot-transparent.png" className="organize-mascot" alt="" aria-hidden="true"/><div className="organize-copy"><h2>{organizeCopy.title}</h2><p>{organizeCopy.description}</p></div><button className="organize-action" onClick={()=>setOrganizing(true)} aria-label="AI 整理知识库"><Sparkles size={17}/><span>AI 整理</span></button></section>
        <div className="section-header"><h1>全部分类 <span>{allCategories.length}</span></h1><WorkspaceTools compact categories={categories} onMutation={mutation} onRemoved={()=>navigate('knowledge')}/></div>
        {allCategories.length?<div className="category-grid">{allCategories.filter(c=>c.name.includes(query)).map(c=><CategoryCard key={c.id} category={c} items={allKnowledge.filter(k=>k.categoryId===c.id)} onOpen={()=>navigate(`category/${c.id}`)}/>)}</div>:empty('这里还没藏东西','把好东西带进来，慢慢藏点本事。','导入第一条收藏',openImportDemo)}

      </>:<>
        <div className="collection-toolbar"><div className="filters" aria-label="Skill 主题">{['全部',...themes].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
        {shownSkills.length?<div className="skill-list">{shownSkills.map(s=><SkillCard key={s.id} skill={s} sourceCount={allKnowledge.filter(k=>s.knowledgeIds.includes(k.id)).length} onOpen={()=>navigate(`skills/${s.id}`)}/>)}</div>:empty(query?'没有找到相关 Skill':'你的本事，从收藏开始','告诉 AI，你希望用收藏完成什么。','创建第一个 Skill',()=>openAi('根据收藏创建 Skill'))}
      </>}

    </main>
    <ShareImportDemo key={workspaceEpoch} open={importOpen} onClose={()=>{setImportOpen(false);if(location.hash==='#share-demo')navigate('knowledge')}} onSaved={(job,undo,message)=>{if(isDemo){setUndoId(undo);setNotice(message||(job.duplicate?'这条演示资料已收录，未重复保存。':'演示资料已保存到知识库。'));void load()}}} onView={id=>{setImportOpen(false);if(isDemo)navigate(`item/${id}`);else location.assign(`/?workspace=demo#item/${id}`)}}/>
    <ChatPanel key={`${aiMode}-${workspaceEpoch}`} context={{page:view.page,categoryId:view.categoryId,knowledgeId:view.knowledgeId,skillId:view.skillId}} configured={health?.aiConfigured??null} launch={launch} knowledge={knowledge} skills={skills} onSaved={()=>void load()} onOrganize={()=>setOrganizing(true)} onSourceOpen={id=>navigate(`item/${id}`)} onSkillOpen={id=>navigate(`skills/${id}`)}/>
    {organizing&&<OrganizePanel categoryId={view.categoryId} categories={categories} knowledge={knowledge} onClose={()=>setOrganizing(false)} onMutation={mutation}/>}{notice&&<div className="toast" role="status">{notice}{undoId&&<button onClick={()=>void undo()}>撤回</button>}<button aria-label="关闭提示" onClick={()=>setNotice('')}><X size={18}/></button></div>}
  </div>;
}




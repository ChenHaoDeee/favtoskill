import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUp, ArrowUpRight, History, Maximize2, Minimize2, Plus, Sparkles, Blocks, FileText, Search, X } from './Icons';
import { api,getMode } from '../api';
import ChatMessage from './ChatMessage';
import type {ChatTurn} from './conversationCards';
import SkillFlow,{type SkillFlowHandle} from './SkillFlow';
import type { ChatContext, Conversation, Message, Knowledge,Skill } from '../../shared/contracts';
export interface ChatLaunch { prompt?:string; nonce:number;action?:'create'|'edit'|'run';skillId?:string;goal?:string;knowledgeIds?:string[];conversationId?:string }
export default function ChatPanel({context,configured,launch,knowledge=[],skills=[],onSourceOpen,onSkillOpen,onSaved,onOrganize}:{context:ChatContext;configured:boolean|null;launch:ChatLaunch|null;knowledge?:Knowledge[];skills?:Skill[];onSourceOpen?:(id:string)=>void;onSkillOpen?:(id:string)=>void;onSaved:(id:string)=>void;onOrganize:()=>void}) {
  const skillRef=useRef<SkillFlowHandle>(null);const [skillBusy,setSkillBusy]=useState(false);
  const createsSkill=(text:string)=>/(创建|生成|新建|做|变成|转成|制作).*(skill|本事|助手)/i.test(text)||/(skill|本事).*(创建|生成|新建)/i.test(text);
  const previousSkill=useRef(context.skillId);
  useEffect(()=>{if(previousSkill.current===context.skillId)return;previousSkill.current=context.skillId;setFlow(null);setChooseSkill(false);setSuggestSkill(false);setDraft('')},[context.skillId]);
  const [mode,setMode]=useState<'closed'|'half'|'full'>('closed');
  const [sheetHeight,setSheetHeight]=useState(()=>Math.max(340,Math.round(window.innerHeight*.6)));
  const [dragging,setDragging]=useState(false);
  const panelRef=useRef<HTMLElement>(null);
  const drag=useRef<{y:number;height:number}|null>(null);
  const [draft,setDraft]=useState('');const [messages,setMessages]=useState<ChatTurn[]>([]);
  const [id,setId]=useState<string>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [history,setHistory]=useState<Conversation[]|null>(null);const [loadingHistory,setLoadingHistory]=useState(false);
  const [flow,setFlow]=useState<ChatLaunch|null>(null);const [chooseSkill,setChooseSkill]=useState(false);const [suggestSkill,setSuggestSkill]=useState(false);
  const closeRef=useRef<HTMLButtonElement>(null);const entryRef=useRef<HTMLTextAreaElement>(null);const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(launch){setMode(current=>current==='closed'?'half':current);setError('');setHistory(null);setChooseSkill(false);if(launch.action){setFlow(launch);setDraft('')}else if(launch.prompt&&createsSkill(launch.prompt)){setFlow({...launch,goal:launch.prompt,action:'create'});setDraft('')}else{setFlow(null);if(launch.prompt)setDraft(launch.prompt)}}},[launch]);
  const open=mode!=='closed';
  useEffect(()=>{if(open)closeRef.current?.focus({preventScroll:true})},[open]);
  useEffect(()=>{if(open){const body=endRef.current?.parentElement;body?.scrollTo({top:body.scrollHeight,behavior:'smooth'})}},[messages,busy,skillBusy,open]);
  useEffect(()=>{
    if(!open)return;
    const y=window.scrollY;
    const body=document.body;
    const previous={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};
    // Fixed-body locking also prevents iOS background scrolling and restores the reading position.
    Object.assign(body.style,{position:'fixed',top:`-${y}px`,width:'100%',overflow:'hidden'});
    const background=Array.from(document.querySelectorAll<HTMLElement>('.topbar, .category-topbar, .knowledge-topbar, main, .preview-banner'));
    const inert=background.map(element=>element.inert);
    background.forEach(element=>{element.inert=true});
    return()=>{Object.assign(body.style,previous);background.forEach((element,index)=>{element.inert=inert[index]});window.scrollTo({top:y,behavior:'instant'})};
  },[open]);
  const detailSkill=skills.find(s=>s.id===context.skillId);
  const prompts=detailSkill?[`请说明「${detailSkill.name}」需要哪些输入，并给我一个填写示例。`,`请按「${detailSkill.name}」的规则处理以下任务：`,`我想调整这个 Skill 的执行步骤`]:context.page==='skills'?['根据收藏创建 Skill','帮我修改已有 Skill']:context.knowledgeId?['总结这篇内容','提取其中的关键方法','围绕这篇内容继续提问']:context.categoryId?['总结这个分类','这个分类有哪些实用方法？','查找这个分类里的内容']:['帮我总结最近收藏的内容','找找我收藏过的面试技巧','根据收藏创建 Skill','帮我整理知识库'];
  const placeholder=detailSkill?'尝试使用这个 Skill…':context.knowledgeId?'针对这条收藏提问…':context.page==='skills'?'想创建什么本事？':context.categoryId?'关于这个分类，想了解什么？':'问问你的收藏夹…';
  function heightLimits(){const max=Math.round((window.visualViewport?.height||window.innerHeight)-(window.innerWidth>=768?16:0));return {min:Math.min(340,max),max}}
  function resizeSheet(height:number){const {min,max}=heightLimits();setSheetHeight(Math.max(min,Math.min(max,height)));setMode('half')}
  function startDrag(e:PointerEvent<HTMLDivElement>){if(e.button!==0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);drag.current={y:e.clientY,height:panelRef.current?.getBoundingClientRect().height||sheetHeight};setDragging(true)}
  function moveDrag(e:PointerEvent<HTMLDivElement>){if(drag.current)resizeSheet(drag.current.height+drag.current.y-e.clientY)}
  function endDrag(e:PointerEvent<HTMLDivElement>){if(!drag.current)return;const height=drag.current.height+drag.current.y-e.clientY;drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(height>=heightLimits().max-20){setMode('full');closeRef.current?.focus({preventScroll:true})}}
  function close(){(document.activeElement as HTMLElement|null)?.blur();setMode('closed');setTimeout(()=>entryRef.current?.focus({preventScroll:true}),0)}
  async function send(){
    if(!draft.trim()||busy||skillBusy)return;const input=draft.trim();
    if(flow){setDraft('');await skillRef.current?.send(input);return}
    if(detailSkill){setFlow({action:/(修改|编辑|调整).*(Skill|本事|执行步骤|规则|输入要求)/i.test(input)?'edit':'run',skillId:detailSkill.id,goal:input,nonce:Date.now(),conversationId:id});setDraft('');return}
    if(createsSkill(input)){setFlow({action:'create',goal:input,nonce:Date.now(),conversationId:id,knowledgeIds:messages.at(-1)?.sources});setDraft('');setSuggestSkill(false);return}
    if(/修改.*skill|编辑.*skill/i.test(input)){setChooseSkill(true);setDraft('');return}
    if(/深度整理|整理知识库|AI 整理/.test(input)){close();onOrganize();return}
    const pendingId=crypto.randomUUID();setMessages(m=>[...m,{id:pendingId,role:'user',content:input,sources:[],createdAt:new Date().toISOString()}]);
    setBusy(true);setDraft('');setError('');setHistory(null);setSuggestSkill(false);
    try {const result=await api.chat({conversationId:id,content:input,context});setMessages(m=>[...m,result.message]);setId(result.conversationId);setDraft('');setSuggestSkill(Boolean(result.suggestSkill))}
    catch(e){setMessages(m=>m.filter(message=>message.id!==pendingId));setDraft(input);setError((e as Error).message)}finally{setBusy(false)}
  }
  async function showHistory(){setFlow(null);setChooseSkill(false);setLoadingHistory(true);setError('');try{setHistory((await api.conversations()).items)}catch(e){setError((e as Error).message)}finally{setLoadingHistory(false)}}
  async function loadConversation(conversation:Conversation){setLoadingHistory(true);try{const result=await api.messages(conversation.id);setMessages(result.items);setId(conversation.id);setHistory(null);setError('')}catch(e){setError((e as Error).message)}finally{setLoadingHistory(false)}}
  return <>
    <div className="ai-dock" hidden={open}><form className="composer dock-composer" onSubmit={e=>{e.preventDefault();setMode('half')}}><textarea ref={entryRef} aria-label="打开藏点本事 AI" readOnly placeholder={placeholder} value={draft} onClick={()=>setMode('half')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setMode('half')}}}/><button type="submit" aria-label="打开 AI 对话"><ArrowUp size={22}/></button></form></div>
    {<div hidden={!open} className={`chat-backdrop ${mode}`} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
      <section ref={panelRef} className={`chat-panel ${mode} ${dragging?'resizing':''}`} style={{'--sheet-height':`${sheetHeight}px`} as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="chat-title" onKeyDown={e=>{
        if(e.key==='Escape')close();
        if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
      }}>
        {mode==='half'&&<div className="sheet-grip" role="slider" tabIndex={0} aria-label="调整对话面板高度" aria-orientation="vertical" aria-valuemin={heightLimits().min} aria-valuemax={heightLimits().max} aria-valuenow={Math.round(Math.min(sheetHeight,heightLimits().max))} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={()=>{drag.current=null;setDragging(false)}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='End'){setMode('full');closeRef.current?.focus({preventScroll:true})}else resizeSheet(e.key==='Home'?heightLimits().min:(panelRef.current?.getBoundingClientRect().height||sheetHeight)+(e.key==='ArrowUp'?64:-64))}}}><span/></div>}
        <header className="chat-header"><div className="chat-actions chat-actions-left"><button className="icon-button" title="历史对话" aria-label="历史对话" disabled={busy||skillBusy||loadingHistory} onClick={showHistory}><History size={18}/></button><button className="icon-button" title="新对话" aria-label="新对话" disabled={busy||skillBusy||loadingHistory} onClick={()=>{setId(undefined);setMessages([]);setDraft('');setError('');setHistory(null);setFlow(null);setChooseSkill(false);setSuggestSkill(false)}}><Plus size={20}/></button></div><strong id="chat-title">藏点本事</strong><div className="chat-actions chat-actions-right"><button className="icon-button" aria-label={mode==='half'?'展开全屏':'收起半屏'} onClick={()=>setMode(mode==='half'?'full':'half')}>{mode==='half'?<Maximize2 size={22}/>:<Minimize2 size={22}/>}</button><button ref={closeRef} className="icon-button" aria-label="关闭对话" onClick={close}><X size={20}/></button></div></header>
        <div className="chat-body" aria-live="polite">
          {loadingHistory&&<p className="muted">正在加载历史对话…</p>}
          {chooseSkill?<div className="history-list"><h3>选择要调整的 Skill</h3>{skills.length?skills.map(s=><button key={s.id} onClick={()=>{setFlow({action:'edit',skillId:s.id,nonce:Date.now()});setChooseSkill(false);setMode('full')}}>{s.name}<ArrowUpRight size={16}/></button>):<p>还没有 Skill，先创建一个吧。</p>}<button onClick={()=>setChooseSkill(false)}>返回对话</button></div>:history!==null?<div className="history-list"><h3>历史对话</h3>{history.length?history.map(c=><button disabled={loadingHistory} key={c.id} onClick={()=>loadConversation(c)}>{c.title}<ArrowUpRight size={16}/></button>):<p className="muted">还没有保存的对话。</p>}</div>:<>
            {messages.length===0&&!flow&&<div className="chat-welcome"><div className="assistant-intro"><span className="assistant-avatar"><img src="/brand/mascot-transparent.png" alt="藏点本事 AI 形象"/></span><div><h2>{detailSkill?`试试「${detailSkill.name}」`:'问问你的收藏夹'}</h2><p>{detailSkill?'发送任务，我会按照这个 Skill 的规则处理。':'基于你的收藏，帮你查找、总结与整理。'}</p></div></div><div className="quick-prompts">{prompts.map((p,i)=>{const Icon=[Sparkles,Search,Blocks,FileText][i%4];return <button key={p} onClick={()=>setDraft(p)}><Icon size={18}/><span>{p}</span></button>})}</div></div>}
            {messages.map(m=><ChatMessage key={m.id} message={m} knowledge={knowledge} onSource={source=>{close();onSourceOpen?.(source)}} onSkillOpen={skillId=>{close();onSkillOpen?.(skillId)}} busy={busy||skillBusy} onCardAction={action=>void skillRef.current?.act(m.id,action)}/>)}
            {flow&&<SkillFlow ref={skillRef} key={flow.nonce} launch={{...flow,conversationId:flow.conversationId||id}} context={context} knowledge={knowledge} skills={skills} onSaved={onSaved} onBusyChange={setSkillBusy} onConversation={setId} onMessage={message=>setMessages(old=>[...old,message])} onPatch={(messageId,card)=>setMessages(old=>old.map(m=>m.id===messageId?{...m,card}:m))}/>}
            {detailSkill&&!flow&&messages.length>0&&<div className="quick-prompts skill-context-prompts">{prompts.map(p=><button key={p} onClick={()=>setDraft(p)}><span>{p}</span></button>)}</div>}
            {suggestSkill&&!flow&&<button className="secondary-button ai-button" onClick={()=>{setFlow({action:'create',nonce:Date.now(),goal:messages.filter(m=>m.role==='user').at(-1)?.content,conversationId:id,knowledgeIds:messages.at(-1)?.sources});setSuggestSkill(false)}}>把这些方法变成 Skill</button>}
            {busy&&!flow&&<div className="answer-pending" role="status"><img className="message-avatar" src="/brand/mascot-transparent.png" alt=""/><div><span className="pulse"/>{getMode()==='demo'?'正在查找已保存的资料…':'正在检索资料并生成回答…'}<small>{context.categoryId?'仅使用当前分类的收藏':context.knowledgeId?'仅使用这篇收藏':'基于你的知识库'} · 完成后显示来源</small></div></div>}<div ref={endRef}/>
          </>}
        </div>
        <footer className="chat-footer">
          {error&&<div className="error-box" role="alert">{error}<button disabled={busy} onClick={send}>重试</button></div>}
          {configured===false&&getMode()==='real'&&<p className="config-note">AI 暂未启用 · 需配置服务端模型</p>}
          <form onSubmit={e=>{e.preventDefault();void send()}} className="composer"><textarea aria-label="向藏点本事 AI 提问" maxLength={8000} placeholder={messages.length?'继续提问…':placeholder} value={draft} disabled={busy||skillBusy||loadingHistory} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/><button aria-label="发送消息" type="submit" disabled={!draft.trim()||busy||skillBusy||loadingHistory}><ArrowUp size={20}/></button></form>

        </footer>
      </section>
    </div>}
  </>;
}




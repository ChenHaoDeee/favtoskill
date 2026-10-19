import { forwardRef,useEffect,useImperativeHandle,useRef,useState } from 'react';
import type { ChatContext,Knowledge,Skill,ChatResponse } from '../../shared/contracts';
import type { ChatTurn,ConversationCard,CardAction } from './conversationCards';
import { getMode,write } from '../api';
import type { ChatLaunch } from './ChatPanel';

type Draft=Omit<Skill,'id'|'createdAt'|'updatedAt'>;
type Turn={role:'user'|'assistant';content:string};
export interface SkillFlowHandle{send:(text:string)=>Promise<void>;act:(messageId:string,action:CardAction)=>Promise<void>}
interface Props{launch:ChatLaunch;context:ChatContext;knowledge:Knowledge[];skills:Skill[];onSaved:(id:string)=>void;onMessage:(message:ChatTurn)=>void;onPatch:(id:string,card:ConversationCard)=>void;onBusyChange:(busy:boolean)=>void;onConversation:(id:string)=>void}
export default forwardRef<SkillFlowHandle,Props>(function SkillFlow({launch,context,knowledge,skills,onSaved,onMessage,onPatch,onBusyChange,onConversation},ref){
  const aiMode=useRef(getMode()).current,existing=skills.find(s=>s.id===launch.skillId);
  const [stage,setStage]=useState<'goal'|'sources'|'draft'|'trial'>(launch.action==='run'?'trial':existing?'draft':'goal');
  const history=useRef<Turn[]>([]),conversation=useRef(launch.conversationId),savedId=useRef(existing?.id),started=useRef(false),lock=useRef(false);
  const [goal,setGoal]=useState(launch.goal||existing?.description||''),[draft,setDraft]=useState<Draft|null>(existing||null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const retry=useRef<(()=>Promise<void>)|null>(null);
  const activeCard=useRef<{id:string;card:ConversationCard}|null>(null);
  function say(role:'user'|'assistant',content:string,card?:ConversationCard){
    history.current=[...history.current,{role,content}].slice(-12);const id=crypto.randomUUID();onMessage({id,role,content,card,sources:[],createdAt:new Date().toISOString()});
    if(card&&card.kind!=='result')activeCard.current={id,card};
  }
  function finishCard(response?:string,ids?:string[]){const current=activeCard.current;if(!current||current.card.kind==='result')return;onPatch(current.id,current.card.kind==='question'?{...current.card,status:'complete',response}:{...current.card,status:'complete',selectedIds:ids||current.card.selectedIds});activeCard.current=null}
  async function task(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setError('');retry.current=fn;try{await fn();retry.current=null}catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false);onBusyChange(false)}}
  async function recommend(target:string){
    const result=await write<{items:Knowledge[]}>('/skills/sources',{goal:target,context,mode:aiMode});
    const found=result.items.map(k=>k.id),selected=launch.knowledgeIds?.length?launch.knowledgeIds.filter(id=>knowledge.some(k=>k.id===id)):found;
    finishCard();setStage('sources');say('assistant',found.length?'确认要引用的收藏':'选择这次要参考的收藏',{kind:'sources',goal:target,recommended:found,selectedIds:selected,status:'active'});
  }
  async function clarify(){
    const result=await write<{ready:boolean;goal:string;reply:string;options:string[];conversationId:string}>('/skills/intent',{messages:history.current.map(turn=>({...turn,content:turn.content.slice(0,3000)})),context,mode:aiMode,conversationId:conversation.current});
    conversation.current=result.conversationId;onConversation(result.conversationId);finishCard();
    if(result.ready){setGoal(result.goal);await recommend(result.goal)}else say('assistant',result.reply,{kind:'question',options:result.options,status:'active'});
  }
  async function persist(next:Draft,requestId:string){
    const result=await write<{item:Skill}>(savedId.current?`/skills/${savedId.current}`:'/skills',savedId.current?next:{draft:next,origin:next.origin||'edited',requestId},savedId.current?'PATCH':'POST');
    savedId.current=result.item.id;setDraft(result.item);setStage('draft');onSaved(result.item.id);say('assistant','已创建并保存这个 Skill。',{kind:'result',skill:result.item});
  }
  async function generate(ids:string[],adjustment?:string){
    const result=await write<{draft:Draft;conversationId?:string}>('/skills/draft',{goal,knowledgeIds:ids,mode:aiMode,currentDraft:draft||undefined,adjustment,conversationId:conversation.current,recordConversation:true});
    if(result.conversationId){conversation.current=result.conversationId;onConversation(result.conversationId)}
    setDraft(result.draft);const requestId=crypto.randomUUID();
    // A failed save retries this exact generated definition, without regenerating it.
    retry.current=()=>persist(result.draft,requestId);await persist(result.draft,requestId);
  }
  async function send(text:string,forceSkill=false){
    if(lock.current)return;finishCard(text);say('user',text);
    await task(async()=>{
      const route=forceSkill?{intent:'skill' as const}:await write<{intent:'chat'|'skill'|'trial'}>('/assistant/intent',{text,stage,goal,mode:aiMode,messages:history.current.slice(-8).map(turn=>({...turn,content:turn.content.slice(0,3000)}))});
      if(route.intent==='chat'){
        const response=await write<ChatResponse>('/chat',{conversationId:conversation.current,content:text,context,mode:aiMode});conversation.current=response.conversationId;onConversation(response.conversationId);history.current=[...history.current,{role:'assistant' as const,content:response.message.content}].slice(-12);onMessage(response.message);return;
      }
      if(stage==='goal'||stage==='sources'){setStage('goal');await clarify();return}
      if(route.intent==='trial'){
        if(!draft)throw new Error('Skill 不存在。');const result=await write<{output:string;conversationId?:string}>('/skills/trial',{draft,input:text,mode:aiMode,conversationId:conversation.current,recordConversation:true});if(result.conversationId){conversation.current=result.conversationId;onConversation(result.conversationId)}say('assistant',result.output);return;
      }
      if(/^(试运行|测试一下|试试看)$/.test(text)){setStage('trial');say('assistant','发一条示例任务，我会按这个 Skill 的规则处理。');return}
      if(!draft)throw new Error('请先确认要引用的收藏。');await generate(draft.knowledgeIds,text);
    });
  }
  async function act(messageId:string,action:CardAction){
    if(lock.current||activeCard.current?.id!==messageId)return;
    if(action.type==='question'){await send(action.text,true);return}
    if(!action.ids.length||action.ids.length>36||action.ids.some(id=>!knowledge.some(k=>k.id===id)))return;
    finishCard(undefined,action.ids);say('user',`确认这 ${action.ids.length} 条收藏，生成 Skill`);await task(()=>generate(action.ids));
  }
  useImperativeHandle(ref,()=>({send,act}));
  useEffect(()=>{if(started.current)return;started.current=true;
    if(existing&&launch.goal){void send(launch.goal);return}
    if(existing){say('assistant',launch.action==='run'?`尝试使用「${existing.name}」，请发送你的任务。`:`可以直接告诉我「${existing.name}」的修改要求。`);return}
    if(launch.goal){void send(launch.goal,launch.action==='create')}else say('assistant','你希望把收藏变成什么本事？',{kind:'question',options:[],status:'active'});
  },[]);
  return <section className="skill-conversation" aria-label="对话任务状态">
    {busy&&<div className="answer-pending" role="status"><img className="message-avatar" src="/brand/mascot-transparent.png" alt=""/><div><span className="pulse"/>{stage==='sources'?'正在生成并保存 Skill…':'正在理解需求并生成回复…'}</div></div>}
    {error&&<div className="error-box" role="alert">{error}<button disabled={busy} onClick={()=>{if(retry.current)void task(retry.current)}}>重试</button></div>}
  </section>;
});

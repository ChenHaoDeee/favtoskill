import { useEffect,useRef,useState,type ReactNode,type KeyboardEvent } from 'react';
import { CategoryCard } from './ContentCards';
import { Plus,X,Edit } from './Icons';
import type { Category,Knowledge,Skill } from '../../shared/contracts';
import { write } from '../api';
import { categoryAppearance,iconChoices,toneChoices } from './categoryAppearance';
import type { CategoryIcon,CategoryTone } from '../../shared/categoryAppearance';
function navigateChoices(event:KeyboardEvent<HTMLDivElement>){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
  const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
  buttons[next]?.focus();buttons[next]?.click();
}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;const old=document.body.style.overflow;document.body.style.overflow='hidden';dialog?.showModal();return()=>{dialog?.close();document.body.style.overflow=old}},[]);
  return <dialog ref={ref} className="workspace-modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose()}}><header><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
export {default as OrganizePanel} from './OrganizePanel';
export default function WorkspaceTools({category,item,skill,categories,onMutation,onRemoved,compact=false,settingsOnly=false}:{settingsOnly?:boolean;compact?:boolean;category?:Category;item?:Knowledge;skill?:Skill;categories:Category[];onMutation:(undoId:string,message:string)=>void;onRemoved:()=>void}){
  const [dialog,setDialog]=useState<'category'|'delete'|'move'|null>(null);const [name,setName]=useState('');const [target,setTarget]=useState(item?.categoryId||'');const [title,setTitle]=useState(item?.title||'');const [tags,setTags]=useState(item?.tags.join('、')||'');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [folderIcon,setFolderIcon]=useState<CategoryIcon>('book');const [folderTone,setFolderTone]=useState<CategoryTone>('lime');
  const subject=item||skill||category;
  function open(kind:'category'|'delete'|'move'){setDialog(kind);setError('');setName(category?.name||'');setTarget(item?.categoryId||'');setTitle(item?.title||'');setTags(item?.tags.join('、')||'');const appearance=categoryAppearance(category||{name:''});setFolderIcon(appearance.icon);setFolderTone(appearance.tone)}
  async function commit(){setBusy(true);setError('');try{
    const result=dialog==='category'?await write<{undoId:string}>(category?`/categories/${category.id}`:'/categories',{name,icon:folderIcon,tone:folderTone},category?'PATCH':'POST'):dialog==='move'&&item?await write<{undoId:string}>(`/knowledge/${item.id}`,{categoryId:target||null,title,tags:tags.split(/[、,，]/).map(t=>t.trim()).filter(Boolean)},'PATCH'):await write<{undoId:string}>(item?`/knowledge/${item.id}`:skill?`/skills/${skill.id}`:`/categories/${category?.id}`,{confirmed:true},'DELETE');
    onMutation(result.undoId,dialog==='delete'?'已移除，可撤回本次操作。':'修改已保存，可撤回。');if(dialog==='delete')onRemoved();setDialog(null);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <><div className={settingsOnly?'category-settings':compact?'folder-create':'detail-tools management-tools'}>{settingsOnly?<button className="header-edit-button" aria-label={item?'编辑资料':'编辑文件夹'} onClick={()=>open(item?'move':'category')}><Edit size={20}/></button>:compact?<button className="create-folder-button" aria-label="新建文件夹" onClick={()=>open('category')}><Plus size={20}/><span>新建文件夹</span></button>:<>{!item&&!skill&&<button className="secondary-button" onClick={()=>open('category')}>编辑文件夹</button>}{item&&<button className="secondary-button" onClick={()=>open('move')}>编辑收藏</button>}{subject&&<button className="text-button danger" onClick={()=>open('delete')}>{category?'移除分类':'删除'}</button>}</>}</div>{dialog&&<Modal title={dialog==='category'?(category?'编辑文件夹':'新建文件夹'):dialog==='move'?'编辑收藏':'确认移除'} onClose={()=>setDialog(null)}>
    {dialog==='category'?<><div className="folder-card-preview" aria-label="文件夹样式预览"><CategoryCard preview category={{id:category?.id||'preview',name:name.trim()||'新文件夹',icon:folderIcon,tone:folderTone,createdAt:category?.createdAt||''}} items={[]} onOpen={()=>{}}/></div><label className="field">名称<input maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：求职面试"/></label><div className="appearance-field"><h3>图标</h3><div className="icon-picker" role="radiogroup" aria-label="文件夹图标" onKeyDown={navigateChoices}>{iconChoices.map(({id,label,Icon})=><button type="button" role="radio" key={id} aria-label={label} aria-checked={folderIcon===id} tabIndex={folderIcon===id?0:-1} onClick={()=>setFolderIcon(id)}><Icon size={24}/></button>)}</div></div><div className="appearance-field"><h3>颜色</h3><div className="tone-picker" role="radiogroup" aria-label="文件夹颜色" onKeyDown={navigateChoices}>{toneChoices.map(({id,label})=><button type="button" role="radio" key={id} className={`tone-${id}`} aria-label={label} aria-checked={folderTone===id} tabIndex={folderTone===id?0:-1} onClick={()=>setFolderTone(id)}><span/></button>)}</div></div>{category&&<button className="text-button danger remove-category" disabled={busy} onClick={()=>{setError('');setDialog('delete')}}>移除分类</button>}</>:dialog==='move'?<><label className="field">标题<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field">标签<input value={tags} onChange={e=>setTags(e.target.value)} placeholder="用顿号或逗号分隔"/></label><label className="field">移到<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">未分类</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label></>:<p className="flow-output">{category?'移除分类后，其中的收藏会保留在「未分类」。':`移除「${item?.title||skill?.name}」？此操作可在出现后续修改前撤回。${item?'关联的 Skill 会提示来源缺失，需重新关联。':''}`}</p>}
    {dialog==='move'&&item&&<button className="text-button danger remove-category" disabled={busy} onClick={()=>{setError('');setDialog('delete')}}>删除收藏</button>}
    {error&&<p className="error-box" role="alert">{error}</p>}<div className="flow-buttons"><button className="secondary-button" disabled={busy} onClick={()=>setDialog(null)}>取消</button><button className="primary-button" disabled={busy||(dialog==='category'&&!name.trim())} onClick={commit}>{busy?'正在保存…':'确认'}</button></div>
  </Modal>}</>;
}

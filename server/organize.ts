import type { OrganizePlan,OrganizeDuplicateGroup,OrganizeCategoryMerge,OrganizeMove } from '../shared/contracts.js';
import type { Store } from './store.js';
import { ServiceError } from './ai.js';

export function organizeExtras(store:Store,pairs:OrganizePlan['duplicates'],categoryId?:string){
  const sets:Set<string>[]=[];
  for(const pair of pairs){
    const related=sets.filter(group=>group.has(pair.firstId)||group.has(pair.secondId));
    const merged=new Set([pair.firstId,pair.secondId,...related.flatMap(group=>[...group])]);
    for(const old of related)sets.splice(sets.indexOf(old),1);
    sets.push(merged);
  }
  const items=store.knowledge();
  const duplicateGroups:OrganizeDuplicateGroup[]=sets.map((group,i)=>({id:`duplicate-${i}`,knowledgeIds:[...group],recommendedKeepId:[...group].sort((a,b)=>items.find(k=>k.id===b)!.createdAt.localeCompare(items.find(k=>k.id===a)!.createdAt))[0],reason:'保存的原文或来源链接相同，请核对后选择保留一条；其他副本将收起，原始记录保留，可撤回。'}));
  const categoryMerges:OrganizeCategoryMerge[]=[];
  // Only whole-library plans suggest merging, with exact duplicate evidence.
  // Similar names alone are not sufficient grounds for changing folders.
  if(!categoryId){
    const categories=store.categories();const occupied=new Set<string>();
    for(let i=0;i<categories.length;i++)for(let j=i+1;j<categories.length;j++){
      const first=categories[i],second=categories[j];
      if(occupied.has(first.id)||occupied.has(second.id))continue;
      const a=items.filter(k=>k.categoryId===first.id),b=items.filter(k=>k.categoryId===second.id);
      const overlap=duplicateGroups.filter(g=>g.knowledgeIds.some(id=>a.some(k=>k.id===id))&&g.knowledgeIds.some(id=>b.some(k=>k.id===id))).length;
      if(overlap<2||overlap/Math.min(a.length,b.length)<.6)continue;
      const [source,target]=a.length<=b.length?[first,second]:[second,first];
      categoryMerges.push({sourceId:source.id,targetId:target.id,reason:`两个分类有 ${overlap} 组原文或链接一致的收藏，可以合并管理；所有收藏都会保留，重复项是否收起由你另行选择。`});
      occupied.add(source.id);occupied.add(target.id);
    }
  }
  return {duplicateGroups,categoryMerges};
}

export function applyOrganizePlan(store:Store,plan:OrganizePlan,body:{moves:OrganizeMove[];duplicates:{groupId:string;keepId:string}[];merges:{sourceId:string;targetId:string}[]}){
  if(plan.version!==store.revision())throw new ServiceError('PLAN_STALE','资料已有变化，请重新生成整理方案。',409);
  const items=store.knowledge(),categories=store.categories();
  const invalid=()=>{throw new ServiceError('INVALID_PLAN','不在预览范围内、来源不存在或包含冲突的修改。',400)};
  const seen=new Set<string>();
  for(const move of body.moves){
    if(!plan.moves.some(m=>m.knowledgeId===move.knowledgeId)||seen.has(move.knowledgeId)||!items.some(k=>k.id===move.knowledgeId)||(move.categoryId&&!categories.some(c=>c.id===move.categoryId)))invalid();
    seen.add(move.knowledgeId);
  }
  const usedCategories=new Set<string>();
  for(const merge of body.merges){
    if(!plan.categoryMerges?.some(m=>m.sourceId===merge.sourceId&&m.targetId===merge.targetId)||usedCategories.has(merge.sourceId)||usedCategories.has(merge.targetId)||!categories.some(c=>c.id===merge.sourceId)||!categories.some(c=>c.id===merge.targetId))invalid();
    usedCategories.add(merge.sourceId);usedCategories.add(merge.targetId);
  }
  const replacements=new Map<string,string>();const selectedGroups=new Set<string>();
  for(const choice of body.duplicates){
    const group=plan.duplicateGroups?.find(g=>g.id===choice.groupId);
    if(!group||selectedGroups.has(choice.groupId)||!group.knowledgeIds.includes(choice.keepId)||group.knowledgeIds.some(id=>!items.some(k=>k.id===id)))invalid();
    selectedGroups.add(choice.groupId);
    for(const id of group!.knowledgeIds)if(id!==choice.keepId)replacements.set(id,choice.keepId);
  }
  const now=new Date().toISOString();
  const undoId=store.mutate(()=>{
    const next=new Map(items.map(k=>[k.id,{...k}]));
    for(const move of body.moves){const item=next.get(move.knowledgeId)!;item.categoryId=move.categoryId;item.updatedAt=now;}
    for(const merge of body.merges){
      for(const item of next.values())if(item.categoryId===merge.sourceId){item.categoryId=merge.targetId;item.updatedAt=now;}
      store.db.prepare('UPDATE categories SET deleted_at=? WHERE id=?').run(now,merge.sourceId);
    }
    for(const item of next.values())if(item.updatedAt===now)store.putKnowledge(item);
    for(const id of replacements.keys())store.db.prepare('UPDATE knowledge SET deleted_at=? WHERE id=?').run(now,id);
    // Rebind live Skills to the retained copy, avoiding missing-source errors.
    for(const skill of store.skills())if(skill.knowledgeIds.some(id=>replacements.has(id)))store.putSkill({...skill,knowledgeIds:[...new Set(skill.knowledgeIds.map(id=>replacements.get(id)||id))],updatedAt:now});
  });
  return {undoId,applied:{moves:body.moves.length,duplicates:body.duplicates.length,merges:body.merges.length}};
}

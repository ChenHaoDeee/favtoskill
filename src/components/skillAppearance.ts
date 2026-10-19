import type { Skill } from '../../shared/contracts';
import { iconChoices,toneChoices,categoryAppearance } from './categoryAppearance';

export function skillAppearance(skill:Pick<Skill,'id'|'name'|'origin'>){
  if(skill.origin==='preset'||skill.id.startsWith('demo-')){
    let hash=2166136261;
    for(const char of skill.id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    return {Icon:iconChoices[hash%iconChoices.length].Icon,tone:toneChoices[(hash>>>8)%toneChoices.length].id};
  }
  return categoryAppearance({name:skill.name});
}

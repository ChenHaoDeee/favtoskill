import type { Skill } from '../../shared/contracts';
import { skillAppearance } from './skillAppearance';
export default function SkillIdentity({skill,heading='h1'}:{skill:Skill;heading?:'h1'|'h3'}){
  const {Icon,tone}=skillAppearance(skill),Heading=heading;
  return <div className="skill-identity"><span className={`skill-detail-icon skill-tone-${tone}`}><Icon size={36}/></span><Heading>{skill.name}</Heading><p className="skill-description">{skill.description}</p></div>;
}

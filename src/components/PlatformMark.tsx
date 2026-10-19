import type { Knowledge } from '../../shared/contracts';
import TiktokIcon from '@icon-park/react/es/icons/Tiktok';
import { FileText } from './Icons';
export const platformName=(item:Knowledge)=>item.demoPlatform||item.sourcePlatform||'来源未标注';
export default function PlatformMark({platform}:{platform:string}){
  if(platform==='抖音')return <span className="platform-logo platform-douyin" aria-hidden="true"><TiktokIcon size={15} theme="filled" fill="white"/></span>;
  const asset=platform==='小红书'?'xiaohongshu':/B站|哔哩哔哩|bilibili/i.test(platform)?'bilibili':null;
  return asset?<span className={`platform-logo platform-${asset}`} aria-hidden="true"><img src={`/brands/${asset}.svg`} alt=""/></span>:<span className="platform-logo" aria-hidden="true"><FileText size={14}/></span>;
}

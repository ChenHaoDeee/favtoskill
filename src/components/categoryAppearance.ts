import { Briefcase,Robot,Cpu,Airplane,Food,Game,Video,Home,Fitness,Book } from './Icons';
import type { Category } from '../../shared/contracts';
import type { CategoryIcon,CategoryTone } from '../../shared/categoryAppearance';
export const iconChoices=[{id:'book',label:'阅读',Icon:Book},{id:'briefcase',label:'工作',Icon:Briefcase},{id:'robot',label:'AI工具',Icon:Robot},{id:'cpu',label:'科技',Icon:Cpu},{id:'airplane',label:'旅行',Icon:Airplane},{id:'food',label:'美食',Icon:Food},{id:'game',label:'游戏',Icon:Game},{id:'video',label:'影视',Icon:Video},{id:'home',label:'生活',Icon:Home},{id:'fitness',label:'运动',Icon:Fitness}] as const;
export const toneChoices=[{id:'lime',label:'青柠'},{id:'lavender',label:'浅紫'},{id:'peach',label:'暖杏'},{id:'blue',label:'浅蓝'},{id:'rose',label:'浅粉'}] as const;
export function categoryAppearance(category:Pick<Category,'name'|'icon'|'tone'>){
  let icon:CategoryIcon='book',tone:CategoryTone='lime';const n=category.name;
  if(/求职|面试|职场|工作/.test(n))icon='briefcase';
  else if(/AI|工具|人工智能/i.test(n)){icon='robot';tone='lavender'}
  else if(/科技|数码|编程/.test(n)){icon='cpu';tone='lavender'}
  else if(/旅行|旅游|出行/.test(n))icon='airplane';
  else if(/健身|运动/.test(n)){icon='fitness';tone='peach'}
  else if(/美食|饮食|餐/.test(n)){icon='food';tone='peach'}
  else if(/游戏/.test(n)){icon='game';tone='blue'}
  else if(/解说|影视|视频/.test(n)){icon='video';tone='rose'}
  else if(/生活|家居/.test(n)){icon='home';tone='blue'}
  else if(/人文|阅读|摘录/.test(n))tone='peach';
  icon=category.icon||icon;tone=category.tone||tone;
  return {icon,tone,Icon:iconChoices.find(choice=>choice.id===icon)!.Icon};
}

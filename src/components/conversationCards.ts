import type { Message,Skill } from '../../shared/contracts';
export type ConversationCard=
  |{kind:'question';options:string[];status:'active'|'complete';response?:string}
  |{kind:'sources';goal:string;recommended:string[];selectedIds:string[];status:'active'|'complete'}
  |{kind:'result';skill:Skill};
export type ChatTurn=Message&{card?:ConversationCard};
export type CardAction={type:'question';text:string}|{type:'sources';ids:string[]};

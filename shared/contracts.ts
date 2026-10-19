import type { CategoryIcon,CategoryTone } from './categoryAppearance.js';
export interface Category { id:string; name:string; createdAt:string;icon?:CategoryIcon|null;tone?:CategoryTone|null }
export type Completeness = 'complete'|'fragment'|'unavailable';
export interface Knowledge { id:string; title:string; originalText:string; imagePath?:string|null; sourcePlatform?:string;demoPlatform?:string; sourceUrl?:string|null; summary:string; keyPoints:string[]; categoryId:string|null; tags:string[]; completeness:Completeness; createdAt:string; updatedAt:string; provenance?:{kind:string;repository:string;commit:string;file:string;originalId:string;textKind:string} }
export interface Skill { id:string; name:string; description:string; scenarios:string[]; inputRequirements:string; steps:string[]; outputFormat:string; knowledgeIds:string[]; limitations:string[]; externalDependencies:string[]; createdAt:string; updatedAt:string; origin?:'preset'|'template'|'ai'|'edited';sourceMarkdown?:string }
export interface ChatContext { page:'knowledge'|'skills'; categoryId?:string; knowledgeId?:string;skillId?:string }
export interface Message { id:string; role:'user'|'assistant'; content:string; sources:string[]; createdAt:string }
export interface Conversation { id:string; title:string; createdAt:string }
export interface Health { status:'ok'; aiConfigured:boolean;embeddingConfigured?:boolean;model?:string|null; phase:number;workspace?:'personal'|'demo' }
export interface ApiError { error:{code:string;message:string;retryable:boolean} }
export type AiMode='demo'|'real';
export interface ChatRequest { conversationId?:string; content:string; context:ChatContext;mode?:AiMode }
export interface ChatResponse { conversationId:string; message:Message;mode?:AiMode;suggestSkill?:boolean }
export interface OrganizeMove { knowledgeId:string;categoryId:string|null;reason:string }
export interface OrganizeDuplicateGroup { id:string;knowledgeIds:string[];recommendedKeepId:string;reason:string }
export interface OrganizeCategoryMerge { sourceId:string;targetId:string;reason:string }
export interface OrganizeDuplicateGroup { id:string;knowledgeIds:string[];recommendedKeepId:string;reason:string }
export interface OrganizeCategoryMerge { sourceId:string;targetId:string;reason:string }
export interface KnowledgeUpdate { id:string;knowledgeId:string;beforeText:string;afterText:string;source:'manual'|'tikhub'|'demo';note:string }
export interface OrganizePlan { id:string;version:number;mode:AiMode;moves:OrganizeMove[];duplicates:{firstId:string;secondId:string}[];duplicateGroups?:OrganizeDuplicateGroup[];categoryMerges?:OrganizeCategoryMerge[];updates?:KnowledgeUpdate[];analyzedCount?:number }
export interface Suggestion { id:string;kind:'duplicate'|'update'|'review';title:string;reason:string;knowledgeIds:string[];skillId?:string;categoryId?:string }

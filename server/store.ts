import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Category, Knowledge, Skill, Message, Conversation } from '../shared/contracts.js';
export function createStore(path=resolve('data/favtoskill.sqlite')) {
  if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS skills(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),role TEXT NOT NULL,content TEXT NOT NULL,sources TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT OR IGNORE INTO state VALUES('revision','0');
    CREATE TABLE IF NOT EXISTS undo(id TEXT PRIMARY KEY,snapshot TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,last_used TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dismissed(id TEXT PRIMARY KEY);`);
  for(const table of ['categories','knowledge','skills'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='deleted_at'))db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
  for(const column of ['icon','tone'])if(!db.prepare('PRAGMA table_info(categories)').all().some(c=>c.name===column))db.exec(`ALTER TABLE categories ADD COLUMN ${column} TEXT`);
  const revision=()=>Number((db.prepare("SELECT value FROM state WHERE key='revision'").get() as {value:string}).value);
  const categories=()=>db.prepare('SELECT id,name,created_at AS createdAt,icon,tone FROM categories WHERE deleted_at IS NULL ORDER BY created_at').all() as unknown as Category[];
  const knowledge=()=>db.prepare('SELECT body FROM knowledge WHERE deleted_at IS NULL').all().map(r=>JSON.parse(r.body as string) as Knowledge);
  const skills=()=>db.prepare('SELECT body FROM skills WHERE deleted_at IS NULL').all().map(r=>JSON.parse(r.body as string) as Skill);
  const snapshot=()=>JSON.stringify(Object.fromEntries(['categories','knowledge','skills'].map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()])));
  const mutate=(fn:(undoId:string)=>void)=>{
    db.exec('BEGIN IMMEDIATE');
    try {const before=snapshot();const undoId=randomUUID();fn(undoId);const next=revision()+1;db.prepare("UPDATE state SET value=? WHERE key='revision'").run(String(next));db.prepare('INSERT INTO undo VALUES(?,?,?)').run(undoId,before,next);db.exec('COMMIT');return undoId}
    catch(e){db.exec('ROLLBACK');throw e}
  };
  return {
    db,revision,categories,knowledge,skills,mutate,
    putKnowledge:(k:Knowledge)=>db.prepare('INSERT INTO knowledge(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,deleted_at=NULL').run(k.id,JSON.stringify(k)),
    putSkill:(s:Skill)=>db.prepare('INSERT INTO skills(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,deleted_at=NULL').run(s.id,JSON.stringify(s)),
    undo:(id:string)=>{
      const row=db.prepare('SELECT snapshot,revision FROM undo WHERE id=?').get(id) as {snapshot:string;revision:number}|undefined;
      if(!row||row.revision!==revision())return false;
      const data=JSON.parse(row.snapshot) as Record<string,Record<string,string|null>[]>;
      db.exec('BEGIN IMMEDIATE');
      try {for(const table of ['categories','knowledge','skills']){db.exec(`DELETE FROM ${table}`);for(const record of data[table]){const keys=Object.keys(record);db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>record[k]))}}db.prepare("UPDATE state SET value=? WHERE key='revision'").run(String(revision()+1));db.prepare('DELETE FROM undo WHERE id=?').run(id);db.exec('COMMIT');return true}catch(e){db.exec('ROLLBACK');throw e}
    },
    conversations:()=>db.prepare('SELECT id,title,created_at AS createdAt FROM conversations ORDER BY created_at DESC LIMIT 100').all() as unknown as Conversation[],
    messages:(id:string)=>db.prepare('SELECT id,role,content,sources,created_at AS createdAt FROM messages WHERE conversation_id=? ORDER BY rowid').all(id).map(r=>({...r,sources:JSON.parse(r.sources as string)})) as unknown as Message[],
    addMessage:(id:string,m:Message)=>db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(m.id,id,m.role,m.content,JSON.stringify(m.sources),m.createdAt),
    touch:(id:string)=>db.prepare('INSERT INTO activity VALUES(?,?) ON CONFLICT(id) DO UPDATE SET last_used=excluded.last_used').run(id,new Date().toISOString())
  };
}
export type Store=ReturnType<typeof createStore>;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,existsSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';

test('folder appearance: legacy migration, validation, rename, undo and disk persistence',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fav-appearance-')),file=join(dir,'test.sqlite');
  const old=new DatabaseSync(file);
  old.exec("CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);INSERT INTO categories VALUES('legacy','已有分类','2026-10-18')");old.close();
  const app=await createApp(createStore(file));let closed=false;
  try{
    const before=(await app.inject('/api/categories')).json().items;
    assert.equal(before[0].name,'已有分类');assert.equal(before[0].icon,null);
    const created=await app.inject({method:'POST',url:'/api/categories',payload:{name:'灵感收集',icon:'robot',tone:'rose'}});
    assert.equal(created.statusCode,200);const id=created.json().item.id;
    assert.equal((await app.inject({method:'POST',url:'/api/categories',payload:{name:'无效',icon:'unknown',tone:'lime'}})).statusCode,400);
    const renamed=await app.inject({method:'PATCH',url:`/api/categories/${id}`,payload:{name:'我的灵感'}});assert.equal(renamed.statusCode,200);
    assert.equal(renamed.json().item.icon,'robot');assert.equal(renamed.json().item.tone,'rose');
    const edited=await app.inject({method:'PATCH',url:`/api/categories/${id}`,payload:{icon:'airplane',tone:'blue'}});assert.equal(edited.statusCode,200);
    assert.equal((await app.inject({method:'POST',url:`/api/undo/${edited.json().undoId}`,payload:{}})).statusCode,200);
    await app.close();closed=true;
    const reopened=createStore(file);
    try{const saved=reopened.categories().find(c=>c.id===id)!;assert.equal(saved.name,'我的灵感');assert.equal(saved.icon,'robot');assert.equal(saved.tone,'rose')}finally{reopened.db.close()}
  }finally{
    if(!closed)await app.close();
    for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);
    rmdirSync(dir);
  }
});

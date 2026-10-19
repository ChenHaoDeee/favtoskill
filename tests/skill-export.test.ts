import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';

test('one Skill ZIP contains readable rules, structured data, reference originals and license; absent sources reject export',async()=>{
  const demo=createStore(':memory:');seedDemo(demo);const app=await createApp(createStore(':memory:'),demo);
  try{
    const skill=demo.skills()[0];const response=await app.inject(`/api/demo/skills/${skill.id}/export?format=zip`);
    assert.equal(response.statusCode,200);assert.match(response.headers['content-type']!,/application\/zip/);assert.match(String(response.headers['content-disposition']),/\.zip/);
    const bytes=response.rawPayload,files=new Map<string,string>();let cursor=0;
    while(bytes.readUInt32LE(cursor)===0x04034b50){
      const size=bytes.readUInt32LE(cursor+18),nameLength=bytes.readUInt16LE(cursor+26),extraLength=bytes.readUInt16LE(cursor+28),start=cursor+30+nameLength+extraLength;
      const name=bytes.subarray(cursor+30,cursor+30+nameLength).toString('utf8'),body=bytes.subarray(start,start+size);
      assert.equal(bytes.readUInt16LE(cursor+8),0);assert.equal(crc32(body),bytes.readUInt32LE(cursor+14));files.set(name,body.toString('utf8'));cursor=start+size;
    }
    assert.equal(bytes.readUInt32LE(cursor),0x02014b50);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);assert.equal(bytes.readUInt16LE(bytes.length-12),files.size);
    assert.ok(files.has('SKILL.md'));assert.ok(files.has('README.md'));assert.ok(files.has('LICENSE.txt'));
    const bundle=JSON.parse(files.get('skill.json')!);assert.equal(bundle.skill.id,skill.id);assert.equal(bundle.references.length,skill.knowledgeIds.length);
    assert.equal([...files.keys()].filter(k=>k.startsWith('references/')).length,skill.knowledgeIds.length);assert.match(files.get('SKILL.md')!,/外部平台兼容性未经验证/);
    assert.ok(files.get('references/001.md')!.includes(bundle.references[0].originalText));assert.ok(files.get('SKILL.md')!.includes(bundle.references[0].originalText));assert.match(files.get('README.md')!,/图片\/视频不包含/);
    assert.equal((await app.inject(`/api/demo/skills/${skill.id}/export?format=invalid`)).statusCode,400);
    demo.mutate(()=>demo.db.prepare('UPDATE knowledge SET deleted_at=? WHERE id=?').run('2026-10-19',skill.knowledgeIds[0]));
    assert.equal((await app.inject(`/api/demo/skills/${skill.id}/export?format=zip`)).statusCode,409);
  }finally{await app.close()}
});

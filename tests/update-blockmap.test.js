import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chunks,blockmap,fixtureBytes,MIN_BLOCK,MAX_BLOCK,sha256} from '../scripts/update-blockmap.mjs';

test('内容定义块确定性连续覆盖，空块和尾块正确',()=>{
 assert.deepEqual(chunks(Buffer.alloc(0)),[]);
 for(const bytes of [Buffer.from([1]),Buffer.alloc(MAX_BLOCK+3,7),fixtureBytes(0xbadc0ffe,65536)]){
  const blocks=chunks(bytes);assert.deepEqual(chunks(bytes),blocks);let offset=0;
  for(const [i,block]of blocks.entries()){
   assert.equal(block.offset,offset);assert.ok(block.size>0&&block.size<=MAX_BLOCK);
   if(i<blocks.length-1)assert.ok(block.size>=MIN_BLOCK);
   assert.equal(block.sha256,sha256(bytes.subarray(offset,offset+block.size)));offset+=block.size;
  }
  assert.equal(offset,bytes.length);
 }
 assert.throws(()=>blockmap(Buffer.alloc(0),'1.0.0','https://example.test/setup.exe'));
});

test('插入内容后块边界重新同步，绝大多数未变内容可复用',()=>{
 const before=fixtureBytes(12345,1024*1024),after=Buffer.concat([before.subarray(0,200000),Buffer.from('new version content'),before.subarray(200000)]);
 const known=new Set(chunks(before).map(block=>block.sha256));
 const reused=chunks(after).filter(block=>known.has(block.sha256)).reduce((sum,block)=>sum+block.size,0);
 assert.ok(reused>before.length*.9);
});

test('发布块图与已提交Rust跨语言fixture一致',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/update-blockmap.json',import.meta.url),'utf8'));
 assert.deepEqual(blockmap(fixtureBytes(fixture.seed,fixture.length),fixture.map.version,fixture.map.url),fixture.map);
});

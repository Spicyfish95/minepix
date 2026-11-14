import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveConnect, tilePattern, patternTable} from '../src/terrain-connect.js';

const tile=(terrain=-1,peering={},weight=1)=>({terrain,peering:[...Array(8)].map((_,i)=>peering[i]??-1),weight});
const tileset=(mode,tiles)=>({w:2,h:2,mode,terrains:[{id:0,name:'草地'},{id:1,name:'水'}],tiles});
// 位序：0 左上、1 上、2 右上、3 左、4 右、5 左下、6 下、7 右下。

test('图块模式只填当前匹配方式的有效位',()=>{
  const set=tileset('corners',[tile(0,{0:0,1:0,4:0})]);
  const pattern=tilePattern(set,0);
  assert.equal(pattern.terrain,0);
  assert.deepEqual(pattern.bits,[0,-1,-1,-1,-1,-1,-1,-1]);
  assert.deepEqual(tilePattern(tileset('sides',[tile(0,{0:0,4:0})]),0).bits,[-1,-1,-1,-1,0,-1,-1,-1]);
  assert.deepEqual(tilePattern(set,9),{terrain:-1,bits:new Array(8).fill(-1)});
});

test('相同地形与邻居位的图块归成一个模式',()=>{
  const table=patternTable(tileset('sides',[tile(0),tile(0),tile(0,{4:0}),tile(1,{4:0})]));
  assert.equal(table.length,3);
  assert.deepEqual(table[0].ids,[0,1]);
  assert.deepEqual(table[2].ids,[3]);
});

test('刷相邻格后先前的孤岛图块被邻居约束纠正为连边图块',()=>{
  const set=tileset('sides',[tile(0),tile(0,{4:0}),tile(0,{3:0})]);
  const first=solveConnect({tileset:set,cols:2,rows:1,cells:[0,-1],painted:[0]});
  assert.deepEqual(first.ids,[0,-1],'只刷一格时没有邻居，取孤岛图块');
  assert.deepEqual(first.exact,[true,true]);
  const second=solveConnect({tileset:set,cols:2,rows:1,cells:[0,0],painted:[0,1],previous:first.ids});
  assert.deepEqual(second.ids,[1,2],'两侧同时有地形后，左格换成右边连、右格换成左边连');
  assert.deepEqual(second.exact,[true,true]);
});

test('角位要共用该角的三个格同属该地形才成为约束',()=>{
  const set=tileset('corners',[tile(0),tile(0,{0:0})]);
  const alone=solveConnect({tileset:set,cols:2,rows:2,cells:[-1,-1,-1,0],painted:[3]});
  assert.equal(alone.ids[3],0,'只有一个角格时不加角约束');
  const diagonal=solveConnect({tileset:set,cols:2,rows:2,cells:[0,-1,-1,0],painted:[0,3]});
  assert.equal(diagonal.ids[3],0,'对角相邻不算共用角');
  const full=solveConnect({tileset:set,cols:2,rows:2,cells:[0,0,0,0],painted:[0,1,2,3]});
  assert.equal(full.ids[3],1,'四个格都把左上角填满后，右下角用带左上连接的图块');
  assert.equal(full.exact[3],true);
});

test('没有匹配模式时该格解不出图块并标记不精确',()=>{
  const set=tileset('sides',[tile(0,{4:0})]);
  const solved=solveConnect({tileset:set,cols:1,rows:1,cells:[0],painted:[0]});
  assert.deepEqual(solved.ids,[-1]);
  assert.deepEqual(solved.exact,[false]);
});

test('未刷地形的格不参与解析',()=>{
  const set=tileset('sides',[tile(0)]);
  const solved=solveConnect({tileset:set,cols:2,rows:1,cells:[-1,-1],painted:[0,1]});
  assert.deepEqual(solved.ids,[-1,-1]);
  assert.deepEqual(solved.exact,[true,true]);
});

test('同模式多图块按权重随机，随机源可注入',()=>{
  const set=tileset('sides',[tile(0,{},3),tile(0,{},1)]);
  const first=solveConnect({tileset:set,cols:1,rows:1,cells:[0],painted:[0],random:()=>0});
  assert.deepEqual(first.ids,[0]);
  const last=solveConnect({tileset:set,cols:1,rows:1,cells:[0],painted:[0],random:()=>0.99});
  assert.deepEqual(last.ids,[1]);
});

test('大量模式按首次出现顺序建表，相同模式的变体保留原始图块顺序',()=>{
  const tiles=Array.from({length:512},(_,i)=>tile(0,Object.fromEntries(Array.from({length:8},(_,bit)=>[bit,(i%256>>>bit)&1]))));
  const table=patternTable(tileset('corners-and-sides',tiles));
  assert.equal(table.length,256);
  assert.deepEqual(table[173].bits,[1,0,1,1,0,1,0,1]);
  for(let i=0;i<256;i++)assert.deepEqual(table[i].ids,[i,i+256]);
});

test('非精确匹配同分保留首次模式，后续格仍按邻接约束解析',()=>{
  const set=tileset('sides',[tile(0),tile(0,{4:1}),tile(0,{3:0})]);
  const result=solveConnect({tileset:set,cols:2,rows:1,cells:[0,0],painted:[0,1]});
  assert.deepEqual(result.ids,[0,2]);
  assert.deepEqual(result.exact,[false,true]);
});

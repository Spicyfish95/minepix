import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PALETTE_LIBRARY_KEY,BUILTIN_PALETTES,listPaletteLibrary,paletteById,savePaletteToLibrary,deletePaletteFromLibrary,nearestIndex,remapIndices} from '../src/palette-library.js';

// node 里没有 localStorage：用内存实现顶替，写读走同一份数据。
const store=new Map();
globalThis.localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
const reset=()=>store.clear();

test('色板库内置四份色板且颜色按 #RRGGBB 记录',()=>{
  reset();
  const list=listPaletteLibrary();
  assert.equal(list.length,BUILTIN_PALETTES.length);
  assert.deepEqual(list.map(entry=>entry.id),['pico8','db32','gray16','gameboy']);
  assert.ok(list.every(entry=>!entry.user&&entry.colors.length>=4&&entry.colors.every(color=>/^#[0-9A-F]{6}$/.test(color))));
});

test('保存色板会规范化颜色并去重',()=>{
  reset();
  const entry=savePaletteToLibrary('验收色板',['#ff0000','#FF0000','f00','#00ff0080','#00000000']);
  assert.equal(entry.name,'验收色板');
  assert.deepEqual(entry.colors,['#FF0000','#00FF00','#000000']);
  assert.deepEqual(paletteById(entry.id).colors,entry.colors);
});

test('同名保存沿用同一标识',()=>{
  reset();
  const first=savePaletteToLibrary('同名',['#112233']);
  const second=savePaletteToLibrary('同名',['#445566']);
  assert.equal(second.id,first.id);
  assert.deepEqual(listPaletteLibrary().filter(entry=>entry.user).map(entry=>entry.colors),[[ '#445566' ]]);
});

test('空色板与非法颜色会报错',()=>{
  reset();
  assert.throws(()=>savePaletteToLibrary('空',[]),/至少需要一个颜色/);
  assert.throws(()=>savePaletteToLibrary('坏','#ff0000'),/至少需要一个颜色/);
  assert.throws(()=>savePaletteToLibrary('坏',['#12345']),/需为 #RRGGBB/);
});

test('只删除用户色板，内置色板删不掉',()=>{
  reset();
  const saved=savePaletteToLibrary('临时',['#abcdef']);
  deletePaletteFromLibrary('pico8');
  assert.ok(paletteById('pico8'));
  deletePaletteFromLibrary(saved.id);
  assert.equal(paletteById(saved.id),null);
  assert.equal(JSON.parse(store.get(PALETTE_LIBRARY_KEY)||'[]').length,0);
});

test('最近色按 RGB 距离选取，空色板返回 -1',()=>{
  const palette=['#000000','#FF0000','#00FF00'];
  assert.equal(nearestIndex(palette,'#0a0a0a'),0);
  assert.equal(nearestIndex(palette,'#f01010'),1);
  assert.equal(nearestIndex(palette,'#10f010'),2);
  assert.equal(nearestIndex([],'#ffffff'),-1);
});

test('重映射按旧色板把索引搬到新色板的最近色并报告变化',()=>{
  const oldPalette=['#000000','#ff0000','#00ff00'];
  const newPalette=['#000000','#00ff00','#ff0000'];
  const result=remapIndices(oldPalette,newPalette,[0,1,2]);
  assert.deepEqual(result.indices,[0,2,1]);
  assert.equal(result.changed,true);
  const same=remapIndices(oldPalette,oldPalette,[0,1,2]);
  assert.deepEqual(same.indices,[0,1,2]);
  assert.equal(same.changed,false);
});

test('越界或非法下标原样保留且不算变化',()=>{
  const result=remapIndices(['#000000'],['#000000'],[5,-1,0]);
  assert.deepEqual(result.indices,[5,-1,0]);
  assert.equal(result.changed,false);
});

test('大量重复索引映射保持最近色首槽、无效值和 typed-array 输入语义',()=>{
  const palette=['#000000','#ff0000','#00ff00'];
  const indices=Uint8Array.from({length:8192},(_,i)=>i%3);
  const result=remapIndices(palette,['#ff0000','#000000','#ff0000'],indices);
  assert.deepEqual(result.indices,Array.from(indices,i=>[1,0,1][i]));
  assert.equal(result.changed,true);
  const empty=remapIndices(palette,[],[0,1,-1,NaN]);
  assert.deepEqual(empty.indices,[0,1,-1,NaN]);
  assert.equal(empty.changed,false);
});

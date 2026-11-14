import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addLayer,composite,clone} from '../src/model.js';
import {BLEND_MODES,blendColor} from '../src/compositor.js';
import {FrameCache} from '../src/renderer.js';
import {mergeVisible,flattenSprite} from '../src/layer-commands.js';

function sample(){const doc=createDocument(2,1);doc.frames[0].cels[0]=[0x804020ff,0x2080c080];addLayer(doc,0);doc.frames[0].cels[1]=[0x4080c0ff,0xc0604080];return doc;}

test('全部19模式对照Aseprite半透明黄金像素',async()=>{
 const golden=JSON.parse(await fs.readFile(new URL('./fixtures/blend-golden.json',import.meta.url),'utf8'));
 assert.equal(BLEND_MODES.length,19);assert.equal(golden.results.length,19);
 assert.deepEqual(new Set(golden.results.map(entry=>entry.mode)),new Set(BLEND_MODES.map(([mode])=>mode)));
 for(const entry of golden.results){const doc=sample();doc.layers[1].blendMode=entry.mode;const actual=composite(doc,0);assert.ok(actual.every((value,i)=>Math.abs(value-entry.actual[i])<=1),entry.mode);}
});

test('三种算术混合对照手算通道值',()=>{
 for(const [mode,expected]of [['addition',[.7,.9,1]],['subtract',[0,.1,.6]],['divide',[.4,1,1]]]){
  const actual=blendColor([.2,.5,.8],[.5,.4,.2],mode);assert.ok(actual.every((value,i)=>Math.abs(value-expected[i])<1e-8),mode);
 }
});

test('全部模式的脏区域缓存与合并保留完整合成',()=>{
 for(const [mode]of BLEND_MODES){
  const doc=sample();doc.layers[1].blendMode=mode;
  const cache=new FrameCache();cache.get(doc,0);doc.frames[0].cels[1][0]=0xff112280;cache.invalidate(0,{x:0,y:0,w:1,h:1});
  const expected=composite(doc,0);assert.deepEqual(cache.get(doc,0).rgba,expected,mode+' cache');
  const copy=clone(doc);mergeVisible(doc);flattenSprite(copy);assert.deepEqual(composite(doc,0),expected,mode+' merge');assert.deepEqual(composite(copy,0),expected,mode+' flatten');
 }
});

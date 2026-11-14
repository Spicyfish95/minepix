import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument,addLayer,addFrame,colorValue,composite,clone } from '../src/model.js';
import { mergeDown,mergeVisible,flattenSprite } from '../src/layer-commands.js';
const red=colorValue('#ff0000'),blue=colorValue('#0000ff');
test('merge down bakes transparency and preserves all animation frames',()=>{
  const d=createDocument(2,1);d.frames[0].cels[0][0]=red;addLayer(d,0);d.layers[1].opacity=50;d.frames[0].cels[1][0]=blue;d.frames[0].cels[1][1]=blue;addFrame(d,0,true);d.frames[1].cels[0][1]=red;
  const before=d.frames.map((_,i)=>[...composite(d,i)]);assert.equal(mergeDown(d,1),0);assert.equal(d.layers.length,1);assert.equal(d.layers[0].opacity,100);d.frames.forEach((f,i)=>{assert.equal(f.cels.length,1);assert.deepEqual([...composite(d,i)],before[i]);});
});
test('merge visible preserves hidden cels and the visible composite',()=>{
  const d=createDocument(1,1);d.frames[0].cels[0][0]=red;addLayer(d,0);d.layers[1].visible=false;d.layers[1].locked=true;d.frames[0].cels[1][0]=blue;addLayer(d,1);d.layers[2].opacity=50;d.frames[0].cels[2][0]=blue;
  const before=[...composite(d,0)],hidden=clone(d.layers[1]);assert.equal(mergeVisible(d),1);assert.equal(d.layers.length,2);assert.deepEqual(d.layers[0],hidden);assert.equal(d.frames[0].cels[0][0],blue);assert.deepEqual([...composite(d,0)],before);
});
test('locked or hidden merge targets are rejected without modifying data',()=>{
  const d=createDocument();addLayer(d,0);d.layers[1].locked=true;let before=clone(d);assert.throws(()=>mergeDown(d,1),/解锁/);assert.deepEqual(d,before);
  d.layers[1].locked=false;d.layers[0].visible=false;before=clone(d);assert.throws(()=>mergeDown(d,1),/显示/);assert.throws(()=>mergeVisible(d),/至少/);assert.deepEqual(d,before);
});
test('flatten keeps the visible image and removes hidden layers explicitly',()=>{
  const d=createDocument(2,1);d.frames[0].cels[0][0]=red;addLayer(d,0);d.layers[1].visible=false;d.frames[0].cels[1][1]=blue;
  const before=[...composite(d,0)];flattenSprite(d);assert.equal(d.layers.length,1);assert.deepEqual([...composite(d,0)],before);assert.equal(d.frames[0].cels[0][1],0);
});

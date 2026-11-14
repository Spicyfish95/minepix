import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, addLayer, addFrame, clone, colorValue } from '../src/model.js';
import { celRectangle, containsCel, celTargets, copyCels, clearCels, pasteCels, moveCels, celContentBounds, transformCels, flipCels } from '../src/timeline-selection.js';
import { transformState } from '../src/transform-controls.js';
const range={fromFrame:0,toFrame:1,fromLayer:0,toLayer:1};
function fixture(){
  const doc=createDocument(4,3);addLayer(doc,0);addLayer(doc,1);for(let i=1;i<4;i++)addFrame(doc,i-1);
  doc.frames.forEach((frame,f)=>{frame.duration=(f+1)*100;frame.cels.forEach((pixels,l)=>pixels[0]=((f*3+l+1)*256+128)>>>0);});
  doc.tags=[{id:'walk',name:'行走',color:'#edb75b',from:0,to:2,direction:'forward'}];return doc;
}
test('cel rectangles span both axes and enumerate rows in visual top-to-bottom order',()=>{
  const box=celRectangle({frame:2,layer:0},{frame:0,layer:2});assert.deepEqual(box,{fromFrame:0,toFrame:2,fromLayer:0,toLayer:2});
  assert.equal(containsCel(box,1,1),true);assert.equal(containsCel(box,3,1),false);assert.deepEqual(celTargets(range),[{frame:0,layer:1},{frame:0,layer:0},{frame:1,layer:1},{frame:1,layer:0}]);
});
test('read-only cel copy preserves RGBA and includes locked or hidden sources independently',()=>{
  const doc=fixture();doc.layers[1].locked=true;doc.layers[0].visible=false;const clip=copyCels(doc,range);
  assert.deepEqual(clip.data[0][0],doc.frames[0].cels[1]);assert.equal(clip.data[1][1][0]&255,128);
  clip.data[0][0][0]=0;assert.notEqual(doc.frames[0].cels[1][0],0);
});
test('paste anchors at the top-left cell and overwrites transparent pixels without aliases',()=>{
  const doc=fixture(),clip=copyCels(doc,range);doc.frames[2].cels[2].fill(255);
  assert.deepEqual(pasteCels(doc,clip,2,2),{fromFrame:2,toFrame:3,fromLayer:1,toLayer:2});
  assert.deepEqual(doc.frames[2].cels[2],clip.data[0][0]);assert.equal(doc.frames[2].cels[2][1],0);
  doc.frames[2].cels[2][0]=0;assert.notEqual(clip.data[0][0][0],0);assert.notEqual(doc.frames[0].cels[1][0],0);
});
test('out-of-bounds, canvas mismatch and locked destinations reject the entire paste',()=>{
  const doc=fixture(),clip=copyCels(doc,range);doc.layers[1].locked=true;const before=clone(doc);
  for(const apply of [()=>pasteCels(doc,clip,3,2),()=>pasteCels(doc,clip,0,0),()=>pasteCels(doc,{...clip,width:8},0,2),()=>pasteCels(doc,clip,2,2)]){assert.throws(apply);assert.deepEqual(doc,before);}
});
test('overlapping cel moves use a snapshot and preserve timing, tags and layer properties',()=>{
  const doc=fixture(),before=clone(doc),clip=copyCels(doc,range);moveCels(doc,range,1,1);
  assert.deepEqual(doc.frames[1].cels[2],clip.data[0][0]);assert.deepEqual(doc.frames[1].cels[1],clip.data[0][1]);assert.deepEqual(doc.frames[2].cels[1],clip.data[1][1]);
  assert.ok(doc.frames[0].cels[0].every(p=>p===0));assert.ok(doc.frames[1].cels[0].every(p=>p===0));assert.deepEqual(doc.frames[3],before.frames[3]);
  assert.deepEqual(doc.frames.map(f=>f.duration),before.frames.map(f=>f.duration));assert.deepEqual(doc.tags,before.tags);assert.deepEqual(doc.layers,before.layers);
});
test('clear and move reject any hidden or locked member before writing other cells',()=>{
  const doc=fixture();doc.layers[2].locked=true;let before=clone(doc);assert.throws(()=>moveCels(doc,range,1,1),/锁定/);assert.deepEqual(doc,before);
  doc.layers[2].locked=false;doc.layers[1].visible=false;before=clone(doc);assert.throws(()=>clearCels(doc,range),/隐藏/);assert.deepEqual(doc,before);
  doc.layers[1].visible=true;clearCels(doc,range);assert.ok(celTargets(range).every(({frame,layer})=>doc.frames[frame].cels[layer].every(p=>!p)));assert.equal(doc.frames.length,4);assert.equal(doc.layers.length,3);
});
test('shared content bounds align transforms across frames and layers with canvas clipping',()=>{
  const doc=fixture();for(const frame of doc.frames)for(const cel of frame.cels)cel.fill(0);
  doc.frames[0].cels[0][0]=colorValue('#ff000080');doc.frames[1].cels[1][5]=colorValue('#0000ff');doc.frames[3].cels[2][11]=255;
  const bounds=celContentBounds(doc,range);assert.deepEqual(bounds,{x:0,y:0,w:2,h:2});
  transformCels(doc,range,bounds,{...transformState(bounds),angle:90});assert.equal(doc.frames[0].cels[0][1],colorValue('#ff000080'));assert.equal(doc.frames[1].cels[1][4],colorValue('#0000ff'));assert.equal(doc.frames[3].cels[2][11],255);
  transformCels(doc,range,bounds,{...transformState(bounds),x:8});assert.equal(celContentBounds(doc,range),null);
});
test('batch flips share a pivot and preserve cells outside the rectangle',()=>{
  const doc=fixture();for(const {frame,layer}of celTargets(range))doc.frames[frame].cels[layer].fill(0);
  doc.frames[0].cels[0][0]=255;doc.frames[1].cels[1][5]=511;const outside=clone(doc.frames[2]);
  flipCels(doc,range,celContentBounds(doc,range),'x');assert.equal(doc.frames[0].cels[0][1],255);assert.equal(doc.frames[1].cels[1][4],511);assert.deepEqual(doc.frames[2],outside);
});

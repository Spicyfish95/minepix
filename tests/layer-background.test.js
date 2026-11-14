import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addLayer,addFrame,clone,History,composite,validateDocument} from '../src/model.js';
import {convertBackground} from '../src/layer-types.js';
import {moveLayerSibling,groupLayer,duplicateLayerTree} from '../src/layer-tree.js';
import {mergeVisible,flattenSprite} from '../src/layer-commands.js';
import {resizeCanvas} from '../src/canvas-commands.js';

test('background conversion composites every frame and fixes the layer below normal siblings',()=>{
 const doc=createDocument(2,1);addLayer(doc,0);doc.frames[0].cels[1]=[0xff000080,0];addFrame(doc,0,true);
 assert.equal(convertBackground(doc,1,0x0000ffff),0);assert.equal(doc.layers[0].type,'background');assert.ok(doc.frames.every(frame=>frame.cels[0][0]===0x80007fff&&frame.cels[0][1]===0x0000ffff));
 const before=clone(doc);for(const operation of [()=>moveLayerSibling(doc,0,1),()=>moveLayerSibling(doc,1,-1),()=>groupLayer(doc,0)]){assert.throws(operation,/背景/);assert.deepEqual(doc,before);}validateDocument(doc);
});
test('history fills transparent background writes and merging preserves its role and composite',()=>{
 const doc=createDocument(2,1);convertBackground(doc,0,0x112233ff);const before=clone(doc),history=new History();doc.frames[0].cels[0][0]=0;history.push(before,doc);assert.equal(doc.frames[0].cels[0][0],0x112233ff);
 addLayer(doc,0);doc.frames[0].cels[1][0]=0xff000080;const expected=composite(doc,0),flat=clone(doc);mergeVisible(doc);flattenSprite(flat);for(const next of [doc,flat]){assert.equal(next.layers[0].type,'background');assert.deepEqual(composite(next,0),expected);}
});
test('duplicated backgrounds become independent normal layers and ordinary conversion keeps pixels',()=>{
 const doc=createDocument(2,1);convertBackground(doc,0,0x112233ff);const before=clone(doc.frames),index=duplicateLayerTree(doc,0);assert.equal(doc.layers[index].type,undefined);assert.equal(doc.layers[index].clearColor,undefined);assert.deepEqual(doc.frames[0].cels[index],before[0].cels[0]);doc.frames[0].cels[index][0]=0;assert.equal(doc.frames[0].cels[0][0],0x112233ff);
 convertBackground(doc,0,0);assert.equal(doc.layers[0].type,undefined);assert.equal(doc.layers[0].clearColor,undefined);assert.deepEqual(doc.frames[0].cels[0],before[0].cels[0]);
});
test('new frames and expanded canvases retain opaque backgrounds and transparent ordinary borders',()=>{
 const doc=createDocument(2,1);convertBackground(doc,0,0x112233ff);addLayer(doc,0);doc.frames[0].cels[1][1]=0xff0000ff;addFrame(doc,0);assert.ok(doc.frames[1].cels[0].every(p=>p===0x112233ff));assert.ok(doc.frames[1].cels[1].every(p=>p===0));
 resizeCanvas(doc,4,3,'center');validateDocument(doc);assert.ok(doc.frames.every(frame=>frame.cels[0].every(p=>p===0x112233ff)));assert.equal(doc.frames[0].cels[1][6],0xff0000ff);assert.equal(doc.frames[0].cels[1][0],0);assert.ok(doc.frames[1].cels[1].every(p=>p===0));
});

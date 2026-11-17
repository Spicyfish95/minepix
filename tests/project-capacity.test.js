import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,validateDocument,clone,addFrame,addLayer} from '../src/model.js';
import {duplicateFrames} from '../src/timeline-commands.js';
import {addReference} from '../src/reference-board.js';
import {groupLayer,duplicateLayerTree} from '../src/layer-tree.js';
import {resizeCanvas,spriteSize} from '../src/canvas-commands.js';
import {celPixels,validateCelProperties} from '../src/cel-properties.js';
import {assertCapacity,assertProjectCapacity} from '../src/project-capacity.js';
import {History} from '../src/history.js';

const oldLimit=32*1024*1024;
function largeReferenceDocument(){
 const doc=createDocument(2,2);doc.frames[0].cels[0][0]=0x448844ff;
 addReference(doc,{id:'large',name:'外部参考',path:'C:/reference.png',missing:true,width:8192,height:4097,x:0,y:0,scale:1});return doc;
}
function sparseDocument(){
 const doc=createDocument(1,1);doc.width=1024;doc.height=1024;doc.frames[0].cels[0][0]=0x448844ff;
 doc.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};doc.requiredFeatures=['cel-properties'];
 while(doc.frames.length<33)duplicateFrames(doc,new Set([0]),doc.frames.length);return doc;
}
test('超过旧 32M 的单画布和多层多帧不再受固定像素预算限制',()=>{
 assertCapacity(8192,4097,1,1);assertCapacity(4096,4096,3,1);assertCapacity(8192,8192,64,256);
 assertCapacity(oldLimit+1,1,1,1);
});
test('尺寸必须可精确表示为正整数，层帧数量边界保持',()=>{
 for(const dims of[[0,1,1,1],[-1,2,1,1],[1.5,1,1,1],[NaN,1,1,1],[Infinity,1,1,1],[Number.MAX_SAFE_INTEGER,2,1,1],[1,1,0,1],[1,1,65,1],[1,1,1,257]])assert.throws(()=>assertCapacity(...dims));
});
test('超过旧预算的稀疏项目可验证、复制帧并独立撤销重做',()=>{
 let doc=validateDocument(sparseDocument());const before=clone(doc),history=new History();
 assert.ok(doc.width*doc.height*doc.frames.length>oldLimit);duplicateFrames(doc,new Set([0]),1);history.push(before,doc);
 assert.equal(doc.frames.length,34);assert.ok(doc.frames.every(frame=>frame.cels[0].length===1&&frame.cels[0][0]===0x448844ff));validateDocument(doc);
 doc=history.undo(doc);assert.deepEqual(doc,before);doc=history.redo(doc);assert.equal(doc.frames.length,34);validateDocument(doc);
});
for(const [name,edit]of[
 ['新增帧',d=>addFrame(d,0)],['复制单帧',d=>addFrame(d,0,true)],['复制多帧',d=>duplicateFrames(d,new Set([0]),1)],
 ['新增层',d=>addLayer(d,0)],['复制单层',d=>addLayer(d,0,true)],['复制图层树',d=>duplicateLayerTree(d,0)],['分组',d=>groupLayer(d,0)],
 ['扩大画布',d=>resizeCanvas(d,4,3)],['扩大精灵',d=>spriteSize(d,4,3)]
])test(name+'不再受外部参考图的旧像素预算约束',()=>{
 const doc=validateDocument(largeReferenceDocument()),reference=clone(doc.references);edit(doc);assertProjectCapacity(doc);validateDocument(doc);assert.deepEqual(doc.references,reference);
});
test('参考层复制不再累计源图像素预算',()=>{
 for(const edit of[d=>addLayer(d,0,true),d=>duplicateLayerTree(d,0)]){
  const doc=createDocument(2,2);doc.layers[0].type='reference';doc.layers[0].reference={path:'C:/large.png',missing:true,width:8192,height:4097,x:0,y:0,scale:1};
  edit(doc);assert.equal(doc.layers.length,2);validateDocument(doc);
 }
});
test('cel 属性接受超过旧预算的合法尺寸，仍拒绝无效字段',()=>{
 const doc=createDocument(1,1),properties={1:{x:0,y:0,width:8192,height:4097,opacity:100}};
 assert.deepEqual(validateCelProperties(properties,doc),properties);
 for(const patch of[{width:0},{height:1.5},{width:65536},{opacity:101},{x:32768}])assert.throws(()=>validateCelProperties({1:{...properties[1],...patch}},doc));
});
test('带超旧预算参考的链接 cel 扩展保持共享像素与位置',()=>{
 const doc=largeReferenceDocument();doc.frames[0].cels[0]=[0x448844ff];doc.frames[0].celProperties={1:{x:1,y:1,width:1,height:1,opacity:100}};
 doc.frames.push({...clone(doc.frames[0]),cels:[doc.frames[0].cels[0]]});celPixels(doc,0,0)[0]=0xff0000ff;
 assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);assert.deepEqual(doc.frames[0].cels[0],[0xff0000ff,0,0,0x448844ff]);
});
test('64 层与 256 帧上限保持，拒绝时不修改作品',()=>{
 const layers=createDocument(1,1);for(let i=1;i<64;i++)addLayer(layers,i-1);
 validateDocument(layers);const beforeLayers=clone(layers);assert.throws(()=>addLayer(layers,63),/64 图层/);assert.deepEqual(layers,beforeLayers);
 const frames=createDocument(1,1);for(let i=1;i<256;i++)addFrame(frames,i-1);
 validateDocument(frames);const beforeFrames=clone(frames);assert.throws(()=>duplicateFrames(frames,new Set([0]),256),/256 帧/);assert.deepEqual(frames,beforeFrames);
});

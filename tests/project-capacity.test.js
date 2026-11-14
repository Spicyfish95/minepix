import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,validateDocument,clone,addFrame,addLayer} from '../src/model.js';
import {duplicateFrames} from '../src/timeline-commands.js';
import {addReference} from '../src/reference-board.js';
import {groupLayer,duplicateLayerTree} from '../src/layer-tree.js';
import {resizeCanvas,spriteSize} from '../src/canvas-commands.js';
import {celPixels} from '../src/cel-properties.js';
import {LIMIT,assertProjectCapacity,celPixelCount,sourcePixelCount} from '../src/project-capacity.js';

function sparseDocument(){
 const doc=createDocument(1,1);doc.width=4096;doc.height=4096;doc.frames[0].cels[0][0]=0x448844ff;
 doc.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};doc.requiredFeatures=['cel-properties'];
 addReference(doc,{id:'ref',name:'ref',width:1,height:1,data:'/wAA/w==',x:32,y:64,scale:1});return doc;
}
test('有效大画布小cel的参考预算在复制帧之前拒绝且保持作品',()=>{
 const doc=validateDocument(sparseDocument()),before=clone(doc);assert.throws(()=>duplicateFrames(doc,new Set([0]),1),/32M/);assert.deepEqual(doc,before);
});
for(const [name,edit]of [
 ['新增帧',d=>addFrame(d,0)],['复制单帧',d=>addFrame(d,0,true)],
 ['新增层',d=>addLayer(d,0)],['复制单层',d=>addLayer(d,0,true)],
 ['复制图层树',d=>duplicateLayerTree(d,0)],['分组',d=>groupLayer(d,0)],
 ['扩大画布',d=>resizeCanvas(d,8192,4096)],['扩大精灵',d=>spriteSize(d,8192,4096)]
])test(name+'在分配像素或修改元数据前拒绝组合容量超限',()=>{
 const doc=validateDocument(sparseDocument()),before=clone(doc);
 assert.throws(()=>edit(doc),/32M/);assert.deepEqual(doc,before);
});
test('无参考精确32M逻辑边界允许复制并可重新验证',()=>{
 const doc=sparseDocument();delete doc.references;doc.requiredFeatures=doc.requiredFeatures.filter(f=>f!=='reference-board');
 duplicateFrames(doc,new Set([0]),1);
 assert.equal(doc.width*doc.height*doc.frames.length,LIMIT);
 assert.equal(celPixelCount(doc),2);
 assert.deepEqual(validateDocument(doc),doc);
 const before=clone(doc);
 assert.throws(()=>addReference(doc,{id:'extra',name:'参考',width:1,height:1,data:'/wAA/w==',x:0,y:0,scale:1}),/32M/);
 assert.deepEqual(doc,before);
});
test('小作品新增帧层、分组、画布与精灵尺寸在有参考时仍合法',()=>{
 const doc=createDocument(2,2);addReference(doc,{id:'small',name:'参考',width:1,height:1,data:'/wAA/w==',x:0,y:0,scale:1});
 addFrame(doc,0);addLayer(doc,0);groupLayer(doc,1);resizeCanvas(doc,3,2);spriteSize(doc,6,4);
 const reopened=validateDocument(doc);assert.deepEqual(reopened.frames,doc.frames);assert.deepEqual(reopened.references,doc.references);assert.equal(sourcePixelCount(doc),1);
});
test('64层与256帧数量边界保持，下一次增加拒绝且不修改',()=>{
 const layers=createDocument(1,1);for(let i=1;i<64;i++)addLayer(layers,i-1);
 validateDocument(layers);const beforeLayers=clone(layers);
 assert.throws(()=>addLayer(layers,63),/64 图层/);assert.deepEqual(layers,beforeLayers);
 const frames=createDocument(1,1);for(let i=1;i<256;i++)addFrame(frames,i-1);
 validateDocument(frames);const beforeFrames=clone(frames);
 assert.throws(()=>duplicateFrames(frames,new Set([0]),256),/256 帧/);assert.deepEqual(frames,beforeFrames);
});
// Count-only fixtures below intentionally omit large reference bytes. They test
// projected arithmetic without claiming to be valid on-disk projects.
function countOnlyDocument(){
 const doc=createDocument(2,1);doc.frames[0].cels[0]=[0x448844ff];
 doc.frames[0].celProperties={1:{x:1,y:0,width:1,height:1,opacity:100}};
 doc.layers[0].reference={width:LIMIT-2,height:1,data:'count-only'};
 return doc;
}
test('实际源cel增长加参考恰好32M允许，多一个像素拒绝并保持链接成员',()=>{
 const doc=countOnlyDocument();celPixels(doc,0,0)[0]=0xff0000ff;
 assert.equal(celPixelCount(doc),2);assert.equal(celPixelCount(doc)+sourcePixelCount(doc),LIMIT);
 const linked=countOnlyDocument();linked.layers[0].reference.width=LIMIT-8;linked.frames[0].cels[0]=[1,2,3,4];linked.frames[0].celProperties[1].width=4;linked.frames.push({...clone(linked.frames[0]),cels:[linked.frames[0].cels[0]]});
 const before=clone(linked);assertProjectCapacity(linked);
 assert.throws(()=>{celPixels(linked,0,0)[0]=0xff0000ff;},/32M/);
 assert.deepEqual(linked,before);assert.equal(linked.frames[0].cels[0],linked.frames[1].cels[0]);
});
test('复制参考层需同时计入复制的参考源图与实际cel',()=>{
 for(const edit of[d=>addLayer(d,0,true),d=>duplicateLayerTree(d,0)]){
  const doc=countOnlyDocument();doc.layers[0].type='reference';const before=clone(doc);
  assert.throws(()=>edit(doc),/32M/);assert.deepEqual(doc,before);
 }
});
test('画布很小但实际cel超出逻辑尺寸时，复制不能忽略实际长度',()=>{
 const doc=countOnlyDocument();doc.layers[0].reference.width=LIMIT-3;
 doc.frames[0].cels[0]=[1,2];assertProjectCapacity(doc);const before=clone(doc);
 assert.throws(()=>duplicateFrames(doc,new Set([0]),1),/32M/);assert.deepEqual(doc,before);
});

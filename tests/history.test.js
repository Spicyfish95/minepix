import test from 'node:test';
import assert from 'node:assert/strict';
import {History,snapshotCel} from '../src/history.js';
import {createDocument,clone,addLayer} from '../src/model.js';
import {convertColorMode} from '../src/color-modes.js';
import {toTileset,toPixels} from '../src/tilemap.js';
import {addReference,moveReference,removeReference,reorderReference} from '../src/reference-board.js';
test('稀疏像素历史仅保存差量，撤销重做精确且没有别名',()=>{let doc=createDocument(512,512),history=new History(),before=snapshotCel(doc,0,0);doc.frames[0].cels[0][123]=0xffffffff;assert.ok(history.push(before,doc));assert.equal(history.undoStack[0].kind,'delta');assert.ok(history.memoryBytes<10000);doc=history.undo(doc);assert.equal(doc.frames[0].cels[0][123],0);doc=history.redo(doc);assert.equal(doc.frames[0].cels[0][123],0xffffffff);});
test('结构改变使用双向紧凑快照，维度及元数据保持',()=>{let doc=createDocument(2,2),history=new History(),before=clone(doc);addLayer(doc,0);doc.layers[1].name='Added';history.push(before,doc);assert.equal(history.undoStack[0].kind,'snapshot');doc=history.undo(doc);assert.equal(doc.layers.length,1);doc=history.redo(doc);assert.equal(doc.layers[1].name,'Added');});
test('undo/redo 总预算、条目上限和新分支受控',()=>{let doc=createDocument(16,16),history=new History(5,20000);for(let i=0;i<10;i++){const before=snapshotCel(doc,0,0);doc.frames[0].cels[0][i]=i+1;history.push(before,doc);assert.ok(history.memoryBytes<=20000);}assert.ok(history.undoStack.length<=5);doc=history.undo(doc);const saved=history.revision;doc=history.redo(doc);assert.notEqual(history.revision,saved);doc=history.undo(doc);const before=snapshotCel(doc,0,0);doc.frames[0].cels[0][0]=99;history.push(before,doc);assert.equal(history.redoStack.length,0);assert.notEqual(history.revision,saved);});
test('空操作不增加历史，捕获状态保持独立版本号',()=>{const doc=createDocument(1,1),history=new History();assert.equal(history.push(clone(doc),doc),false);assert.equal(history.revision,0);const before=snapshotCel(doc,0,0);doc.frames[0].cels[0][0]=1;history.push(before,doc);const state=history.capture(),other=new History();other.restore(state);assert.equal(other.revision,history.revision);assert.equal(other.memoryBytes,history.memoryBytes);});

test('旧式 pending 无差量历史可撤销重做，快照与预算保持独立',()=>{
 let doc=createDocument(4,4),history=new History();
 doc.frames[0].cels[0][5]=0x123456ff;
 const original=clone(doc);
 history.push(doc);
 const pendingBytes=history.memoryBytes;
 doc=history.undo(doc);
 assert.deepEqual(doc,original);
 assert.equal(history.revision,0);
 assert.equal(history.redoStack[0].kind,'snapshot');
 assert.equal(history.memoryBytes,pendingBytes*2);
 doc.frames[0].cels[0][5]=0;
 doc=history.redo(doc);
 assert.deepEqual(doc,original);
 assert.equal(history.revision,1);
});

test('重复色槽在索引块交界及不满256的尾块可精确撤销重做',()=>{
 let doc=createDocument(513,1);
 doc.palette=['#00000000','#ff0000ff','#ff0000ff'];
 doc.frames[0].cels[0].fill(0xff0000ff);
 convertColorMode(doc,'indexed',{palette:'current'});
 const history=new History(),before=snapshotCel(doc,0,0),changed=[255,256,512];
 for(const index of changed)doc.frames[0].indices[0][index]=2;
 history.push(before,doc);
 assert.equal(history.undoStack[0].changes.length,0);
 assert.deepEqual(history.undoStack[0].indexChanges.map(c=>[c.start,c.after.length]),[[0,256],[256,256],[512,1]]);
 doc=history.undo(doc);
 assert.ok(doc.frames[0].indices[0].every(index=>index===1));
 doc=history.redo(doc);
 assert.deepEqual(doc.frames[0].indices[0],Array.from({length:513},(_,i)=>changed.includes(i)?2:1));
 assert.ok(doc.frames[0].cels[0].every(pixel=>pixel===0xff0000ff));
});

function previewDocument(){
 const doc=createDocument(2,2);doc.frames[0].cels[0].fill(0x448844ff);toTileset(doc,0,{w:1,h:1});
 doc.layers[0].tileset.terrains=[{id:0,name:'草地',color:'#66c266'}];
 doc.previewTerrain={layerId:doc.layers[0].id,w:2,h:1,cells:[0,-1]};return doc;
}

test('预览独立编辑不被更早的像素差量撤销重做覆盖',()=>{
 let doc=previewDocument();const history=new History(),before=snapshotCel(doc,0,0);
 doc.frames[0].cels[0][0]=0xff0000ff;history.push(before,doc);doc.previewTerrain.cells[1]=0;
 doc=history.undo(doc);assert.deepEqual(doc.previewTerrain.cells,[0,0]);assert.equal(doc.frames[0].cels[0][0],0x448844ff);
 doc.previewTerrain.cells[0]=-1;const undone=doc;doc=history.redo(doc);
 assert.deepEqual(doc.previewTerrain.cells,[-1,0]);assert.equal(doc.frames[0].cels[0][0],0xff0000ff);
 doc.previewTerrain.cells[1]=-1;assert.deepEqual(undone.previewTerrain.cells,[-1,0]);
});

test('结构快照也保留之后的预览且所有者消失时清理',()=>{
 let doc=previewDocument();const history=new History(),before=clone(doc);addLayer(doc,0);history.push(before,doc);
 assert.equal(history.undoStack[0].kind,'snapshot');doc.previewTerrain.cells[1]=0;
 doc=history.undo(doc);assert.equal(doc.layers.length,1);assert.deepEqual(doc.previewTerrain.cells,[0,0]);
 doc=history.redo(doc);assert.equal(doc.layers.length,2);assert.deepEqual(doc.previewTerrain.cells,[0,0]);
 const beforeRemoval=clone(doc);doc.layers.splice(0,1);doc.frames[0].cels.splice(0,1);history.push(beforeRemoval,doc);
 doc=history.undo(doc);assert.ok(doc.previewTerrain);doc=history.redo(doc);assert.equal(doc.previewTerrain,undefined);
 doc=history.undo(doc);assert.deepEqual(doc.previewTerrain.cells,[0,0]);
});

test('历史条目明确修改预览时仍撤销对应修改与图集转换',()=>{
 let doc=previewDocument();const history=new History(),before=clone(doc);doc.previewTerrain.cells[1]=0;history.push(before,doc);
 doc=history.undo(doc);assert.deepEqual(doc.previewTerrain.cells,[0,-1]);doc=history.redo(doc);assert.deepEqual(doc.previewTerrain.cells,[0,0]);
 const beforeConversion=clone(doc);toPixels(doc,0);delete doc.previewTerrain;history.push(beforeConversion,doc);
 doc=history.undo(doc);assert.equal(doc.layers[0].type,'tileset');assert.deepEqual(doc.previewTerrain.cells,[0,0]);
 doc=history.redo(doc);assert.equal(doc.layers[0].type,undefined);assert.equal(doc.previewTerrain,undefined);
});

function addBoardReference(doc,id,x=0){return addReference(doc,{id,name:id,width:1,height:1,data:'/wAA/w==',x,y:0,scale:1});}

test('绘画差量撤销重做保留参考移动层序与独立对象',()=>{
 let doc=createDocument(2,2);addBoardReference(doc,'a');addBoardReference(doc,'b',16);
 const history=new History(),before=snapshotCel(doc,0,0);doc.frames[0].cels[0][0]=0xff0000ff;history.push(before,doc);
 moveReference(doc,'a',8,12);reorderReference(doc,'a','front');const expected=clone(doc.references),old=doc;
 doc=history.undo(doc);assert.deepEqual(doc.references,expected);assert.equal(doc.frames[0].cels[0][0],0);assert.notEqual(doc.references[1],old.references[1]);
 moveReference(doc,'a',20,24);const undone=doc;doc=history.redo(doc);assert.equal(doc.references[1].x,20);assert.equal(doc.frames[0].cels[0][0],0xff0000ff);
 moveReference(doc,'a',28,32);assert.equal(undone.references[1].x,20);
});

test('删除清空与后来新增参考不会被旧像素历史覆盖',()=>{
 let doc=createDocument(2,2);addBoardReference(doc,'a');const history=new History(),before=snapshotCel(doc,0,0);doc.frames[0].cels[0][0]=1;history.push(before,doc);
 removeReference(doc,'a');doc=history.undo(doc);assert.deepEqual(doc.references,[]);doc=history.redo(doc);assert.deepEqual(doc.references,[]);
 addBoardReference(doc,'new');doc=history.undo(doc);assert.equal(doc.references[0].id,'new');doc=history.redo(doc);assert.equal(doc.references[0].id,'new');
 delete doc.references;doc=history.undo(doc);assert.equal(doc.references,undefined);
});

test('新增参考跨越更早图层快照时保留特性且不变成绘画图层',()=>{
 let doc=createDocument(2,2);const history=new History(),before=clone(doc);addLayer(doc,0);history.push(before,doc);addBoardReference(doc,'new');
 doc=history.undo(doc);assert.equal(doc.layers.length,1);assert.equal(doc.references[0].id,'new');assert.ok(doc.requiredFeatures.includes('reference-board'));
 moveReference(doc,'new',12,16);doc=history.redo(doc);assert.equal(doc.layers.length,2);assert.equal(doc.references[0].x,12);assert.ok(doc.requiredFeatures.includes('reference-board'));
 doc.references=[];doc=history.undo(doc);assert.deepEqual(doc.references,[]);doc=history.redo(doc);assert.deepEqual(doc.references,[]);
});

test('pending绘画条目回放也只影响绘画而保留当前参考',()=>{
 let doc=createDocument(2,2);addBoardReference(doc,'old');const history=new History();history.push(doc);doc.frames[0].cels[0][0]=1;
 removeReference(doc,'old');addBoardReference(doc,'new',24);doc=history.undo(doc);assert.equal(doc.frames[0].cels[0][0],0);assert.equal(doc.references[0].id,'new');
 moveReference(doc,'new',32,16);doc=history.redo(doc);assert.equal(doc.frames[0].cels[0][0],1);assert.equal(doc.references[0].x,32);
});

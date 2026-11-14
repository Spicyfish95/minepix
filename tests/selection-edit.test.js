import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,selectionContains} from '../src/model.js';
import {colorRangeSelection,modifySelection} from '../src/selection-edit.js';
const count=s=>s.mask.reduce((a,b)=>a+b,0);

test('按颜色范围同时选择分离像素并使用 RGBA 容差',()=>{
 const doc=createDocument(4,1),pixels=[0xff0000ff,0x0000ffff,0xfa0200ff,0xff000080];
 assert.equal(count(colorRangeSelection(doc,pixels,0xff0000ff,0)),1);const selected=colorRangeSelection(doc,pixels,0xff0000ff,5);assert.equal(count(selected),2);assert.ok(selectionContains(selected,0,0)&&selectionContains(selected,2,0));assert.equal(count(colorRangeSelection(doc,pixels,0xff0000ff,127)),3);
});
test('扩展、收缩与内边界使用方形或圆形核，裁剪画布边缘',()=>{
 const doc=createDocument(9,9),point={x:4,y:4,w:1,h:1};assert.equal(count(modifySelection(doc,point,'expand',2,'square')),25);assert.equal(count(modifySelection(doc,point,'expand',2,'circle')),21);
 const rect={x:2,y:2,w:5,h:5};assert.equal(count(modifySelection(doc,rect,'contract',1,'square')),9);const border=modifySelection(doc,rect,'border',1,'square');assert.equal(count(border),16);assert.equal(selectionContains(border,1,2),false);assert.equal(selectionContains(border,4,4),false);
 assert.equal(count(modifySelection(doc,{x:0,y:0,w:1,h:1},'expand',1,'square')),4);assert.equal(count(modifySelection(doc,{x:0,y:0,w:9,h:9},'contract',1,'square')),49);
});
test('圆形修改与独立逐邻域实现一致，空选区及孔洞保持正确',()=>{
 const doc=createDocument(13,11),mask=Uint8Array.from({length:35},(_,i)=>i%4!==0?1:0),selection={x:3,y:2,w:7,h:5,mask};
 for(const shape of ['circle','square'])for(const operation of ['expand','contract','border']){
  const radius=2,result=modifySelection(doc,selection,operation,radius,shape);
  for(let y=0;y<doc.height;y++)for(let x=0;x<doc.width;x++){
   let any=false,all=true;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(shape==='circle'&&dx*dx+dy*dy>(radius+.5)**2)continue;const on=!!selectionContains(selection,x+dx,y+dy);any ||=on;all &&=on;}
   const current=!!selectionContains(selection,x,y),expected=operation==='expand'?any:operation==='contract'?current&&all:current&&!all;
   assert.equal(!!selectionContains(result,x,y),expected,`${shape}/${operation} ${x},${y}`);
  }
 }
 assert.equal(count(modifySelection(doc,{x:0,y:0,w:0,h:0},'expand')),0);
});

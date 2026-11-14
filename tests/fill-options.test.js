import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from '../src/model.js';
import {paintFill} from '../src/brush-engine.js';

const red=0xff0000ff,near=0xfa0200ff,blue=0x0000ffff,green=0x00ff00ff;
function fill(values,options={},selection=null){const doc=createDocument(values.length,1),pixels=doc.frames[0].cels[0];pixels.splice(0,values.length,...values);paintFill(doc,pixels,0,0,green,{ink:'copy',opacity:1,...options},selection);return pixels;}
test('连续填充容差从落点颜色判断，默认保持精确匹配',()=>{
 assert.deepEqual(fill([red,near,blue,red]),[green,near,blue,red]);
 assert.deepEqual(fill([red,near,blue,red],{fillTolerance:5}),[green,green,blue,red]);
 assert.deepEqual(fill([red,near,blue,red],{fillTolerance:4}),[green,near,blue,red]);
});
test('关闭连续填充命中分离区域，同时尊重选区遮罩',()=>{
 assert.deepEqual(fill([red,near,blue,red],{fillTolerance:5,fillContiguous:false}),[green,green,blue,green]);
 assert.deepEqual(fill([red,near,blue,red],{fillTolerance:5,fillContiguous:false},{x:0,y:0,w:4,h:1,mask:new Uint8Array([1,0,0,1])}),[green,near,blue,green]);
});
test('容差包含 Alpha，合成使用原图，每个命中像素量化一次',()=>{
 const calls=[],result=fill([red,0xff000080,blue,red],{fillContiguous:false,fillTolerance:127,quantize:(value,i)=>{calls.push(i);return value;}});
 assert.deepEqual(result,[green,green,blue,green]);assert.deepEqual(calls,[0,1,3]);
 const doc=createDocument(3,1),pixels=doc.frames[0].cels[0];pixels.fill(0xff000080);paintFill(doc,pixels,0,0,0xff000080,{ink:'over',opacity:1,fillContiguous:false});assert.ok(pixels.every(p=>(p&255)===192));
});

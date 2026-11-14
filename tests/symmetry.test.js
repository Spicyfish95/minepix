import {test} from 'node:test';
import assert from 'node:assert/strict';
import {symmetryPoints} from '../src/symmetry.js';
import {stampBrush} from '../src/brush-engine.js';
import {createDocument,validateDocument} from '../src/model.js';

test('双轴对称支持中心、像素中心与自定义轴并消除重复',()=>{
 assert.deepEqual(symmetryPoints(1,2,8,8,{horizontal:true,vertical:true}),[{x:1,y:2},{x:6,y:2},{x:1,y:5},{x:6,y:5}]);
 assert.deepEqual(symmetryPoints(2,1,8,8,{horizontal:true,x:2.5}),[{x:2,y:1}]);
 assert.deepEqual(symmetryPoints(0,0,8,8,{horizontal:true,vertical:true,x:2,y:1.5}),[{x:0,y:0},{x:3,y:0},{x:0,y:2},{x:3,y:2}]);
});
test('双轴落笔尊重选区，重复点不重复进行半透明合成',()=>{
 const doc=createDocument(5,5),pixels=doc.frames[0].cels[0];stampBrush(doc,pixels,2,2,0xff000080,{size:1,ink:'over',opacity:1},{x:0,y:0,w:5,h:5},{horizontal:true,vertical:true});assert.equal(pixels[12],0xff000080);
 stampBrush(doc,pixels,0,0,0x00ff00ff,{size:1,ink:'copy',opacity:1},{x:0,y:0,w:3,h:5},{horizontal:true,vertical:true});assert.equal(pixels[0],0x00ff00ff);assert.equal(pixels[20],0x00ff00ff);assert.equal(pixels[4],0);assert.equal(pixels[24],0);
});
test('对称轴随工程保存回读并拒绝画布范围外坐标',()=>{
 const doc=createDocument(8,6);doc.symmetryAxes={x:2.5,y:4};assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))).symmetryAxes,doc.symmetryAxes);
 assert.throws(()=>validateDocument({...doc,symmetryAxes:{x:9,y:2}}),/对称轴/);
});

test('裁剪、缩放与翻转同步对称轴位置',async()=>{
 const {resizeCanvas,spriteSize,flipSprite}=await import('../src/canvas-commands.js');
 const doc=createDocument(8,8);doc.symmetryAxes={x:2.5,y:6};resizeCanvas(doc,6,6,'top-left');assert.deepEqual(doc.symmetryAxes,{x:2.5,y:6});spriteSize(doc,12,12);assert.deepEqual(doc.symmetryAxes,{x:5,y:12});flipSprite(doc,'x');assert.deepEqual(doc.symmetryAxes,{x:7,y:12});
});

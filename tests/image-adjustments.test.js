import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addLayer} from '../src/model.js';
import {adjustImagePixel,applyImageAdjustment} from '../src/image-adjustments.js';
import {linkCels} from '../src/cel-links.js';
import {convertColorMode} from '../src/color-modes.js';

test('HSV、亮度对比度和反色保持 Alpha 与中性参数',()=>{
 assert.equal(adjustImagePixel(0xff000080,{type:'hsv',hue:120}),0x00ff0080);
 assert.equal(adjustImagePixel(0x12345678,{type:'hsv'}),0x12345678);assert.equal(adjustImagePixel(0x12345678,{type:'brightness'}),0x12345678);
 assert.equal(adjustImagePixel(0xff000080,{type:'invert'}),0x00ffff80);assert.equal(adjustImagePixel(0x12345600,{type:'invert'}),0x12345600);
 assert.equal(adjustImagePixel(0x777777aa,{type:'brightness',brightness:100}),0xffffffaa);assert.equal(adjustImagePixel(0x777777aa,{type:'brightness',brightness:-100}),0x000000aa);
 assert.equal(adjustImagePixel(0xff0000ff,{type:'hsv',saturation:-100}),0xffffffff);
});
test('作用范围、选区、隐藏锁定与共享 cel 仅处理一次',()=>{
 const doc=createDocument(2,1);doc.frames[0].cels[0].fill(0x112233ff);doc.frames.push({duration:100,cels:[[0x112233ff,0x112233ff]]});linkCels(doc,0,[0,1]);
 applyImageAdjustment(doc,{type:'invert',scope:'layer',selection:{x:0,y:0,w:1,h:1}});assert.equal(doc.frames[0].cels[0][0],0xeeddccff);assert.equal(doc.frames[0].cels[0][1],0x112233ff);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);
 addLayer(doc,0);doc.layers[1].locked=true;doc.frames[0].cels[1][0]=0xff0000ff;applyImageAdjustment(doc,{type:'invert',scope:'sprite'});assert.equal(doc.frames[0].cels[1][0],0xff0000ff);
});
test('灰度和索引调整继续保持颜色模式约束',()=>{
 const doc=createDocument(1,1);doc.frames[0].cels[0][0]=0xff0000ff;doc.palette=['#00000000','#ff0000','#00ffff'];convertColorMode(doc,'indexed',{palette:'current',colors:3});applyImageAdjustment(doc,{type:'invert'});assert.equal(doc.frames[0].indices[0][0],2);assert.equal(doc.frames[0].cels[0][0],0x00ffffff);
 convertColorMode(doc,'grayscale');applyImageAdjustment(doc,{type:'hsv',hue:80,saturation:50});const pixel=doc.frames[0].cels[0][0];assert.equal(pixel>>>24,pixel>>>16&255);assert.equal(pixel>>>24,pixel>>>8&255);
});

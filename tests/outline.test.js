import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from '../src/model.js';
import {outlineImagePixels} from '../src/outline.js';
import {applyImageAdjustment} from '../src/image-adjustments.js';

test('外描边保留原图并以 Alpha 合成描边色，不改变画布',()=>{
 const doc=createDocument(5,5),pixels=doc.frames[0].cels[0];pixels[12]=0xff0000ff;const output=outlineImagePixels(doc,pixels,{outlineShape:'square',outlineColor:0x00ff0080});
 assert.equal(output[12],0xff0000ff);assert.equal(output.filter(p=>p===0x00ff0080).length,8);assert.equal(pixels.filter(Boolean).length,1);assert.equal(output.length,25);
});
test('内描边保留内部颜色，圆形与方形边角可选',()=>{
 const doc=createDocument(7,7),pixels=doc.frames[0].cels[0];for(let y=2;y<5;y++)for(let x=2;x<5;x++)pixels[y*7+x]=0xff0000ff;
 const inside=outlineImagePixels(doc,pixels,{outlinePlacement:'inside',outlineShape:'square',outlineColor:0x00ff00ff});assert.equal(inside.filter(p=>p===0x00ff00ff).length,8);assert.equal(inside[24],0xff0000ff);
 const dot=Array(49).fill(0);dot[24]=0xff0000ff;assert.equal(outlineImagePixels(doc,dot,{outlineWidth:2,outlineShape:'circle'}).filter(Boolean).length,21);assert.equal(outlineImagePixels(doc,dot,{outlineWidth:2,outlineShape:'square'}).filter(Boolean).length,25);
});
test('文档描边遵守选区，空图无变化，画布边缘裁剪',()=>{
 const doc=createDocument(3,3),pixels=doc.frames[0].cels[0];assert.deepEqual(outlineImagePixels(doc,pixels),pixels);pixels[0]=0xff0000ff;applyImageAdjustment(doc,{type:'outline',outlineShape:'square',outlineColor:0x0000ffff,selection:{x:1,y:0,w:1,h:1}});assert.deepEqual(pixels,[0xff0000ff,0x0000ffff,0,0,0,0,0,0,0]);
});

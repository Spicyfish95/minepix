import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from '../src/model.js';
import {gradientColor,paintGradient} from '../src/gradient.js';

test('渐变端点与预乘 Alpha 插值不引入透明色晕',()=>{
 assert.equal(gradientColor(0xff0000ff,0x0000ffff,0),0xff0000ff);assert.equal(gradientColor(0xff0000ff,0x0000ffff,1),0x0000ffff);assert.equal(gradientColor(0xff0000ff,0x0000ffff,.5),0x800080ff);
 assert.equal(gradientColor(0xff0000ff,0x0000ff00,.5),0xff000080);assert.equal(gradientColor(0,0,.5),0);
});
test('线性径向渐变、选区和重复预览均以落笔快照为准',()=>{
 const doc=createDocument(5,5),pixels=doc.frames[0].cels[0],base=pixels.slice(),options={ink:'copy',base,opacity:.5};
 paintGradient(doc,pixels,{x:0,y:0},{x:4,y:0},0xff0000ff,0x0000ffff,options,{x:1,y:1,w:3,h:3});assert.equal(pixels[0],0);assert.equal(pixels[2*5+2],0x800080ff);
 paintGradient(doc,pixels,{x:2,y:2},{x:4,y:2},0xff0000ff,0x0000ffff,{...options,gradientType:'radial'});assert.equal(pixels[12],0xff0000ff);assert.equal(pixels[14],0x0000ffff);assert.equal(pixels[2],0x0000ffff);
 const before=pixels.slice();paintGradient(doc,pixels,{x:2,y:2},{x:2,y:2},0,0,options);assert.deepEqual(pixels,before);
});
test('有序抖动只使用端点色并通过量化回调写入结果',()=>{
 const doc=createDocument(8,4),pixels=doc.frames[0].cels[0],calls=[];paintGradient(doc,pixels,{x:0,y:0},{x:7,y:0},0x111111ff,0xeeeeeeff,{gradientDither:'ordered',ink:'copy',quantize:(value,i)=>{calls.push(i);return value;}});
 assert.equal(calls.length,32);assert.ok(pixels.every(p=>p===0x111111ff||p===0xeeeeeeff));assert.ok(pixels.includes(0x111111ff)&&pixels.includes(0xeeeeeeff));
});

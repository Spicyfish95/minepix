import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from '../src/model.js';
import {blurAt} from '../src/blur-tool.js';

test('模糊按 3x3 邻域混合 RGBA 并尊重选区',()=>{
  const doc=createDocument(3,3),pixels=doc.frames[0].cels[0];pixels[4]=0xffffffff;
  blurAt(doc,pixels,1,1);
  assert.equal(pixels[4],0x1c1c1c1c);
  const selected={x:0,y:0,w:1,h:1},before=pixels.slice();blurAt(doc,pixels,2,2,[{x:0,y:0}],selected);
  assert.deepEqual(pixels,before);
});

test('模糊笔形一次更新多个中心像素',()=>{
  const doc=createDocument(5,1),pixels=doc.frames[0].cels[0];pixels[2]=0xff0000ff;
  blurAt(doc,pixels,2,0,[{x:-1,y:0},{x:0,y:0},{x:1,y:0}]);
  assert.ok(pixels[1]&&pixels[2]&&pixels[3]);
});

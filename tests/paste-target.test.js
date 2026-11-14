import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,colorValue,copyRegion,pasteRegion,composite} from '../src/model.js';
import {pasteTarget} from '../src/paste-target.js';

const red=colorValue('#ff0000');

test('复制后再粘贴会在别处产生可见新像素',()=>{
  const doc=createDocument(8,8),pixels=doc.frames[0].cels[0];
  pixels[1*8+1]=red;
  const selection={x:1,y:1,w:2,h:2};
  const clipboard=copyRegion(doc,pixels,selection);
  // Aseprite 习惯：保留原选区时再次粘贴不应静默原地覆盖，目标应落到选区之外。
  const target=pasteTarget(doc,clipboard,selection);
  assert.notDeepEqual({x:target.x,y:target.y},{x:selection.x,y:selection.y},'粘贴目标应与选区左上角不同');
  pasteRegion(doc,pixels,clipboard,target.x,target.y,null);
  assert.equal(pixels[target.y*8+target.x],red,'新位置应出现复制的像素');
  assert.equal(pixels.filter(v=>v===red).length,2,'画布上应有两处红色像素');
  assert.equal(composite(doc,0)[(target.y*8+target.x)*4+3],255,'合成结果包含粘贴像素');
});

test('目标选区在别处时按该处粘贴',()=>{
  const doc=createDocument(8,8),pixels=doc.frames[0].cels[0];
  pixels[0]=red;
  const clipboard=copyRegion(doc,pixels,{x:0,y:0,w:1,h:1});
  const target=pasteTarget(doc,clipboard,{x:5,y:5,w:1,h:1});
  assert.deepEqual({x:target.x,y:target.y},{x:5,y:5});
});

test('跨文档粘贴按复制区域原坐标落位',()=>{
  const doc=createDocument(4,4),pixels=doc.frames[0].cels[0];
  const clipboard=copyRegion(doc,pixels,{x:0,y:0,w:1,h:1});
  const target=pasteTarget(doc,clipboard,{x:0,y:0,w:1,h:1},false);
  assert.deepEqual({x:target.x,y:target.y},{x:0,y:0},'跨文档时选区来自另一文档，不应据此偏移');
});

test('选区贴住右下角时回退到上方目标且不越界',()=>{
  const doc=createDocument(4,4),pixels=doc.frames[0].cels[0];
  const clipboard=copyRegion(doc,pixels,{x:2,y:2,w:2,h:2});
  const target=pasteTarget(doc,clipboard,{x:2,y:2,w:2,h:2});
  assert.ok(target.x>=0&&target.y>=0&&target.x+clipboard.w<=4&&target.y+clipboard.h<=4,'目标必须留在画布内');
  assert.notDeepEqual({x:target.x,y:target.y},{x:2,y:2});
});

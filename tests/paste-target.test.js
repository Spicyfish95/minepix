import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,colorValue,copyRegion,pasteRegion,composite} from '../src/model.js';
import {pasteTarget} from '../src/paste-target.js';
import {convertColorMode,validateColorMode,grayPixel} from '../src/color-modes.js';
import {History} from '../src/history.js';
import {selectionFrom} from '../src/selection-mask.js';

const red=colorValue('#ff0000');

for(const [name,contains]of[
 ['L 形',(x,y)=>x===0||y===2],
 ['带孔选区',(x,y)=>x!==1||y!==1],
 ['分离选区',(x,y)=>x===y]
])test(`跨项目${name}保留外接尺寸、掩码和透明位置，支持撤销重做`,()=>{
 const a=createDocument(10,8),source=a.frames[0].cels[0],green=colorValue('#00ff00');source.fill(red);source[5*10+7]=0;
 const selection=selectionFrom(a,(x,y)=>x>=7&&x<=9&&y>=5&&y<=7&&contains(x-7,y-5));
 const region=copyRegion(a,source,selection),original=structuredClone(region),sourceBefore=structuredClone(a);
 assert.deepEqual([region.x,region.y,region.w,region.h],[7,5,3,3]);assert.notEqual(region.mask,selection.mask);
 let b=createDocument(3,3);b.frames[0].cels[0].fill(green);const before=structuredClone(b),history=new History(),target=pasteTarget(b,region,null,false);
 assert.deepEqual(target,{x:0,y:0});pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);history.push(before,b);
 const expected=Array.from({length:9},(_,i)=>contains(i%3,Math.floor(i/3))&&i!==0?red:green);
 assert.deepEqual(b.frames[0].cels[0],expected);assert.deepEqual(region,original);assert.deepEqual(a,sourceBefore);
 b=history.undo(b);assert.deepEqual(b,before);b=history.redo(b);assert.deepEqual(b.frames[0].cels[0],expected);
});
test('不规则选区大于目标时按原掩码裁切而不缩放或填充孔洞',()=>{
 const a=createDocument(8,8);a.frames[0].cels[0].fill(red);
 const selection=selectionFrom(a,(x,y)=>x>=5&&y>=5&&(x===5||y===7)),region=copyRegion(a,a.frames[0].cels[0],selection),b=createDocument(2,2),green=colorValue('#00ff00');b.frames[0].cels[0].fill(green);
 const target=pasteTarget(b,region,null,false);pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);
 assert.deepEqual(b.frames[0].cels[0],[red,green,red,green]);
 assert.deepEqual([...selectionFrom(b,(x,y)=>region.mask[y*region.w+x]).mask],[1,1]);
});

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

test('跨项目原坐标可完整容纳时保留非零源坐标',()=>{
 const target=pasteTarget(createDocument(10,8),{x:6,y:4,w:3,h:2},null,false);assert.deepEqual(target,{x:6,y:4});
});
test('跨项目源区域完全位于小画布外时仍能粘贴可见像素',()=>{
 const a=createDocument(8,8);a.frames[0].cels[0][6*8+6]=red;const region=copyRegion(a,a.frames[0].cels[0],{x:6,y:6,w:2,h:2}),b=createDocument(2,2),target=pasteTarget(b,region,null,false);
 assert.deepEqual(target,{x:0,y:0});pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);assert.equal(b.frames[0].cels[0][0],red);assert.ok(composite(b,0).some(value=>value));
});
test('跨项目只校正越界的轴并将整块复制区域放入画布',()=>{
 const doc=createDocument(8,6);assert.deepEqual(pasteTarget(doc,{x:20,y:2,w:3,h:2},null,false),{x:5,y:2});assert.deepEqual(pasteTarget(doc,{x:2,y:20,w:3,h:2},null,false),{x:2,y:4});
 assert.deepEqual(pasteTarget(doc,{x:20,y:2,w:10,h:2},null,false),{x:0,y:2});
});
test('跨项目区域大于画布时从非负原点裁切，源剪贴板保持不变',()=>{
 const a=createDocument(4,4);a.frames[0].cels[0][0]=red;const region=copyRegion(a,a.frames[0].cels[0],null),before=structuredClone(region),b=createDocument(2,2),target=pasteTarget(b,region,null,false);
 assert.deepEqual(target,{x:0,y:0});pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);assert.equal(b.frames[0].cels[0][0],red);assert.deepEqual(region,before);
});
test('跨项目负的源坐标约束到画布，显式目标选区继续优先',()=>{
 const doc=createDocument(8,8),region={x:-2,y:-3,w:2,h:2};assert.deepEqual(pasteTarget(doc,region,null,false),{x:0,y:0});assert.deepEqual(pasteTarget(doc,{...region,x:6,y:6},{x:1,y:2,w:2,h:2},false),{x:1,y:2});
});
for(const mode of ['rgba','indexed','grayscale'])test(`跨项目 ${mode} 粘贴保留目标模式并可撤销重做`,()=>{
 const a=createDocument(8,8);a.frames[0].cels[0][6*8+6]=red;const region=copyRegion(a,a.frames[0].cels[0],{x:6,y:6,w:2,h:2});let b=createDocument(2,2);b.palette=['#00000000','#ff0000ff','#ffffffff'];if(mode!=='rgba')convertColorMode(b,mode,{palette:'current'});
 const before=structuredClone(b),history=new History(),target=pasteTarget(b,region,null,false);pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);history.push(before,b);validateColorMode(b);assert.equal(b.frames[0].cels[0][0],mode==='grayscale'?grayPixel(red):red);
 b=history.undo(b);assert.deepEqual(b,before);b=history.redo(b);validateColorMode(b);assert.ok(b.frames[0].cels[0][0]);assert.equal(a.frames[0].cels[0][6*8+6],red);
});
test('跨项目复制索引色像素到不同顺序色板时按颜色映射而非复用旧 index',()=>{
 const a=createDocument(8,8);a.palette=['#00000000','#ff0000ff','#00ff00ff'];a.frames[0].cels[0][6*8+6]=red;convertColorMode(a,'indexed',{palette:'current'});const region=copyRegion(a,a.frames[0].cels[0],{x:6,y:6,w:2,h:2}),b=createDocument(2,2);b.palette=['#00000000','#00ff00ff','#ff0000ff'];convertColorMode(b,'indexed',{palette:'current'});const target=pasteTarget(b,region,null,false);pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);assert.equal(b.frames[0].indices[0][0],2);assert.equal(b.frames[0].cels[0][0],red);validateColorMode(b);
});
test('跨项目透明像素及掩码外像素不会覆盖已有目标像素',()=>{
 const b=createDocument(2,2);b.frames[0].cels[0].fill(0x00ff00ff);const region={x:6,y:6,w:2,h:2,data:[red,0,0x0000ffff,red],mask:[1,1,0,1]},target=pasteTarget(b,region,null,false);pasteRegion(b,b.frames[0].cels[0],region,target.x,target.y);assert.deepEqual(b.frames[0].cels[0],[red,0x00ff00ff,0x00ff00ff,red]);
});

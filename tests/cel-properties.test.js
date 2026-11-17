import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,validateDocument,composite,History,pasteRegion,copyRegion,flipRegion} from '../src/model.js';
import {celPixels,celIndexPixels,celProperty,setCelProperty} from '../src/cel-properties.js';
import {linkCels} from '../src/cel-links.js';
import {prepareDocumentPixels} from '../src/pixel-storage.js';
import {snapshotCel} from '../src/history.js';
import {convertColorMode,applyIndexedPalette,validateColorMode} from '../src/color-modes.js';
import {copyCels,pasteCels} from '../src/timeline-selection.js';
import {FrameCache} from '../src/renderer.js';
import {readAseprite,writeAseprite} from './helpers/aseprite.js';
import {spriteSize,reframe,flipSprite} from '../src/canvas-commands.js';
import {mergeDown} from '../src/layer-commands.js';
import {addLayer} from '../src/model.js';
const sample=()=>{const d=createDocument(4,3);d.frames[0].cels[0][0]=0xff0000ff;addFrame(d,0,true);linkCels(d,0,[0,1]);setCelProperty(d,1,0,{x:2,y:1,opacity:50});return d;};
test('画布几何命令烘焙位置后缩放翻转裁剪，合并烘焙 cel 透明度',()=>{const d=sample();spriteSize(d,8,6);assert.equal(celProperty(d,1,0).opacity,50);assert.equal(composite(d,1)[(2*8+4)*4+3],128);flipSprite(d,'x');assert.equal(composite(d,1)[(2*8+3)*4+3],128);reframe(d,{x:2,y:1,w:4,h:4});assert.equal(composite(d,1)[(1*4+1)*4+3],128);validateDocument(d);const m=createDocument(4,3);addLayer(m,0);m.frames[0].cels[1][0]=0xff0000ff;setCelProperty(m,0,1,{x:1,opacity:50});const before=composite(m,0);mergeDown(m,1);assert.deepEqual(composite(m,0),before);validateDocument(m);});
test('链接 cel 独立位置透明度参与合成与帧缓存，原始像素不变',()=>{const d=sample(),cache=new FrameCache();assert.equal(d.frames[0].cels[0],d.frames[1].cels[0]);assert.equal(composite(d,1)[(1*4+2)*4+3],128);assert.equal(celPixels(d,1,0)[6],0xff0000ff);cache.get(d,1);setCelProperty(d,1,0,{opacity:0});assert.equal(cache.get(d,1).rgba.some(v=>v),false);assert.equal(d.frames[0].cels[0][0],0xff0000ff);});
test('移动 cel 可按画布坐标绘画并增长源图，链接同步图像而保留相对位置，历史恢复尺寸',()=>{let d=sample();const before=structuredClone(d),h=new History();celPixels(d,1,0)[0]=0x00ff00ff;assert.equal(celPixels(d,1,0)[6],0xff0000ff);assert.equal(celPixels(d,1,0)[0],0x00ff00ff);assert.equal(d.frames[0].cels[0],d.frames[1].cels[0]);assert.equal(celProperty(d,0,0).x,-2);h.push(before,d);d=h.undo(d);assert.deepEqual(celProperty(d,1,0),celProperty(before,1,0));assert.equal(d.frames[0].cels[0].length,12);d=h.redo(d);validateDocument(d);assert.equal(celPixels(d,1,0)[0],0x00ff00ff);});
test('索引偏移视图、图像增长、粘贴与重复槽保持一致',()=>{const d=createDocument(4,3);d.palette=['#00000000','#ff0000ff','#ff0000ff'];convertColorMode(d,'indexed',{palette:'current'});setCelProperty(d,0,0,{x:2,y:0});celIndexPixels(d,0,0)[0]=2;celPixels(d,0,0)[0]=0xff0000ff;assert.equal(celIndexPixels(d,0,0)[0],2);assert.equal(celProperty(d,0,0).width,6);pasteRegion(d,celPixels(d,0,0),{w:1,h:1,data:[0xff0000ff],indexed:{palette:d.palette,transparentIndex:d.transparentIndex,data:[2]}},1,1);assert.equal(celIndexPixels(d,0,0)[5],2);validateDocument(d);});
test('工程与 cel 剪贴板保留位置透明度，坏属性拒绝',()=>{const d=sample(),clip=copyCels(d,{fromFrame:1,toFrame:1,fromLayer:0,toLayer:0});pasteCels(d,clip,0,0);assert.deepEqual(celProperty(d,0,0),celProperty(d,1,0));assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(d))).frames[0].celProperties,d.frames[0].celProperties);d.frames[0].celProperties[1].opacity=101;assert.throws(()=>validateDocument(d),/透明度/);});
test('ASE 保留独立位置透明度、链接和画布外源图，RGBA/灰度/索引均不烘焙 Alpha',async()=>{for(const mode of ['rgba','grayscale','indexed']){const d=sample();if(mode!=='rgba')convertColorMode(d,mode,{palette:'current'});celPixels(d,1,0)[0]=mode==='indexed'?d.frames[0].cels[0][0]:0xffffffff;if(mode==='indexed'){const index=d.frames[0].indices[0].find(i=>i!==d.transparentIndex);celIndexPixels(d,1,0)[0]=index;}const {doc,warnings}=await readAseprite(await writeAseprite(d));assert.deepEqual(warnings,[]);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);assert.equal(celProperty(doc,1,0).width,6);assert.ok(Math.abs(celProperty(doc,1,0).opacity-50)<.2);assert.deepEqual(doc.frames[0].cels[0],d.frames[0].cels[0]);assert.equal(celPixels(doc,1,0)[0],celPixels(d,1,0)[0]);}});

test('sparse canvas views preserve array methods without allocating filled backing slots',()=>{
 const doc=createDocument(1,1);doc.width=1024;doc.height=1024;doc.frames[0].cels[0]=[0x123456ff];setCelProperty(doc,0,0,{x:4,y:3,width:1,height:1});
 const view=celPixels(doc,0,0);assert.equal(Object.keys(view).length,0);assert.equal(view[3*1024+4],0x123456ff);assert.equal(view[0],0);
 assert.deepEqual(view.slice(3*1024+3,3*1024+6),[0,0x123456ff,0]);assert.equal(view.some(value=>value===0x123456ff),true);
});

test('typed cel growth keeps typed buffers, row alignment, transparent slots and link aliases',()=>{
 const doc=createDocument(4,4);doc.colorMode='indexed';doc.transparentIndex=2;doc.palette=['#ff0000ff','#00ff00ff','#00000000'];doc.frames[0].cels[0]=Uint32Array.of(0xff0000ff);doc.frames[0].indices=[Uint8Array.of(0)];setCelProperty(doc,0,0,{x:2,y:2,width:1,height:1});doc.frames.push({...doc.frames[0],cels:[doc.frames[0].cels[0]],indices:[doc.frames[0].indices[0]]});
 celPixels(doc,0,0)[1*4+1]=0x00ff00ff;celIndexPixels(doc,0,0)[1*4+1]=1;
 assert.ok(doc.frames[0].cels[0] instanceof Uint32Array);assert.ok(doc.frames[0].indices[0] instanceof Uint8Array);assert.deepEqual([...doc.frames[0].cels[0]],[0x00ff00ff,0,0,0xff0000ff]);assert.deepEqual([...doc.frames[0].indices[0]],[1,2,2,0]);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);assert.equal(doc.frames[0].indices[0],doc.frames[1].indices[0]);
});

function reorderedCroppedCel(){
 const doc=createDocument(5,1);doc.colorMode='indexed';doc.palette=['#00000000','#ff0000ff','#ff0000ff'];doc.transparentIndex=0;doc.frames[0].cels[0]=Uint32Array.of(0xff0000ff);doc.frames[0].indices=[Uint8Array.of(2)];setCelProperty(doc,0,0,{x:1,y:0,width:1,height:1});prepareDocumentPixels(doc);
 const view=celIndexPixels(doc,0,0),rgba=celPixels(doc,0,0);applyIndexedPalette(doc,['#ff0000ff','#00000000','#ff0000ff'],[1,0,2]);prepareDocumentPixels(doc);return{doc,view,rgba};
}
test('cached cropped index view follows transparent slot changes for reads and writes',()=>{
 const {doc,view,rgba}=reorderedCroppedCel();assert.equal(doc.transparentIndex,1);assert.equal(celIndexPixels(doc,0,0),view);assert.equal(view[0],1);assert.equal(rgba[0],0);assert.deepEqual(view.slice(0,3),[1,2,1]);
 const before=celProperty(doc,0,0);view[4]=1;assert.deepEqual(celProperty(doc,0,0),before);assert.equal(doc.frames[0].indices[0].length,1);
 view[4]=0;rgba[4]=0xff0000ff;assert.equal(celProperty(doc,0,0).width,4);assert.deepEqual([...doc.frames[0].indices[0]],[2,1,1,0]);validateColorMode(doc);
});
test('reordered cropped cel copy and flip retain transparency and duplicate slots through undo redo',()=>{
 let {doc}=reorderedCroppedCel();const copied=copyRegion(doc,celPixels(doc,0,0),null);assert.deepEqual(copied.data,[0,0xff0000ff,0,0,0]);assert.deepEqual(copied.indexed.data,[1,2,1,1,1]);
 const history=new History(),before=snapshotCel(doc,0,0);flipRegion(doc,celPixels(doc,0,0),null,'x');validateColorMode(doc);assert.deepEqual([...celIndexPixels(doc,0,0)],[1,1,1,2,1]);history.push(before,doc);
 doc=history.undo(doc);validateColorMode(doc);assert.equal(celProperty(doc,0,0).width,1);assert.deepEqual([...celIndexPixels(doc,0,0)],[1,2,1,1,1]);
 doc=history.redo(doc);validateColorMode(doc);assert.deepEqual([...celIndexPixels(doc,0,0)],[1,1,1,2,1]);
});

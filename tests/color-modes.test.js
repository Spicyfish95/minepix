import fs from 'node:fs/promises';
import {readAseprite,writeAseprite} from './helpers/aseprite.js';
import {copyRegion,clearRegion,pasteRegion,flipRegion} from '../src/model.js';
import {transformSelectionRegion} from '../src/selection-mask.js';
import {transformState} from '../src/transform-controls.js';
import {resizeCanvas} from '../src/canvas-commands.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,clone,History,validateDocument} from '../src/model.js';
import {convertColorMode,canonicalizeColors,applyIndexedPalette,indexColor,grayPixel} from '../src/color-modes.js';
import {snapshotCel} from '../src/history.js';
import {linkCels} from '../src/cel-links.js';
import {convertBackground} from '../src/layer-types.js';
import {addLayer} from '../src/model.js';
function sample(){const d=createDocument(2,1);d.palette=['#00000000','#ff0000ff','#00ff0080'];d.frames[0].cels[0]=[0xff0000ff,0x00ff0080];return d;}

test('色板重复来源取首槽，背景与普通层分别保留不透明和透明槽语义',()=>{
 const d=createDocument(3,1);d.palette=['#00000000','#ff0000ff','#00ff0080'];
 convertBackground(d,0,0xff0000ff);addLayer(d,0);
 d.frames[0].cels[0]=[0x000000ff,0xff0000ff,0x00ff00ff];
 d.frames[0].cels[1]=[0,0xff0000ff,0x00ff0080];
 convertColorMode(d,'indexed',{palette:'current'});
 applyIndexedPalette(d,['#ff0000ff','#00000000','#0000ffff','#00ff0080'],[1,0,1,2]);
 assert.equal(d.transparentIndex,1);
 assert.deepEqual(d.frames[0].indices,[[1,0,3],[1,0,3]]);
 assert.deepEqual(d.frames[0].cels[0],[0x000000ff,0xff0000ff,0x00ff00ff]);
 assert.deepEqual(d.frames[0].cels[1],[0,0xff0000ff,0x00ff0080]);
 assert.equal(d.layers[0].clearIndex,0);
 validateDocument(d);
});
test('索引模式保存真实索引与透明槽，调色板改色改变像素而不改索引',()=>{const d=sample();convertColorMode(d,'indexed',{palette:'current'});assert.deepEqual(d.frames[0].indices[0],[1,2]);assert.equal(d.transparentIndex,0);assert.ok(d.requiredFeatures.includes('color-modes'));applyIndexedPalette(d,['#00000000','#0000ffff','#00ff0080'],[0,1,2]);assert.deepEqual(d.frames[0].indices[0],[1,2]);assert.equal(d.frames[0].cels[0][0],0x0000ffff);validateDocument(d);});
test('重复颜色索引保留独立身份，索引单独变化可撤销重做并恢复链接',()=>{let d=sample();d.palette=['#00000000','#ff0000ff','#ff0000ff'];d.frames[0].cels[0]=[0xff0000ff,0xff0000ff];convertColorMode(d,'indexed',{palette:'current'});d.frames[0].indices[0]=[1,2];addFrame(d,0,true);linkCels(d,0,[0,1]);const history=new History(),before=snapshotCel(d,1,0);d.frames[1].indices[0][0]=2;history.push(before,d);assert.ok(history.undoStack[0].indexChanges.length);d=history.undo(d);assert.deepEqual(d.frames[0].indices[0],[1,2]);assert.equal(d.frames[0].indices[0],d.frames[1].indices[0]);d=history.redo(d);assert.deepEqual(d.frames[0].indices[0],[2,2]);assert.equal(d.frames[0].indices[0],d.frames[1].indices[0]);});
test('模式转换能整步撤销，灰度保留Alpha并写入相等RGB通道',()=>{let d=sample();const before=clone(d),history=new History();convertColorMode(d,'indexed',{palette:'current'});history.push(before,d);d=history.undo(d);assert.equal(d.colorMode,undefined);assert.equal(d.frames[0].indices,undefined);d=history.redo(d);assert.equal(d.colorMode,'indexed');convertColorMode(d,'grayscale');assert.equal(d.frames[0].indices,undefined);assert.equal(d.frames[0].cels[0][0],grayPixel(0xff0000ff));assert.equal(d.frames[0].cels[0][1]&255,128);validateDocument(d);});
test('4x4 有序抖动按黑白投影覆盖率近似四分之一灰阶',()=>{const d=createDocument(4,4);d.palette=['#00000000','#000000ff','#ffffffff'];d.frames[0].cels[0].fill(0x404040ff);const plain=clone(d);convertColorMode(plain,'indexed',{palette:'current',colors:3});convertColorMode(d,'indexed',{palette:'current',colors:3,dither:true});assert.equal(plain.frames[0].indices[0].filter(i=>i===2).length,0);assert.equal(d.frames[0].indices[0].filter(i=>i===2).length,4);validateDocument(d);});
test('自适应量化遵守色数、保留透明，损坏索引和缓存明确拒绝',()=>{const d=createDocument(32,1);d.frames[0].cels[0]=Array.from({length:32},(_,i)=>((i*8<<24)|(i*7<<16)|(i*6<<8)|255)>>>0);convertColorMode(d,'indexed',{colors:5});assert.ok(d.palette.length<=5);validateDocument(d);const bad=clone(d);bad.frames[0].indices[0][0]=256;assert.throws(()=>validateDocument(bad),/索引/);const mismatch=clone(d);mismatch.frames[0].cels[0][0]^=0x100;assert.throws(()=>validateDocument(mismatch),/不一致/);});

test('重复索引随剪贴板、翻转、旋转与画布锚定移动',()=>{const d=sample();d.palette=['#00000000','#ff0000ff','#ff0000ff'];d.frames[0].cels[0]=[0xff0000ff,0xff0000ff];convertColorMode(d,'indexed',{palette:'current'});d.frames[0].indices[0]=[1,2];const p=d.frames[0].cels[0],copy=copyRegion(d,p,null);flipRegion(d,p,null,'x');assert.deepEqual(d.frames[0].indices[0],[2,1]);pasteRegion(d,p,copy,0,0,null,true);assert.deepEqual(d.frames[0].indices[0],[1,2]);const rotated=transformSelectionRegion(copy,{...transformState(copy),angle:180});clearRegion(d,p,null);pasteRegion(d,p,rotated,rotated.x,rotated.y,null,true);assert.deepEqual(d.frames[0].indices[0],[2,1]);resizeCanvas(d,4,1,'center');assert.deepEqual(d.frames[0].indices[0],[0,2,1,0]);validateDocument(d);});
test('8位索引与16位灰度原生ASE写出正确深度且像素/索引/链接保持',async()=>{for(const mode of ['indexed','grayscale']){const d=sample();convertColorMode(d,mode,{palette:'current'});addFrame(d,0,true);linkCels(d,0,[0,1]);const bytes=await writeAseprite(d);assert.equal(bytes.readUInt16LE(12),mode==='indexed'?8:16);const read=(await readAseprite(bytes)).doc;assert.equal(read.colorMode,mode);assert.deepEqual(read.frames.map(f=>f.cels),d.frames.map(f=>f.cels));if(mode==='indexed'){assert.deepEqual(read.frames.map(f=>f.indices),d.frames.map(f=>f.indices));assert.equal(read.frames[0].indices[0],read.frames[1].indices[0]);}}});

test('索引ASE保留cel独立透明度，逐帧色板明确拒绝',async()=>{const d=sample();convertColorMode(d,'indexed',{palette:'current'});addFrame(d,0,true);const bytes=await writeAseprite(d),firstEnd=128+bytes.readUInt32LE(128);let position=144,celPosition,paletteChunk;while(position<firstEnd){const size=bytes.readUInt32LE(position),type=bytes.readUInt16LE(position+4);if(type===0x2005)celPosition=position;if(type===0x2019)paletteChunk=Buffer.from(bytes.subarray(position,position+size));position+=size;}const opacity=Buffer.from(bytes);opacity[celPosition+12]=128;const imported=await readAseprite(opacity);assert.equal(imported.doc.frames[0].celProperties[imported.doc.layers[0].id].opacity,128*100/255);paletteChunk[28]^=255;const animated=Buffer.concat([bytes,paletteChunk]);animated.writeUInt32LE(animated.length,0);animated.writeUInt32LE(bytes.readUInt32LE(firstEnd)+paletteChunk.length,firstEnd);animated.writeUInt16LE(bytes.readUInt16LE(firstEnd+6)+1,firstEnd+6);animated.writeUInt32LE(bytes.readUInt32LE(firstEnd+12)+1,firstEnd+12);await assert.rejects(readAseprite(animated),/逐帧色板/);});

test('原版生成的固定8/16位样例可读取并保持链接和Alpha',async()=>{for(const [name,mode,values]of [['indexed-linked','indexed',[0xff0000ff,0x00ff0080]],['grayscale-linked','grayscale',[0x4c4c4cff,0x96969680]]]){const read=(await readAseprite(await fs.readFile(new URL('./fixtures/'+name+'.aseprite',import.meta.url)))).doc;assert.equal(read.colorMode,mode);assert.deepEqual(read.frames[0].cels[0],values);assert.equal(read.frames[0].cels[0],read.frames[1].cels[0]);}});

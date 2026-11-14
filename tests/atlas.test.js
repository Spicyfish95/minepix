import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,colorValue} from '../src/model.js';
import {atlasMetadata} from '../src/formats/atlas.js';
import {sheetManifestPlan} from '../src/formats/sheet-manifest.js';
function fixture(){const d=createDocument(6,4,'atlas');d.frames[0].cels[0][8]=colorValue('#ff0000');d.frames[0].cels[0][15]=colorValue('#ff000080');addFrame(d,0);d.frames[1].cels[0][18]=colorValue('#0000ff');addFrame(d,1);return d;}
test('裁边只参考非零 Alpha 并记录原始偏移，空帧使用透明占位',()=>{const m=atlasMetadata(fixture(),[0,1,2],{trim:true,pack:true,scale:2,extrude:1});assert.deepEqual(m.frames[0].spriteSourceSize,{x:4,y:2,w:4,h:4});assert.deepEqual(m.frames[0].sourceSize,{w:12,h:8});assert.equal(m.frames[2].empty,true);assert.equal(m.extrude,2);assert.equal(sheetManifestPlan(m).width,12);});
test('打包矩形含挤出区域不重叠且保持元数据帧序',()=>{const m=atlasMetadata(fixture(),[0,1,2],{trim:true,pack:true,extrude:1,gapX:1,gapY:1});for(let i=0;i<m.frames.length;i++)for(let j=i+1;j<m.frames.length;j++){const a=m.frames[i].frame,b=m.frames[j].frame;assert.ok(a.x+a.w+1<=b.x-1||b.x+b.w+1<=a.x-1||a.y+a.h+1<=b.y-1||b.y+b.h+1<=a.y-1);}assert.deepEqual(m.frames.map(f=>f.sourceIndex),[0,1,2]);});
test('无裁边网格与原布局一致，紧密裁边减少空间',()=>{const d=fixture(),grid=atlasMetadata(d,[0,1,2],{columns:3});assert.deepEqual(grid.size,{w:18,h:4});assert.deepEqual(grid.frames[1].frame,{x:6,y:0,w:6,h:4});const packed=atlasMetadata(d,[0,1,2],{trim:true,pack:true});assert.ok(packed.size.w*packed.size.h<72);});
test('恢复裁边帧校验偏移、尺寸与旋转',()=>{const m=atlasMetadata(fixture(),[0],{trim:true});m.frames[0].spriteSourceSize.x=99;assert.throws(()=>sheetManifestPlan(m),/偏移/);assert.throws(()=>atlasMetadata(fixture(),[0],{extrude:17}));});

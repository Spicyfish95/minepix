import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSlices,scaleSlices,reframeSlices,flipSlices} from '../src/slices.js';
import {createDocument,validateDocument,History} from '../src/model.js';
const slice=()=>({id:'button',name:'按钮',bounds:{x:2,y:2,w:6,h:6},pivot:{x:3,y:3},center:{x:1,y:1,w:4,h:4}});
test('区域、pivot、九宫格随项目往返且深拷贝',()=>{const d=createDocument(12,12);d.slices=[slice()];d.requiredFeatures=['slices'];const next=validateDocument(d);assert.deepEqual(next.slices,d.slices);next.slices[0].bounds.x=1;assert.equal(d.slices[0].bounds.x,2);});
test('无效矩形、重复 id、越界九宫格拒绝',()=>{assert.throws(()=>validateSlices([slice(),slice()],12,12));const s=slice();s.center.w=8;assert.throws(()=>validateSlices([s],12,12));assert.throws(()=>validateSlices([slice()],4,4));});
test('JSON 缩放、画布裁切和翻转坐标一致',()=>{const slices=[slice()],scaled=scaleSlices(slices,2);assert.equal(scaled[0].bounds.w,12);assert.equal(scaled[0].pivot.x,6);const cropped=reframeSlices(slices,{x:4,y:0,w:8,h:8});assert.deepEqual(cropped[0].bounds,{x:0,y:2,w:4,h:6});assert.equal(cropped[0].pivot.x,1);assert.deepEqual(flipSlices(slices,12,12,'x')[0].bounds,{x:4,y:2,w:6,h:6});assert.equal(reframeSlices(slices,{x:10,y:10,w:2,h:2}).length,0);});

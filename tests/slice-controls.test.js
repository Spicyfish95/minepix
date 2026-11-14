import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragSliceBounds,hitSliceHandle,resizedSliceGeometry} from '../src/slice-controls.js';
test('Slice 拖动与八方向缩放保留画布边界及最小尺寸',()=>{
 const b={x:2,y:3,w:4,h:5};assert.deepEqual(dragSliceBounds(b,'move',{x:0,y:0},{x:50,y:-10},12,12),{x:8,y:0,w:4,h:5});
 assert.deepEqual(dragSliceBounds(b,'se',{x:6,y:8},{x:8,y:10},12,12),{x:2,y:3,w:6,h:7});assert.deepEqual(dragSliceBounds(b,'nw',{x:2,y:3},{x:20,y:20},12,12),{x:5,y:7,w:1,h:1});
 assert.equal(hitSliceHandle(b,{x:6.1,y:8.1},24),'se');assert.equal(hitSliceHandle(b,{x:4,y:5},24),null);
});
test('缩放同步相对 pivot 与九宫格，移动只改变范围',()=>{
 const slice={bounds:{x:2,y:2,w:4,h:4},pivot:{x:2,y:2},center:{x:1,y:1,w:2,h:2}};
 assert.deepEqual(resizedSliceGeometry(slice,{x:1,y:1,w:8,h:8}),{bounds:{x:1,y:1,w:8,h:8},pivot:{x:4,y:4},center:{x:2,y:2,w:4,h:4}});
 const tiny=resizedSliceGeometry(slice,{x:2,y:2,w:1,h:1});assert.deepEqual(tiny.center,{x:0,y:0,w:1,h:1});
});

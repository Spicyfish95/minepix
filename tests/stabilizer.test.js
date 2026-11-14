import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStabilizer} from '../src/stabilizer.js';

test('距离稳定器抑制半径内抖动，超出后保持拖曳距离',()=>{
 const stabilizer=createStabilizer({x:0,y:0},4);
 assert.equal(stabilizer.move({x:2,y:1}),null);assert.equal(stabilizer.move({x:4,y:0}),null);
 assert.deepEqual(stabilizer.move({x:8,y:0}),{x:4,y:0});assert.deepEqual(stabilizer.move({x:12,y:0}),{x:8,y:0});
 assert.deepEqual(stabilizer.position(),{x:8,y:0});
});
test('转向保留亚像素轨迹，零距离等价直接绘画且去掉重复点',()=>{
 const stabilizer=createStabilizer({x:0,y:0},2);stabilizer.move({x:4,y:0});const point=stabilizer.move({x:4,y:4});assert.deepEqual(point,{x:3,y:2});assert.ok(Math.abs(Math.hypot(4-stabilizer.position().x,4-stabilizer.position().y)-2)<1e-9);
 const direct=createStabilizer({x:1,y:2},0);assert.deepEqual(direct.move({x:8,y:5}),{x:8,y:5});assert.equal(direct.move({x:8,y:5}),null);
});

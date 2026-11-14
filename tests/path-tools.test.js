import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rasterCurve,rasterPolygon} from '../src/path-tools.js';
test('quadratic curve reaches both endpoints and follows the chosen control point',()=>{
  const points=new Set();rasterCurve({x:0,y:6},{x:10,y:6},{x:5,y:0},(x,y)=>points.add(`${x},${y}`));
  assert(points.has('0,6'));assert(points.has('10,6'));assert(points.has('5,3'));assert(!points.has('5,6'));
});
test('polygon fill handles concavity and distinguishes filled from outlined regions',()=>{
  const vertices=[{x:1,y:1},{x:6,y:1},{x:6,y:6},{x:4,y:6},{x:4,y:3},{x:1,y:3}],filled=new Set(),outline=new Set();
  rasterPolygon(vertices,true,(x,y)=>filled.add(`${x},${y}`));rasterPolygon(vertices,false,(x,y)=>outline.add(`${x},${y}`));
  assert(filled.has('5,4'));assert(!filled.has('2,5'));assert(filled.has('3,2'));assert(!outline.has('3,2'));assert(outline.has('1,1'));
});

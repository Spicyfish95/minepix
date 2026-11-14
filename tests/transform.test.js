import test from 'node:test';
import assert from 'node:assert/strict';
import { transformState, transformPoint, localPoint, relocatePivot, transformHandles, hitTransform, dragTransform, transformCursor } from '../src/transform-controls.js';
import { LIMIT } from '../src/model.js';
import { transformSelectionRegion } from '../src/selection-mask.js';
const near=(a,b)=>{assert.ok(Math.abs(a.x-b.x)<1e-8);assert.ok(Math.abs(a.y-b.y)<1e-8);};
const base=()=>transformState({x:10,y:20,w:12,h:8});

test('rotated geometry and local coordinates roundtrip around an external pivot',()=>{
  const state={...base(),angle:37,u:-.5,v:1.5};
  for(const [x,y] of [[0,0],[1,1],[.2,.7]])near(localPoint(state,transformPoint(state,x,y)),{x,y});
});
test('corner and edge resize keep their opposite anchor fixed after rotation',()=>{
  for(const [handle,u,v]of [['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]]){
    const state={...base(),angle:33},start=transformPoint(state,u,v),next=dragTransform(state,handle,start,{x:start.x+7,y:start.y+9});
    near(transformPoint(next,1-u,1-v),transformPoint(state,1-u,1-v));
    assert.ok(next.width>=1&&next.height>=1);
    if(u===.5)assert.equal(next.width,state.width);if(v===.5)assert.equal(next.height,state.height);
  }
});
test('Shift corner resize preserves aspect and prevents collapsed or excessive dimensions',()=>{
  const state=base(),start=transformPoint(state,1,1),next=dragTransform(state,'se',start,{x:start.x+12,y:start.y+3},true);
  assert.equal(next.width,24);assert.equal(next.height,16);
  const tiny=dragTransform(state,'se',start,{x:-100,y:-100}),large=dragTransform(state,'se',start,{x:5000,y:5000});
  assert.equal(tiny.width,1);assert.ok(large.width>4096);assert.ok(large.width*large.height<=LIMIT);
  const proportional=dragTransform(state,'se',start,{x:5000,y:5000},true);assert.ok(proportional.width>4096);assert.ok(proportional.width*proportional.height<=LIMIT);
});
test('pivot relocation keeps all corners and rasterized pixels stationary',()=>{
  const region={x:10,y:20,w:2,h:2,data:[255,511,767,1023]},state={...transformState(region),angle:90};
  const next=relocatePivot(state,{x:15,y:22});near(transformPoint(next,next.u,next.v),{x:15,y:22});
  for(const [u,v]of [[0,0],[1,0],[1,1],[0,1]])near(transformPoint(state,u,v),transformPoint(next,u,v));
  assert.deepEqual(transformSelectionRegion(region,state),transformSelectionRegion(region,next));
});
test('rotation uses the relocated pivot and Shift snaps to fifteen degrees',()=>{
  const state=relocatePivot(base(),{x:10,y:20}),start={x:30,y:20},point={x:28,y:28};
  const next=dragTransform(state,'rotate',start,point,true);assert.equal(next.angle,30);
  near(transformPoint(next,next.u,next.v),{x:10,y:20});
  const region={x:2,y:2,w:2,h:2,data:[255,511,767,1023]},rotated=transformSelectionRegion(region,{...transformState(region),u:0,v:0,angle:90});
  assert.equal(rotated.x,0);assert.equal(rotated.y,2);assert.deepEqual(rotated.data,[767,255,1023,511]);
});
test('handle hit testing stays constant in screen pixels and supports rotated interior moves',()=>{
  const state={...base(),angle:45};
  for(const zoom of [2,12,48]){
    const handle=transformHandles(state,zoom).find(p=>p.id==='rotate');
    assert.equal(hitTransform(state,{x:handle.x+3/zoom,y:handle.y},zoom),'rotate');
    const corner=transformPoint(state,0,0);assert.equal(hitTransform(state,corner,zoom),'nw');
  }
  assert.equal(hitTransform(state,transformPoint(state,.25,.25),12),'move');
  assert.equal(transformCursor({...state,angle:90},'e'),'ns-resize');assert.equal(transformCursor(state,'rotate',true),'grabbing');
  const moved=dragTransform(state,'move',{x:1,y:1},{x:3.8,y:5.2});assert.equal(moved.x,13);assert.equal(moved.y,24);
});

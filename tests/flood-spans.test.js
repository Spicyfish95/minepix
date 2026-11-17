import test from 'node:test';
import assert from 'node:assert/strict';
import {floodSpans} from '../src/flood-spans.js';
import {shapeSelection,selectionFrom} from '../src/selection-mask.js';
import {tiledPoint} from '../src/tiled-mode.js';
test('scanline connectivity equals independent breadth-first search for holes and wrapping',()=>{
 let state=12345;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 for(const mode of ['none','x','y','both'])for(let sample=0;sample<50;sample++){
  const width=9,height=7,mask=Uint8Array.from({length:width*height},()=>random()%3?1:0),x=random()%width,y=random()%height,expected=new Set(),queue=mask[y*width+x]?[y*width+x]:[];
  for(let n=0;n<queue.length;n++){const i=queue[n];if(expected.has(i))continue;expected.add(i);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const p=tiledPoint({width,height},i%width+dx,Math.floor(i/width)+dy,mode);if(p.x>=0&&p.y>=0&&p.x<width&&p.y<height){const next=p.y*width+p.x;if(mask[next]&&!expected.has(next))queue.push(next);}}}
  const actual=new Set();floodSpans(width,height,x,y,(px,py)=>mask[py*width+px],(_x,_y,i)=>{assert.ok(!actual.has(i));actual.add(i);},mode);assert.deepEqual(actual,expected);
 }
});
test('selection bounded predicate scans only the supplied rectangle and clips to canvas',()=>{
 let calls=0;const selection=selectionFrom({width:8192,height:8192},()=>{calls++;return true;},{x:4,y:3,w:8,h:8});assert.equal(calls,64);assert.equal(selection.mask.length,64);
 const shape=shapeSelection({width:8192,height:8192},'rect',[{x:4,y:3},{x:11,y:10}],'none');assert.deepEqual(shape,selection);
});

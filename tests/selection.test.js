import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, selectionContains, copyRegion, clearRegion, pasteRegion, flipRegion, pixelSet, floodFill } from '../src/model.js';
import { stampBrush, paintFill } from '../src/brush-engine.js';
import { shapeSelection, wandSelection, combineSelection, invertSelection, translateSelection, transformRegion } from '../src/selection-mask.js';

const count=selection=>selection.mask.reduce((a,b)=>a+b,0);
test('ellipse and polygon masks exclude corners and retain interior',()=>{
  const doc=createDocument(7,7),ellipse=shapeSelection(doc,'ellipse',[{x:1,y:1},{x:5,y:5}]);
  assert.equal(selectionContains(ellipse,1,1),false);assert.equal(selectionContains(ellipse,3,3),true);
  const triangle=shapeSelection(doc,'polygon',[{x:0,y:0},{x:4,y:0},{x:0,y:4}]);
  assert.equal(selectionContains(triangle,1,1),true);assert.equal(selectionContains(triangle,4,4),false);
});
test('selection algebra includes empty intersections, inversions and clipped translations',()=>{
  const doc=createDocument(4,4),a={x:0,y:0,w:2,h:2},b={x:1,y:1,w:2,h:2};
  assert.equal(count(combineSelection(doc,a,b,'add')),7);
  assert.equal(count(combineSelection(doc,a,b,'subtract')),3);
  assert.equal(count(combineSelection(doc,a,b,'intersect')),1);
  const empty=combineSelection(doc,a,{x:3,y:3,w:1,h:1},'intersect');
  assert.equal(empty.w,0);assert.equal(selectionContains(empty,0,0),false);
  assert.equal(count(invertSelection(doc,empty)),16);
  assert.equal(count(invertSelection(doc,null)),16);
  assert.equal(count(translateSelection(doc,a,-1,0)),2);
});
test('wand follows connected RGBA matches and channel tolerance',()=>{
  const doc=createDocument(3,2),pixels=[0xff0000ff,0xff0000ff,0,0,0xfe0000ff,0xff0000ff];
  assert.equal(count(wandSelection(doc,pixels,0,0)),2);
  assert.equal(count(wandSelection(doc,pixels,0,0,1)),4);
  assert.equal(count(wandSelection(doc,[0xff000080,0xff0000ff,0,0,0,0],0,0)),1);
});
test('masked painting and both fills leave mask holes unchanged',()=>{
  const doc=createDocument(3,3),selection={x:0,y:0,w:3,h:3,mask:Uint8Array.from([0,1,0,1,1,1,0,1,0])};
  for(const paint of [p=>pixelSet(doc,p,1,1,255,3,selection),p=>stampBrush(doc,p,1,1,255,{size:3},selection),p=>floodFill(doc,p,1,1,255,selection),p=>paintFill(doc,p,1,1,255,{ink:'copy',opacity:1},selection)]){
    const p=new Array(9).fill(0);paint(p);assert.deepEqual(p,[0,255,0,255,255,255,0,255,0]);
  }
});
test('copy, clear, paste and flip preserve irregular masks and unselected pixels',()=>{
  const doc=createDocument(3,2),selection={x:0,y:0,w:2,h:2,mask:Uint8Array.from([1,0,1,1])},pixels=[255,511,0,767,1023,0];
  const region=copyRegion(doc,pixels,selection);assert.deepEqual(region.data,[255,0,767,1023]);
  clearRegion(doc,pixels,selection);assert.equal(pixels[1],511);
  pasteRegion(doc,pixels,region,1,0);assert.deepEqual(pixels,[0,255,0,0,767,1023]);
  const p=[255,511,0,767,1023,0],flipped=flipRegion(doc,p,selection,'x');
  assert.deepEqual([...flipped.mask],[0,1,1,1]);assert.deepEqual(p,[0,255,0,1023,767,0]);
});
test('nearest neighbor scale and quarter turn preserve RGBA and mask holes',()=>{
  const region={x:0,y:0,w:2,h:1,data:[0xff000080,0x0000ffff],mask:Uint8Array.from([1,1])};
  const scaled=transformRegion(region,4,2,0);assert.deepEqual(scaled.data,[0xff000080,0xff000080,0x0000ffff,0x0000ffff,0xff000080,0xff000080,0x0000ffff,0x0000ffff]);
  const rotated=transformRegion(region,2,1,90);assert.equal(rotated.w,1);assert.equal(rotated.h,2);assert.deepEqual(rotated.data,region.data);
  const hole=transformRegion({...region,mask:Uint8Array.from([1,0])},4,1,0);assert.deepEqual([...hole.mask],[1,1,0,0]);
});
import { gridSelection } from '../src/selection-mask.js';
test('grid selection snaps clicks and drags to whole cells and clips at canvas edges',()=>{
  const doc=createDocument(8,10),grid={x:1,y:2,w:3,h:4};
  const one=gridSelection(doc,grid,{x:5,y:5},{x:5,y:5});
  assert.deepEqual([one.x,one.y,one.w,one.h],[4,2,3,4]);assert.equal(count(one),12);
  const many=gridSelection(doc,grid,{x:5,y:5},{x:8,y:9});
  assert.deepEqual([many.x,many.y,many.w,many.h],[4,2,4,8]);assert.equal(count(many),32);
  const reversed=gridSelection(doc,grid,{x:8,y:9},{x:5,y:5});
  assert.deepEqual([reversed.x,reversed.y,reversed.w,reversed.h],[4,2,4,8]);
  const clipped=gridSelection(doc,{x:6,y:6,w:8,h:8},{x:7,y:7},{x:7,y:7});
  assert.deepEqual([clipped.x,clipped.y,clipped.w,clipped.h],[6,6,2,4]);assert.equal(count(clipped),8);
});

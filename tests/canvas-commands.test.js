import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, addLayer, addFrame, colorValue, clone, History } from '../src/model.js';
import { reframe, resizeCanvas, contentBounds, flipSprite } from '../src/canvas-commands.js';
const red=colorValue('#ff0000'), blue=colorValue('#0000ff');
test('canvas expansion honors anchors and updates every frame and hidden layer', () => {
  const d=createDocument(2,2);d.frames[0].cels[0][0]=red;addLayer(d,0);d.layers[1].visible=false;addFrame(d,0);d.frames[1].cels[1][3]=blue;
  resizeCanvas(d,4,4,'center');
  assert.equal(d.frames[0].cels[0][5],red);assert.equal(d.frames[1].cels[1][10],blue);
  assert(d.frames.every(f=>f.cels.every(c=>c.length===16)));
  const topLeft=createDocument(2,2);topLeft.frames[0].cels[0][0]=red;resizeCanvas(topLeft,3,3,'top-left');assert.equal(topLeft.frames[0].cels[0][0],red);
});
test('selection crop preserves source offsets and can be undone as one edit', () => {
  let d=createDocument(4,4);d.frames[0].cels[0][6]=red;d.frames[0].cels[0][11]=blue;const history=new History();history.push(d);
  reframe(d,{x:2,y:1,w:2,h:2});assert.deepEqual(d.frames[0].cels[0],[red,0,0,blue]);
  d=history.undo(d);assert.equal(d.width,4);assert.equal(d.frames[0].cels[0][11],blue);
});
test('automatic trim considers every frame and includes hidden layer content', () => {
  const d=createDocument(8,8);addLayer(d,0);d.layers[1].visible=false;addFrame(d,0);d.frames[0].cels[0][18]=red;d.frames[1].cels[1][53]=blue;
  const bounds=contentBounds(d);assert.deepEqual(bounds,{x:2,y:2,w:4,h:5});reframe(d,bounds);assert.equal(d.frames[0].cels[0][0],red);assert.equal(d.frames[1].cels[1][19],blue);
  assert.equal(contentBounds(createDocument()),null);
});
test('sprite flips affect all cels and dimension failures leave the document intact', () => {
  const d=createDocument(3,2);d.frames[0].cels[0][0]=red;addFrame(d,0,true);flipSprite(d,'x');assert(d.frames.every(f=>f.cels[0][2]===red));flipSprite(d,'y');assert(d.frames.every(f=>f.cels[0][5]===red));
  const before=clone(d);assert.throws(()=>resizeCanvas(d,33554433,2));assert.deepEqual(d,before);
});

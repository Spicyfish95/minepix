import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, addFrame, addLayer, clone, validateDocument } from '../src/model.js';
import { frameMoveOrder, moveFrames, reverseFrames, duplicateFrames, deleteFrames, selectTimelineFrames, scopeFrames, sheetMetadata } from '../src/timeline-commands.js';
import { playbackSequence, createPlayback } from '../src/playback.js';
function fixture(){
  const doc=createDocument(2,1);addLayer(doc,0);
  for(let i=1;i<5;i++)addFrame(doc,i-1);
  doc.frames.forEach((f,i)=>{f.duration=(i+1)*20;f.cels[0][0]=(i+1)*256+255;f.cels[1][1]=(i+6)*256+255;});
  doc.tags=[{id:'walk',name:'行走',color:'#edb75b',from:1,to:3,direction:'forward'}];return doc;
}
test('timeline Shift ranges and Ctrl toggles retain a nonempty selection',()=>{
  assert.deepEqual([...selectTimelineFrames(new Set([1]),1,3,{shiftKey:true})],[1,2,3]);
  assert.deepEqual([...selectTimelineFrames(new Set([1,3]),1,1,{ctrlKey:true})],[3]);
  assert.deepEqual([...selectTimelineFrames(new Set([1]),1,1,{ctrlKey:true})],[1]);
  assert.deepEqual([...selectTimelineFrames(new Set([4]),0,2,{shiftKey:true,ctrlKey:true})],[4,0,1,2]);
});
test('moving disjoint frames keeps all cels and durations together and remaps tags',()=>{
  const doc=fixture(),original=clone(doc.frames),selected=new Set([1,3]);
  assert.deepEqual(frameMoveOrder(5,selected,0),[1,3,0,2,4]);
  assert.deepEqual(moveFrames(doc,selected,0),[0,1]);assert.deepEqual(doc.frames,[original[1],original[3],original[0],original[2],original[4]]);
  assert.equal(doc.tags[0].from,0);assert.equal(doc.tags[0].to,3);
  assert.deepEqual(frameMoveOrder(5,new Set([1,2]),3),[0,1,2,3,4]);
});
test('reverse affects selected slots and duplicate cels remain independent',()=>{
  const doc=fixture(),original=clone(doc.frames);reverseFrames(doc,new Set([1,3]));
  assert.deepEqual(doc.frames,[original[0],original[3],original[2],original[1],original[4]]);
  const selected=duplicateFrames(doc,new Set([1,3]),4);assert.deepEqual(selected,[4,5]);
  assert.equal(doc.tags[0].to,5);doc.frames[4].cels[0][0]=0;assert.notEqual(doc.frames[1].cels[0][0],0);
});
test('delete removes empty tags and rejects deleting every frame before mutation',()=>{
  const doc=fixture(),before=clone(doc);assert.throws(()=>deleteFrames(doc,new Set([0,1,2,3,4])),/至少保留/);assert.deepEqual(doc,before);
  assert.equal(deleteFrames(doc,new Set([1,2,3])),1);assert.equal(doc.tags.length,0);assert.equal(doc.frames.length,2);
});
test('blank insertion shifts or extends tag bounds and duplicate capacity is atomic',()=>{
  const doc=fixture();addFrame(doc,0);assert.equal(doc.tags[0].from,2);assert.equal(doc.tags[0].to,4);
  addFrame(doc,4);assert.equal(doc.tags[0].to,5);
  const small=createDocument(1,1);while(small.frames.length<256)addFrame(small,small.frames.length-1);
  assert.throws(()=>duplicateFrames(small,new Set([0]),1));assert.equal(small.frames.length,256);
});
test('project validation retains tags, accepts legacy projects and rejects damaged ranges',()=>{
  const doc=fixture();assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))).tags,doc.tags);
  const legacy=clone(doc);delete legacy.tags;assert.deepEqual(validateDocument(legacy).tags,[]);
  for(const patch of [{id:'all'},{from:-1},{to:5},{direction:'broken'},{color:'red'},{name:' '}]){const invalid=clone(doc);Object.assign(invalid.tags[0],patch);assert.throws(()=>validateDocument(invalid),/标签/);}
  const duplicate=clone(doc);duplicate.tags.push(clone(doc.tags[0]));assert.throws(()=>validateDocument(duplicate),/标签/);
});
test('tag and selected-frame export preserves source indices, timing and clipped tags',()=>{
  const doc=fixture();assert.deepEqual(scopeFrames(doc,'walk',new Set([0])),[1,2,3]);assert.deepEqual(scopeFrames(doc,'selected',new Set([3,2])),[2,3]);
  const metadata=sheetMetadata(doc,[2,3],1,2);assert.deepEqual(metadata.size,{w:4,h:4});assert.deepEqual(metadata.frames.map(f=>[f.index,f.sourceIndex,f.duration]),[[0,2,60],[1,3,80]]);assert.equal(metadata.tags[0].from,0);assert.equal(metadata.tags[0].to,1);
});
test('reverse and pingpong sequences avoid repeated endpoints in loops',()=>{
  assert.deepEqual(playbackSequence([2,4,6],'reverse'),[6,4,2]);assert.deepEqual(playbackSequence([2,4,6],'pingpong'),[2,4,6,4]);assert.deepEqual(playbackSequence([2],'pingpong'),[2]);
});
test('playback uses absolute deadlines, skips delayed cycles and ends once at the final frame',()=>{
  const doc={frames:[{duration:20},{duration:40},{duration:60}]};
  const loop=createPlayback(doc,[0,1,2],'forward',true,0,100);assert.equal(loop.advance(120),1);assert.equal(loop.nextAt,160);assert.equal(loop.advance(360),1);assert.equal(loop.nextAt,400);
  const once=createPlayback(doc,[0,1,2],'reverse',false,0,100);assert.equal(once.frame,2);assert.equal(once.advance(200),0);once.advance(220);assert.equal(once.finished,true);assert.equal(once.frame,0);
  const pingpong=createPlayback(doc,[0,1,2],'pingpong',false,0,0);pingpong.advance(180);assert.equal(pingpong.finished,true);assert.equal(pingpong.frame,0);
});

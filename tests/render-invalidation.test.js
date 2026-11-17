import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,composite,clone} from '../src/model.js';
import {History,snapshotCel} from '../src/history.js';
import {FrameCache} from '../src/renderer.js';
import {invalidateHistoryCaches,historyRenderImpact} from '../src/render-invalidation.js';
import {setCelProperty} from '../src/cel-properties.js';
const caches=()=>({frameCache:new FrameCache(),referenceCache:new FrameCache(1e7,{includeReference:true}),onionCache:new Map([['0:previous',1],['1:next',2]])});
test('committing a pixel delta preserves other frames and only invalidates matching onion images',()=>{
 const doc=createDocument(32,32);addFrame(doc,0);const history=new History(),cache=caches();
 const old=cache.frameCache.get(doc,1);cache.frameCache.get(doc,0);const before=snapshotCel(doc,0,0);doc.frames[0].cels[0][300]=0x123456ff;history.push(before,doc);
 const impact=invalidateHistoryCaches(doc,history.undoStack.at(-1),cache);assert.equal(impact.all,false);assert.equal(cache.frameCache.get(doc,1),old);assert.deepEqual(cache.frameCache.get(doc,0).rgba,composite(doc,0));assert.equal(cache.frameCache.stats.partial,1);assert.deepEqual([...cache.onionCache.keys()],['1:next']);
});
test('undo/redo keeps unaffected frame caches while replaying the correct entry',()=>{
 let doc=createDocument(4,4);addFrame(doc,0);const history=new History(),cache=caches(),old=cache.frameCache.get(doc,1),before=snapshotCel(doc,0,0);doc.frames[0].cels[0][0]=0xffffffff;history.push(before,doc);const entry=history.undoStack.at(-1);
 doc=history.undo(doc);invalidateHistoryCaches(doc,entry,cache);assert.equal(cache.frameCache.get(doc,1),old);assert.deepEqual(cache.frameCache.get(doc,0).rgba,composite(doc,0));
 doc=history.redo(doc);invalidateHistoryCaches(doc,entry,cache);assert.equal(cache.frameCache.get(doc,1),old);assert.deepEqual(cache.frameCache.get(doc,0).rgba,composite(doc,0));
});
test('palette changes invalidate all while a cel geometry change invalidates its frame',()=>{
 const doc=createDocument(4,4),history=new History();let before=clone(doc);doc.palette[0]='#123456';history.push(before,doc);assert.equal(historyRenderImpact(history.undoStack.at(-1)).all,true);
 before=clone(doc);setCelProperty(doc,0,0,{x:-1,y:2});history.push(before,doc);const impact=historyRenderImpact(history.undoStack.at(-1));assert.equal(impact.all,false);assert.equal(impact.frames.get(0),null);assert.ok(impact.cells.has('0:0'));
});
test('cropped cel block ranges translate into canvas coordinates and index-only edits invalidate',()=>{
 const before={width:20,height:20,layers:[{id:1}],frames:[{celProperties:{1:{x:-2,y:3,width:4,height:2}}}]},after=structuredClone(before);
 const entry={kind:'delta',before,after,changes:[],indexChanges:[{f:0,l:0,start:1,after:new Uint8Array(2)}]},impact=historyRenderImpact(entry);
 assert.deepEqual(impact.frames.get(0),{x:-1,y:3,w:2,h:1});assert.ok(impact.cells.has('0:0'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceCanvasCache} from '../src/reference-canvas-cache.js';
const entry=(size=2)=>({canvas:{width:size,height:size},data:'abcd'});
test('canvas LRU includes encoded bytes and drops the least recently used entry',()=>{
 const cache=new ReferenceCanvasCache(48);cache.set('a',entry());cache.set('b',entry());assert.equal(cache.memoryBytes,48);cache.get('a');cache.set('c',entry());assert.deepEqual([...cache.keys()],['a','c']);
});
test('closed document pruning removes orphan entries while keeping retained documents',()=>{
 const cache=new ReferenceCanvasCache();cache.set('closed',entry());cache.set('retained',entry());cache.retain(new Set(['retained']));assert.deepEqual([...cache.keys()],['retained']);cache.retain(new Set());assert.equal(cache.memoryBytes,0);
});
test('one oversized canvas is usable by the caller but not retained in the cache',()=>{
 const cache=new ReferenceCanvasCache(10),value=entry(100);cache.set('large',value);assert.equal(cache.size,0);assert.equal(value.canvas.width,100);
});

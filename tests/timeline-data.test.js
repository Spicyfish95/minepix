import test from 'node:test';
import assert from 'node:assert/strict';
import {CelOccupancy,celLinkCounts,layerUIKey} from '../src/timeline-data.js';
import {createDocument} from '../src/model.js';
test('indexed occupancy caches by source and transparent role with explicit invalidation',()=>{
 const doc=createDocument(2,1),cache=new CelOccupancy();doc.colorMode='indexed';doc.transparentIndex=0;doc.frames[0].indices=[Uint8Array.of(0,0)];let scans=0;const pixels=doc.frames[0].indices[0],some=pixels.some.bind(pixels);pixels.some=fn=>{scans++;return some(fn);};
 assert.equal(cache.filled(doc,0,0),false);assert.equal(cache.filled(doc,0,0),false);assert.equal(scans,1);pixels[1]=1;cache.invalidate(pixels);assert.equal(cache.filled(doc,0,0),true);doc.transparentIndex=1;pixels[0]=1;assert.equal(cache.filled(doc,0,0),false);doc.layers[0].type='background';assert.equal(cache.filled(doc,0,0),true);
});
test('link count keys include layer identity and reflect unlinked frames',()=>{
 const doc=createDocument(1,1);doc.layers.push({...doc.layers[0],id:2});doc.frames=[{links:{1:'a',2:'a'}},{links:{1:'a'}},{}];const counts=celLinkCounts(doc);assert.equal(counts(0,0),2);assert.equal(counts(0,1),1);assert.equal(counts(2,0),1);
});
test('UI structural keys exclude large reference and terrain pixel metadata',()=>{
 const layers=[{id:1,type:'reference',reference:{data:'huge',x:1,path:'a'}},{id:2,tileset:{tiles:['huge']}}];const key=JSON.stringify(layerUIKey(layers));assert.ok(!key.includes('huge'));layers[0].name='changed';assert.notEqual(JSON.stringify(layerUIKey(layers)),key);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createThumbnailCache,layerThumbnailPixels,sampleThumbnail} from '../src/thumbnails.js';
import {createDocument} from '../src/model.js';
import {celPixels,setCelProperty} from '../src/cel-properties.js';
import {prepareDocumentPixels,pixelStorageStats} from '../src/pixel-storage.js';
import {rasterReference} from '../src/layer-types.js';
const storage=()=>{const entries=new Map();return{getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value)};};
test('recent thumbnails persist, invalidate by file stamp and prune removed files',async()=>{
 const store=storage(),calls=[],generate=async path=>{calls.push(path);return{path,pixels:'preview'};};
 const a={path:'a',fileStamp:'1'},b={path:'b',fileStamp:'1'},cache=createThumbnailCache({storage:store,generate});
 assert.equal((await cache([a,b],['a'])).length,1);assert.deepEqual(calls,['a']);
 await createThumbnailCache({storage:store,generate})([a,b],['a']);assert.deepEqual(calls,['a']);
 await cache([{...a,fileStamp:'2'},b],['a']);assert.deepEqual(calls,['a','a']);
 await cache([b],[]);await createThumbnailCache({storage:store,generate})([a],['a']);assert.deepEqual(calls,['a','a','a']);
});
test('concurrent requests share generation and a failed file does not hide later entries',async()=>{
 let calls=0;const cache=createThumbnailCache({storage:storage(),generate:async path=>{calls++;await Promise.resolve();if(path==='bad')throw Error('bad');return{path};}}),entries=[{path:'a',fileStamp:'1'}];
 await Promise.all([cache(entries),cache(entries)]);assert.equal(calls,1);
 assert.deepEqual(await cache([{path:'bad'},{path:'good'}]),[{path:'good'}]);
});
test('cropped layer thumbnails match canvas sampling and stay display-sized',()=>{
 const doc=createDocument(6,4);setCelProperty(doc,0,0,{x:1,y:-1,width:2,height:3});doc.frames[0].cels[0]=[1,2,3,4,5,6];
 const view=celPixels(doc,0,0),expected=sampleThumbnail(6,4,(x,y)=>view[y*6+x],3);
 assert.deepEqual(layerThumbnailPixels(doc,0,0,3),expected);assert.equal(layerThumbnailPixels(doc,0,0).length,32*32*4);
});
test('indexed thumbnails use indices without materializing editing RGBA',()=>{
 const doc=createDocument(2,1);doc.colorMode='indexed';doc.transparentIndex=0;doc.palette=['#000000','#12345680'];doc.frames[0].indices=[Uint8Array.of(0,1)];
 prepareDocumentPixels(doc);assert.equal(pixelStorageStats(doc).rgbaBytes,0);
 const actual=layerThumbnailPixels(doc,0,0,2);assert.deepEqual([...actual.slice(0,8)],[0,0,0,0,18,52,86,128]);assert.equal(pixelStorageStats(doc).rgbaBytes,0);
});
test('reference thumbnails preserve offset and scale without canvas-wide rasterization',()=>{
 const doc=createDocument(6,4);doc.layers[0].type='reference';doc.layers[0].reference={x:1,y:0,scale:2,width:1,height:1,data:'EjRW/w=='};
 const full=rasterReference(doc,0);assert.deepEqual(layerThumbnailPixels(doc,0,0,4),sampleThumbnail(6,4,(x,y)=>full[y*6+x],4));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,validateDocument,composite,pixelSet} from '../src/model.js';
import {convertColorMode,applyIndexedPalette,validateColorMode} from '../src/color-modes.js';
import {prepareDocumentPixels,releaseIndexedCaches,pixelStorageStats,materializeDocumentPixels} from '../src/pixel-storage.js';
import {linkCels} from '../src/cel-links.js';
import {packProjectSave,unpackProjectReadPacket} from '../src/project-transfer.js';
import {History} from '../src/history.js';
import {packDocumentWire,unpackDocumentWire} from '../src/document-wire.js';
function indexed(){const doc=createDocument(3,1);doc.palette=['#00000000','#ff0000ff','#ff0000ff','#00ff00ff'];doc.frames[0].cels[0]=[0xff0000ff,0,0x00ff00ff];convertColorMode(doc,'indexed',{palette:'current'});return doc;}
test('editing pixels use Uint32 and Uint16 while indexed caches are lazy and disposable',()=>{
 const doc=prepareDocumentPixels(indexed());assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.ok(doc.frames[0].indices[0] instanceof Uint16Array);
 assert.ok(doc.frames[0].cels[0] instanceof Uint32Array);assert.equal(pixelStorageStats(doc).rgbaBytes,12);
 releaseIndexedCaches(doc);assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.deepEqual([...doc.frames[0].cels[0]],[0xff0000ff,0,0x00ff00ff]);
 assert.deepEqual([...composite(doc,0)],[255,0,0,255,0,0,0,0,0,255,0,255]);validateDocument(doc);
});
test('linked indexed cels share both source indices and derived buffers',()=>{
 const doc=indexed();addFrame(doc,0,true);linkCels(doc,0,[0,1]);prepareDocumentPixels(doc);
 assert.equal(doc.frames[0].indices[0],doc.frames[1].indices[0]);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);
 releaseIndexedCaches(doc);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);
});
test('duplicate palette slot edits, palette remap and history keep exact indices',()=>{
 let doc=prepareDocumentPixels(indexed());const before=structuredClone(doc),history=new History();doc.frames[0].indices[0][0]=2;
 history.push(before,doc);releaseIndexedCaches(doc);assert.equal(doc.frames[0].indices[0][0],2);validateColorMode(doc);
 doc=prepareDocumentPixels(history.undo(doc));assert.equal(doc.frames[0].indices[0][0],1);doc=prepareDocumentPixels(history.redo(doc));assert.equal(doc.frames[0].indices[0][0],2);
 applyIndexedPalette(doc,['#00000000','#00ff00ff','#ff0000ff','#ff0000ff'],[0,3,1,2]);prepareDocumentPixels(doc);validateColorMode(doc);assert.equal(doc.frames[0].indices[0][0],3);assert.equal(doc.frames[0].cels[0][2],0x00ff00ff);
});
test('typed document save/read and color mode conversion preserve pixels',()=>{
 const doc=prepareDocumentPixels(indexed()),wire=packProjectSave(doc,'typed');wire.set(new TextEncoder().encode('MPXREAD1'));
 const restored=unpackProjectReadPacket(wire,{typed:true}).document;assert.ok(restored.frames[0].indices[0] instanceof Uint16Array);assert.equal(restored.frames[0].cels[0][0],0xff0000ff);
 convertColorMode(restored,'rgba');assert.equal(restored.frames[0].cels[0][0],0xff0000ff);assert.equal(restored.frames[0].indices,undefined);
 prepareDocumentPixels(restored);pixelSet(restored,restored.frames[0].cels[0],1,0,0xffffffff);assert.equal(restored.frames[0].cels[0][1],0xffffffff);materializeDocumentPixels(restored);validateDocument(restored);
});
test('indexed source packets rebuild RGBA on demand without a transmitted RGBA plane',()=>{
 const meta={document:{...indexed(),frames:[{duration:100,cels:[null],indices:[null]}]},blocks:[{path:'/frames/0/indices/0',kind:'u8',count:3}],info:{indexedSource:true}};
 const json=new TextEncoder().encode(JSON.stringify(meta)),wire=new Uint8Array(12+json.length+3);wire.set(new TextEncoder().encode('MPXREAD1'));new DataView(wire.buffer).setUint32(8,json.length,true);wire.set(json,12);wire.set([2,0,3],12+json.length);
 const doc=unpackProjectReadPacket(wire).document;assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.deepEqual([...doc.frames[0].cels[0]],[0xff0000ff,0,0x00ff00ff]);assert.equal(doc.frames[0].indices[0][0],2);validateDocument(doc);
});

test('validation preserves lazy indexed planes and source independence without invoking RGBA getters',()=>{
 const doc=prepareDocumentPixels(indexed());addFrame(doc,0,true);linkCels(doc,0,[0,1]);prepareDocumentPixels(doc);releaseIndexedCaches(doc);
 const result=validateDocument(doc);assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.equal(pixelStorageStats(result).rgbaBytes,0);assert.equal(result.frames[0].indices[0],result.frames[1].indices[0]);assert.notEqual(result.frames[0].indices[0],doc.frames[0].indices[0]);
 result.frames[0].indices[0][0]=2;assert.equal(doc.frames[0].indices[0][0],1);assert.equal(result.frames[0].cels[0][0],0xff0000ff);
});
test('lazy validation rejects bad slots, wrong source lengths, mismatched cached RGBA and conflicting links',()=>{
 let doc=prepareDocumentPixels(indexed());doc.frames[0].indices[0][0]=255;assert.throws(()=>validateDocument(doc),/索引/);
 doc=prepareDocumentPixels(indexed());doc.frames[0].indices[0]=Uint8Array.of(1);assert.throws(()=>validateDocument(doc),/尺寸/);
 doc=prepareDocumentPixels(indexed());doc.frames[0].cels[0][0]=0xffffffff;assert.throws(()=>validateDocument(doc),/缓存不一致/);
 doc=indexed();addFrame(doc,0,true);linkCels(doc,0,[0,1]);prepareDocumentPixels(doc);releaseIndexedCaches(doc);doc.frames[1].indices[0]=Uint8Array.of(2,0,3);assert.throws(()=>validateDocument(doc),/不一致/);
});
test('plain validation copies each shared source only once and retains input isolation',()=>{
 const doc=createDocument(4,4);doc.frames.push({...doc.frames[0],cels:[doc.frames[0].cels[0]]});const result=validateDocument(doc);assert.equal(result.frames[0].cels[0],result.frames[1].cels[0]);assert.notEqual(result.frames[0].cels[0],doc.frames[0].cels[0]);result.frames[0].cels[0][0]=1;assert.equal(doc.frames[0].cels[0][0],0);
});

test('typed index validation scans shared buffers once per call and still rechecks later edits',()=>{
 const doc=prepareDocumentPixels(indexed());doc.frames.push({...doc.frames[0],cels:[null],indices:[doc.frames[0].indices[0]]});prepareDocumentPixels(doc);releaseIndexedCaches(doc);
 const validated=validateDocument(doc);assert.equal(pixelStorageStats(validated).rgbaBytes,0);doc.frames[0].indices[0][0]=255;assert.throws(()=>validateDocument(doc),/索引像素越界/);
});
test('plain index validation rejects holes, fractions and negative values',()=>{
 for(const values of [[-1,0,0],[1.2,0,0],Array(3)]){const doc=indexed();doc.frames[0].indices[0]=values;assert.throws(()=>validateColorMode(doc),/索引像素越界/);}
});
test('index storage rejects invalid values before narrowing ordinary and wider typed arrays',()=>{
 for(const values of [[65536,0,0],[-1,0,0],[1.2,0,0],Array(3),Uint32Array.of(65536,0,0)]){
  const doc=indexed();doc.frames[0].indices[0]=values;
  assert.throws(()=>prepareDocumentPixels(doc),/索引像素越界/);
 }
});
test('project reads and window migration reject inline indices before narrowing',()=>{
 for(const value of [65536,-1,1.2]){
  const doc=indexed();doc.frames[0].indices[0]=[value,0,0];
  const json=new TextEncoder().encode(JSON.stringify({document:doc,blocks:[],info:{indexedSource:true}})),wire=new Uint8Array(12+json.length);
  wire.set(new TextEncoder().encode('MPXREAD1'));new DataView(wire.buffer).setUint32(8,json.length,true);wire.set(json,12);
  for(const typed of [false,true])assert.throws(()=>unpackProjectReadPacket(wire,{typed}),/索引像素越界/);
  assert.throws(()=>unpackDocumentWire(packDocumentWire(doc)),/索引像素越界/);
 }
});

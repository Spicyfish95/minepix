import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,validateDocument,composite,pixelSet} from '../src/model.js';
import {convertColorMode,applyIndexedPalette,validateColorMode} from '../src/color-modes.js';
import {prepareDocumentPixels,releaseIndexedCaches,pixelStorageStats,materializeDocumentPixels} from '../src/pixel-storage.js';
import {linkCels} from '../src/cel-links.js';
import {packProjectSave,unpackProjectReadPacket} from '../src/project-transfer.js';
import {History} from '../src/history.js';
function indexed(){const doc=createDocument(3,1);doc.palette=['#00000000','#ff0000ff','#ff0000ff','#00ff00ff'];doc.frames[0].cels[0]=[0xff0000ff,0,0x00ff00ff];convertColorMode(doc,'indexed',{palette:'current'});return doc;}
test('editing pixels use Uint32 and Uint8 while indexed caches are lazy and disposable',()=>{
 const doc=prepareDocumentPixels(indexed());assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.ok(doc.frames[0].indices[0] instanceof Uint8Array);
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
 const restored=unpackProjectReadPacket(wire,{typed:true}).document;assert.ok(restored.frames[0].indices[0] instanceof Uint8Array);assert.equal(restored.frames[0].cels[0][0],0xff0000ff);
 convertColorMode(restored,'rgba');assert.equal(restored.frames[0].cels[0][0],0xff0000ff);assert.equal(restored.frames[0].indices,undefined);
 prepareDocumentPixels(restored);pixelSet(restored,restored.frames[0].cels[0],1,0,0xffffffff);assert.equal(restored.frames[0].cels[0][1],0xffffffff);materializeDocumentPixels(restored);validateDocument(restored);
});
test('indexed source packets rebuild RGBA on demand without a transmitted RGBA plane',()=>{
 const meta={document:{...indexed(),frames:[{duration:100,cels:[null],indices:[null]}]},blocks:[{path:'/frames/0/indices/0',kind:'u8',count:3}],info:{indexedSource:true}};
 const json=new TextEncoder().encode(JSON.stringify(meta)),wire=new Uint8Array(12+json.length+3);wire.set(new TextEncoder().encode('MPXREAD1'));new DataView(wire.buffer).setUint32(8,json.length,true);wire.set(json,12);wire.set([2,0,3],12+json.length);
 const doc=unpackProjectReadPacket(wire).document;assert.equal(pixelStorageStats(doc).rgbaBytes,0);assert.deepEqual([...doc.frames[0].cels[0]],[0xff0000ff,0,0x00ff00ff]);assert.equal(doc.frames[0].indices[0][0],2);validateDocument(doc);
});

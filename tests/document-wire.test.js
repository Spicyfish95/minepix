import test from 'node:test';
import assert from 'node:assert/strict';
import {packDocumentWire,unpackDocumentWire} from '../src/document-wire.js';
import {unpackBinaryPacket} from '../src/binary-packet.js';
import {createDocument,addFrame} from '../src/model.js';
import {History} from '../src/history.js';
test('document wire preserves aliases, Set, Map, typed history and cyclic state',()=>{
 const pixels=[0xff0000ff,0,0xffffffff],value={pixels,alias:pixels,selection:new Set([0,2]),map:new Map([['p',pixels]]),mask:Uint8Array.of(1,0,1),history:Uint32Array.of(0xffffffff),fraction:[-1,.5,2],optional:undefined};value.self=value;
 const result=unpackDocumentWire(packDocumentWire(value));assert.deepEqual(result,value);assert.equal(result.pixels,result.alias);assert.equal(result.map.get('p'),result.pixels);assert.equal(result.self,result);
});
test('large numeric arrays leave only descriptors in JSON metadata',()=>{
 const values=new Array(10000).fill(0xffffffff),wire=packDocumentWire({doc:{frames:[{cels:[values]}]},same:values}),packet=unpackBinaryPacket(wire);
 assert.ok(JSON.stringify(packet.metadata).length<1000);assert.equal(packet.payloads.length,1);assert.equal(packet.payloads[0].length,40000);assert.deepEqual(unpackDocumentWire(wire).doc.frames[0].cels[0],values);
});
test('migrated document can undo and redo and keeps linked pixels',()=>{
 let doc=createDocument(2,1);doc.frames[0].cels[0][0]=0xff0000ff;addFrame(doc,0,true);doc.frames[1].cels[0]=doc.frames[0].cels[0];
 const history=new History(),before=structuredClone(doc);doc.frames[0].cels[0][1]=0x00ff00ff;history.push(before,doc);
 const state=unpackDocumentWire(packDocumentWire({doc,history:history.capture()}));assert.equal(state.doc.frames[0].cels[0],state.doc.frames[1].cels[0]);const restored=new History();restored.restore(state.history);let undone=restored.undo(state.doc);assert.equal(undone.frames[0].cels[0][1],0);undone=restored.redo(undone);assert.equal(undone.frames[0].cels[0][1],0x00ff00ff);
});

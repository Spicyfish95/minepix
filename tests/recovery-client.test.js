import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryClient} from '../src/recovery-client.js';
import {packBinaryPacket,unpackBinaryPacket} from '../src/binary-packet.js';
import {packProjectSave,unpackProjectRead} from '../src/project-transfer.js';
import {createDocument} from '../src/model.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('binary envelopes keep metadata small and reject corrupt lengths',()=>{
 const bytes=packBinaryPacket({id:'文档'},[Uint8Array.of(0,255,1)]),packet=unpackBinaryPacket(bytes);
 assert.deepEqual(packet.metadata,{id:'文档'});assert.deepEqual([...packet.payloads[0]],[0,255,1]);
 for(const length of[0,11,bytes.length-1])assert.throws(()=>unpackBinaryPacket(bytes.subarray(0,length)));
 const extra=new Uint8Array(bytes.length+1);extra.set(bytes);assert.throws(()=>unpackBinaryPacket(extra));
});
test('recovery strips reference pixels and never sends JSON pixel arrays',async()=>{
 let saved;const doc=createDocument(2,1);doc.frames[0].cels[0][0]=0xff0000ff;doc.references=[{path:'C:/ref.png',data:'large cached data',width:1,height:1,x:0,y:0,scale:1,id:'r',name:'r'}];
 const client=createRecoveryClient({pack:async(...args)=>packProjectSave(...args),write:bytes=>{saved=bytes;}});
 await client.save({id:'a',filePath:'a.pix',dirty:true,name:'name',document:doc});
 const packet=unpackBinaryPacket(saved);assert.equal(packet.metadata.document,undefined);assert.equal(packet.payloads.length,1);
 const wire=packet.payloads[0].slice();wire.set(new TextEncoder().encode('MPXREAD1'));const restored=unpackProjectRead(wire);
 assert.equal(restored.frames[0].cels[0][0],0xff0000ff);assert.equal(restored.references[0].data,undefined);assert.equal(doc.references[0].data,'large cached data');
});
test('a later clean request replaces pending dirty packing and stays last',async()=>{
 const first=deferred(),second=deferred(),writes=[];let calls=0;
 const client=createRecoveryClient({pack:()=>++calls===1?first.promise:second.promise,write:bytes=>writes.push(unpackBinaryPacket(bytes).metadata.dirty)});
 const a=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}}),b=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}}),clean=client.save({id:'a',filePath:'a.pix',dirty:false});
 second.resolve(Uint8Array.of(2));await Promise.resolve();assert.equal(writes.length,0);first.resolve(Uint8Array.of(1));await Promise.all([a,b,clean]);assert.deepEqual(writes,[true,false]);assert.equal(calls,1);
});
test('packing failure does not prevent a subsequent successful recovery',async()=>{
 let count=0,writes=0;const client=createRecoveryClient({pack:async()=>{if(!count++)throw Error('pack failed');return Uint8Array.of(1);},write:()=>writes++});
 await assert.rejects(client.save({id:'a',filePath:'a.pix',dirty:true,document:{}}),/pack failed/);await client.save({id:'a',filePath:'a.pix',dirty:true,document:{}});assert.equal(writes,1);
});
test('recovery load restores binary pixels and rereads external references',async()=>{
 const doc=createDocument(1,1);doc.references=[{path:'C:/ref.png',width:1,height:1,x:0,y:0,scale:1,id:'r',name:'r'}];
 const bytes=packProjectSave(doc,'recovery');bytes.set(new TextEncoder().encode('MPXREAD1'));
 const client=createRecoveryClient({load:async()=>packBinaryPacket({id:'a',filePath:'a.pix'},[bytes]),readReference:async path=>{assert.equal(path,'C:/ref.png');return{data:'new bytes',width:1,height:1};}});
 const loaded=await client.load('a');assert.equal(loaded.document.frames[0].cels[0][0],0);assert.equal(loaded.document.references[0].data,'new bytes');
});
test('only the latest pending revision packs and it captures pixels before further edits',async()=>{
 const gate=deferred(),writes=[],packed=[];let calls=0;
 const client=createRecoveryClient({pack:async doc=>{const value=doc.frames[0].cels[0][0];packed.push(value);if(++calls===1)await gate.promise;return Uint8Array.of(value);},write:bytes=>writes.push(unpackBinaryPacket(bytes).payloads[0][0])}),doc=createDocument(1,1);
 const save=revision=>client.save({id:'a',filePath:'a.pix',dirty:true,revision,boardRevision:0,document:doc});
 doc.frames[0].cels[0][0]=1;const a=save(1);doc.frames[0].cels[0][0]=2;const b=save(2);doc.frames[0].cels[0][0]=3;const c=save(3);doc.frames[0].cels[0][0]=4;
 assert.deepEqual(packed,[1]);gate.resolve();await Promise.all([a,b,c]);assert.deepEqual(packed,[1,3]);assert.deepEqual(writes,[1,3]);
 await save(3);assert.equal(calls,2);await client.save({id:'a',filePath:'a.pix',dirty:true,revision:3,boardRevision:1,document:doc});assert.equal(calls,3);
});
test('documents keep their own latest pending revision without losing another document',async()=>{
 const gate=deferred(),writes=[];let calls=0;
 const client=createRecoveryClient({capture:value=>value,pack:async value=>{if(++calls===1)await gate.promise;return Uint8Array.of(value);},write:bytes=>{const p=unpackBinaryPacket(bytes);writes.push([p.metadata.id,p.payloads[0][0]]);}});
 const save=(id,value)=>client.save({id,filePath:id+'.pix',dirty:true,document:value});
 const requests=[save('a',1),save('b',2),save('a',3),save('b',4)];gate.resolve();await Promise.all(requests);assert.deepEqual(writes,[['a',1],['a',3],['b',4]]);
});
test('discard is an ordered barrier and an identical revision after it is written again',async()=>{
 const gate=deferred(),events=[];let calls=0;
 const client=createRecoveryClient({capture:value=>value,pack:async()=>{if(++calls===1)await gate.promise;return Uint8Array.of(1);},write:async()=>events.push('write'),discard:async path=>events.push('discard '+path)});
 const record={id:'a',filePath:'a.pix',dirty:true,revision:1,document:{}};
 const first=client.save(record),discard=client.discard('a.pix'),next=client.save(record);gate.resolve();await Promise.all([first,discard,next]);assert.deepEqual(events,['write','discard a.pix','write']);
});
test('a failed active request does not block the latest pending revision',async()=>{
 const gate=deferred();let calls=0,writes=0;
 const client=createRecoveryClient({pack:async()=>{if(++calls===1){await gate.promise;throw Error('first failed');}return Uint8Array.of(1);},write:()=>writes++});
 const first=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}});const rejected=assert.rejects(first,/first failed/),next=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}});gate.resolve();await Promise.all([rejected,next]);assert.equal(writes,1);
});

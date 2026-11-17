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
test('async recovery writes follow request order and a later clean request stays last',async()=>{
 const first=deferred(),second=deferred(),writes=[];let calls=0;
 const client=createRecoveryClient({pack:()=>++calls===1?first.promise:second.promise,write:bytes=>writes.push(unpackBinaryPacket(bytes).metadata.dirty)});
 const a=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}}),b=client.save({id:'a',filePath:'a.pix',dirty:true,document:{}}),clean=client.save({id:'a',filePath:'a.pix',dirty:false});
 second.resolve(Uint8Array.of(2));await Promise.resolve();assert.equal(writes.length,0);first.resolve(Uint8Array.of(1));await Promise.all([a,b,clean]);assert.deepEqual(writes,[true,true,false]);
});
test('packing failure does not prevent a subsequent successful recovery',async()=>{
 let count=0,writes=0;const client=createRecoveryClient({pack:async()=>{if(!count++)throw Error('pack failed');return Uint8Array.of(1);},write:()=>writes++});
 await assert.rejects(client.save({id:'a',filePath:'a.pix',dirty:true}),/pack failed/);await client.save({id:'a',filePath:'a.pix',dirty:true});assert.equal(writes,1);
});
test('recovery load restores binary pixels and rereads external references',async()=>{
 const doc=createDocument(1,1);doc.references=[{path:'C:/ref.png',width:1,height:1,x:0,y:0,scale:1,id:'r',name:'r'}];
 const bytes=packProjectSave(doc,'recovery');bytes.set(new TextEncoder().encode('MPXREAD1'));
 const client=createRecoveryClient({load:async()=>packBinaryPacket({id:'a',filePath:'a.pix'},[bytes]),readReference:async path=>{assert.equal(path,'C:/ref.png');return{data:'new bytes',width:1,height:1};}});
 const loaded=await client.load('a');assert.equal(loaded.document.frames[0].cels[0][0],0);assert.equal(loaded.document.references[0].data,'new bytes');
});

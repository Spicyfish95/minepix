import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectSaveClient,snapshotProject} from '../src/project-save-client.js';
import {createDocument} from '../src/model.js';
import {prepareDocumentPixels,pixelStorageStats} from '../src/pixel-storage.js';
import {snapshotMessage} from '../src/document-snapshot.js';
import {packProjectSave} from '../src/project-transfer.js';
function harness(){
 const workers=[];const client=createProjectSaveClient({createWorker:()=>{const worker={messages:[],terminated:false,postMessage(value,transfer){this.messages.push(structuredClone(value,{transfer}));},terminate(){this.terminated=true;}};workers.push(worker);return worker;}});
 return{client,workers};
}
test('save snapshot isolates pixels references and metadata while retaining linked cel sharing',()=>{
 const doc=createDocument(2,1,'snapshot');doc.frames.push(doc.frames[0]);doc.references=[{data:'AQIDBA==',path:'C:/reference.png',x:0}];
 const snapshot=snapshotProject(doc);doc.frames[0].cels[0][0]=123;doc.references[0].x=42;doc.name='edited';
 assert.equal(snapshot.name,'snapshot');assert.equal(snapshot.frames[0].cels[0][0],0);assert.equal(snapshot.references[0].x,0);assert.equal(snapshot.frames[0],snapshot.frames[1]);
});
test('indexed snapshot copies authoritative slots without reading derived editing planes',()=>{
 const doc=createDocument(3,1);doc.colorMode='indexed';doc.palette=['#00000000','#123456ff','#123456ff'];doc.transparentIndex=0;doc.frames[0].indices=[Uint8Array.of(0,2,1)];
 Object.defineProperty(doc.frames[0].cels,0,{enumerable:true,configurable:true,get(){throw Error('must not read editing RGBA');}});
 const snapshot=snapshotProject(doc);assert.equal(pixelStorageStats(snapshot).rgbaBytes,0);assert.deepEqual([...snapshot.frames[0].indices[0]],[0,2,1]);
 const message=snapshotMessage(snapshot);assert.equal(message.document.frames[0].cels[0],null);assert.equal(message.transfer.length,1);
 const received=structuredClone(message.document,{transfer:message.transfer});prepareDocumentPixels(received);assert.deepEqual([...received.frames[0].cels[0]],[0,0x123456ff,0x123456ff]);assert.ok(packProjectSave(received,'indexed').length>0);assert.equal(doc.frames[0].indices[0].byteLength,3);
});
test('Worker transfers owned snapshots once and never detaches live editing buffers',async()=>{
 const {client,workers}=harness(),doc=prepareDocumentPixels(createDocument(2,1)),live=doc.frames[0].cels[0],snapshot=snapshotProject(doc),owned=snapshot.frames[0].cels[0];
 const pending=client.pack(snapshot,'owned');assert.equal(owned.byteLength,0);assert.equal(live.byteLength,8);live[0]=123;assert.equal(workers[0].messages[0].document.frames[0].cels[0][0],0);
 workers[0].onmessage({data:{id:1,bytes:Uint8Array.of(1)}});await pending;
 const next=client.pack(doc,'live');assert.equal(live.byteLength,8);assert.equal(workers[0].messages[1].document.frames[0].cels[0][0],123);workers[0].onmessage({data:{id:2,bytes:Uint8Array.of(2)}});await next;client.dispose();
});
test('worker is reused and concurrent results route to their own save requests',async()=>{
 const {client,workers}=harness(),first=client.pack({name:'A'},'A',false,{filePath:'a.pix'}),second=client.pack({name:'B'},'B',true,{filePath:null});
 assert.equal(workers.length,1);const worker=workers[0];assert.equal(worker.messages.length,2);assert.equal(worker.messages[1].target.filePath,null);
 worker.onmessage({data:{id:2,bytes:new Uint8Array([2])}});worker.onmessage({data:{id:1,bytes:new Uint8Array([1])}});
 assert.deepEqual(await first,new Uint8Array([1]));assert.deepEqual(await second,new Uint8Array([2]));client.dispose();assert.equal(worker.terminated,true);
});
test('packing error rejects only its request and subsequent save can succeed',async()=>{
 const {client,workers}=harness(),bad=client.pack({},'bad');workers[0].onmessage({data:{id:1,error:'invalid pixels'}});await assert.rejects(bad,/invalid pixels/);
 const good=client.pack({},'good');workers[0].onmessage({data:{id:2,bytes:new Uint8Array([3])}});assert.equal((await good)[0],3);assert.equal(workers.length,1);client.dispose();
});
for(const event of ['onerror','onmessageerror'])test(event+' rejects pending work and recreates worker for retry',async()=>{
 const {client,workers}=harness(),first=client.pack({},'A'),second=client.pack({},'B');workers[0][event]({preventDefault(){},message:'worker failed'});
 await assert.rejects(first);await assert.rejects(second);assert.equal(workers[0].terminated,true);
 const retry=client.pack({},'retry');assert.equal(workers.length,2);workers[1].onmessage({data:{id:3,bytes:new Uint8Array([4])}});assert.equal((await retry)[0],4);client.dispose();
});
test('disposing rejects in-flight saves and startup failure can retry',async()=>{
 const {client}=harness(),pending=client.pack({},'pending');client.dispose();await assert.rejects(pending,/停止/);
 let attempts=0;const retry=createProjectSaveClient({createWorker:()=>{attempts++;throw Error('unavailable');}});
 await assert.rejects(retry.pack({},'first'),/unavailable/);await assert.rejects(retry.pack({},'second'),/unavailable/);assert.equal(attempts,2);
});

test('snapshot conversion rejects invalid numbers instead of truncating them',async()=>{
 const {client}=harness(),doc=createDocument(1,1);doc.frames[0].cels[0][0]=-1;await assert.rejects(client.pack(doc,'invalid'),/越界/);client.dispose();
});

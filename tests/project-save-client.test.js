import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectSaveClient,snapshotProject} from '../src/project-save-client.js';
import {createDocument} from '../src/model.js';
function harness(){
 const workers=[];const client=createProjectSaveClient({createWorker:()=>{const worker={messages:[],terminated:false,postMessage(value){this.messages.push(structuredClone(value));},terminate(){this.terminated=true;}};workers.push(worker);return worker;}});
 return{client,workers};
}
test('save snapshot isolates pixels references and metadata while retaining linked cel sharing',()=>{
 const doc=createDocument(2,1,'snapshot');doc.frames.push(doc.frames[0]);doc.references=[{data:'AQIDBA==',x:0}];
 const snapshot=snapshotProject(doc);doc.frames[0].cels[0][0]=123;doc.references[0].x=42;doc.name='edited';
 assert.equal(snapshot.name,'snapshot');assert.equal(snapshot.frames[0].cels[0][0],0);assert.equal(snapshot.references[0].x,0);assert.equal(snapshot.frames[0],snapshot.frames[1]);
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

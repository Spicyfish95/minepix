import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {packProjectSave,unpackProjectRead,unpackProjectReadPacket,openedProject} from '../src/project-transfer.js';

test('ASE binary read preserves pixels, indices and warnings without JSON pixel arrays',()=>{
 const document={format:'pixel-studio',frames:[{cels:[[0xff0000ff,0]],indices:[[1,0]]}]},packed=packProjectSave(document,'sprite');
 const start=12+new DataView(packed.buffer).getUint32(8,true),metadata=JSON.parse(new TextDecoder().decode(packed.subarray(12,start)));
 assert.equal(metadata.document.frames[0].cels[0],null);metadata.info={warnings:['unknown extension']};
 const json=new TextEncoder().encode(JSON.stringify(metadata)),wire=new Uint8Array(12+json.length+packed.length-start);
 wire.set(new TextEncoder().encode('MPXREAD1'));new DataView(wire.buffer).setUint32(8,json.length,true);wire.set(json,12);wire.set(packed.subarray(start),12+json.length);
 const packet=unpackProjectReadPacket(wire);assert.deepEqual(packet.document,document);assert.deepEqual(packet.info,metadata.info);assert.deepEqual(unpackProjectRead(wire),document);
 const file=openedProject({type:'aseprite',name:'sprite.ase',filePath:'C:/sprite.ase',rawProject:true},packet.document,packet.info);
 assert.equal(file.doc,packet.document);assert.deepEqual(file.warnings,['unknown extension']);assert.equal(file.rawProject,undefined);assert.equal('data' in file,false);
});

const source=readFileSync(new URL('../src/desktop.js',import.meta.url),'utf8');
const reader=source.slice(source.indexOf('async function readProjectPacket('),source.indexOf('const readProject='));
for(const failure of [null,'read','references'])test('foreground read updates loading state and releases it: '+(failure||'success'),async()=>{
 const events=[],document={frames:[]},context=vm.createContext({dispatch:(...event)=>events.push(event),invokeBackend:async(command,args)=>{assert.equal(command,'read_project_packed');assert.equal(args.filePath,'C:/sprite.ase');if(failure==='read')throw Error('decode failed');return new ArrayBuffer(0);},unpackProjectReadPacket:()=>({document,info:{warnings:[]}}),loadReferenceFiles:async value=>{if(failure==='references')throw Error('reference failed');return value;}});
 vm.runInContext(reader,context);
 if(failure)await assert.rejects(context.readProjectPacket('C:/sprite.ase'),/failed/);else assert.equal((await context.readProjectPacket('C:/sprite.ase')).document,document);
 assert.deepEqual(events,[['file:loading',true],['file:loading',false]]);
});
test('thumbnail/background reads do not change foreground busy state',async()=>{
 const context=vm.createContext({dispatch:()=>assert.fail('background read changed loading state'),invokeBackend:async()=>new ArrayBuffer(0),unpackProjectReadPacket:()=>({document:{},info:{}}),loadReferenceFiles:async value=>value});
 vm.runInContext(reader,context);await context.readProjectPacket('C:/sprite.ase',false);
});

import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {createDocument} from '../src/model.js';
import {packProjectSave} from '../src/project-transfer.js';
const size=Number(process.argv[2]||2048),doc=createDocument(64,64,'save-profile'),rgba=Buffer.alloc(size*size*4);
let seed=17;for(let i=0;i<rgba.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;rgba[i]=i%4===3?255:seed&255;}
doc.references=[{id:'large-reference',name:'large reference',width:size,height:size,x:0,y:0,scale:1,data:rgba.toString('base64')}];doc.requiredFeatures.push('reference-board');
const samples=[];let packed;
for(let iteration=0;iteration<3;iteration++){
 let start=performance.now();const snapshot=structuredClone(doc),snapshotMs=performance.now()-start;
 start=performance.now();const decoded=atob(snapshot.references[0].data),decodeMs=performance.now()-start;
 start=performance.now();Uint8Array.from(decoded,char=>char.charCodeAt(0));const legacyByteCopyMs=performance.now()-start;
 start=performance.now();packed=packProjectSave(snapshot,doc.name);const packMs=performance.now()-start;
 samples.push({iteration,snapshotMs,decodeMs,legacyByteCopyMs,packMs,bytes:packed.byteLength});
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/profile-project-save.bin',packed);
console.log(JSON.stringify({size,samples},null,2));

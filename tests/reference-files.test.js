import test from 'node:test';
import assert from 'node:assert/strict';
import {projectForSave,loadReferenceFiles} from '../src/reference-files.js';
import {createDocument,validateDocument,addLayer} from '../src/model.js';
import {addReference} from '../src/reference-board.js';
import {snapshotProject} from '../src/project-save-client.js';
test('project snapshot strips board and imported layer pixels while keeping paths and transforms',()=>{
 const doc=createDocument(1,1);addReference(doc,{id:'ref',name:'ref',width:1,height:1,data:'AQIDBA==',path:'C:/ref.png',x:8,y:9,scale:2});
 doc.layers[0].reference={width:1,height:1,data:'AQIDBA==',path:'D:/layer.png',x:0,y:0,scale:1};
 const snapshot=snapshotProject(doc);assert.equal(snapshot.references[0].data,undefined);assert.equal(snapshot.layers[0].reference.data,undefined);assert.equal(snapshot.references[0].path,'C:/ref.png');assert.equal(snapshot.references[0].scale,2);assert.equal(doc.references[0].data,'AQIDBA==');
});
test('opening loads file contents, deduplicates paths and preserves transform',async()=>{
 const doc=createDocument(1,1);doc.references=[{id:'r',name:'ref',width:1,height:1,path:'C:/ref.png',x:8,y:9,scale:2},{id:'s',name:'ref',width:1,height:1,path:'C:/ref.png',x:0,y:0,scale:1}];let reads=0;
 await loadReferenceFiles(doc,async()=>{reads++;return{width:2,height:1,data:'AQIDBAUGBwg='};});assert.equal(reads,1);assert.equal(doc.references[0].width,2);assert.equal(doc.references[0].x,8);validateDocument(doc);
});
test('missing source remains a path-only placeholder and saving never embeds stale pixels',async()=>{
 const doc=createDocument(1,1);doc.references=[{id:'r',name:'ref',width:1,height:1,path:'C:/missing.png',data:'AQIDBA==',x:0,y:0,scale:1}];
 await loadReferenceFiles(doc,async()=>{throw Error('missing file');});assert.equal(doc.references[0].data,undefined);assert.equal(doc.references[0].missing,'missing file');validateDocument(doc);assert.equal(projectForSave(doc).references[0].missing,undefined);
});
test('opening removes legacy embedded references without reading them and leaves artwork unchanged',async()=>{
 const doc=createDocument(2,1);doc.frames[0].cels[0]=[0x123456ff,0xabcdef80];doc.references=[{id:'old',data:'AQIDBA=='},{id:'empty-path',path:' ',data:'bad-old-data'}];
 const frames=structuredClone(doc.frames),palette=structuredClone(doc.palette);let reads=0;
 await loadReferenceFiles(doc,async()=>{reads++;throw Error('legacy reference must not be read');});
 assert.equal(reads,0);assert.deepEqual(doc.references,[]);assert.deepEqual(doc.frames,frames);assert.deepEqual(doc.palette,palette);validateDocument(doc);assert.deepEqual(projectForSave(doc).references,[]);
});
test('mixed projects discard embedded references and still load valid file paths',async()=>{
 const doc=createDocument(1,1);doc.references=[{id:'old',data:'old'},{id:'new',name:'new',path:'C:/new.png',width:1,height:1,x:4,y:5,scale:2}];let requested=[];
 await loadReferenceFiles(doc,async path=>{requested.push(path);return{width:1,height:1,data:'AQIDBA=='};});
 assert.deepEqual(requested,['C:/new.png']);assert.equal(doc.references.length,1);assert.equal(doc.references[0].id,'new');assert.equal(doc.references[0].x,4);validateDocument(doc);
});
test('legacy imported reference layer is emptied while structure and other frame pixels remain intact',async()=>{
 const doc=createDocument(2,1);doc.frames[0].cels[0]=[0x123456ff,0xabcdef80];addLayer(doc,0);doc.layers[1].type='reference';doc.layers[1].reference={width:1,height:1,data:'AQIDBA==',x:8,y:9,scale:2};doc.frames[0].cels[1]=[0xffffffff,0xffffffff];
 await loadReferenceFiles(doc,async()=>{throw Error('must not read');});
 assert.equal(doc.layers.length,2);assert.equal(doc.layers[1].type,'reference');assert.deepEqual(doc.layers[1].reference,{x:8,y:9,scale:2});assert.deepEqual(doc.frames[0].cels[0],[0x123456ff,0xabcdef80]);assert.deepEqual(doc.frames[0].cels[1],[0,0]);validateDocument(doc);assert.ok(!('data' in projectForSave(doc).layers[1].reference));
});
test('saving a newly created pathless image still requires a real source file',()=>{
 const doc=createDocument(1,1);doc.references=[{data:'AQIDBA=='}];assert.throws(()=>projectForSave(doc),/路径/);
});

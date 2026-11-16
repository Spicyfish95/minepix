import test from 'node:test';
import assert from 'node:assert/strict';
import {projectForSave,loadReferenceFiles} from '../src/reference-files.js';
import {createDocument,validateDocument} from '../src/model.js';
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
test('embedded references without a path are rejected',async()=>{
 const doc=createDocument(1,1);doc.references=[{data:'AQIDBA=='}];assert.throws(()=>projectForSave(doc),/路径/);await assert.rejects(loadReferenceFiles(doc,async()=>{}),/嵌入参考图/);
});

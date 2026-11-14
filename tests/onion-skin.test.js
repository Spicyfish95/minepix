import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, addLayer, colorValue, composite } from '../src/model.js';
import { DEFAULT_ONION_SETTINGS, onionSources, onionPixels } from '../src/onion-skin.js';
const settings=values=>({...DEFAULT_ONION_SETTINGS,...values});

test('onion references paint far to near with geometric alpha falloff',()=>{
  const sources=onionSources(7,3,settings({before:3,after:2,opacity:40,falloff:50}));
  assert.deepEqual(sources.map(s=>[s.index,s.side,s.distance]),[[0,'previous',3],[1,'previous',2],[5,'next',2],[2,'previous',1],[4,'next',1]]);
  assert.deepEqual(sources.map(s=>s.alpha),[.1,.2,.2,.4,.4]);
});
test('boundaries and zero opacity never introduce references or the active frame',()=>{
  assert.deepEqual(onionSources(1,0,settings({before:8,after:8})),[]);
  assert.deepEqual(onionSources(5,2,settings({opacity:0})),[]);
  assert.deepEqual(onionSources(5,2,settings({before:3,after:3,falloff:0})).map(s=>s.index),[1,3]);
  assert.deepEqual(onionSources(4,0,settings({before:8,after:1})).map(s=>s.index),[1]);
});
test('wrapped short ranges deduplicate references and prefer previous on equal distance',()=>{
  const two=onionSources(2,0,settings({before:8,after:8,wrap:true}));
  assert.equal(two.length,1);assert.equal(two[0].index,1);assert.equal(two[0].side,'previous');assert.equal(two[0].distance,1);
  const three=onionSources(3,0,settings({before:8,after:8,wrap:true}));
  assert.deepEqual(three.map(s=>s.index),[2,1]);assert.ok(three.every(s=>s.distance===1));
});
test('range restriction follows selected-frame order and handles an out-of-range active frame',()=>{
  assert.deepEqual(onionSources(7,3,settings(),[1,3,5]).map(s=>s.index),[1,5]);
  assert.deepEqual(onionSources(7,0,settings(),[1,3,5]),[]);
  assert.deepEqual(onionSources(7,1,settings({wrap:true}),[1]),[]);
});
test('tint preserves composite alpha and leaves document and original-color rendering intact',()=>{
  const doc=createDocument(2,1);addLayer(doc,0);doc.layers[1].opacity=50;
  doc.frames[0].cels[0][0]=colorValue('#ff000080');doc.frames[0].cels[1][0]=colorValue('#0000ff80');
  const before=JSON.stringify(doc),original=composite(doc,0),options=settings({previousColor:'#ef6672',nextColor:'#5b9fe8'});
  const previous=onionPixels(doc,0,0,options,'previous'),next=onionPixels(doc,0,0,options,'next');
  assert.deepEqual([...previous.slice(0,3)],[239,102,114]);assert.deepEqual([...next.slice(0,3)],[91,159,232]);assert.equal(previous[3],original[3]);assert.equal(next[3],original[3]);
  assert.deepEqual([...previous.slice(4)],[0,0,0,0]);assert.deepEqual(onionPixels(doc,0,0,{...options,mode:'original'},'previous'),original);assert.equal(JSON.stringify(doc),before);
});
test('current-layer references respect layer opacity and hidden state',()=>{
  const doc=createDocument(1,1);addLayer(doc,0);doc.frames[0].cels[0][0]=colorValue('#ff000080');doc.frames[0].cels[1][0]=colorValue('#0000ff');doc.layers[1].opacity=50;
  const options=settings({layers:'current',mode:'original'});
  assert.equal(onionPixels(doc,0,0,options,'previous')[3],128);assert.equal(onionPixels(doc,0,1,options,'previous')[3],128);
  doc.layers[1].visible=false;assert.equal(onionPixels(doc,0,1,options,'previous')[3],0);assert.equal(onionPixels(doc,0,0,options,'previous')[3],128);
});

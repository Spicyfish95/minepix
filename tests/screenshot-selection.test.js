import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionRect,imageRegion} from '../src/screenshot-selection.js';
import {defaultKeymap,asepriteKeymap,loadKeymap,KEYMAP_KEY,resolveShortcut} from '../src/keymap-manager.js';
test('selection normalizes reverse drags and clips to the screen',()=>{
 assert.deepEqual(selectionRect({x:90,y:80},{x:10,y:20},100,100),{x:10,y:20,width:80,height:60});
 assert.deepEqual(selectionRect({x:-5,y:10},{x:200,y:120},100,100),{x:0,y:10,width:100,height:90});
 assert.deepEqual(selectionRect({x:5,y:5},{x:5,y:5},100,100),{x:5,y:5,width:0,height:0});
});
test('physical crop uses independent viewport scales and consistent shared edges',()=>{
 assert.deepEqual(imageRegion({x:10,y:20,width:80,height:40},{width:100,height:100},{width:150,height:200}),[15,40,120,80]);
 assert.deepEqual(imageRegion({x:0,y:0,width:1280,height:720},{width:1280,height:720},{width:1920,height:1080}),[0,0,1920,1080]);
 const viewport={width:2560/1.5,height:1440/1.5};
 const rect=selectionRect({x:0,y:0},{x:64/1.5,y:48/1.5},viewport.width,viewport.height);
 assert.deepEqual(imageRegion(rect,viewport,{width:2560,height:1440}),[0,0,64,48]);
});
test('both profiles support configurable foreground screenshot Ctrl+1',()=>{
 for(const profile of [defaultKeymap(),asepriteKeymap()]){
  assert.deepEqual(resolveShortcut({code:'Digit1',key:'1',ctrlKey:true},profile),{action:'screenshot'});
  assert.deepEqual(resolveShortcut({code:'Digit1',key:'1'},profile),{action:'actual-size'});
 }
});
test('adding screenshot preserves existing user bindings including a custom Ctrl+1 owner',()=>{
 const saved=defaultKeymap();delete saved.bindings.screenshot;saved.bindings.fit=['Ctrl+1'];
 const storage={getItem:key=>key===KEYMAP_KEY?JSON.stringify(saved):null};
 const loaded=loadKeymap(storage);
 assert.deepEqual(loaded.bindings.fit,['Ctrl+1']);
 assert.deepEqual(loaded.bindings.screenshot,[]);
});

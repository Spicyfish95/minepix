import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultKeymap,asepriteKeymap,releasedHoldActionFor} from '../src/keymap-manager.js';
import {pointerMode} from '../src/interaction.js';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function editor(keymap,playing=false){
 const handlers={},actions=[],context={space:true,playing,keymap,modifiers:{alt:false,shift:false,grid:false},releasedHoldActionFor,
  onUI:(type,handler)=>{handlers[type]=handler;},$:()=>({open:false}),isTextTarget:()=>false,
  dispatch:action=>{actions.push(action);if(action==='play')context.playing=!context.playing;},drawOverlay:()=>{},
  syncInteraction:()=>{context.cursor=pointerMode({tool:'pencil',space:context.space,playing:context.playing}).cursor;}};
 vm.createContext(context);
 const start=source.indexOf("onUI('keyup',e=>{"),end=source.indexOf('function resetInteraction(',start);
 vm.runInContext(source.slice(start,end),context);
 return{context,actions,release:event=>handlers.keyup({key:' ',code:'Space',preventDefault:()=>{},...event})};
}
for(const modifier of ['Alt','Ctrl','Shift'])test(`grid hold release clears state after ${modifier} was released first`,()=>{
 const keymap=defaultKeymap();keymap.bindings['grid-select']=[modifier+'+J'];
 const {context,release}=editor(keymap);context.modifiers.grid=true;
 release({key:modifier==='Ctrl'?'Control':modifier,code:modifier==='Ctrl'?'ControlLeft':modifier+'Left'});
 release({key:'j',code:'KeyJ',defaultPrevented:true});
 assert.equal(context.modifiers.grid,false);
});

for(const keymap of [defaultKeymap(),asepriteKeymap()]){
 for(const playing of [false,true])test(`${keymap.profile}: releasing Space preserves playback=${playing} and restores cursor`,()=>{
  const {context,actions,release}=editor(keymap,playing);release();
  assert.equal(context.space,false);assert.equal(context.playing,playing);
  assert.equal(context.cursor,playing?'not-allowed':'pencil');assert.deepEqual(actions,[]);
  release();assert.equal(context.playing,playing);assert.deepEqual(actions,[]);
 });
 test(`${keymap.profile}: Space release still clears temporary pan after focus or modifier changes`,()=>{
  const {context,actions,release}=editor(keymap);
  release({key:'Unidentified',code:'Space',ctrlKey:true,shiftKey:true});
  assert.equal(context.space,false);assert.equal(context.cursor,'pencil');assert.deepEqual(actions,[]);
  context.space=true;release({code:'',key:' '});assert.equal(context.space,false);
 });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument,colorValue} from '../src/model.js';
import {normalizeColor,fromRgba} from '../src/colors.js';
import {modeOf,grayPixel,convertColorMode,applyIndexedPalette,createMapper,validateColorMode} from '../src/color-modes.js';
import {History} from '../src/history.js';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function editor(mode='rgba'){
 const doc=createDocument(2,1,'eyedropper');doc.palette=['#00000000','#ff0000','#00ff00'];
 doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
 if(mode!=='rgba')convertColorMode(doc,mode,{palette:'current'});
 const context={doc,li:0,gesture:null,color:'#ff0000',colorIndex:1,paletteEditing:true,paletteActive:1,paletteSelection:new Set([1]),history:new History(),
  normalizeColor,fromRgba,colorValue,modeOf,grayPixel,applyIndexedPalette,createMapper,
  saveColorPreferences:()=>{},renderColors:()=>{},useForegroundForPattern:()=>{}};
 context.mutate=(change,_,options)=>{const before=structuredClone(context.doc);change();context.history.push(before,context.doc,options);};
 vm.createContext(context);
 vm.runInContext(section('function paletteTargetIndex(','function paletteTargetColor(')+'\n'+section('function setColor(','function setBackground(')+'\n'+section('function setPaletteColor(','function insertPaletteColor('),context);
 return context;
}
test('entering and leaving palette editing clears selection without changing foreground or document',()=>{
 const context=editor(),before=structuredClone(context.doc),foreground=context.color;
 Object.assign(context,{paletteEditing:false,paletteDomKey:'cached',cancelPaletteDrag:()=>{},closeContextMenu:()=>{},renderPalette:()=>{},syncPaletteEditorButton:()=>{},syncPalettePanel:()=>{},message:()=>{}});
 vm.runInContext(section('function setPaletteEditing(','function togglePaletteEditor('),context);
 for(const value of [true,false,true]){
  context.paletteActive=1;context.paletteSelection.add(1);context.setPaletteEditing(value);
  assert.equal(context.paletteActive,null);assert.equal(context.paletteSelection.size,0);
  assert.equal(context.color,foreground);assert.deepEqual(context.doc,before);
 }
});
for(const mode of ['rgba','indexed','grayscale'])test(`${mode}: picking updates foreground and active palette slot, with undo/redo`,()=>{
 const context=editor(mode),before=structuredClone(context.doc),picked='#12345680';
 context.pickColor(picked);
 const expected=mode==='grayscale'?'#'+grayPixel(colorValue(picked)).toString(16).padStart(8,'0'):picked;
 assert.equal(context.color,expected);assert.equal(context.doc.palette[1],expected);
 assert.equal(context.history.undoStack.length,1);assert.equal(context.paletteActive,1);
 if(mode==='indexed'){
  assert.equal(context.colorIndex,1);assert.deepEqual(context.doc.frames[0].indices[0],[1,2]);
  assert.equal(context.doc.frames[0].cels[0][0],colorValue(expected));
 }
 validateColorMode(context.doc);
 context.doc=context.history.undo(context.doc);assert.deepEqual(context.doc,before);
 context.doc=context.history.redo(context.doc);assert.equal(context.doc.palette[1],expected);validateColorMode(context.doc);
});
test('indexed picking retains active index when sampled color already belongs to another slot',()=>{
 const context=editor('indexed');context.pickColor('#00ff00');
 assert.equal(context.colorIndex,1);assert.equal(context.color,'#00ff00');
 assert.deepEqual(context.doc.frames[0].indices[0],[1,2]);assert.equal(context.doc.palette[1],context.doc.palette[2]);
});
for(const state of ['not editing','no active slot','active slot not selected'])test(`${state}: only foreground changes`,()=>{
 const context=editor('indexed'),before=structuredClone(context.doc);
 if(state==='not editing')context.paletteEditing=false;
 else if(state==='no active slot')context.paletteActive=null;
 else context.paletteSelection.clear();
 context.pickColor('#123456');assert.equal(context.color,'#123456');
 assert.deepEqual(context.doc,before);assert.equal(context.history.undoStack.length,0);
});
test('multiple selected swatches change only active slot, repeated picking adds no history',()=>{
 const context=editor();context.paletteSelection=new Set([1,2]);context.pickColor('#123456');context.pickColor('#123456');
 assert.equal(context.doc.palette[1],'#123456');assert.equal(context.doc.palette[2],'#00ff00');
 assert.equal(context.history.undoStack.length,1);
});
test('reference picking uses same palette edit path and ignores transparent pixels',()=>{
 const context=editor('indexed');let pixel=0x12345680;
 Object.assign(context,{boardView:()=>({zoom:1}),boardItemPixels:()=>[pixel],boardMessage:()=>{}});
 vm.runInContext(section('function pickBoardColor(','function boardEyedropper('),context);
 const event={preventDefault:()=>{},stopPropagation:()=>{},clientX:0,clientY:0,currentTarget:{getBoundingClientRect:()=>({left:0,top:0})}};
 const item={width:1,height:1,scale:1};context.pickBoardColor(event,item);
 assert.equal(context.color,'#12345680');assert.equal(context.doc.palette[1],'#12345680');assert.equal(context.colorIndex,1);
 pixel=0;context.pickBoardColor(event,item);
 assert.equal(context.doc.palette[1],'#12345680');assert.equal(context.history.undoStack.length,1);
});

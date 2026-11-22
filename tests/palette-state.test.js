import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument,validateDocument,colorValue,addFrame} from '../src/model.js';
import {convertColorMode,applyIndexedPalette,modeOf,grayPixel,indexColor,createMapper} from '../src/color-modes.js';
import {paletteById,remapIndices} from '../src/palette-library.js';
import {isBackground} from '../src/layer-types.js';
import {History} from '../src/history.js';
import {snapshotDocument} from '../src/document-snapshot.js';
import {prepareDocumentPixels} from '../src/pixel-storage.js';
import {linkCels} from '../src/cel-links.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function editor(doc){
 const errors=[],messages=[],context={doc:prepareDocumentPixels(doc),history:new History(),li:0,documentTabs:{items:[{}]},paletteLibraryId:'',paletteImportName:'',paletteRemap:null,
  modeOf,grayPixel,indexColor,createMapper,applyIndexedPalette,paletteById,remapIndices,isBackground,colorValue,color:'#0000ff',colorIndex:3,paletteSelection:new Set(),paletteActive:null,
  renderPaletteLibrary:()=>{},syncRemapButton:()=>{},renderColors:()=>{},message:value=>messages.push(value),showError:value=>errors.push(value)};
 context.mutate=(change,_text,options={})=>{
  const before=snapshotDocument(context.doc);
  try{change();context.history.push(before,context.doc,options);prepareDocumentPixels(context.doc);}
  catch(error){context.doc=before;errors.push(error.message);}
 };
 vm.createContext(context);
 vm.runInContext(section('function libraryPaletteColors(','function syncRemapButton(')+'\n'+section('function applyPaletteLibrary(','async function savePaletteLibraryEntry(')+'\n'+section('function applyPaletteReorder(','function paletteIndexAt('),context);
 return{context,errors,messages};
}
function wide(){
 const doc=createDocument(2,1);doc.palette=Array(300).fill('#000000');doc.palette[0]='#ff0000';doc.palette[257]='#00ff00';doc.palette[299]='#00000000';
 doc.colorMode='indexed';doc.transparentIndex=299;doc.frames[0].indices=[[257,299]];doc.frames[0].cels=[[0x00ff00ff,0]];
 addFrame(doc,0,true);linkCels(doc,0,[0,1]);return doc;
}
test('applying a shorter library palette supports high indices and transparency, with linked undo and remap',()=>{
 const {context:c,errors}=editor(wide()),before=snapshotDocument(c.doc);
 c.applyPaletteLibrary('gameboy');
 assert.deepEqual(errors,[]);assert.equal(c.paletteLibraryId,'gameboy');assert.equal(c.history.undoStack.length,1);
 validateDocument(c.doc);assert.ok(c.doc.transparentIndex<c.doc.palette.length);assert.equal(c.doc.frames[0].cels[0][1],0);
 c.remapPaletteIndices();assert.deepEqual(errors,[]);validateDocument(c.doc);assert.equal(c.doc.frames[0].indices[0],c.doc.frames[1].indices[0]);
 while(c.history.undoStack.length)c.doc=c.history.undo(c.doc);assert.deepEqual(c.doc.palette,before.palette);assert.deepEqual([...c.doc.frames[0].indices[0]],[257,299]);
 c.doc=c.history.redo(c.doc);validateDocument(c.doc);
});
test('palette remap remains usable after adding an animation frame',()=>{
 const doc=createDocument(2,1);doc.palette=['#00000000','#ff0000','#00ff00'];doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];convertColorMode(doc,'indexed',{palette:'current'});
 const {context:c,errors}=editor(doc);c.applyPaletteLibrary('pico8');assert.deepEqual(errors,[]);
 c.mutate(()=>addFrame(c.doc,0,true));
 c.remapPaletteIndices();assert.deepEqual(errors,[]);validateDocument(c.doc);
});
test('importing opaque indexed palettes retains their first color by adding a transparent slot',()=>{
 const doc=createDocument(2,1);doc.palette=['#00000000','#ff0000','#00ff00'];doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];convertColorMode(doc,'indexed',{palette:'current'});
 applyIndexedPalette(doc,['#ff0000','#00ff00']);
 assert.deepEqual(doc.palette,['#00000000','#ff0000','#00ff00']);assert.equal(doc.transparentIndex,0);
 assert.deepEqual([...doc.frames[0].indices[0]],[1,2]);assert.deepEqual([...doc.frames[0].cels[0]],[0xff0000ff,0x00ff00ff]);validateDocument(doc);
});
test('importing indexed palettes uses an existing transparent slot at its actual position',()=>{
 const doc=createDocument(2,1);doc.palette=['#00000000','#ff0000','#00ff00'];doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];convertColorMode(doc,'indexed',{palette:'current'});
 applyIndexedPalette(doc,['#ff0000','#00ff00','#12345600']);
 assert.equal(doc.transparentIndex,2);assert.deepEqual([...doc.frames[0].indices[0]],[0,1]);validateDocument(doc);
});
test('deleting an earlier slot remaps the original foreground index before render clamps it',()=>{
 const doc=createDocument(1,1);doc.palette=['#00000000','#ff0000','#00ff00','#0000ff'];convertColorMode(doc,'indexed',{palette:'current'});
 const {context:c,errors}=editor(doc),mutate=c.mutate;c.mutate=(...args)=>{mutate(...args);c.colorIndex=Math.min(c.colorIndex,c.doc.palette.length-1);};
 c.paletteSelection=new Set([1]);c.paletteActive=1;c.removeSelectedPaletteColors();
 assert.deepEqual(errors,[]);assert.equal(c.colorIndex,2);assert.equal(c.doc.palette[c.colorIndex],'#0000ff');validateDocument(c.doc);
});
test('deleting the foreground when only the transparent slot remains selects a valid slot',()=>{
 const doc=createDocument(1,1);doc.palette=['#00000000','#ff0000'];convertColorMode(doc,'indexed',{palette:'current'});
 const {context:c,errors}=editor(doc);c.color='#ff0000';c.colorIndex=1;c.paletteSelection=new Set([1]);c.paletteActive=1;c.removeSelectedPaletteColors();
 assert.deepEqual(errors,[]);assert.equal(c.colorIndex,0);validateDocument(c.doc);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument,colorValue} from '../src/model.js';
import {normalizeColor} from '../src/colors.js';
import {modeOf,grayPixel,convertColorMode,applyIndexedPalette} from '../src/color-modes.js';
import {parsePaletteClipboard,insertPaletteColors} from '../src/palette-clipboard.js';
import {DocumentStore} from '../src/document-manager.js';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function indexedDocument(name){
 const doc=createDocument(2,1,name);
 doc.palette=['#00000000','#ff0000ff','#00ff00ff'];
 doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
 convertColorMode(doc,'indexed',{palette:'current'});
 return doc;
}
function paletteEditor(){
 let resolve,reject;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no;}),messages=[],errors=[];
 const context={documentId:'a',doc:indexedDocument('A'),paletteActive:1,paletteSelection:new Set([1]),paletteRemap:null,dirty:false,mutations:0,
  navigator:{clipboard:{readText:()=>pending}},normalizeColor,colorValue,modeOf,grayPixel,applyIndexedPalette,parsePaletteClipboard,insertPaletteColors,
  syncRemapButton:()=>{},message:text=>messages.push(text),showError:text=>errors.push(text)};
 context.documentTabs=new DocumentStore();context.documentTabs.add({documentId:'a',doc:context.doc,dirty:false});
 context.mutate=change=>{change();context.dirty=true;context.mutations++;};
 vm.createContext(context);
 vm.runInContext(section('function paletteRemapSources(','function remapPaletteIndices(')+'\n'+section('function setPaletteColor(','function insertPaletteColor(')+'\n'+section('async function pastePaletteColorAfterSelection(','async function copyPaletteValue(')+'\n'+section('async function pastePaletteValue(','function closeContextMenu('),context);
 return{context,resolve,reject,messages,errors};
}
for(const action of ['pastePaletteColorAfterSelection','pastePaletteValue']){
 test(`${action} 正常粘贴修改原文档并保持索引像素一致`,async()=>{
  const {context,resolve,errors}=paletteEditor(),pasting=context[action](1);
  resolve('  #0000ff  ');await pasting;
  assert.deepEqual(errors,[]);assert.equal(context.dirty,true);assert.equal(context.mutations,1);
  if(action==='pastePaletteValue'){
   assert.equal(context.doc.palette[1],'#0000ff');
   assert.deepEqual(context.doc.frames[0].indices[0],[1,2]);
   assert.deepEqual(context.doc.frames[0].cels[0],[0x0000ffff,0x00ff00ff]);
  }else{
   assert.equal(context.doc.palette[2],'#0000ff');
   assert.deepEqual(context.doc.frames[0].indices[0],[1,3]);
   assert.deepEqual(context.doc.frames[0].cels[0],[0xff0000ff,0x00ff00ff]);
  }
 });
 for(const transition of ['切换标签','关闭发起标签'])test(`${action} 读取期间${transition}不修改任何文档`,async()=>{
  const {context,resolve,messages,errors}=paletteEditor(),original=context.doc,before=structuredClone(original);
  const pasting=context[action](1);
  context.documentId='b';context.doc=indexedDocument('B');
  context.documentTabs.add({documentId:'b',doc:context.doc,dirty:false});
  if(transition==='关闭发起标签')context.documentTabs.remove('a');
  const current=context.doc,currentBefore=structuredClone(current);
  resolve('#0000ff');await pasting;
  assert.deepEqual(original,before);assert.deepEqual(current,currentBefore);
  assert.equal(context.dirty,false);assert.equal(context.mutations,0);assert.deepEqual(errors,[]);
  assert.ok(messages.some(text=>text.includes('重新粘贴')));
 });
 test(`${action} 剪贴板读取失败不改色板、像素或未保存状态`,async()=>{
  const {context,reject,errors}=paletteEditor(),before=structuredClone(context.doc),pasting=context[action](1);
  reject(new Error('clipboard denied'));await pasting;
  assert.deepEqual(context.doc,before);assert.equal(context.dirty,false);assert.equal(context.mutations,0);
  assert.equal(errors.length,1);assert.match(errors[0],/clipboard denied/);
 });
}

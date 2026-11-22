import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,validateDocument,colorValue,copyRegion,pasteRegion,addFrame} from '../src/model.js';
import {convertColorMode,applyIndexedPalette,createMapper,validateColorMode,asepriteMode} from '../src/color-modes.js';
import {selectionFrom} from '../src/selection-mask.js';
import {parsePalette,extractPalette} from '../src/colors.js';
import {encodePalette,decodePalette,paletteFromPixels} from '../src/palette-file.js';
import {savePaletteToLibrary,paletteById,setPalettePreset,palettePreset} from '../src/palette-library.js';
import {insertPaletteColors} from '../src/palette-clipboard.js';
import {History} from '../src/history.js';
import {snapshotCel} from '../src/history.js';
import {prepareDocumentPixels,documentJSON,releaseIndexedCaches} from '../src/pixel-storage.js';
import {linkCels} from '../src/cel-links.js';
import {snapshotDocument,snapshotMessage} from '../src/document-snapshot.js';
import {packProjectSave,unpackProjectReadPacket} from '../src/project-transfer.js';
import {packDocumentWire,unpackDocumentWire} from '../src/document-wire.js';
import {prepareRotSprite} from '../src/rotsprite.js';
import {readAseprite,writeAseprite} from './helpers/aseprite.js';

const colors=count=>Array.from({length:count},(_,i)=>'#'+i.toString(16).padStart(6,'0'));
test('deleting a high palette slot remaps from original colors with cold caches and linked cels',()=>{
 for(const linked of [false,true]){
  let doc=createDocument(2,1);doc.palette=['#00000000','#00ff00',...Array(255).fill('#000000'),'#ff0000'];doc.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
  convertColorMode(doc,'indexed',{palette:'current'});assert.deepEqual(doc.frames[0].indices[0],[257,1]);
  if(linked){addFrame(doc,0,true);linkCels(doc,0,[0,1]);}
  prepareDocumentPixels(doc);releaseIndexedCaches(doc);
  const before=snapshotDocument(doc),history=new History();
  applyIndexedPalette(doc,doc.palette.slice(0,-1),doc.palette.slice(0,-1).map((_,i)=>i));
  for(const frame of doc.frames){assert.deepEqual([...frame.indices[0]],[2,1]);assert.deepEqual([...frame.cels[0]],[0x000000ff,0x00ff00ff]);}
  history.push(before,doc,{colorsReady:true});validateDocument(doc);
  doc=history.undo(doc);assert.deepEqual([...doc.frames[0].indices[0]],[257,1]);assert.equal(doc.palette.length,258);
  doc=history.redo(doc);assert.deepEqual([...doc.frames[0].indices[0]],[2,1]);assert.equal(doc.palette.length,257);validateDocument(doc);
  if(linked)assert.equal(doc.frames[0].indices[0],doc.frames[1].indices[0]);
 }
});
test('large project palettes preserve all ordered slots in every color mode',()=>{
 for(const mode of ['rgba','grayscale','indexed']){
  const doc=createDocument(2,1);doc.palette=['#00000000',...colors(300)];
  if(mode!=='rgba')convertColorMode(doc,mode,{palette:'current'});
  assert.equal(doc.palette.length,301);
  assert.deepEqual(validateDocument(doc).palette,doc.palette);
 }
});
test('binary palette roundtrip uses a wide count beyond u16 and retains legacy reads',()=>{
 for(const count of [263,17000,65537]){
  const palette=colors(count),bytes=encodePalette(palette);
  assert.deepEqual(decodePalette(bytes),palette);
  assert.throws(()=>decodePalette(bytes.subarray(0,bytes.length-1)),/长度/);
 }
 const legacy=Uint8Array.of(77,80,73,88,80,65,76,0,1,0,1,0,18,52,86,128);
 assert.deepEqual(decodePalette(legacy),['#12345680']);
});
test('large palettes survive clipboard text image extraction and library storage',()=>{
 const palette=colors(17000),store=new Map();
 globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))};
 const saved=savePaletteToLibrary('large',palette);
 assert.deepEqual(paletteById(saved.id).colors,palette.map(c=>c.toUpperCase()));
 setPalettePreset(palette);assert.deepEqual(palettePreset().colors,palette);
 assert.deepEqual(parsePalette(JSON.stringify(palette)),palette);
 const inserted=insertPaletteColors(palette,0,['#123456','#12345680']);
 assert.equal(inserted.palette.length,17002);assert.equal(inserted.dropped,0);
 const rgba=Uint8Array.from(colors(300).flatMap(color=>{const n=colorValue(color);return[n>>>24,n>>>16&255,n>>>8&255,n&255];}));
 assert.equal(paletteFromPixels(rgba).length,300);assert.equal(extractPalette(rgba).length,300);
});
test('indexed mapping supports indices beyond 255 without byte truncation even when extra slots match exactly',()=>{
 const doc=createDocument(2,1);doc.palette=['#00000000',...Array(255).fill('#000000'),'#ff0000'];
 convertColorMode(doc,'indexed',{palette:'current'});
 assert.equal(doc.palette.length,257);
 const mapped=createMapper(doc,doc.layers[0])(0xff0000ff,0,0,256);
 assert.equal(mapped.index,256);assert.equal(mapped.color,0xff0000ff);
 // Raw ordinary indices must be rejected before converting to Uint16Array.
 doc.frames[0].indices[0]=[65536,0];doc.frames[0].cels[0]=[0xff0000ff,0];
 assert.throws(()=>validateColorMode(doc),/索引像素越界/);
 assert.throws(()=>validateDocument(doc),/索引像素越界/);
 doc.transparentIndex=65536;assert.throws(()=>validateColorMode(doc),/透明索引/);
});
function highIndexed(){
 const doc=createDocument(3,1,'wide-index');doc.palette=colors(65537);doc.colorMode='indexed';doc.transparentIndex=65535;doc.requiredFeatures=['color-modes','indexed-16'];
 doc.frames[0].indices=[[255,256,65535]];doc.frames[0].cels=[doc.frames[0].indices[0].map(index=>index===65535?0:colorValue(doc.palette[index]))];
 return doc;
}
test('16-bit storage snapshots transfer window migration and RotSprite preserve index boundaries',()=>{
 const doc=prepareDocumentPixels(highIndexed());validateDocument(doc);assert.ok(doc.frames[0].indices[0] instanceof Uint16Array);
 const snapshot=snapshotDocument(doc);assert.deepEqual([...snapshot.frames[0].indices[0]],[255,256,65535]);assert.notEqual(snapshot.frames[0].indices[0].buffer,doc.frames[0].indices[0].buffer);
 const message=snapshotMessage(snapshot),moved=structuredClone(message.document,{transfer:message.transfer});prepareDocumentPixels(moved);
 assert.deepEqual([...moved.frames[0].indices[0]],[255,256,65535]);assert.equal(doc.frames[0].indices[0].length,3);
 const wire=packProjectSave(moved,'wide');wire.set(new TextEncoder().encode('MPXREAD1'));
 const restored=unpackProjectReadPacket(wire,{typed:true}).document;assert.deepEqual([...restored.frames[0].indices[0]],[255,256,65535]);validateDocument(restored);
 const migrated=unpackDocumentWire(packDocumentWire(doc));assert.deepEqual([...migrated.frames[0].indices[0]],[255,256,65535]);validateDocument(migrated);
 const rotated=prepareRotSprite({w:3,h:1,data:[0,0,0],indexed:{data:[255,256,65535]}});assert.ok(rotated.data instanceof Uint16Array);assert.ok(rotated.data.includes(256)&&rotated.data.includes(65535));
});
test('16-bit history deltas and structural snapshots preserve high indices and transparent slots',()=>{
 let doc=prepareDocumentPixels(highIndexed());const history=new History(),before=snapshotCel(doc,0,0);
 doc.frames[0].indices[0][0]=65534;doc.frames[0].cels[0][0]=colorValue(doc.palette[65534]);history.push(before,doc,{colorsReady:true});
 doc=history.undo(doc);assert.deepEqual([...doc.frames[0].indices[0]],[255,256,65535]);
 doc=history.redo(doc);assert.equal(doc.frames[0].indices[0][0],65534);validateColorMode(doc);
 const structural=snapshotDocument(doc);doc.width=4;doc.frames[0].indices[0]=Uint16Array.of(65534,256,65535,65535);doc.frames[0].cels[0]=Uint32Array.of(colorValue(doc.palette[65534]),colorValue(doc.palette[256]),0,0);history.push(structural,doc,{colorsReady:true});
 doc=history.undo(doc);assert.equal(doc.width,3);assert.equal(doc.frames[0].indices[0][0],65534);validateDocument(doc);
});
test('irregular cross-document paste keeps high duplicate slots, transparent holes and destination pixels',()=>{
 const source=prepareDocumentPixels(highIndexed()),target=prepareDocumentPixels(highIndexed());
 source.palette[65534]=source.palette[256];target.palette[65534]=target.palette[256];source.frames[0].indices[0][0]=65534;
 const selection=selectionFrom(source,x=>x!==1),region=copyRegion(source,source.frames[0].cels[0],selection);
 target.frames[0].indices[0].fill(256);target.frames[0].cels[0].fill(colorValue(target.palette[256]));
 pasteRegion(target,target.frames[0].cels[0],region,0,0,null,true);
 assert.deepEqual([...target.frames[0].indices[0]],[65534,256,65535]);validateColorMode(target);
});
test('ASE converts high indices and high transparent slots to RGBA while preserving complete palette and source',async()=>{
 const doc=highIndexed(),before=documentJSON(doc),bytes=await writeAseprite(doc),{doc:next}=await readAseprite(bytes);
 assert.equal(asepriteMode(doc),'rgba');
 assert.equal(bytes.readUInt16LE(12),32);assert.equal(next.colorMode,undefined);assert.equal(next.palette.length,65537);
 assert.deepEqual(next.palette.map(colorValue),doc.palette.map(colorValue));assert.deepEqual(Array.from(next.frames[0].cels[0]),doc.frames[0].cels[0]);assert.equal(documentJSON(doc),before);
});
test('large indexed palette edits and cross-boundary reorder keep valid indices through undo',()=>{
 const doc=createDocument(2,1);doc.palette=['#00000000','#ff0000',...Array(298).fill('#000000')];doc.frames[0].cels[0]=[0xff0000ff,0];
 convertColorMode(doc,'indexed',{palette:'current'});
 const history=new History(),before=structuredClone(doc),origins=doc.palette.map((_,i)=>i);
 const palette=[...doc.palette];palette[270]='#12345680';applyIndexedPalette(doc,palette,origins);
 history.push(before,doc,{colorsReady:true});assert.equal(doc.palette[270],'#12345680');assert.equal(doc.palette.length,300);
 const undo=history.undo(doc);assert.deepEqual(undo.palette,before.palette);
 const redo=history.redo(undo);assert.equal(redo.palette[270],'#12345680');
 const moved=redo.palette.map((color,i)=>({color,i}));moved.splice(270,0,moved.splice(1,1)[0]);
 applyIndexedPalette(redo,moved.map(item=>item.color),moved.map(item=>item.i));
 assert.equal(redo.palette.length,300);assert.ok(redo.frames[0].indices[0].every(index=>index<65536));validateColorMode(redo);validateDocument(redo);
});
test('ASE roundtrip preserves complete large palettes in all pixel modes',async()=>{
 for(const mode of ['rgba','grayscale','indexed']){
  const doc=createDocument(2,1,'large');doc.palette=['#00000000',...colors(300)];
  if(mode!=='rgba')convertColorMode(doc,mode,{palette:'current'});
  const bytes=await writeAseprite(doc),{doc:next,warnings}=await readAseprite(bytes);
  assert.equal(asepriteMode(doc),mode);
  assert.equal(next.palette.length,301);assert.deepEqual(next.palette.map(colorValue),doc.palette.map(colorValue));assert.deepEqual(warnings,[]);
  assert.deepEqual(Array.from(next.frames[0].cels[0]),Array.from(doc.frames[0].cels[0]));
 }
});

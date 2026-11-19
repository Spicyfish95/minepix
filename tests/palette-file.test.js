import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {encodePalette,decodePalette,isPaletteFile,asepritePalette,adobePalette,palPalette,paletteFromPixels,importPaletteFile,paletteBytes,paletteBase64} from '../src/palette-file.js';
import {BRIGHT24} from '../src/builtin-palette.js';

test('PIX binary roundtrip preserves slot order, duplicates and alpha',()=>{
 const colors=['#12345678','#00000000','#abcdef','#12345678'];
 const bytes=encodePalette(colors);
 assert.ok(isPaletteFile(bytes));assert.equal(bytes.length,28);
 assert.deepEqual(decodePalette(bytes),colors);
 assert.deepEqual(paletteBytes(paletteBase64(bytes)),bytes);
 assert.throws(()=>decodePalette(bytes.subarray(0,27)),/长度/);
 const bad=bytes.slice();bad[8]=3;assert.throws(()=>decodePalette(bad),/不支持/);
 assert.throws(()=>encodePalette([]),/至少需要/);
 assert.equal(decodePalette(encodePalette(Array(257).fill('#000000'))).length,257);
});

test('workspace lost-century Adobe ASE imports its actual palette',async()=>{
 const bytes=new Uint8Array(await readFile(new URL('./fixtures/palettes/lost-century.ase',import.meta.url)));
 const colors=adobePalette(bytes);
 assert.equal(colors.length,16);
 assert.equal(colors[0],'#d1b187');
 assert.deepEqual(await importPaletteFile('lost-century.ase',bytes),colors);
 assert.throws(()=>adobePalette(bytes.subarray(0,150)),/不完整/);
});

test('Aseprite modern and legacy palette chunks import first frame colors',async()=>{
 for(const modern of [true,false]){
  const bytes=new Uint8Array(modern?182:160),view=new DataView(bytes.buffer);
  view.setUint32(0,bytes.length,true);view.setUint16(4,0xa5e0,true);view.setUint16(6,1,true);
  view.setUint32(128,bytes.length-128,true);view.setUint16(132,0xf1fa,true);view.setUint16(134,1,true);
  view.setUint32(144,bytes.length-144,true);view.setUint16(148,modern?0x2019:4,true);
  if(modern){
   view.setUint32(150,2,true);view.setUint32(158,1,true);
   bytes.set([0,0,255,0,0,128,0,0,0,255,0,255],170);
  }else bytes.set([1,0,0,2,255,0,0,0,255,0],150);
  const colors=await importPaletteFile('test.aseprite',bytes);
  assert.deepEqual(colors,modern?['#ff000080','#00ff00']:['#ff0000','#00ff00']);
  assert.throws(()=>asepritePalette(bytes.subarray(0,150)),/不完整/);
 }
});

test('JASC and RIFF PAL preserve ordered slots',()=>{
 assert.deepEqual(palPalette(new TextEncoder().encode('JASC-PAL\r\n0100\r\n2\r\n255 0 0\r\n0 128 255\r\n')),['#ff0000','#0080ff']);
 const bytes=new Uint8Array(32),view=new DataView(bytes.buffer);
 bytes.set(new TextEncoder().encode('RIFF'));view.setUint32(4,24,true);
 bytes.set(new TextEncoder().encode('PAL data'),8);view.setUint32(16,12,true);view.setUint16(20,0x300,true);view.setUint16(22,2,true);
 bytes.set([255,0,0,0,0,128,255,0],24);
 assert.deepEqual(palPalette(bytes),['#ff0000','#0080ff']);
 assert.throws(()=>palPalette(new TextEncoder().encode('JASC-PAL\n0100\n1\n256 0 0')),/超出/);
});

test('GPL import and image color order retain alpha',async()=>{
 assert.deepEqual(await importPaletteFile('test.gpl',new TextEncoder().encode('GIMP Palette\nName: sample\n255 0 0 Red\n0 128 255 Blue')),['#ff0000','#0080ff']);
 assert.deepEqual(paletteFromPixels(Uint8Array.of(0,0,0,0,255,0,0,128,0,0,0,0)),['#00000000','#ff000080']);
 assert.equal(BRIGHT24.length,24);
 assert.equal(BRIGHT24[23],'#433455');
 await assert.rejects(importPaletteFile('project.pix',Uint8Array.of(1,2,3)),/不是色板/);
});

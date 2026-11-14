import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import omggif from 'omggif';
import { createDocument, addFrame } from '../src/model.js';
import { animationIndices, rgbaPixels, decodeGif, gifInfo } from '../src/formats/animation.js';
const {GifReader}=omggif;
const rgba=values=>Uint8Array.from(values);
test('independent GIF fixture includes partial frames and restore-previous/background disposal',async()=>{
  const reader=new GifReader(await fs.readFile(new URL('./fixtures/gif-disposal.gif',import.meta.url))),expected=JSON.parse(await fs.readFile(new URL('./fixtures/gif-disposal.expected.json',import.meta.url),'utf8'));
  assert.deepEqual(Array.from({length:reader.numFrames()},(_,i)=>reader.frameInfo(i).disposal),[1,3,2,1]);assert.equal(reader.frameInfo(1).x,1);assert.equal(reader.frameInfo(1).width,2);assert.equal(expected.frames.length,4);
  const bytes=new Uint8Array(await fs.readFile(new URL('./fixtures/gif-disposal.gif',import.meta.url)));assert.deepEqual(gifInfo(bytes).delays,[40,60,80,100]);const control=bytes.findIndex((value,i)=>value===0x21&&bytes[i+1]===0xf9);bytes[control+4]=1;bytes[control+5]=0;assert.equal(gifInfo(bytes).delays[0],10);assert.throws(()=>gifInfo(bytes.subarray(0,bytes.length-1)),/结束/);
});
test('animation scopes honor tag direction and RGBA packing is unsigned',async()=>{
  const doc=createDocument(1,1);addFrame(doc,0);addFrame(doc,1);doc.tags=[{id:'walk',from:0,to:2,direction:'reverse'}];
  assert.deepEqual(animationIndices(doc,'walk',new Set([1]),'tag'),[2,1,0]);assert.deepEqual(animationIndices(doc,'all',new Set([1]),'pingpong'),[0,1,2,1]);assert.deepEqual(rgbaPixels(rgba([255,0,0,128])),[0xff000080]);
  await assert.rejects(decodeGif(new Uint8Array(13),'bad.gif'),/有效/);
});

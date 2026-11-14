import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAnimatedWebp} from '../src/export-formats.js';

// Container-only fixture: payload bytes are markers, not a decodable VP8 stream.
function chunk(type,data){const body=Buffer.from(data),header=Buffer.alloc(8);header.write(type);header.writeUInt32LE(body.length,4);return Buffer.concat([header,body,...(body.length%2?[Buffer.alloc(1)]:[])]);}
function staticWebp(parts){const data=Buffer.concat([Buffer.from('WEBP'),...parts]),header=Buffer.alloc(8);header.write('RIFF');header.writeUInt32LE(data.length,4);return Buffer.concat([header,data]).toString('base64');}
function chunks(bytes,start=12){const result=[];for(let at=start;at<bytes.length;){const type=bytes.toString('ascii',at,at+4),size=bytes.readUInt32LE(at+4);result.push({type,data:bytes.subarray(at+8,at+8+size)});at+=8+size+(size&1);}return result;}
const rgb=staticWebp([chunk('VP8 ',[1,2,3,4])]),transparent=staticWebp([chunk('VP8L',[5,6,7])]);

test('动画WebP完整帧使用no-blend覆盖，透明帧也不叠加旧画面',()=>{
 const bytes=Buffer.from(encodeAnimatedWebp([{duration:40,webp:rgb},{duration:70,webp:transparent}],4,2),'base64'),frames=chunks(bytes).filter(part=>part.type==='ANMF');
 assert.equal(frames.length,2);
 for(const frame of frames){assert.equal(frame.data[15],2);assert.equal(frame.data.readUIntLE(0,3),0);assert.equal(frame.data.readUIntLE(3,3),0);assert.equal(frame.data.readUIntLE(6,3),3);assert.equal(frame.data.readUIntLE(9,3),1);}
 assert.deepEqual(frames.map(frame=>frame.data.readUIntLE(12,3)),[40,70]);
});

test('动画WebP保留RIFF尺寸、循环和各帧静态子块',()=>{
 const alpha=staticWebp([chunk('VP8X',Array(10).fill(0)),chunk('ALPH',[9,8,7]),chunk('VP8 ',[6,5,4,3])]);
 for(const loop of [false,true]){
  const bytes=Buffer.from(encodeAnimatedWebp([{duration:110,webp:alpha},{duration:50,webp:transparent}],4,2,loop),'base64'),parts=chunks(bytes);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt32LE(4),bytes.length-8);
  assert.deepEqual(parts.map(part=>part.type),['VP8X','ANIM','ANMF','ANMF']);assert.equal(parts[0].data[0]&2,2);
  assert.equal(parts[1].data.readUInt16LE(4),loop?0:1);
  assert.deepEqual(chunks(parts[2].data,16),[{type:'ALPH',data:Buffer.from([9,8,7])},{type:'VP8 ',data:Buffer.from([6,5,4,3])}]);
  assert.deepEqual(chunks(parts[3].data,16),[{type:'VP8L',data:Buffer.from([5,6,7])}]);
 }
});

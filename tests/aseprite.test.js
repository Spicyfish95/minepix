import {celPixels,celProperty} from '../src/cel-properties.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {readAseprite,writeAseprite} from './helpers/aseprite.js';
const fixture=()=>fs.readFile(new URL('./fixtures/rgba-linked.aseprite',import.meta.url));
test('独立 ASE 样例保留 RGBA、层属性、时长、标签与 Slice',async()=>{const {doc,warnings}=await readAseprite(await fixture(),'Sample');assert.equal(doc.width,2);assert.equal(doc.layers.length,2);assert.equal(doc.layers[1].locked,true);assert.equal(doc.layers[1].opacity,128*100/255);assert.deepEqual(doc.frames.map(f=>f.duration),[60,120]);assert.equal(doc.frames[0].cels[0][0],0xff0000ff);assert.equal(doc.frames[0].cels[0][2],0x0000ff80);assert.equal(doc.tags[0].direction,'reverse');assert.equal(doc.slices[0].center.w,1);assert.deepEqual(warnings,[]);});
test('链接 cel 保留独立位置且继续共享原始图像',async()=>{const {doc}=await readAseprite(await fixture());assert.equal(celPixels(doc,1,0)[1],0xff0000ff);assert.equal(celPixels(doc,1,0)[3],0x0000ff80);assert.equal(doc.frames[0].cels[0],doc.frames[1].cels[0]);});
test('拒绝未知深度、截断和超出32M容量的画布，并接受大于512边长',async()=>{const b=await fixture();const indexed=Buffer.from(b);indexed.writeUInt16LE(24,12);await assert.rejects(readAseprite(indexed),/RGBA/);await assert.rejects(readAseprite(b.subarray(0,b.length-1)),/完整/);const big=Buffer.from(b);big.writeUInt16LE(65535,8);big.writeUInt16LE(65535,10);await assert.rejects(readAseprite(big),/32M/);const wide=Buffer.from(b);wide.writeUInt16LE(513,8);assert.equal((await readAseprite(wide)).doc.width,513);});
import {createDocument,addLayer,addFrame,colorValue} from '../src/model.js';
import {deflateSync,inflateSync} from 'node:zlib';

function tilemapFixture({depth=32,values=[1,0x80000001,0x40000001,0x20000001,0],flags=6,linked=false}={}){
 const chunk=(type,data)=>{const header=Buffer.alloc(6);header.writeUInt32LE(data.length+6);header.writeUInt16LE(type,4);return Buffer.concat([header,data]);};
 const layer=Buffer.alloc(24);layer.writeUInt16LE(3);layer.writeUInt16LE(2,2);layer[12]=128;layer.writeUInt16LE(2,16);layer.write('TM',18);layer.writeUInt32LE(7,20);
 const set=Buffer.alloc(34);set.writeUInt32LE(7);set.writeUInt32LE(flags,4);set.writeUInt32LE(2,8);set.writeUInt16LE(2,12);set.writeUInt16LE(2,14);set.writeInt16LE(10,16);
 const pixels=depth===8?Buffer.from([0,0,0,0,1,2,3,4]):Buffer.from([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 const compressed=deflateSync(pixels),size=Buffer.alloc(4);size.writeUInt32LE(compressed.length);
 const cel=Buffer.alloc(48);cel.writeInt16LE(1,2);cel[6]=255;cel.writeUInt16LE(3,7);cel.writeUInt16LE(values.length,16);cel.writeUInt16LE(1,18);cel.writeUInt16LE(32,20);[0x1fffffff,0x80000000,0x40000000,0x20000000].forEach((v,i)=>cel.writeUInt32LE(v,22+i*4));
 const tiles=Buffer.alloc(values.length*4);values.forEach((v,i)=>tiles.writeUInt32LE(v,i*4));
 const palette=Buffer.from([1,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,63,0,0,0,63,0,0,0,63,63,63,63]);
 const frame=chunks=>{const body=Buffer.concat(chunks),head=Buffer.alloc(16);head.writeUInt32LE(body.length+16);head.writeUInt16LE(0xf1fa,4);head.writeUInt16LE(chunks.length,6);head.writeUInt16LE(100,8);return Buffer.concat([head,body]);};
 const frames=[frame([chunk(0x2004,layer),chunk(0x2023,Buffer.concat([set,size,compressed])),...(depth===8?[chunk(17,palette)]:[]),chunk(0x2005,Buffer.concat([cel,deflateSync(tiles)]))])];
 if(linked){const link=Buffer.alloc(18);link[6]=255;link.writeUInt16LE(1,7);frames.push(frame([chunk(0x2005,link)]));}
 const header=Buffer.alloc(128);header.writeUInt16LE(0xa5e0,4);header.writeUInt16LE(frames.length,6);header.writeUInt16LE(values.length*2+1,8);header.writeUInt16LE(2,10);header.writeUInt16LE(depth,12);header.writeUInt32LE(1,14);header.writeUInt16LE(5,32);const output=Buffer.concat([header,...frames]);output.writeUInt32LE(output.length);return output;
}

test('tilemap 打开铺回普通图层，保留翻转、偏移、空瓦片、透明度与链接帧',async()=>{
 const {doc,warnings}=await readAseprite(tilemapFixture({linked:true}));
 assert.equal(doc.layers[0].type,undefined);assert.equal(doc.layers[0].opacity,128*100/255);assert.match(warnings.join(''),/普通像素图层/);
 const [r,g,b,w]=[0xff0000ff,0x00ff00ff,0x0000ffff,0xffffffff];
 assert.deepEqual(doc.frames[0].cels[0],[0,r,g,g,r,b,w,r,b,0,0,0,b,w,w,b,r,g,g,w,0,0]);
 assert.deepEqual(doc.frames[1].cels[0],[r,g,g,r,b,w,r,b,0,0,0,b,w,w,b,r,g,g,w,0,0,0]);
});

test('tilemap 拒绝缺失外部瓦片、越界编号及损坏压缩数据',async()=>{
 await assert.rejects(readAseprite(tilemapFixture({flags:1})),/外部瓦片集/);
 await assert.rejects(readAseprite(tilemapFixture({values:[99]})),/越界瓦片/);
 const broken=tilemapFixture();broken[broken.length-1]^=255;await assert.rejects(readAseprite(broken));
});

test('grass.ase 索引色内嵌瓦片实际打开，全部像素与瓦片集独立展开一致',async()=>{
 const bytes=await fs.readFile(new URL('./fixtures/grass.ase',import.meta.url)),{doc}=await readAseprite(bytes,'grass');
 assert.deepEqual([doc.width,doc.height,doc.layers.length,doc.colorMode],[128,128,2,'indexed']);
 const sets=new Map();let cel;
 for(let p=144;p<bytes.length;){const size=bytes.readUInt32LE(p),type=bytes.readUInt16LE(p+4),data=bytes.subarray(p+6,p+size);if(type===0x2023){const nameLength=data.readUInt16LE(32);sets.set(data.readUInt32LE(0),inflateSync(data.subarray(38+nameLength)));}if(type===0x2005&&data.readUInt16LE(0)===1)cel=inflateSync(data.subarray(48));p+=size;}
 const source=sets.get(1),expected=new Array(128*128).fill(doc.transparentIndex);
 for(let ty=0;ty<4;ty++)for(let tx=0;tx<4;tx++){const tile=cel.readUInt32LE((ty*4+tx)*4);assert.ok(tile<16);if(tile)for(let y=0;y<32;y++)for(let x=0;x<32;x++)expected[(ty*32+y)*128+tx*32+x]=source[(tile*32+y)*32+x];}
 assert.deepEqual(doc.frames[0].indices[1],expected);assert.equal(doc.frames[0].cels[1].filter(p=>p&255).length,9086);
});
test('ASE 写出后恢复所有 cel 像素、可见性、锁定、色板与元数据',async()=>{const doc=createDocument(3,2,'Export');doc.frames[0].cels[0][0]=colorValue('#11223380');addLayer(doc,0);doc.layers[1].visible=false;doc.layers[1].locked=true;doc.layers[1].opacity=128*100/255;addFrame(doc,0,true);doc.frames[1].duration=80;doc.tags=[{id:'walk',name:'Walk',from:0,to:1,color:'#123456',direction:'reverse'}];doc.slices=[{id:'s',name:'Body',bounds:{x:0,y:0,w:2,h:2},pivot:{x:1,y:1}}];const bytes=await writeAseprite(doc),next=await readAseprite(bytes);assert.equal(bytes.readUInt16LE(4),0xa5e0);assert.deepEqual(next.doc.frames,doc.frames);assert.deepEqual(next.doc.layers,doc.layers);assert.deepEqual(next.doc.palette,doc.palette.map(c=>c+'ff'));assert.equal(next.doc.tags[0].color,'#123456');assert.deepEqual(next.doc.slices[0].pivot,{x:1,y:1});});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {packProjectSave,unpackProjectRead,openedProject} from '../src/project-transfer.js';
import {createDocument,addFrame} from '../src/model.js';
import {linkCels} from '../src/cel-links.js';

function unpack(bytes){
 assert.equal(new TextDecoder().decode(bytes.subarray(0,8)),'MPXSAVE1');
 const length=new DataView(bytes.buffer,bytes.byteOffset).getUint32(8,true);
 const metadata=JSON.parse(new TextDecoder().decode(bytes.subarray(12,12+length)));
 let offset=12+length;
 for(const block of metadata.blocks){
  const size=block.count*(block.kind==='u32'?4:1),raw=bytes.subarray(offset,offset+size);offset+=size;
  const parts=block.path.slice(1).split('/');let parent=metadata.document;for(const key of parts.slice(0,-1))parent=parent[key];
  parent[parts.at(-1)]=block.kind==='u32'?Array.from({length:block.count},(_,i)=>new DataView(raw.buffer,raw.byteOffset,raw.byteLength).getUint32(i*4,true)):block.kind==='u8'?[...raw]:btoa(String.fromCharCode(...raw));
 }
 assert.equal(offset,bytes.length);
 return metadata;
}

test('原始保存字节保留u32索引边界、空cel、参考和未知元数据',()=>{
 const document={format:'pixel-studio',width:2,height:1,frames:[{duration:75,cels:[null,[],[0,0xffffffff,0x11223344]],indices:[null,[],[0,255]],custom:{data:'保留'}}],references:[{data:'AQIDBA==',note:'参考'}, {data:'',note:'空'}],custom:{cels:[1,2]}};
 const original=JSON.stringify(document),wire=packProjectSave(original,'中文 保存',true),restored=unpack(wire);
 assert.deepEqual(restored.document,document);assert.equal(restored.name,'中文 保存');assert.equal(restored.saveAs,true);assert.equal(JSON.stringify(document),original);
 assert.equal(restored.blocks.length,6);
});

test('可选payload字段null、缺省和空frames保留',()=>{
 for(const document of [{format:'pixel-studio',frames:[{cels:null,indices:[]},{cels:[],custom:42}],references:null},{format:'pixel-studio',frames:[]}]){
  const wire=unpack(packProjectSave(JSON.stringify(document),'test'));
  assert.deepEqual(wire.document,document);assert.equal(wire.saveAs,false);
 }
});

test('非法数字不通过typed-array静默截断',()=>{
 for(const [field,pixel]of [['cels',-1],['cels',4294967296],['cels',1.5],['cels',null],['cels','1'],['indices',256],['indices',-1]]){
  assert.throws(()=>packProjectSave(JSON.stringify({format:'pixel-studio',frames:[{[field]:[[pixel]]}]}),'invalid'),/像素/);
 }
 for(const payload of [1,{},'pixels'])assert.throws(()=>packProjectSave(JSON.stringify({format:'pixel-studio',frames:[{cels:payload}]}),'invalid'),/cel/);
 assert.throws(()=>packProjectSave('{"format":"other","frames":[]}','invalid'));
 assert.throws(()=>packProjectSave('{"format":"pixel-studio","frames":[],"references":[{"data":"%%%"}]}','invalid'));
});

test('大块重复像素使用定长原始字节而不保留数字JSON',()=>{
 const document={format:'pixel-studio',frames:[{cels:[Array(65536).fill(0xff8844ff)]}]},json=JSON.stringify(document),wire=packProjectSave(json,'large');
 assert.ok(wire.length<json.length/2);assert.deepEqual(unpack(wire).document,document);
});

test('直接文档打包与字符串字节相同，不修改冻结文档或链接共享',()=>{
 const document=createDocument(2,1,'直接保存');document.frames[0].cels[0]=[0xffffffff,0x11223344];
 addFrame(document,0,true);linkCels(document,0,[0,1]);
 document.references=[{id:'reference',data:'AQIDBA==',width:1,height:1}];
 document.custom={unknown:['保留',null,{enabled:true}]};
 const original=JSON.stringify(document),pixels=document.frames[0].cels[0];
 assert.equal(document.frames[1].cels[0],pixels);
 function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}}
 freeze(document);
 const bytes=packProjectSave(document,'中文 直接',true);
 assert.deepEqual(bytes,packProjectSave(original,'中文 直接',true));
 assert.deepEqual(unpack(bytes).document,JSON.parse(original));
 assert.equal(JSON.stringify(document),original);assert.equal(document.frames[1].cels[0],pixels);
});

test('Rust真实原始读取fixture保留全部像素、索引、参考与未知元数据',()=>{
 const wire=readFileSync(new URL('./fixtures/project-transfer/read.bin',import.meta.url));
 const expected=JSON.parse(readFileSync(new URL('./fixtures/project-transfer/fixture.json',import.meta.url),'utf8'));
 const restored=unpackProjectRead(wire);
 assert.deepEqual(restored,expected);
 assert.ok(Array.isArray(restored.frames[0].cels[2]));assert.ok(Array.isArray(restored.frames[0].indices[2]));
});

test('原始读取保留可选null和空字段，较大参考使用分块Base64',()=>{
 for(const document of [{format:'pixel-studio',frames:[{cels:null,indices:[]},{cels:[null,[]]}],references:null},{format:'pixel-studio',frames:[]},{format:'pixel-studio',frames:[],references:[{data:Buffer.alloc(65537,0xaf).toString('base64')}]}]){
  const wire=packProjectSave(document,'test');wire.set(new TextEncoder().encode('MPXREAD1'));
  assert.deepEqual(unpackProjectRead(wire.buffer),document);
 }
});

test('原始读取拒绝截断、额外像素和重复或越界映射',()=>{
 function wire(metadata,payload=[1,2,3,4]){
  const json=new TextEncoder().encode(JSON.stringify(metadata)),bytes=new Uint8Array(12+json.length+payload.length);
  bytes.set(new TextEncoder().encode('MPXREAD1'));new DataView(bytes.buffer).setUint32(8,json.length,true);bytes.set(json,12);bytes.set(payload,12+json.length);return bytes;
 }
 const metadata={document:{format:'pixel-studio',frames:[{cels:[null]}]},blocks:[{path:'/frames/0/cels/0',kind:'u32',count:1}]},bytes=wire(metadata);
 for(const length of [0,7,11,bytes.length-1])assert.throws(()=>unpackProjectRead(bytes.subarray(0,length)));
 const header=bytes.slice();header[0]=0;assert.throws(()=>unpackProjectRead(header));
 header.set(bytes);new DataView(header.buffer).setUint32(8,0xffffffff,true);assert.throws(()=>unpackProjectRead(header));
 assert.throws(()=>unpackProjectRead(wire(metadata,[1,2,3,4,5])));
 for(const [key,value]of [['path','/missing'],['path','/format'],['path','/frames/0/cels/1'],['path','/constructor/prototype'],['kind','u64'],['count',Number.MAX_SAFE_INTEGER],['count',-1]]){
  const invalid=structuredClone(metadata);invalid.blocks[0][key]=value;assert.throws(()=>unpackProjectRead(wire(invalid)));
 }
 const duplicate=structuredClone(metadata);duplicate.blocks.push(duplicate.blocks[0]);assert.throws(()=>unpackProjectRead(wire(duplicate,[1,2,3,4,5,6,7,8])));
});

test('正常document访问不触发惰性诊断JSON，data按需保留原接口',()=>{
 let serialized=0;
 const document={format:'pixel-studio',frames:[],toJSON(){serialized++;return{format:this.format,frames:this.frames};}};
 const file=openedProject({type:'project',name:'读取.pix',filePath:'C:/读取.pix',rawProject:true},document);
 assert.equal(file.document,document);assert.equal(serialized,0);assert.equal(file.rawProject,undefined);
 assert.equal(file.data,'{"format":"pixel-studio","frames":[]}');assert.equal(serialized,1);
});

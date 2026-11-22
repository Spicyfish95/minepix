import {prepareDocumentPixels,documentJSON,isPixelArray} from './pixel-storage.js';
import {projectForSave} from './reference-files.js';
const MAX_BYTES=512*1024*1024;
const littleEndian=new Uint8Array(Uint32Array.of(1).buffer)[0]===1;
const magic=new TextEncoder().encode('MPXSAVE1');
export function unpackProjectRead(input){return unpackProjectReadPacket(input).document;}
export function unpackProjectReadPacket(input,{typed=false}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<12||bytes.length-12>MAX_BYTES||new TextDecoder().decode(bytes.subarray(0,8))!=='MPXREAD1')throw new Error('项目读取传输头无效');
 const metadataEnd=12+new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true);
 if(metadataEnd>bytes.length)throw new Error('项目读取元数据截断');
 const {document,blocks,info={}}=JSON.parse(new TextDecoder().decode(bytes.subarray(12,metadataEnd)));
 if(document.format!=='pixel-studio'||!Array.isArray(blocks))throw new Error('项目读取元数据无效');
 let offset=metadataEnd;
 for(const block of blocks){
  const width=block.kind==='u32'?4:block.kind==='u16'?2:1,size=block.count*width;
  if(!Number.isSafeInteger(block.count)||block.count<0||!Number.isSafeInteger(size)||offset+size>bytes.length)throw new Error('项目读取像素截断或长度无效');
  if(typeof block.path!=='string'||!block.path.startsWith('/'))throw new Error('项目读取块映射无效');
  const parts=block.path.slice(1).split('/').map(key=>key.replaceAll('~1','/').replaceAll('~0','~'));
  let parent=document;
  for(const key of parts.slice(0,-1)){
   if(parent===null||typeof parent!=='object'||!Object.hasOwn(parent,key))throw new Error('项目读取块映射无效');
   parent=parent[key];
  }
  const key=parts.at(-1);
  if(parent===null||typeof parent!=='object'||!Object.hasOwn(parent,key)||parent[key]!==null)throw new Error('项目读取块映射重复或覆盖元数据');
  const raw=bytes.subarray(offset,offset+size);offset+=size;
  if(block.kind==='u32'){
   const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),pixels=typed?new Uint32Array(block.count):new Array(block.count);
   for(let i=0;i<pixels.length;i++)pixels[i]=view.getUint32(i*4,true);
   parent[key]=pixels;
  }else if(block.kind==='u16'){
   const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),pixels=typed?new Uint16Array(block.count):new Array(block.count);
   for(let i=0;i<pixels.length;i++)pixels[i]=view.getUint16(i*2,true);
   parent[key]=pixels;
  }else if(block.kind==='u8')parent[key]=typed?raw.slice():Array.from(raw);
  else if(block.kind==='base64'){
   let binary='';for(let i=0;i<raw.length;i+=32768)binary+=String.fromCharCode(...raw.subarray(i,i+32768));
   parent[key]=btoa(binary);
  }else throw new Error('项目读取块数据类型无效');
 }
 if(offset!==bytes.length)throw new Error('项目读取包含多余像素');
 if(typed||info.indexedSource)prepareDocumentPixels(document);
 return{document,info};
}

export function openedProject(file,document,info={}){
 const {rawProject,...result}=file;
 if(result.type==='aseprite'){result.doc=document;result.warnings=info.warnings||[];return result;}
 result.document=document;
 Object.defineProperty(result,'data',{enumerable:true,get:()=>documentJSON(document)});
 return result;
}

// Only the IPC representation changes. Rust still writes the native compressed PIX v1.
export function packProjectSave(data,name,saveAs=false,target){
 const document=projectForSave(typeof data==='string'?JSON.parse(data):data);
 if(document.format!=='pixel-studio'||!Array.isArray(document.frames))throw new Error('不是有效的 MinePix 项目');
 const blocks=[],payloads=[];let rawBytes=0;
 function add(path,kind,pixels){
  if(!isPixelArray(pixels))throw new Error('像素块不是数组');
  const width=kind==='u32'?4:2,size=pixels.length*width;
  if(rawBytes+size>MAX_BYTES)throw new Error('项目解压后超过 512 MiB');
  const native=littleEndian&&(kind==='u32'?pixels instanceof Uint32Array:pixels instanceof Uint16Array),max=kind==='u32'?0xffffffff:65535;
  if(!native)for(const pixel of pixels)if(!Number.isInteger(pixel)||pixel<0||pixel>max)throw new Error('项目像素值越界');
  rawBytes+=size;blocks.push({path,kind,count:pixels.length});payloads.push({pixels,kind,size,native});
 }
 const metadata={...document,frames:document.frames.map((frame,f)=>{
  const copy=Object.fromEntries(Object.entries(frame).filter(([key])=>key!=='cels'&&key!=='indices'));
  for(const [field,kind]of [['cels','u32'],['indices','u16']]){
   if(frame[field]===undefined)continue;
   if(frame[field]===null){copy[field]=null;continue;}
   if(!Array.isArray(frame[field]))throw new Error('项目 cel 列表无效');
   copy[field]=frame[field].map((pixels,l)=>{if(pixels!==null)add(`/frames/${f}/${field}/${l}`,kind,pixels);return null;});
  }
  return copy;
 })};
 const json=new TextEncoder().encode(JSON.stringify({document:metadata,blocks,name,saveAs,...(target?{target}:{})}));
 if(rawBytes+json.length>MAX_BYTES)throw new Error('项目解压后超过 512 MiB');
 const output=new Uint8Array(12+json.length+rawBytes);output.set(magic);new DataView(output.buffer).setUint32(8,json.length,true);output.set(json,12);
 let offset=12+json.length;const view=new DataView(output.buffer);
 for(const {pixels,kind,size,native}of payloads){
  if(native)output.set(new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength),offset);
  else for(let i=0;i<pixels.length;i++)if(kind==='u32')view.setUint32(offset+i*4,pixels[i],true);else view.setUint16(offset+i*2,pixels[i],true);
  offset+=size;
 }
 return output;
}

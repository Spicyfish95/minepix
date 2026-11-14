const MAX_BYTES=512*1024*1024;
const magic=new TextEncoder().encode('MPXSAVE1');

export function unpackProjectRead(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<12||bytes.length-12>MAX_BYTES||new TextDecoder().decode(bytes.subarray(0,8))!=='MPXREAD1')throw new Error('项目读取传输头无效');
 const metadataEnd=12+new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true);
 if(metadataEnd>bytes.length)throw new Error('项目读取元数据截断');
 const {document,blocks}=JSON.parse(new TextDecoder().decode(bytes.subarray(12,metadataEnd)));
 if(document.format!=='pixel-studio'||!Array.isArray(blocks))throw new Error('项目读取元数据无效');
 let offset=metadataEnd;
 for(const block of blocks){
  const width=block.kind==='u32'?4:1,size=block.count*width;
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
   const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),pixels=new Array(block.count);
   for(let i=0;i<pixels.length;i++)pixels[i]=view.getUint32(i*4,true);
   parent[key]=pixels;
  }else if(block.kind==='u8')parent[key]=Array.from(raw);
  else if(block.kind==='base64'){
   let binary='';for(let i=0;i<raw.length;i+=32768)binary+=String.fromCharCode(...raw.subarray(i,i+32768));
   parent[key]=btoa(binary);
  }else throw new Error('项目读取块数据类型无效');
 }
 if(offset!==bytes.length)throw new Error('项目读取包含多余像素');
 return document;
}

export function openedProject(file,document){
 const {rawProject,...result}=file;
 result.document=document;
 Object.defineProperty(result,'data',{enumerable:true,get:()=>JSON.stringify(document)});
 return result;
}

// Only the IPC representation changes. Rust still writes the native compressed PIX v1.
export function packProjectSave(data,name,saveAs=false){
 const document=typeof data==='string'?JSON.parse(data):data;
 if(document.format!=='pixel-studio'||!Array.isArray(document.frames))throw new Error('不是有效的 MinePix 项目');
 const blocks=[],payloads=[];let rawBytes=0;
 function add(path,kind,pixels){
  if(!Array.isArray(pixels))throw new Error('像素块不是数组');
  const width=kind==='u32'?4:1,size=pixels.length*width;
  if(rawBytes+size>MAX_BYTES)throw new Error('项目解压后超过 512 MiB');
  const bytes=new Uint8Array(size),view=new DataView(bytes.buffer),max=kind==='u32'?0xffffffff:255;
  for(let i=0;i<pixels.length;i++){
   const pixel=pixels[i];if(!Number.isInteger(pixel)||pixel<0||pixel>max)throw new Error('项目像素值越界');
   if(width===4)view.setUint32(i*4,pixel,true);else bytes[i]=pixel;
  }
  rawBytes+=size;blocks.push({path,kind,count:pixels.length});payloads.push(bytes);
 }
 const metadata={...document,frames:document.frames.map((frame,f)=>{
  const copy=Object.fromEntries(Object.entries(frame).filter(([key])=>key!=='cels'&&key!=='indices'));
  for(const [field,kind]of [['cels','u32'],['indices','u8']]){
   if(frame[field]===undefined)continue;
   if(frame[field]===null){copy[field]=null;continue;}
   if(!Array.isArray(frame[field]))throw new Error('项目 cel 列表无效');
   copy[field]=frame[field].map((pixels,l)=>{if(pixels!==null)add(`/frames/${f}/${field}/${l}`,kind,pixels);return null;});
  }
  return copy;
 })};
 if(Array.isArray(document.references))metadata.references=document.references.map((reference,i)=>{
  if(typeof reference.data!=='string')throw new Error('参考图片数据无效');
  const decoded=atob(reference.data),bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));rawBytes+=bytes.length;
  if(rawBytes>MAX_BYTES)throw new Error('项目解压后超过 512 MiB');
  blocks.push({path:`/references/${i}/data`,kind:'base64',count:bytes.length});payloads.push(bytes);
  return{...reference,data:null};
 });
 const json=new TextEncoder().encode(JSON.stringify({document:metadata,blocks,name,saveAs}));
 if(rawBytes+json.length>MAX_BYTES)throw new Error('项目解压后超过 512 MiB');
 const output=new Uint8Array(12+json.length+rawBytes);output.set(magic);new DataView(output.buffer).setUint32(8,json.length,true);output.set(json,12);
 let offset=12+json.length;for(const bytes of payloads){output.set(bytes,offset);offset+=bytes.length;}
 return output;
}

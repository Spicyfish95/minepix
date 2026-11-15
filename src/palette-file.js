import {normalizeColor,rgba,fromRgba,parsePalette} from './colors.js';

// PIX palette v1: eight-byte signature, u16 version/count, then ordered RGBA slots.
export const PALETTE_MAGIC=Uint8Array.of(77,80,73,88,80,65,76,0);
export const isPaletteFile=bytes=>PALETTE_MAGIC.every((value,index)=>bytes[index]===value);
function checked(colors){
 if(!colors.length||colors.length>256)throw new Error('色板需包含 1–256 个颜色');
 return colors.map(normalizeColor);
}
export function encodePalette(colors){
 colors=checked(colors);
 const bytes=new Uint8Array(12+colors.length*4),view=new DataView(bytes.buffer);
 bytes.set(PALETTE_MAGIC);view.setUint16(8,1,true);view.setUint16(10,colors.length,true);
 colors.forEach((color,index)=>{const {r,g,b,a}=rgba(color);bytes.set([r,g,b,a],12+index*4);});
 return bytes;
}
export function decodePalette(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(!isPaletteFile(bytes)||bytes.length<12||view.getUint16(8,true)!==1)throw new Error('无效或不支持的 PIX 色板');
 const count=view.getUint16(10,true);
 if(bytes.length!==12+count*4)throw new Error('PIX 色板长度无效');
 return checked(Array.from({length:count},(_,i)=>fromRgba({r:bytes[12+i*4],g:bytes[13+i*4],b:bytes[14+i*4],a:bytes[15+i*4]})));
}
export function paletteBase64(bytes){
 let text='';
 for(let at=0;at<bytes.length;at+=8192)text+=String.fromCharCode(...bytes.subarray(at,at+8192));
 return btoa(text);
}
export const paletteBytes=text=>Uint8Array.from(atob(text),char=>char.charCodeAt(0));

export function asepritePalette(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<144||view.getUint16(4,true)!==0xa5e0||view.getUint16(132,true)!==0xf1fa)throw new Error('无效的 Aseprite 色板');
 const end=128+view.getUint32(128,true);
 if(end>bytes.length)throw new Error('Aseprite 帧数据不完整');
 const colors=[];let modern=false;
 for(let offset=144;offset<end;){
  if(offset+6>end)throw new Error('Aseprite 色板块不完整');
  const size=view.getUint32(offset,true),type=view.getUint16(offset+4,true),limit=offset+size;
  if(size<6||limit>end)throw new Error('Aseprite 色板块长度无效');
  let at=offset+6;
  const need=n=>{if(at+n>limit)throw new Error('Aseprite 色板数据不完整');};
  if(type===0x2019){
   need(20);const count=view.getUint32(at,true),first=view.getUint32(at+4,true),last=view.getUint32(at+8,true);at+=20;
   if(!count||count>256||first>last||last>=count)throw new Error('Aseprite 色板范围无效');
   colors.length=count;colors.fill('#000000',0,count);modern=true;
   for(let i=first;i<=last;i++){
    need(6);const flags=view.getUint16(at,true);colors[i]=fromRgba({r:bytes[at+2],g:bytes[at+3],b:bytes[at+4],a:bytes[at+5]});at+=6;
    if(flags&1){need(2);const length=view.getUint16(at,true);at+=2;need(length);at+=length;}
   }
  }else if((type===4||type===11)&&!modern){
   need(2);const packets=view.getUint16(at,true);at+=2;let index=0;
   for(let packet=0;packet<packets;packet++){
    need(2);index+=bytes[at++];const count=bytes[at++]||256;need(count*3);
    if(index+count>256)throw new Error('Aseprite 色板范围无效');
    while(colors.length<index)colors.push('#000000');
    for(let i=0;i<count;i++){const scale=type===11?value=>Math.round(value*255/63):value=>value;colors[index++]=fromRgba({r:scale(bytes[at++]),g:scale(bytes[at++]),b:scale(bytes[at++])});}
   }
  }
  offset=limit;
 }
 return checked(colors);
}

export function adobePalette(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=new TextDecoder();
 if(bytes.length<12||text.decode(bytes.subarray(0,4))!=='ASEF'||view.getUint16(4)!==1)throw new Error('无效的 Adobe ASE 色板');
 const colors=[];let at=12;
 for(let block=0;block<view.getUint32(8);block++){
  if(at+6>bytes.length)throw new Error('Adobe ASE 数据不完整');
  const type=view.getUint16(at),end=at+6+view.getUint32(at+2);at+=6;
  if(end>bytes.length)throw new Error('Adobe ASE 数据不完整');
  if(type===1){
   if(at+2>end)throw new Error('Adobe ASE 名称不完整');
   const length=view.getUint16(at);at+=2+length*2;
   if(at+4>end)throw new Error('Adobe ASE 颜色不完整');
   const model=text.decode(bytes.subarray(at,at+4));at+=4;
   const count=model==='RGB '?3:model==='CMYK'?4:model==='Gray'?1:0;
   if(!count)throw new Error('不支持的 Adobe ASE 颜色空间：'+model);
   if(at+count*4+2>end)throw new Error('Adobe ASE 颜色不完整');
   const values=Array.from({length:count},(_,i)=>view.getFloat32(at+i*4));
   if(values.some(value=>!Number.isFinite(value)||value<0||value>1))throw new Error('Adobe ASE 颜色超出范围');
   const [x,y,z,k]=values;
   const [r,g,b]=model==='RGB '?[x,y,z]:model==='Gray'?[x,x,x]:[(1-x)*(1-k),(1-y)*(1-k),(1-z)*(1-k)];
   colors.push(fromRgba({r:r*255,g:g*255,b:b*255}));
  }
  at=end;
 }
 return checked(colors);
}

export function palPalette(bytes){
 const text=new TextDecoder().decode(bytes),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(text.startsWith('JASC-PAL')){
  const lines=text.trim().split(/\r?\n/),count=Number(lines[2]);
  if(lines[1]?.trim()!=='0100'||lines.length!==count+3)throw new Error('JASC PAL 色板格式无效');
  return checked(lines.slice(3).map(line=>{
   const values=line.trim().split(/\s+/).map(Number);
   if(values.length!==3||values.some(value=>!Number.isInteger(value)||value<0||value>255))throw new Error('PAL RGB 超出范围');
   return fromRgba({r:values[0],g:values[1],b:values[2]});
  }));
 }
 if(text.startsWith('RIFF')&&text.slice(8,12)==='PAL '){
  const end=view.getUint32(4,true)+8;if(end>bytes.length)throw new Error('RIFF PAL 数据不完整');
  for(let offset=12;offset+8<=end;){
   const size=view.getUint32(offset+4,true),at=offset+8;
   if(at+size>end)throw new Error('RIFF PAL 块长度无效');
   if(text.slice(offset,offset+4)==='data'){
    if(size<4||view.getUint16(at,true)!==0x300)throw new Error('RIFF PAL 版本无效');
    const count=view.getUint16(at+2,true);
    if(size!==4+count*4)throw new Error('RIFF PAL 色板长度无效');
    return checked(Array.from({length:count},(_,i)=>fromRgba({r:bytes[at+4+i*4],g:bytes[at+5+i*4],b:bytes[at+6+i*4]})));
   }
   offset=at+size+(size%2);
  }
 }
 throw new Error('不支持的 PAL 色板（支持 JASC / RIFF PAL）');
}
export function paletteFromPixels(pixels){
 const colors=[],seen=new Set();
 for(let i=0;i<pixels.length;i+=4){
  const color=fromRgba({r:pixels[i],g:pixels[i+1],b:pixels[i+2],a:pixels[i+3]});
  if(!seen.has(color)){seen.add(color);colors.push(color);}
 }
 return checked(colors);
}
export async function importPaletteFile(name,bytes){
 if(isPaletteFile(bytes))return decodePalette(bytes);
 if(new TextDecoder().decode(bytes.subarray(0,4))==='ASEF')return adobePalette(bytes);
 const extension=name.split('.').pop().toLowerCase();
 if(extension==='ase'||extension==='aseprite')return asepritePalette(bytes);
 if(extension==='pal')return palPalette(bytes);
 if(extension==='png'){
  const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  try{
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return paletteFromPixels(ctx.getImageData(0,0,image.width,image.height).data);
  }finally{image.close();}
 }
 if(extension==='pix')throw new Error('此 PIX 文件不是色板，请使用“打开”载入项目');
 return parsePalette(new TextDecoder().decode(bytes));
}

export const EXPORT_FORMATS={
  image:['bmp','css','gif','ico','jpeg','jpg','png','svg','webp'],
  animation:['gif','webp'],
  sheet:['bmp','css','gif','ico','jpeg','jpg','png','svg','webp']
};

export const formatLabel=format=>format==='jpeg'?'JPEG':format.toUpperCase();
export const exportFormatsFor=mode=>EXPORT_FORMATS[mode==='gif'?'animation':['sheet','metadata','sheet-pair'].includes(mode)?'sheet':'image'];

const bytesToBase64=bytes=>{
  let text='';
  for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(text);
};
const u24=value=>[value&255,value>>8&255,value>>16&255];
const u32=value=>[value&255,value>>8&255,value>>16&255,value>>>24&255];

export function encodeBmp(image){
  const {width,height,data}=image,row=Math.ceil(width*3/4)*4,size=54+row*height,out=new Uint8Array(size),view=new DataView(out.buffer);
  out.set([0x42,0x4d]);view.setUint32(2,size,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,width,true);view.setInt32(22,height,true);view.setUint16(26,1,true);view.setUint16(28,24,true);view.setUint32(34,row*height,true);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=((height-1-y)*width+x)*4,target=54+y*row+x*3,a=data[source+3]/255;
    out[target]=Math.round(data[source+2]*a+255*(1-a));out[target+1]=Math.round(data[source+1]*a+255*(1-a));out[target+2]=Math.round(data[source]*a+255*(1-a));
  }
  return bytesToBase64(out);
}

export function encodeIco(png,width,height){
  const binary=atob(png),image=Uint8Array.from(binary,c=>c.charCodeAt(0)),out=new Uint8Array(22+image.length),view=new DataView(out.buffer);
  view.setUint16(2,1,true);view.setUint16(4,1,true);out[6]=width>=256?0:width;out[7]=height>=256?0:height;view.setUint16(10,1,true);view.setUint16(12,32,true);view.setUint32(14,image.length,true);view.setUint32(18,22,true);out.set(image,22);
  return bytesToBase64(out);
}

const color=({data},index)=>`rgba(${data[index]},${data[index+1]},${data[index+2]},${(data[index+3]/255).toFixed(3)})`;
export function encodeCss(image,scale=1){
  const shadows=[];let first='transparent';
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const index=(y*image.width+x)*4;if(!image.data[index+3])continue;
    if(x===0&&y===0)first=color(image,index);else shadows.push(`${x*scale}px ${y*scale}px ${color(image,index)}`);
  }
  return `.minepix-image {\n  width: ${scale}px;\n  height: ${scale}px;\n  background: ${first};${shadows.length?`\n  box-shadow: ${shadows.join(',\n    ')};`:''}\n  image-rendering: pixelated;\n}\n`;
}

export function encodeSvg(image,scale=1){
  const rects=[];
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const i=(y*image.width+x)*4,a=image.data[i+3];if(!a)continue;
    const opacity=a===255?'':` opacity="${(a/255).toFixed(3)}"`;
    rects.push(`<rect x="${x*scale}" y="${y*scale}" width="${scale}" height="${scale}" fill="#${[image.data[i],image.data[i+1],image.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('')}"${opacity}/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${image.width*scale}" height="${image.height*scale}" viewBox="0 0 ${image.width*scale} ${image.height*scale}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

function webpChunks(base64){
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),chunks=[];
  for(let offset=12;offset+8<=bytes.length;){const size=new DataView(bytes.buffer,bytes.byteOffset+offset+4,4).getUint32(0,true),end=offset+8+size+(size&1);chunks.push({type:String.fromCharCode(...bytes.subarray(offset,offset+4)),bytes:bytes.slice(offset,end)});offset=end;}
  return chunks.filter(chunk=>['ALPH','VP8 ','VP8L'].includes(chunk.type));
}
function chunk(type,payload){const out=new Uint8Array(8+payload.length+(payload.length&1));out.set([...type].map(c=>c.charCodeAt(0)));new DataView(out.buffer).setUint32(4,payload.length,true);out.set(payload,8);return out;}
export function encodeAnimatedWebp(frames,width,height,loop=true){
  const vp8x=new Uint8Array(10);vp8x[0]=0x12;vp8x.set(u24(width-1),4);vp8x.set(u24(height-1),7);
  const anim=new Uint8Array(6);anim.set([0,0,0,0]);anim.set(loop?[0,0]:[1,0],4);
  const parts=[chunk('VP8X',vp8x),chunk('ANIM',anim)];
  for(const frame of frames){const payload=new Uint8Array(16+webpChunks(frame.webp).reduce((sum,item)=>sum+item.bytes.length,0));payload.set(u24(width-1),6);payload.set(u24(height-1),9);payload.set(u24(Math.max(1,frame.duration)),12);payload[15]=2;let offset=16;for(const item of webpChunks(frame.webp)){payload.set(item.bytes,offset);offset+=item.bytes.length;}parts.push(chunk('ANMF',payload));}
  const bodySize=4+parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(8+bodySize);out.set([82,73,70,70,...u32(bodySize),87,69,66,80]);let offset=12;for(const part of parts){out.set(part,offset);offset+=part.length;}return bytesToBase64(out);
}

export function encodeCanvas(canvas,format,scale=1){
  const context=canvas.getContext('2d',{willReadFrequently:true}),image=context.getImageData(0,0,canvas.width,canvas.height),png=canvas.toDataURL('image/png').split(',')[1];
  if(format==='png')return{data:png,binary:true};
  if(format==='jpg'||format==='jpeg'){
    const flattened=document.createElement('canvas');flattened.width=canvas.width;flattened.height=canvas.height;
    const output=flattened.getContext('2d');output.fillStyle='#ffffff';output.fillRect(0,0,flattened.width,flattened.height);output.drawImage(canvas,0,0);
    return{data:flattened.toDataURL('image/jpeg',.92).split(',')[1],binary:true};
  }
  if(format==='webp')return{data:canvas.toDataURL('image/webp',1).split(',')[1],binary:true};
  if(format==='bmp')return{data:encodeBmp(image),binary:true};
  if(format==='ico')return{data:encodeIco(png,canvas.width,canvas.height),binary:true};
  if(format==='svg')return{data:encodeSvg(image,scale),binary:false};
  if(format==='css')return{data:encodeCss(image,scale),binary:false};
  return{data:png,binary:true};
}

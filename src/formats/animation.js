import { createDocument, assertCapacity } from '../model.js';
import { scopeFrames, remapTags } from '../timeline-commands.js';
import { playbackSequence } from '../playback.js';

export function animationIndices(doc,scope,selection,direction='timeline'){
  const indices=scopeFrames(doc,scope,selection),tag=doc.tags.find(tag=>tag.id===scope);
  return playbackSequence(indices,direction==='tag'?tag?.direction||'forward':direction);
}
export function animationTags(doc,indices){return remapTags(doc.tags,indices);}
export function rgbaPixels(rgba){const pixels=new Array(rgba.length/4);for(let i=0;i<pixels.length;i++){const p=i*4;pixels[i]=((rgba[p]<<24)|(rgba[p+1]<<16)|(rgba[p+2]<<8)|rgba[p+3])>>>0;}return pixels;}
export function gifInfo(bytes){
  const header=new TextDecoder().decode(bytes.subarray(0,6));
  if(!['GIF87a','GIF89a'].includes(header)||bytes.length<13)throw new Error('不是有效的 GIF 文件');
  const width=bytes[6]|bytes[7]<<8,height=bytes[8]|bytes[9]<<8,delays=[];
  let p=13,delay=null,ended=false;
  const requireBytes=count=>{if(p+count>bytes.length)throw new Error('GIF 数据截断');};
  const skipBlocks=()=>{for(;;){requireBytes(1);const size=bytes[p++];if(!size)return;requireBytes(size);p+=size;}};
  if(bytes[10]&128)p+=3*(1<<((bytes[10]&7)+1));
  while(p<bytes.length){
    const block=bytes[p++];
    if(block===0x3b){ended=true;break;}
    if(block===0x21){
      requireBytes(1);const label=bytes[p++];
      if(label===0xf9){requireBytes(6);if(bytes[p++]!==4)throw new Error('GIF 控制块无效');delay=((bytes[p+1]|bytes[p+2]<<8)*10)||100;p+=4;if(bytes[p++]!==0)throw new Error('GIF 控制块无效');}
      else{skipBlocks();if(label===1)delay=null;}
    }else if(block===0x2c){
      requireBytes(9);const x=bytes[p]|bytes[p+1]<<8,y=bytes[p+2]|bytes[p+3]<<8,w=bytes[p+4]|bytes[p+5]<<8,h=bytes[p+6]|bytes[p+7]<<8,packed=bytes[p+8];
      if(!w||!h||x+w>width||y+h>height)throw new Error('GIF 子图像超出逻辑画布');
      p+=9;if(packed&128)p+=3*(1<<((packed&7)+1));requireBytes(1);p++;skipBlocks();delays.push(delay??100);delay=null;
    }else throw new Error('GIF 数据块无效');
  }
  if(!ended||!delays.length)throw new Error('GIF 缺少完整图像或结束标记');return{width,height,delays};
}
export async function decodeGif(bytes,name){
  const {width,height,delays}=gifInfo(bytes);assertCapacity(width,height,1,delays.length);
  if(typeof ImageDecoder==='undefined')throw new Error('当前运行时不支持 GIF 动画解码');
  const decoder=new ImageDecoder({data:bytes,type:'image/gif',preferAnimation:true});
  try{
    await decoder.completed;await decoder.tracks.ready;const track=decoder.tracks.selectedTrack,count=track.frameCount;if(count!==delays.length)throw new Error('GIF 帧信息与解码结果不一致');
    const doc=createDocument(width,height,name.replace(/\.gif$/i,'')),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});doc.frames=[];let adjusted=0;
    for(let i=0;i<count;i++){
      const {image}=await decoder.decode({frameIndex:i,completeFramesOnly:true});
      try{const raw=delays[i],duration=Math.max(20,Math.min(10000,raw));if(raw!==duration)adjusted++;ctx.clearRect(0,0,width,height);ctx.drawImage(image,0,0);doc.frames.push({duration,cels:[rgbaPixels(ctx.getImageData(0,0,width,height).data)]});}finally{image.close();}
    }
    return{doc,adjusted,repetitions:track.repetitionCount};
  }finally{decoder.close();}
}

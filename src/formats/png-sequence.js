import { assertCapacity, createDocument, validateTags } from '../model.js';
import { rgbaPixels } from './animation.js';

const natural=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function sequencePlan(source,{order='natural',duration=100,useTiming=true,useTags=true,name=source.name}={}){
  const {width,height,manifest}=source;assertCapacity(width,height,1,source.files.length);
  if((!manifest||!useTiming)&&(!Number.isInteger(duration)||duration<20||duration>10000))throw new Error('默认帧时长需为 20–10000 ms');
  if(!name.trim())throw new Error('请输入项目名称');
  let files=[...source.files];
  if(!manifest&&order!=='selected'){
    files.sort((a,b)=>natural.compare(a.name,b.name)||a.name.localeCompare(b.name,'en'));
    if(order==='reverse')files.reverse();
  }
  return{width,height,name:name.trim(),frames:files.map((file,i)=>({...file,duration:manifest&&useTiming?manifest.frames[i].duration:duration})),tags:manifest&&useTags?validateTags(manifest.tags,files.length):[]};
}
export async function decodePngSequence(plan,onProgress=()=>{}){
  const doc=createDocument(plan.width,plan.height,plan.name),canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});doc.frames=[];doc.tags=plan.tags;
  for(const [index,frame]of plan.frames.entries()){
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('PNG 无法解码：'+frame.name));image.src='data:image/png;base64,'+frame.data;});
    if(image.naturalWidth!==plan.width||image.naturalHeight!==plan.height)throw new Error('PNG 解码尺寸不一致：'+frame.name);
    ctx.clearRect(0,0,plan.width,plan.height);ctx.drawImage(image,0,0);doc.frames.push({duration:frame.duration,cels:[rgbaPixels(ctx.getImageData(0,0,plan.width,plan.height).data)]});onProgress(index+1,plan.frames.length);
  }
  return doc;
}

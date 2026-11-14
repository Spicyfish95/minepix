import {isReference} from './layer-types.js';
import {isGroup,subtree} from './layer-tree.js';
import {exportLayerPlan} from './export-layers.js';
import { composite } from './model.js';

export const DEFAULT_ONION_SETTINGS={before:1,after:1,opacity:30,falloff:65,mode:'tinted',previousColor:'#ef6672',nextColor:'#5b9fe8',layers:'visible',position:'behind',wrap:false,limitRange:false};

export function onionSources(frameCount,current,settings,range=null){
  const indices=range||Array.from({length:frameCount},(_,i)=>i),position=indices.indexOf(current);
  if(position<0)return [];
  const sources=[],seen=new Set([current]);
  for(let distance=1;distance<=Math.max(settings.before,settings.after);distance++){
    const alpha=settings.opacity/100*(settings.falloff/100)**(distance-1);if(!alpha)continue;
    for(const [side,count,offset]of[['previous',settings.before,-distance],['next',settings.after,distance]]){
      if(distance>count)continue;
      let at=position+offset;
      if(settings.wrap)at=((at%indices.length)+indices.length)%indices.length;
      if(at<0||at>=indices.length)continue;
      const index=indices[at];if(seen.has(index))continue;
      seen.add(index);sources.push({index,side,distance,alpha});
    }
  }
  // Paint distant references first. A short wrapped range uses each frame once;
  // equally near references prefer the previous-frame color.
  return sources.sort((a,b)=>b.distance-a.distance);
}

export function onionPixels(doc,index,layer,settings,side){
  if(settings.layers==='current'&&isReference(doc.layers[layer]))return new Uint8ClampedArray(doc.width*doc.height*4);
  if(settings.layers==='current'&&isGroup(doc.layers[layer])&&!subtree(doc,layer).indices.some(i=>!isGroup(doc.layers[i])))return new Uint8ClampedArray(doc.width*doc.height*4);
  const source=settings.layers==='current'?(()=>{const plan=exportLayerPlan(doc,'current',layer);return{...plan.document,layers:plan.document.layers.map((value,i)=>({...value,visible:value.visible&&doc.layers[i].visible}))};})():doc;
  const pixels=composite(source,index);
  if(settings.mode==='original')return pixels;
  const tint=parseInt((side==='previous'?settings.previousColor:settings.nextColor).slice(1),16);
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){pixels[i]=tint>>>16;pixels[i+1]=tint>>>8&255;pixels[i+2]=tint&255;}
  return pixels;
}

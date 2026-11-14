import {celProperty} from './cel-properties.js';
import {outlineImagePixels} from './outline.js';
import {selectionContains} from './model.js';
import {isGroup,layerState} from './layer-tree.js';
import {isReference,finalizeBackground} from './layer-types.js';
import {canonicalizeColors} from './color-modes.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const pack=(r,g,b,a)=>((Math.round(clamp(r)*255)<<24)|(Math.round(clamp(g)*255)<<16)|(Math.round(clamp(b)*255)<<8)|a)>>>0;
export function adjustImagePixel(pixel,{type,hue=0,saturation=0,value=0,brightness=0,contrast=0}){
 const alpha=pixel&255;if(!alpha)return pixel;
 const r=(pixel>>>24)/255,g=(pixel>>>16&255)/255,b=(pixel>>>8&255)/255;
 if(type==='invert')return pack(1-r,1-g,1-b,alpha);
 if(type==='brightness'){
  if(!brightness&&!contrast)return pixel;
  const c=contrast*2.55,factor=259*(c+255)/(255*(259-c)),adjust=channel=>(channel-.5)*factor+.5+brightness/100;
  return pack(adjust(r),adjust(g),adjust(b),alpha);
 }
 if(!hue&&!saturation&&!value)return pixel;
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;let h=0;
 if(delta){h=max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;h*=60;}
 h=((h+hue)%360+360)%360/60;const s=clamp((max?delta/max:0)+saturation/100),v=clamp(max+value/100),chroma=v*s,x=chroma*(1-Math.abs(h%2-1)),m=v-chroma;
 const channels=h<1?[chroma,x,0]:h<2?[x,chroma,0]:h<3?[0,chroma,x]:h<4?[0,x,chroma]:h<5?[x,0,chroma]:[chroma,0,x];
 return pack(channels[0]+m,channels[1]+m,channels[2]+m,alpha);
}

export function applyImageAdjustment(doc,{scope='cel',frame=0,layer=0,selection=null,...settings}){
 const visited=new Map(),outlines=new Map();let changed=0;
 for(let f=0;f<doc.frames.length;f++)for(let l=0;l<doc.layers.length;l++){
  if(scope==='cel'&&(f!==frame||l!==layer)||scope==='layer'&&l!==layer)continue;
  const state=layerState(doc,l);if(isGroup(doc.layers[l])||isReference(doc.layers[l])||state.locked||!state.visible)continue;
  const pixels=doc.frames[f].cels[l];if(!selection&&visited.has(pixels))continue;const processed=visited.get(pixels)||new Set();visited.set(pixels,processed);
  const property=celProperty(doc,f,l),imageDoc={width:property.width,height:property.height};
  if(settings.type==='outline'&&!outlines.has(pixels))outlines.set(pixels,outlineImagePixels(imageDoc,pixels,settings));const outlined=outlines.get(pixels);
  for(let i=0;i<pixels.length;i++)if(!processed.has(i)&&selectionContains(selection,i%property.width+property.x,Math.floor(i/property.width)+property.y)){if(selection)processed.add(i);const next=outlined?outlined[i]:adjustImagePixel(pixels[i],settings);if(next!==pixels[i]){pixels[i]=next;changed++;}}
 }
 finalizeBackground(doc);canonicalizeColors(doc);return changed;
}

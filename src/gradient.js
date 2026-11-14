import {selectionContains} from './model.js';
import {applyInk} from './brush-engine.js';

const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export function gradientColor(first,last,amount){
 const t=Math.max(0,Math.min(1,amount)),a0=first&255,a1=last&255,alpha=a0*(1-t)+a1*t;
 if(!alpha)return 0;
 let result=0;for(const shift of [24,16,8]){const channel=Math.round((((first>>>shift)&255)*a0*(1-t)+((last>>>shift)&255)*a1*t)/alpha);result|=channel<<shift;}
 return(result|Math.round(alpha))>>>0;
}

export function paintGradient(doc,pixels,start,end,first,last,options={},selection=null){
 const dx=end.x-start.x,dy=end.y-start.y,length=dx*dx+dy*dy;if(!length)return;
 const base=options.base||pixels.slice();
 for(let y=0;y<doc.height;y++)for(let x=0;x<doc.width;x++){
  if(!selectionContains(selection,x,y))continue;
  const px=(options.tiledMode==='x'||options.tiledMode==='both')?x+Math.round((start.x-x)/doc.width)*doc.width:x,py=(options.tiledMode==='y'||options.tiledMode==='both')?y+Math.round((start.y-y)/doc.height)*doc.height:y;
  const distance=options.gradientType==='radial'?Math.hypot(px-start.x,py-start.y)/Math.sqrt(length):((px-start.x)*dx+(py-start.y)*dy)/length,t=Math.max(0,Math.min(1,distance));
  const source=options.gradientDither==='ordered'?(t>=(BAYER[(y%4)*4+x%4]+.5)/16?last:first):gradientColor(first,last,t),i=y*doc.width+x;
  if(options.ink==='shading'){if(options.opacity>0&&options.shade)pixels[i]=options.shade(base[i],i);continue;}
  const value=applyInk(base[i],source,options.ink||'over',options.opacity??1);pixels[i]=options.quantize?options.quantize(value,i,source):value;options.touched?.add(i);
 }
}

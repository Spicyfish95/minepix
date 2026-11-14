import {tiledPoint} from './tiled-mode.js';
import {symmetryPoints} from './symmetry.js';
import {colorMatches} from './color-replace.js';
import { line, shape, selectionContains } from './model.js';

const pack=(r,g,b,a)=>((Math.round(r)<<24)|(Math.round(g)<<16)|(Math.round(b)<<8)|Math.round(a))>>>0;

export function applyInk(destination,source,mode='over',opacity=1){
  const da=(destination&255)/255,raw=(source&255)/255,sa=raw*opacity;
  if(mode==='erase'||(mode==='simple'&&!raw)){
    const alpha=Math.round(da*(1-opacity)*255);
    return alpha?pack(destination>>>24,(destination>>>16)&255,(destination>>>8)&255,alpha):0;
  }
  if(mode==='copy')return pack(source>>>24,(source>>>16)&255,(source>>>8)&255,source&255);
  if(mode==='lock-alpha'){
    if(!da)return destination;
    return pack(source>>>24,(source>>>16)&255,(source>>>8)&255,da*255);
  }
  const alpha=sa+da*(1-sa);if(!alpha)return 0;
  return pack(((source>>>24)*sa+(destination>>>24)*da*(1-sa))/alpha,(((source>>>16)&255)*sa+((destination>>>16)&255)*da*(1-sa))/alpha,(((source>>>8)&255)*sa+((destination>>>8)&255)*da*(1-sa))/alpha,alpha*255);
}

export function brushFootprint({size=1,shape='square',angle=0,pattern=null,patternMode='destination'}){
  const points=[],offset=Math.floor((size-1)/2);
  if(shape==='pattern'&&pattern){
    const scale=size/Math.max(pattern.w,pattern.h),w=Math.max(1,Math.round(pattern.w*scale)),h=Math.max(1,Math.round(pattern.h*scale));
    const sourceX=x=>Math.min(pattern.w-1,Math.floor((scale>=1?x:x+.5)/scale)),sourceY=y=>Math.min(pattern.h-1,Math.floor((scale>=1?y:y+.5)/scale));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const color=pattern.data[sourceY(y)*pattern.w+sourceX(x)];
      if(color&255)points.push({x:x-Math.floor((w-1)/2),y:y-Math.floor((h-1)/2),color});
    }
    if(!points.length){
      const cx=(pattern.w-1)/2,cy=(pattern.h-1)/2;
      let nearest=null;
      for(let y=0;y<pattern.h;y++)for(let x=0;x<pattern.w;x++){
        const color=pattern.data[y*pattern.w+x];
        if(!(color&255))continue;
        const distance=(x-cx)**2+(y-cy)**2;
        if(!nearest||distance<nearest.distance)nearest={color,distance};
      }
      if(nearest)points.push({x:0,y:0,color:nearest.color});
    }
  }else if(shape==='line'){
    const radians=angle*Math.PI/180,half=(size-1)/2;
    line(Math.round(-Math.cos(radians)*half),Math.round(-Math.sin(radians)*half),Math.round(Math.cos(radians)*half),Math.round(Math.sin(radians)*half),(x,y)=>points.push({x,y}));
  }else{
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(shape==='circle'&&((x-(size-1)/2)**2+(y-(size-1)/2)**2)>(size/2)**2)continue;
      points.push({x:x-offset,y:y-offset});
    }
  }
  return points;
}

export function stampBrush(doc,pixels,x,y,color,options,selection=null,symmetry=false){
  const {base=pixels,ink='over',opacity=1,erasing=false,touched}=options;
  const pattern=options.pattern,scale=pattern?Math.max(1e-6,options.size/Math.max(pattern.w,pattern.h)):1;
  const anchored=!!pattern&&(options.patternMode==='source'||options.patternMode==='destination')&&!!options.patternAnchor;
  const wrap=(value,length)=>((value%length)+length)%length;
  const patternColor=(px,py)=>{const anchor=options.patternAnchor;return pattern.data[wrap(Math.floor((py-anchor.y)/scale),pattern.h)*pattern.w+wrap(Math.floor((px-anchor.x)/scale),pattern.w)];};
  const put=(px,py,source,coverage=1)=>{
    ({x:px,y:py}=tiledPoint(doc,px,py,options.tiledMode));if(px<0||py<0||px>=doc.width||py>=doc.height)return;
    if(!selectionContains(selection,px,py))return;
    const i=py*doc.width+px;
    const strength=opacity*coverage;if(options.coverageMap){if(strength<=options.coverageMap[i])return;options.coverageMap[i]=strength;}if(ink==='shading'&&!erasing){if(strength>0&&options.shade)pixels[i]=options.shade(base[i],i);touched?.add(i);return;}const value=applyInk(base[i],source,erasing?'erase':ink,strength);pixels[i]=options.quantize?options.quantize(value,i,source):value;touched?.add(i);
  };
  for(const p of options.footprint||brushFootprint(options)){
    let source,coverage=1;
    if(anchored){
      source=patternColor(x+p.x,y+p.y);
      const alpha=source&255;if(!alpha)continue;
      coverage=alpha/255;source=(source|255)>>>0;
    }else{
      const colored=options.patternMode==='brush'&&p.color!==undefined;
      source=colored?color:p.color??color;
      if((erasing||colored)&&p.color!==undefined)coverage=(p.color&255)/255;
    }
    for(const point of symmetryPoints(x+p.x,y+p.y,doc.width,doc.height,symmetry))put(point.x,point.y,source,coverage);
  }
}

export function rasterShape(kind,a,b,filled,put){
  if(!filled||kind==='line')return shape(kind,a,b,put);
  const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
  const rx=(x1-x0+1)/2,ry=(y1-y0+1)/2,cx=(x0+x1)/2,cy=(y0+y1)/2;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(kind==='rect'||((x-cx)/rx)**2+((y-cy)/ry)**2<=1)put(x,y);
}

export function appendPixelPerfect(points,point){
  const b=points.at(-1);if(b&&b.x===point.x&&b.y===point.y)return;
  const a=points.at(-2);
  if(a&&Math.abs(a.x-point.x)===1&&Math.abs(a.y-point.y)===1&&((a.x===b.x&&b.y===point.y)||(a.y===b.y&&b.x===point.x)))points.pop();
  points.push(point);
}

export function paintFill(doc,pixels,x,y,color,options,selection=null){
  ({x,y}=tiledPoint(doc,x,y,options.tiledMode));
  const base=options.base||[...pixels],target=base[y*doc.width+x],seen=new Uint8Array(pixels.length),queue=[y*doc.width+x];
  const inside=(px,py)=>px>=0&&py>=0&&px<doc.width&&py<doc.height&&selectionContains(selection,px,py);
  if(!inside(x,y))return;
  const matches=value=>colorMatches(value,target,options.fillTolerance||0);
  const put=i=>{if(options.ink==='shading'&&!options.erasing){if(options.opacity>0&&options.shade)pixels[i]=options.shade(base[i],i);options.touched?.add(i);return;}const value=applyInk(base[i],color,options.erasing?'erase':options.ink,options.opacity);pixels[i]=options.quantize?options.quantize(value,i,color):value;options.touched?.add(i);};
  if(options.fillContiguous===false){for(let i=0;i<base.length;i++)if(inside(i%doc.width,Math.floor(i/doc.width))&&matches(base[i]))put(i);return;}
  seen[queue[0]]=1;
  for(let n=0;n<queue.length;n++){
    const i=queue[n],px=i%doc.width,py=Math.floor(i/doc.width);
    put(i);
    for(let [nx,ny]of[[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){
      ({x:nx,y:ny}=tiledPoint(doc,nx,ny,options.tiledMode));
      const next=ny*doc.width+nx;if(inside(nx,ny)&&!seen[next]&&matches(base[next])){seen[next]=1;queue.push(next);}
    }
  }
}

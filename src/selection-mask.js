import {tiledPoint} from './tiled-mode.js';
import {prepareRotSprite} from './rotsprite.js';
import { selectionContains } from './model.js';
import { rasterPolygon } from './path-tools.js';
import { rasterShape } from './brush-engine.js';
import { transformState, transformPoint } from './transform-controls.js';

// Masks are cropped to their bounds. An empty mask is distinct from no selection.
export function selectionFrom(doc,test){
  let left=doc.width,top=doc.height,right=-1,bottom=-1;
  const full=new Uint8Array(doc.width*doc.height);
  for(let y=0;y<doc.height;y++)for(let x=0;x<doc.width;x++)if(test(x,y)){
    full[y*doc.width+x]=1;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  if(right<left)return{x:0,y:0,w:0,h:0,mask:new Uint8Array()};
  const w=right-left+1,h=bottom-top+1,mask=new Uint8Array(w*h);
  for(let y=0;y<h;y++)mask.set(full.subarray((top+y)*doc.width+left,(top+y)*doc.width+left+w),y*w);
  return{x:left,y:top,w,h,mask};
}

export function shapeSelection(doc,kind,points,tiledMode){
  const mask=new Uint8Array(doc.width*doc.height);
  const put=(x,y)=>{({x,y}=tiledPoint(doc,x,y,tiledMode));if(x>=0&&y>=0&&x<doc.width&&y<doc.height)mask[y*doc.width+x]=1;};
  if(kind==='lasso'||kind==='polygon')rasterPolygon(points,true,put);
  else rasterShape(kind==='ellipse'?'ellipse':'rect',points[0],points.at(-1),true,put);
  return selectionFrom(doc,(x,y)=>mask[y*doc.width+x]);
}

// 网格选取：起止点所覆盖的整格矩形，按网格偏移与格子尺寸吸附后裁剪到画布。
export function gridSelection(doc,grid,start,end){
  const c0=Math.floor((Math.min(start.x,end.x)-grid.x)/grid.w),c1=Math.floor((Math.max(start.x,end.x)-grid.x)/grid.w);
  const r0=Math.floor((Math.min(start.y,end.y)-grid.y)/grid.h),r1=Math.floor((Math.max(start.y,end.y)-grid.y)/grid.h);
  return selectionFrom(doc,(x,y)=>{const c=Math.floor((x-grid.x)/grid.w),r=Math.floor((y-grid.y)/grid.h);return c>=c0&&c<=c1&&r>=r0&&r<=r1;});
}

export function wandSelection(doc,pixels,x,y,tolerance=0,tiledMode){
  ({x,y}=tiledPoint(doc,x,y,tiledMode));
  const target=pixels[y*doc.width+x],seen=new Uint8Array(pixels.length),mask=new Uint8Array(pixels.length),queue=[y*doc.width+x];seen[queue[0]]=1;
  const matches=value=>[0,8,16,24].every(shift=>Math.abs(((value>>>shift)&255)-((target>>>shift)&255))<=tolerance);
  for(let i=0;i<queue.length;i++){
    const pos=queue[i],px=pos%doc.width,py=Math.floor(pos/doc.width);mask[pos]=1;
    for(let [nx,ny]of[[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){
      ({x:nx,y:ny}=tiledPoint(doc,nx,ny,tiledMode));
      if(nx<0||ny<0||nx>=doc.width||ny>=doc.height)continue;
      const next=ny*doc.width+nx;if(!seen[next]){seen[next]=1;if(matches(pixels[next]))queue.push(next);}
    }
  }
  return selectionFrom(doc,(px,py)=>mask[py*doc.width+px]);
}

export function combineSelection(doc,previous,next,operation='replace'){
  if(operation==='replace')return next;
  return selectionFrom(doc,(x,y)=>{
    const a=!!previous&&selectionContains(previous,x,y),b=selectionContains(next,x,y);
    return operation==='add'?a||b:operation==='subtract'?a&&!b:a&&b;
  });
}
export const invertSelection=(doc,selection)=>selectionFrom(doc,(x,y)=>!selection||!selectionContains(selection,x,y));
export const translateSelection=(doc,selection,dx,dy)=>selectionFrom(doc,(x,y)=>selectionContains(selection,x-dx,y-dy));

export function transformRegion(region,width,height,angle){
  return transformSelectionRegion(region,{...transformState(region),width,height,angle,x:region.x+(region.w-width)/2,y:region.y+(region.h-height)/2});
}
export function transformSelectionRegion(region,state){
  const {width,height,angle}=state;
  const prepared=state.algorithm==='rotsprite'&&Math.abs(angle%90)>1e-9?prepareRotSprite(region):null;
  const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  const w=Math.ceil(Math.abs(width*c)+Math.abs(height*s)-1e-9),h=Math.ceil(Math.abs(width*s)+Math.abs(height*c)-1e-9);
  const indexData=region.indexed?new Array(w*h).fill(region.indexed.transparentIndex):null,data=new Array(w*h).fill(0),mask=new Uint8Array(w*h),center=transformPoint(state,.5,.5);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=x+.5-w/2,dy=y+.5-h/2;
    const sx=Math.floor((.5+(dx*c+dy*s)/width)*region.w+1e-9),sy=Math.floor((.5+(-dx*s+dy*c)/height)*region.h+1e-9);
    if(sx<0||sy<0||sx>=region.w||sy>=region.h||region.mask&&!region.mask[sy*region.w+sx])continue;
    mask[y*w+x]=1;
    if(prepared){const u=Math.floor((.5+(dx*c+dy*s)/width)*prepared.width+1e-9),v=Math.floor((.5+(-dx*s+dy*c)/height)*prepared.height+1e-9),token=prepared.data[v*prepared.width+u];if(indexData){indexData[y*w+x]=token;data[y*w+x]=token===region.indexed.transparentIndex?0:parseInt(region.indexed.palette[token].slice(1).padEnd(8,'f'),16)>>>0;}else data[y*w+x]=token;}
    else{data[y*w+x]=region.data[sy*region.w+sx];if(indexData)indexData[y*w+x]=region.indexed.data[sy*region.w+sx];}
  }
  return{x:Math.floor(center.x-w/2+1e-9),y:Math.floor(center.y-h/2+1e-9),w,h,mask,data,...(indexData?{indexed:{...region.indexed,data:indexData}}:{})};
}

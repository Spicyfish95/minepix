import {floodSpans} from './flood-spans.js';
import {tiledPoint} from './tiled-mode.js';
import {prepareRotSprite} from './rotsprite.js';
import { selectionContains } from './model.js';
import { rasterPolygon } from './path-tools.js';
import { rasterShape } from './brush-engine.js';
import { transformState, transformPoint } from './transform-controls.js';

// Masks are cropped to their bounds. An empty mask is distinct from no selection.
function clippedBounds(doc,bounds={x:0,y:0,w:doc.width,h:doc.height}){
 const x=Math.max(0,Math.floor(bounds.x)),y=Math.max(0,Math.floor(bounds.y)),right=Math.min(doc.width,Math.ceil(bounds.x+bounds.w)),bottom=Math.min(doc.height,Math.ceil(bounds.y+bounds.h));return{x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)};
}
export function selectionFrom(doc,test,bounds){
 const area=clippedBounds(doc,bounds);let left=area.w,top=area.h,right=-1,bottom=-1;
 const full=new Uint8Array(area.w*area.h);
 for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++)if(test(x+area.x,y+area.y)){full[y*area.w+x]=1;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 if(right<left)return{x:0,y:0,w:0,h:0,mask:new Uint8Array()};
 const w=right-left+1,h=bottom-top+1;
 if(left===0&&top===0&&w===area.w&&h===area.h)return{...area,mask:full};
 const mask=new Uint8Array(w*h);for(let y=0;y<h;y++)mask.set(full.subarray((top+y)*area.w+left,(top+y)*area.w+left+w),y*w);
 return{x:area.x+left,y:area.y+top,w,h,mask};
}

export function shapeSelection(doc,kind,points,tiledMode){
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),wrapX=tiledMode==='x'||tiledMode==='both',wrapY=tiledMode==='y'||tiledMode==='both',bounds=clippedBounds(doc,{x:wrapX?0:Math.min(...xs),y:wrapY?0:Math.min(...ys),w:wrapX?doc.width:Math.max(...xs)-Math.min(...xs)+1,h:wrapY?doc.height:Math.max(...ys)-Math.min(...ys)+1});
 const mask=new Uint8Array(bounds.w*bounds.h),put=(x,y)=>{({x,y}=tiledPoint(doc,x,y,tiledMode));x-=bounds.x;y-=bounds.y;if(x>=0&&y>=0&&x<bounds.w&&y<bounds.h)mask[y*bounds.w+x]=1;};
 if(kind==='lasso'||kind==='polygon')rasterPolygon(points,true,put);else rasterShape(kind==='ellipse'?'ellipse':'rect',points[0],points.at(-1),true,put);
 return selectionFrom(doc,(x,y)=>mask[(y-bounds.y)*bounds.w+x-bounds.x],bounds);
}

export function gridSelection(doc,grid,start,end){
 const x=grid.x+Math.floor((Math.min(start.x,end.x)-grid.x)/grid.w)*grid.w,y=grid.y+Math.floor((Math.min(start.y,end.y)-grid.y)/grid.h)*grid.h,right=grid.x+(Math.floor((Math.max(start.x,end.x)-grid.x)/grid.w)+1)*grid.w,bottom=grid.y+(Math.floor((Math.max(start.y,end.y)-grid.y)/grid.h)+1)*grid.h;
 return selectionFrom(doc,()=>true,{x,y,w:right-x,h:bottom-y});
}

export function wandSelection(doc,pixels,x,y,tolerance=0,tiledMode){
 ({x,y}=tiledPoint(doc,x,y,tiledMode));const target=pixels[y*doc.width+x],runs=[];let left=doc.width,top=doc.height,right=-1,bottom=-1;
 const matches=value=>[0,8,16,24].every(shift=>Math.abs(((value>>>shift)&255)-((target>>>shift)&255))<=tolerance);
 floodSpans(doc.width,doc.height,x,y,(px,py)=>matches(pixels[py*doc.width+px]),(px,py)=>{const last=runs.at(-1);if(last&&last.y===py&&last.right===px-1)last.right=px;else runs.push({x:px,y:py,right:px});left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);},tiledMode);
 if(right<left)return{x:0,y:0,w:0,h:0,mask:new Uint8Array()};const w=right-left+1,h=bottom-top+1,mask=new Uint8Array(w*h);
 for(const run of runs)mask.fill(1,(run.y-top)*w+run.x-left,(run.y-top)*w+run.right-left+1);return{x:left,y:top,w,h,mask};
}

export function combineSelection(doc,previous,next,operation='replace'){
 if(operation==='replace')return next;
 if(!previous)return operation==='add'?next:{x:0,y:0,w:0,h:0,mask:new Uint8Array()};
 const x=Math.min(previous.x,next.x),y=Math.min(previous.y,next.y),bounds=operation==='add'?{x,y,w:Math.max(previous.x+previous.w,next.x+next.w)-x,h:Math.max(previous.y+previous.h,next.y+next.h)-y}:previous;
 return selectionFrom(doc,(x,y)=>{const a=selectionContains(previous,x,y),b=selectionContains(next,x,y);return operation==='add'?a||b:operation==='subtract'?a&&!b:a&&b;},bounds);
}
export const invertSelection=(doc,selection)=>selectionFrom(doc,(x,y)=>!selection||!selectionContains(selection,x,y));
export const translateSelection=(doc,selection,dx,dy)=>selectionFrom(doc,(x,y)=>selectionContains(selection,x-dx,y-dy),selection?{...selection,x:selection.x+dx,y:selection.y+dy}:undefined);

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

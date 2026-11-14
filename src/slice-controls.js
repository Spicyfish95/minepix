export const sliceHandlePoints=b=>[
 ['nw',b.x,b.y],['n',b.x+b.w/2,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,b.y+b.h/2],
 ['se',b.x+b.w,b.y+b.h],['s',b.x+b.w/2,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,b.y+b.h/2]
].map(([id,x,y])=>({id,x,y}));
export function hitSliceHandle(bounds,point,zoom){return sliceHandlePoints(bounds).find(p=>Math.hypot(point.x-p.x,point.y-p.y)*zoom<=7)?.id||null;}
export function dragSliceBounds(bounds,handle,start,end,width,height){
 const dx=Math.round(end.x-start.x),dy=Math.round(end.y-start.y);
 if(handle==='move')return{...bounds,x:Math.max(0,Math.min(width-bounds.w,bounds.x+dx)),y:Math.max(0,Math.min(height-bounds.h,bounds.y+dy))};
 let x=bounds.x,y=bounds.y,right=x+bounds.w,bottom=y+bounds.h;
 if(handle.includes('w'))x=Math.max(0,Math.min(right-1,x+dx));if(handle.includes('e'))right=Math.min(width,Math.max(x+1,right+dx));
 if(handle.includes('n'))y=Math.max(0,Math.min(bottom-1,y+dy));if(handle.includes('s'))bottom=Math.min(height,Math.max(y+1,bottom+dy));
 return{x,y,w:right-x,h:bottom-y};
}
export function resizedSliceGeometry(slice,bounds){
 const next={...slice,bounds},sx=bounds.w/slice.bounds.w,sy=bounds.h/slice.bounds.h;
 if(slice.pivot)next.pivot={x:Math.round(slice.pivot.x*sx),y:Math.round(slice.pivot.y*sy)};
 if(slice.center){const c=slice.center,x=Math.min(bounds.w-1,Math.round(c.x*sx)),y=Math.min(bounds.h-1,Math.round(c.y*sy));next.center={x,y,w:Math.max(1,Math.min(bounds.w-x,Math.round(c.w*sx))),h:Math.max(1,Math.min(bounds.h-y,Math.round(c.h*sy)))};}
 return next;
}

export const sliceCursor=handle=>({nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',move:'move',create:'crosshair'})[handle]||'crosshair';

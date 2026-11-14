const geometry=s=>({bounds:{...s.bounds},...(s.pivot?{pivot:{...s.pivot}}:{}),...(s.center?{center:{...s.center}}:{})});
export const sliceKeys=s=>s.keys||[{frame:0,...geometry(s)}];
export function sliceAtFrame(slice,frame){const key=sliceKeys(slice).findLast(k=>k.frame<=frame);return key?.bounds.w&&key?.bounds.h?{id:slice.id,name:slice.name,...geometry(key)}:null;}
export function withSliceKeys(slice,keys){
 const sorted=keys.toSorted((a,b)=>a.frame-b.frame),first=sorted[0];
 return{id:slice.id,name:slice.name,...geometry(first),...(sorted.length===1&&first.frame===0?{}:{keys:sorted.map(k=>({frame:k.frame,...geometry(k)}))})};
}
export function setSliceKey(slice,frame,value){return withSliceKeys(slice,[...sliceKeys(slice).filter(k=>k.frame!==frame),{frame,...geometry(value)}]);}
export function deleteSliceKey(slice,frame){const keys=sliceKeys(slice).filter(k=>k.frame!==frame);return keys.length?withSliceKeys(slice,keys):null;}
export function remapSliceFrames(slices=[],sources){return slices.flatMap(slice=>{
 const keys=[];let previous=null;
 sources.forEach((source,frame)=>{const value=sliceAtFrame(slice,source),state=value?geometry(value):null;if(JSON.stringify(state)!==JSON.stringify(previous)){keys.push({frame,...(state||{bounds:{x:0,y:0,w:0,h:0}})});previous=state;}});
 return keys.some(k=>k.bounds.w&&k.bounds.h)?[withSliceKeys(slice,keys)]:[];
});}
export function mapSliceGeometry(slices=[],transform){return slices.flatMap(slice=>{
 const keys=sliceKeys(slice).map(key=>({frame:key.frame,...((key.bounds.w&&key.bounds.h?transform(geometry(key)):null)||{bounds:{x:0,y:0,w:0,h:0}})}));
 return keys.some(k=>k.bounds.w&&k.bounds.h)?[withSliceKeys(slice,keys)]:[];
});}
export function validateSlices(slices=[],width,height,frameCount=Infinity){
 if(!Array.isArray(slices)||slices.length>256)throw new Error('切片最多 256 个');const ids=new Set();
 const validate=(s,animated)=>{const b=s?.bounds;if(!b||!['x','y','w','h'].every(k=>Number.isInteger(b[k]))||b.x<0||b.y<0||b.w<0||b.h<0||(!animated&&(!b.w||!b.h))||b.x+b.w>width||b.y+b.h>height)throw new Error('切片名称、标识或矩形无效');const result={bounds:{...b}};if(s.pivot){if(![s.pivot.x,s.pivot.y].every(v=>Number.isInteger(v)&&Math.abs(v)<=65536))throw new Error('切片 pivot 无效');result.pivot={...s.pivot};}if(s.center){const c=s.center;if(!['x','y','w','h'].every(k=>Number.isInteger(c[k]))||c.x<0||c.y<0||c.w<1||c.h<1||c.x+c.w>b.w||c.y+c.h>b.h)throw new Error('九宫格中心需在切片内');result.center={...c};}return result;};
 return slices.map(slice=>{if(!slice||typeof slice.id!=='string'||!slice.id||ids.has(slice.id)||typeof slice.name!=='string'||!slice.name.trim())throw new Error('切片名称、标识或矩形无效');ids.add(slice.id);const result={id:slice.id,name:slice.name.slice(0,80)};
 if(slice.keys!==undefined){if(!Array.isArray(slice.keys)||!slice.keys.length||slice.keys.length>frameCount)throw new Error('切片关键帧无效');let previous=-1;const keys=slice.keys.map(k=>{if(!Number.isInteger(k.frame)||k.frame<=previous||k.frame>=frameCount)throw new Error('切片关键帧无效');previous=k.frame;return{frame:k.frame,...validate(k,true)};});return withSliceKeys(result,keys);}
 return{...result,...validate(slice,false)};
 });
}
export function scaleSlices(slices=[],scale=1){return mapSliceGeometry(slices,s=>Object.fromEntries(['bounds','pivot','center'].filter(k=>s[k]).map(k=>[k,Object.fromEntries(Object.entries(s[k]).map(([p,v])=>[p,v*scale]))])));}
export function reframeSlices(slices=[],rect){return mapSliceGeometry(slices,slice=>{const b=slice.bounds,x=Math.max(0,b.x-rect.x),y=Math.max(0,b.y-rect.y),right=Math.min(rect.w,b.x+b.w-rect.x),bottom=Math.min(rect.h,b.y+b.h-rect.y);if(right<=x||bottom<=y)return null;const dx=x-(b.x-rect.x),dy=y-(b.y-rect.y),next={...slice,bounds:{x,y,w:right-x,h:bottom-y}};if(slice.pivot)next.pivot={x:slice.pivot.x-dx,y:slice.pivot.y-dy};if(slice.center){const c=slice.center,cx=Math.max(0,c.x-dx),cy=Math.max(0,c.y-dy),cr=Math.min(next.bounds.w,c.x+c.w-dx),cb=Math.min(next.bounds.h,c.y+c.h-dy);if(cr>cx&&cb>cy)next.center={x:cx,y:cy,w:cr-cx,h:cb-cy};else delete next.center;}return next;});}
export function flipSlices(slices=[],width,height,axis){return mapSliceGeometry(slices,slice=>{const b=slice.bounds,k=axis==='x'?'x':'y',size=axis==='x'?'w':'h',edge=axis==='x'?width:height,next={...slice,bounds:{...b,[k]:edge-b[k]-b[size]}};if(slice.pivot)next.pivot={...slice.pivot,[k]:b[size]-1-slice.pivot[k]};if(slice.center)next.center={...slice.center,[k]:b[size]-slice.center[k]-slice.center[size]};return next;});}

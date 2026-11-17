function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function union(a,b){if(!a)return b;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};}
export function historyRenderImpact(entry){
 const frames=new Map(),cells=new Set();
 if(entry?.kind!=='delta')return{all:true,frames,cells};
 const {before,after}=entry;
 if(!same([before.width,before.height,before.layers,before.palette,before.transparentIndex,before.colorMode],[after.width,after.height,after.layers,after.palette,after.transparentIndex,after.colorMode]))return{all:true,frames,cells};
 for(let f=0;f<after.frames.length;f++)if(!same(before.frames[f].celProperties,after.frames[f].celProperties)){
  frames.set(f,null);for(let l=0;l<after.layers.length;l++)cells.add(f+':'+l);
 }
 for(const change of [...entry.changes,...entry.indexChanges||[]]){
  const {f,l,start}=change;cells.add(f+':'+l);if(frames.has(f)&&frames.get(f)===null)continue;
  const p=after.frames[f].celProperties?.[after.layers[l].id]||{x:0,y:0,width:after.width},end=start+change.after.length-1,top=Math.floor(start/p.width),bottom=Math.floor(end/p.width),left=top===bottom?start%p.width:0,right=top===bottom?end%p.width+1:p.width;
  frames.set(f,union(frames.get(f),{x:p.x+left,y:p.y+top,w:right-left,h:bottom-top+1}));
 }
 return{all:false,frames,cells};
}
export function invalidateHistoryCaches(doc,entry,{frameCache,referenceCache,onionCache}){
 const impact=historyRenderImpact(entry);
 if(impact.all){frameCache.clear();referenceCache.clear();onionCache.clear();return impact;}
 for(const cache of [frameCache,referenceCache]){
  // Undo/redo replaces metadata but retains untouched pixel buffers.
  if(cache.document)cache.document=doc;
  for(const [f,rect]of impact.frames)cache.invalidate(f,rect);
 }
 for(const key of onionCache.keys())if(impact.frames.has(Number(key.split(':')[0])))onionCache.delete(key);
 return impact;
}

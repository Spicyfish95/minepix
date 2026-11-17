export class CelOccupancy{
 constructor(){this.values=new WeakMap();}
 invalidate(pixels){if(pixels)this.values.delete(pixels);}
 filled(doc,f,l){
  const frame=doc.frames[f],indexed=doc.colorMode==='indexed'&&frame.indices?.[l],pixels=indexed||frame.cels[l],key=indexed?'index:'+doc.transparentIndex+':'+(doc.layers[l].type==='background'):'rgba';
  const cached=this.values.get(pixels);if(cached?.key===key)return cached.filled;
  const filled=indexed?(doc.layers[l].type==='background'?pixels.length>0:pixels.some(index=>index!==doc.transparentIndex)):pixels.some(pixel=>pixel&255);
  this.values.set(pixels,{key,filled});return filled;
 }
}
export function celLinkCounts(doc){
 const counts=new Map();for(const frame of doc.frames)for(const [layer,id]of Object.entries(frame.links||{})){const key=layer+':'+id;counts.set(key,(counts.get(key)||0)+1);}
 return(f,l)=>{const id=doc.frames[f].links?.[doc.layers[l].id];return id?counts.get(doc.layers[l].id+':'+id):1;};
}
export const layerUIKey=layers=>layers.map(({reference,tileset,...layer})=>({...layer,...(reference?{reference:{x:reference.x,y:reference.y,scale:reference.scale,path:reference.path,width:reference.width,height:reference.height}}:{}),...(tileset?{tileset:true}:{})}));

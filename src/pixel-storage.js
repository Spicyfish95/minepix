const entries=new WeakMap();
const caches=new WeakMap();
export const isPixelArray=value=>Array.isArray(value)||value instanceof Uint32Array||value instanceof Uint16Array||value instanceof Uint8Array;
export const documentJSON=value=>JSON.stringify(value,(_key,value)=>ArrayBuffer.isView(value)?Array.from(value):value);
// Editing buffers are materialized only when a caller needs them. Indices remain
// authoritative at committed boundaries; caches are discarded only after commit.
export function prepareDocumentPixels(doc){
 const rgba=new Map(),indexed=new Map();
 let shared=caches.get(doc);if(!shared)caches.set(doc,shared=new WeakMap());
 const holder=indices=>{if(!shared.has(indices))shared.set(indices,{cache:null});return shared.get(indices);};
 for(const frame of doc.frames){
  if(frame.indices)frame.indices=frame.indices.map(values=>{
   if(!values||values instanceof Uint16Array)return values;
   if(!indexed.has(values))indexed.set(values,Uint16Array.from(values));return indexed.get(values);
  });
  let slots=entries.get(frame.cels);if(!slots)entries.set(frame.cels,slots=new Map());
  for(let l=0;l<frame.cels.length;l++){
   const previous=slots.get(l),descriptor=Object.getOwnPropertyDescriptor(frame.cels,l);
   if(previous&&descriptor?.get===previous.get)continue;
   const values=frame.cels[l];
   if(doc.colorMode==='indexed'&&frame.indices?.[l]){
    const entry={indices:frame.indices[l],holder:holder(frame.indices[l])};
    Object.defineProperty(entry,'cache',{get:()=>entry.holder.cache,set:value=>{entry.holder.cache=value;}});
    entry.get=()=>{
     const indices=frame.indices?.[l];
     if(!indices)return entry.cache||new Uint32Array(0);
     if(entry.indices!==indices){entry.holder=holder(indices);entry.indices=indices;}
     if(!entry.cache||entry.indices!==indices){
      const background=doc.layers[l]?.type==='background',palette=doc.palette.map(color=>parseInt(color.slice(1).padEnd(8,'f'),16)>>>0);
      entry.cache=Uint32Array.from(indices,index=>background?(palette[index]|255)>>>0:index===doc.transparentIndex?0:palette[index]);entry.indices=indices;
     }
     return entry.cache;
    };
    Object.defineProperty(frame.cels,l,{enumerable:true,configurable:true,get:entry.get,set:value=>{entry.indices=frame.indices?.[l];if(entry.indices)entry.holder=holder(entry.indices);entry.cache=value instanceof Uint32Array?value:Uint32Array.from(value);}});
    slots.set(l,entry);
   }else{
    if(values instanceof Uint32Array)continue;
    if(!rgba.has(values))rgba.set(values,Uint32Array.from(values));frame.cels[l]=rgba.get(values);
   }
  }
 }
 return doc;
}
export function materializeDocumentPixels(doc){
 for(const frame of doc.frames)for(let l=0;l<frame.cels.length;l++){
  const descriptor=Object.getOwnPropertyDescriptor(frame.cels,l);if(descriptor?.get)Object.defineProperty(frame.cels,l,{value:frame.cels[l],writable:true,enumerable:true,configurable:true});
 }
 return doc;
}
export function releaseIndexedCaches(doc,keepFrame=-1){
 if(doc.colorMode!=='indexed')return;
 doc.frames.forEach((frame,f)=>{if(f===keepFrame)return;for(const [l,entry]of entries.get(frame.cels)||[])if(Object.getOwnPropertyDescriptor(frame.cels,l)?.get===entry.get)entry.cache=null;});
}
export function pixelStorageStats(doc){
 let indexBytes=0,rgbaBytes=0,cachedCels=0;const seen=new Set();
 for(const frame of doc.frames){for(const indices of frame.indices||[])if(indices&&!seen.has(indices)){seen.add(indices);indexBytes+=indices.byteLength||indices.length*2;}
  for(let l=0;l<frame.cels.length;l++){const entry=entries.get(frame.cels)?.get(l),buffer=entry&&Object.getOwnPropertyDescriptor(frame.cels,l)?.get===entry.get?entry.cache:frame.cels[l];if(buffer&&!seen.has(buffer)){seen.add(buffer);rgbaBytes+=buffer.byteLength||buffer.length*4;cachedCels++;}}
 }
 return{indexBytes,rgbaBytes,cachedCels};
}

export function pixelPlane(frame,layer){
 const entry=entries.get(frame.cels)?.get(layer);
 const derived=!!entry&&Object.getOwnPropertyDescriptor(frame.cels,layer)?.get===entry.get;
 return{derived,values:derived?entry.cache:frame.cels[layer]};
}

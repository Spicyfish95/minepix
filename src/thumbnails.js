import {celProperty} from './cel-properties.js';
import {isReference,referencePixels} from './layer-types.js';

export function sampleThumbnail(width,height,pixel,size=32){
 const rgba=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const value=pixel(Math.min(width-1,Math.floor(x*width/size)),Math.min(height-1,Math.floor(y*height/size))),i=(y*size+x)*4;
  rgba[i]=value>>>24;rgba[i+1]=value>>>16&255;rgba[i+2]=value>>>8&255;rgba[i+3]=value&255;
 }
 return rgba;
}
export function layerThumbnailPixels(doc,frame,layer,size=32){
 const source=doc.frames[frame],ref=doc.layers[layer].reference;
 if(isReference(doc.layers[layer])){
  const external=ref.data||ref.path,pixels=ref.data?referencePixels(ref):external?null:source.cels[layer],width=external?ref.width:doc.width,height=external?ref.height:doc.height;
  return sampleThumbnail(doc.width,doc.height,(x,y)=>{const sx=Math.floor((x-ref.x)/ref.scale),sy=Math.floor((y-ref.y)/ref.scale);return pixels&&sx>=0&&sy>=0&&sx<width&&sy<height?pixels[sy*width+sx]:0;},size);
 }
 const p=celProperty(doc,frame,layer),indices=doc.colorMode==='indexed'&&source.indices?.[layer],pixels=indices||source.cels[layer],palette=indices&&doc.palette.map(color=>parseInt(color.slice(1).padEnd(8,'f'),16)>>>0);
 return sampleThumbnail(doc.width,doc.height,(x,y)=>{
  x-=p.x;y-=p.y;if(x<0||y<0||x>=p.width||y>=p.height)return 0;
  const value=pixels[y*p.width+x];return indices?(doc.layers[layer].type==='background'?(palette[value]|255)>>>0:value===doc.transparentIndex?0:palette[value]):value;
 },size);
}

const KEY='minepix-recent-thumbnails-v1';
export function createThumbnailCache({storage,generate}){
 let cached={};try{cached=JSON.parse(storage.getItem(KEY)||'{}');}catch{/* A disposable cache may be unavailable. */}
 const pending=new Map();
 return async(entries,paths=entries.map(entry=>entry.path))=>{
  const active=new Set(entries.map(entry=>entry.path));for(const path of Object.keys(cached))if(!active.has(path))delete cached[path];
  const wanted=new Set(paths),results=[];
  for(const entry of entries.filter(entry=>wanted.has(entry.path))){
   const key=JSON.stringify([entry.path,entry.fileStamp]);
   try{
    if(!entry.fileStamp||cached[entry.path]?.key!==key){
     if(!pending.has(key))pending.set(key,Promise.resolve().then(()=>generate(entry.path)).finally(()=>pending.delete(key)));
     const thumbnail=await pending.get(key);cached[entry.path]={key,thumbnail};
    }
    results.push(cached[entry.path].thumbnail);
   }catch{/* One unreadable recent file must not hide the others. */}
  }
  try{storage.setItem(KEY,JSON.stringify(cached));}catch{/* Thumbnails remain usable when storage is full. */}
  return results;
 };
}

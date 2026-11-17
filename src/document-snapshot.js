import {prepareDocumentPixels} from './pixel-storage.js';

// Clone metadata separately so reading an indexed snapshot never invokes RGBA getters.
// Plane copies preserve aliases, but never share storage with the editing document.
export function snapshotDocument(document){
 if(!document.frames)return structuredClone(document);
 const frames=new Map(),planes=new Map();
 const metadata={...document,frames:document.frames.map(frame=>{
  if(!frames.has(frame)){const {cels,indices,...rest}=frame;frames.set(frame,{...rest,cels:[],...(indices?{indices:[]}:indices===null?{indices:null}:{})});}
  return frames.get(frame);
 })};
 const snapshot=structuredClone(metadata),completed=new Set();
 const plane=(pixels,Type)=>{
  if(!pixels)return pixels;
  if(!planes.has(pixels)){
   const max=Type===Uint8Array?255:0xffffffff;
   if(!(pixels instanceof Type)&&pixels.some(pixel=>!Number.isInteger(pixel)||pixel<0||pixel>max))throw new Error('项目像素值越界');
   planes.set(pixels,Type.from(pixels));
  }
  return planes.get(pixels);
 };
 document.frames.forEach((frame,f)=>{
  const target=snapshot.frames[f];if(completed.has(target))return;completed.add(target);
  if(frame.indices)target.indices=frame.indices.map(values=>plane(values,Uint8Array));
  target.cels=Array.from({length:frame.cels.length},(_,l)=>document.colorMode==='indexed'&&frame.indices?.[l]?null:plane(frame.cels[l],Uint32Array));
 });
 return prepareDocumentPixels(snapshot);
}

// The caller owns the snapshot. Only its buffers may be detached for a Worker.
export function snapshotMessage(document){
 const buffers=new Set(),frames=new Map();
 const include=pixels=>{if(ArrayBuffer.isView(pixels))buffers.add(pixels.buffer);return pixels;};
 const message={...document,...(document.frames?{frames:document.frames.map(frame=>{
  if(!frames.has(frame))frames.set(frame,{...frame,cels:Array.from({length:frame.cels.length},(_,l)=>document.colorMode==='indexed'&&frame.indices?.[l]?null:include(frame.cels[l])),...(frame.indices?{indices:frame.indices.map(include)}:{})});
  return frames.get(frame);
 })}:{})};
 return{document:message,transfer:[...buffers]};
}

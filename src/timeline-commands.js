import {remapSliceFrames} from './slices.js';
import {initializeFrameLinks} from './cel-links.js';
import { sheetLayout } from './formats/sprite-sheet.js';
import { clone } from './model.js';
import {assertProjectCapacity,celPixelCount} from './project-capacity.js';

export const sortedFrames=selection=>[...selection].sort((a,b)=>a-b);
export function remapTags(tags,sources){
  return tags.flatMap(tag=>{
    const positions=sources.flatMap((source,i)=>source>=tag.from&&source<=tag.to?[i]:[]);
    return positions.length?[{...tag,from:positions[0],to:positions.at(-1)}]:[];
  });
}
function applyOrder(doc,order){
  doc.slices=remapSliceFrames(doc.slices,order);doc.tags=remapTags(doc.tags,order);doc.frames=order.map(index=>doc.frames[index]);
}
export function frameMoveOrder(count,selection,target){
  const selected=sortedFrames(selection),remaining=Array.from({length:count},(_,i)=>i).filter(i=>!selection.has(i));
  const position=remaining.filter(i=>i<target).length;
  remaining.splice(position,0,...selected);return remaining;
}
export function moveFrames(doc,selection,target){
  const order=frameMoveOrder(doc.frames.length,selection,target);applyOrder(doc,order);
  return order.flatMap((source,i)=>selection.has(source)?[i]:[]);
}
export function reverseFrames(doc,selection){
  const indices=sortedFrames(selection),order=doc.frames.map((_,i)=>i);
  indices.forEach((index,i)=>order[index]=indices.at(-1-i));applyOrder(doc,order);
}
export function duplicateFrames(doc,selection,position){
  const selected=sortedFrames(selection);
  assertProjectCapacity(doc,{frames:doc.frames.length+selected.length,pixels:celPixelCount(doc)+selected.reduce((n,f)=>n+doc.frames[f].cels.reduce((sum,cel)=>sum+cel.length,0),0)});
  const sources=doc.frames.map((_,i)=>i),copies=selected.map(i=>clone(doc.frames[i]));
  copies.forEach((frame,i)=>initializeFrameLinks(doc,doc.frames[selected[i]],frame));
  sources.splice(position,0,...selected);doc.slices=remapSliceFrames(doc.slices,sources);doc.tags=remapTags(doc.tags,sources);doc.frames.splice(position,0,...copies);
  return copies.map((_,i)=>position+i);
}
export function deleteFrames(doc,selection){
  if(selection.size===doc.frames.length)throw new Error('至少保留一帧');
  const order=doc.frames.map((_,i)=>i).filter(i=>!selection.has(i));applyOrder(doc,order);
  return Math.min(Math.min(...selection),doc.frames.length-1);
}
export function selectTimelineFrames(selection,anchor,index,{shiftKey=false,ctrlKey=false,metaKey=false}={}){
  if(shiftKey){const range=Array.from({length:Math.abs(index-anchor)+1},(_,i)=>Math.min(index,anchor)+i);return new Set(ctrlKey||metaKey?[...selection,...range]:range);}
  if(ctrlKey||metaKey){const next=new Set(selection);if(next.has(index)&&next.size>1)next.delete(index);else next.add(index);return next;}
  return new Set([index]);
}
export function scopeFrames(doc,scope,selection){
  if(scope==='selected')return sortedFrames(selection);
  const tag=doc.tags.find(tag=>tag.id===scope);
  const from=tag?.from??0,to=tag?.to??doc.frames.length-1;
  return Array.from({length:to-from+1},(_,i)=>from+i);
}
export function sheetMetadata(doc,indices,columns,scale,options={}){
  const layout=sheetLayout(doc.width,doc.height,indices.length,{...options,columns,scale});
  return{app:'pixel-studio',image:doc.name+'-sheet.png',size:{w:layout.width,h:layout.height},tags:remapTags(doc.tags,indices),frames:indices.map((sourceIndex,i)=>({index:i,sourceIndex,frame:layout.rects[i],duration:doc.frames[sourceIndex].duration}))};
}

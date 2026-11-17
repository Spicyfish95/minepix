import {prepareDocumentPixels} from './pixel-storage.js';
import {canonicalizeColors} from './color-modes.js';
import {hydrateLinks,synchronizeLinks,linkedMembers} from './cel-links.js';
import {finalizeBackground} from './layer-types.js';
import {isTileset} from './tilemap.js';
const copy=value=>structuredClone(value);
const meta=({references,...doc})=>({...doc,frames:doc.frames.map(({cels,indices,...frame})=>frame)});
const scopes=new WeakMap();
function packed(doc){
 const planes=new Map(),plane=(pixels,Type)=>{if(!planes.has(pixels))planes.set(pixels,Type.from(pixels));return planes.get(pixels);};
 return{meta:copy(meta(doc)),cels:doc.frames.map(frame=>Array.from({length:frame.cels.length},(_,l)=>doc.colorMode==='indexed'&&frame.indices?.[l]?null:plane(frame.cels[l],Uint32Array))),indices:doc.frames.map(frame=>frame.indices?.map(cel=>cel?plane(cel,Uint8Array):null))};
}
function unpack(state){
 const planes=new Map(),plane=(pixels,Type)=>{if(!pixels)return pixels;if(!planes.has(pixels))planes.set(pixels,Type.from(pixels));return planes.get(pixels);};
 return hydrateLinks(prepareDocumentPixels({...copy(state.meta),frames:state.meta.frames.map((frame,i)=>({...copy(frame),cels:state.cels[i].map(cel=>plane(cel,Uint32Array)),...(state.indices[i]?{indices:state.indices[i].map(cel=>plane(cel,Uint8Array))}:{})}))}));
}
function pixelBytes(planes){const seen=new Set();let bytes=0;for(const plane of planes)if(plane&&!seen.has(plane)){seen.add(plane);bytes+=plane.byteLength;}return bytes;}
const packedBytes=state=>JSON.stringify(state.meta).length*2+pixelBytes([...state.cels.flat(),...state.indices.flat().filter(Boolean)]);
function samePreview(a,b){return a===b||!!a&&!!b&&a.layerId===b.layerId&&a.w===b.w&&a.h===b.h&&a.cells.length===b.cells.length&&a.cells.every((value,index)=>value===b.cells[index]);}
const ownsPreview=(doc,preview)=>doc.layers.some(layer=>layer.id===preview.layerId&&isTileset(layer));
function preservePreview(doc,entry,result){
 const before=entry.kind==='snapshot'?entry.before.meta:entry.before,after=entry.kind==='snapshot'?entry.after.meta:entry.after;
 const stableOwner=!before.previewTerrain||ownsPreview(before,before.previewTerrain)===ownsPreview(after,before.previewTerrain);
 if(stableOwner&&samePreview(before.previewTerrain,after.previewTerrain)){
  const preview=doc.previewTerrain;
  if(preview&&ownsPreview(result,preview))result.previewTerrain=copy(preview);
  else delete result.previewTerrain;
 }
 else if(result.previewTerrain&&!ownsPreview(result,result.previewTerrain))delete result.previewTerrain;
 return result;
}
function preserveReferences(doc,result){
 if(doc.references)result.references=copy(doc.references);else delete result.references;
 if(doc.references?.length&&!result.requiredFeatures.includes('reference-board'))result.requiredFeatures.push('reference-board');
}
function difference(before,after,{blocks=null}={}){
 const bm=meta(before),am=meta(after),scope=scopes.get(before),sameShape=before.width===after.width&&before.height===after.height&&before.frames.length===after.frames.length&&before.layers.length===after.layers.length&&before.colorMode===after.colorMode&&before.layers.every((layer,l)=>layer.id===after.layers[l].id)&&before.frames.every((frame,f)=>frame.cels.length===after.frames[f].cels.length&&Array.from({length:frame.cels.length},(_,l)=>{
  if(scope&&!scope.cells.has(f+':'+l))return true;
  const a=before.colorMode==='indexed'&&frame.indices?.[l]||frame.cels[l],b=after.colorMode==='indexed'&&after.frames[f].indices?.[l]||after.frames[f].cels[l];
  return a.length===b.length&&!!frame.indices?.[l]===!!after.frames[f].indices?.[l];
 }).every(Boolean));
 if(!sameShape){const a=packed(before),b=packed(after);return{kind:'snapshot',before:a,after:b,bytes:packedBytes(a)+packedBytes(b)};}
 const changes=[],indexChanges=[],compared=new Map();
 function delta(a,b,Type){
  if(a===b||!a)return[];
  let targets=compared.get(a);if(!targets)compared.set(a,targets=new Map());if(targets.has(b))return targets.get(b);
  const found=[],starts=blocks?[...blocks].sort((a,b)=>a-b):Array.from({length:Math.ceil(a.length/256)},(_,i)=>i*256);
  for(const start of starts){const end=Math.min(a.length,start+256);let changed=false;for(let i=start;i<end;i++)if(a[i]!==b[i]){changed=true;break;}if(changed)found.push({start,before:Type.from(a.slice(start,end)),after:Type.from(b.slice(start,end))});}
  targets.set(b,found);return found;
 }
 for(let f=0;f<before.frames.length;f++)for(let l=0;l<before.layers.length;l++){
  if(scope&&!scope.cells.has(f+':'+l))continue;
  for(const block of delta(before.frames[f].cels[l],after.frames[f].cels[l],Uint32Array))changes.push({f,l,...block});
  if(after.colorMode==='indexed')for(const block of delta(before.frames[f].indices?.[l],after.frames[f].indices?.[l],Uint8Array))indexChanges.push({f,l,...block});
 }
 const beforeMeta=JSON.stringify(bm),afterMeta=JSON.stringify(am);if(!changes.length&&!indexChanges.length&&beforeMeta===afterMeta)return null;
 const all=[...changes,...indexChanges];return{kind:'delta',before:copy(bm),after:copy(am),changes,indexChanges,bytes:beforeMeta.length*2+afterMeta.length*2+pixelBytes(all.flatMap(c=>[c.before,c.after]))+all.length*32};
}
function apply(doc,entry,side){
 if(entry.kind==='snapshot')return unpack(entry[side]);
 const metadata=copy(entry[side]),indexTouched=new Set((entry.indexChanges||[]).map(c=>c.f+':'+c.l)),touched=new Set(entry.changes.map(c=>c.f+':'+c.l));
 metadata.frames=metadata.frames.map((frame,f)=>({...frame,...(doc.frames[f].indices?{indices:doc.frames[f].indices.map((cel,l)=>indexTouched.has(f+':'+l)?cel.slice():cel)}:{}),cels:Array.from({length:doc.frames[f].cels.length},(_,l)=>metadata.colorMode==='indexed'&&doc.frames[f].indices?.[l]?null:touched.has(f+':'+l)?doc.frames[f].cels[l].slice():doc.frames[f].cels[l])}));
 for(const change of entry.changes){if(metadata.colorMode==='indexed'&&metadata.frames[change.f].indices?.[change.l])continue;const cel=metadata.frames[change.f].cels[change.l],values=change[side];for(let i=0;i<values.length;i++)cel[change.start+i]=values[i];}
 for(const change of entry.indexChanges||[]){const values=change[side],cel=metadata.frames[change.f].indices[change.l];for(let i=0;i<values.length;i++)cel[change.start+i]=values[i];}
 return hydrateLinks(metadata.colorMode==='indexed'?prepareDocumentPixels(metadata):metadata);
}
export function snapshotMetadata(doc){
 const snapshot=copy(meta(doc));if(doc.references)snapshot.references=doc.references;
 snapshot.frames.forEach((frame,f)=>{const source=doc.frames[f];frame.cels=doc.colorMode==='indexed'?Array.from({length:source.cels.length},(_,l)=>source.indices?.[l]?null:source.cels[l]):source.cels;if(source.indices)frame.indices=source.indices.slice();});
 scopes.set(snapshot,{metadataOnly:true,cells:new Set()});return doc.colorMode==='indexed'?prepareDocumentPixels(snapshot):snapshot;
}
export function snapshotCel(doc,frame,layer){
 const members=new Set(linkedMembers(doc,frame,layer)),pixels=doc.frames[frame].cels[layer].slice(),indices=doc.frames[frame].indices?.[layer]?.slice();
 const snapshot={...doc,frames:doc.frames.map((value,f)=>{
  if(doc.colorMode==='indexed')return{...value,indices:value.indices?.map((values,l)=>members.has(f)&&l===layer?indices:values),cels:Array.from({length:value.cels.length},(_,l)=>value.indices?.[l]?null:members.has(f)&&l===layer?pixels:value.cels[l])};
  if(!members.has(f))return value;
  const cels=Object.defineProperties([],Object.getOwnPropertyDescriptors(value.cels));Object.defineProperty(cels,layer,{value:pixels,enumerable:true,configurable:true,writable:true});
  return{...value,...(value.indices?{indices:value.indices.map((values,l)=>l===layer?indices:values)}:{}),cels};
 })};
 scopes.set(snapshot,{cells:new Set([...members].map(f=>f+':'+layer))});return doc.colorMode==='indexed'?prepareDocumentPixels(snapshot):snapshot;
}
export class History{
 constructor(max=40,budget=96*1024*1024){this.max=max;this.budget=budget;this.reset();}
 reset(){this.undoStack=[];this.redoStack=[];this.revision=0;this.nextRevision=1;}
 get memoryBytes(){return[...this.undoStack,...this.redoStack].reduce((sum,entry)=>sum+entry.bytes,0);}
 trim(){while(this.memoryBytes>this.budget||this.undoStack.length+this.redoStack.length>this.max){if(this.undoStack.length)this.undoStack.shift();else if(this.redoStack.length)this.redoStack.shift();else break;}}
 push(before,after,{colorsReady=false,blocks=null}={}){const scope=scopes.get(before);if(after&&!scope?.metadataOnly){finalizeBackground(after,{cells:scope?.cells});if(!colorsReady)canonicalizeColors(after,{before,cells:scope?.cells});synchronizeLinks(before,after);}let entry;if(after)entry=difference(before,after,{blocks:scope&&!scope.metadataOnly?blocks:null});else{const state=packed(before);entry={kind:'pending',before:state,bytes:packedBytes(state)};}if(!entry)return false;entry.beforeRevision=this.revision;entry.afterRevision=this.nextRevision++;this.revision=entry.afterRevision;this.undoStack.push(entry);this.redoStack=[];this.trim();return true;}
 undo(doc){
  let entry=this.undoStack.pop();
  if(!entry)return null;
  if(entry.kind==='pending'){
   const delta=difference(unpack(entry.before),doc);
   if(delta)entry={...delta,beforeRevision:entry.beforeRevision,afterRevision:entry.afterRevision};
   else{
    const after=packed(doc);
    entry={...entry,kind:'snapshot',after,bytes:entry.bytes+packedBytes(after)};
   }
  }
  const result=preservePreview(doc,entry,apply(doc,entry,'before'));
  preserveReferences(doc,result);
  this.revision=entry.beforeRevision;this.redoStack.push(entry);this.trim();
  return result;
 }
 redo(doc){const entry=this.redoStack.pop();if(!entry)return null;const result=preservePreview(doc,entry,apply(doc,entry,'after'));preserveReferences(doc,result);this.revision=entry.afterRevision;this.undoStack.push(entry);this.trim();return result;}
 capture(){return{undo:[...this.undoStack],redo:[...this.redoStack],revision:this.revision,nextRevision:this.nextRevision};}
 restore(state){this.undoStack=[...state.undo];this.redoStack=[...state.redo];this.revision=state.revision;this.nextRevision=state.nextRevision;this.trim();}
}

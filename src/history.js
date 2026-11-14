import {canonicalizeColors} from './color-modes.js';
import {hydrateLinks,synchronizeLinks,linkedMembers} from './cel-links.js';
import {finalizeBackground} from './layer-types.js';
import {isTileset} from './tilemap.js';
const copy=value=>structuredClone(value);
const meta=doc=>({...doc,frames:doc.frames.map(({cels,indices,...frame})=>frame)});
function packed(doc){return{meta:copy(meta(doc)),cels:doc.frames.map(frame=>frame.cels.map(cel=>Uint32Array.from(cel))),indices:doc.frames.map(frame=>frame.indices?.map(cel=>cel?Uint8Array.from(cel):null))};}
function unpack(state){return hydrateLinks({...copy(state.meta),frames:state.meta.frames.map((frame,i)=>({...copy(frame),cels:state.cels[i].map(cel=>Array.from(cel)),...(state.indices[i]?{indices:state.indices[i].map(cel=>cel?Array.from(cel):null)}:{})}))});}
const packedBytes=state=>JSON.stringify(state.meta).length*2+state.cels.reduce((sum,cels)=>sum+cels.reduce((n,cel)=>n+cel.byteLength,0),0)+state.indices.reduce((sum,cels)=>sum+(cels?.reduce((n,cel)=>n+(cel?.byteLength||0),0)||0),0);
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
function difference(before,after){
 const bm=meta(before),am=meta(after),sameShape=before.width===after.width&&before.height===after.height&&before.frames.length===after.frames.length&&before.layers.length===after.layers.length&&before.colorMode===after.colorMode&&before.frames.every((frame,f)=>frame.cels.every((cel,l)=>cel.length===after.frames[f].cels[l].length))&&before.layers.every((_,l)=>!!before.frames[0].indices?.[l]===!!after.frames[0].indices?.[l]);
 if(!sameShape){const a=packed(before),b=packed(after);return{kind:'snapshot',before:a,after:b,bytes:packedBytes(a)+packedBytes(b)};}
 const changes=[];for(let f=0;f<before.frames.length;f++)for(let l=0;l<before.layers.length;l++){const a=before.frames[f].cels[l],b=after.frames[f].cels[l];if(a===b)continue;for(let start=0;start<a.length;start+=256){const end=Math.min(a.length,start+256);let changed=false;for(let i=start;i<end;i++)if(a[i]!==b[i]){changed=true;break;}if(changed)changes.push({f,l,start,before:Uint32Array.from(a.slice(start,end)),after:Uint32Array.from(b.slice(start,end))});}}
 const indexChanges=[];if(after.colorMode==='indexed')for(let f=0;f<before.frames.length;f++)for(let l=0;l<before.layers.length;l++){const a=before.frames[f].indices[l],b=after.frames[f].indices[l];if(!a||a===b)continue;for(let start=0;start<a.length;start+=256){const end=Math.min(a.length,start+256);let changed=false;for(let i=start;i<end;i++)if(a[i]!==b[i]){changed=true;break;}if(changed)indexChanges.push({f,l,start,before:Uint8Array.from(a.slice(start,end)),after:Uint8Array.from(b.slice(start,end))});}}
 const beforeMeta=JSON.stringify(bm),afterMeta=JSON.stringify(am);if(!changes.length&&!indexChanges.length&&beforeMeta===afterMeta)return null;
 return{kind:'delta',before:copy(bm),after:copy(am),changes,indexChanges,bytes:beforeMeta.length*2+afterMeta.length*2+[...changes,...indexChanges].reduce((sum,c)=>sum+c.before.byteLength+c.after.byteLength+32,0)};
}
function apply(doc,entry,side){if(entry.kind==='snapshot')return unpack(entry[side]);const metadata=copy(entry[side]),indexTouched=new Set((entry.indexChanges||[]).map(c=>c.f+':'+c.l)),touched=new Set(entry.changes.map(c=>c.f+':'+c.l));metadata.frames=metadata.frames.map((frame,f)=>({...frame,...(doc.frames[f].indices?{indices:doc.frames[f].indices.map((cel,l)=>indexTouched.has(f+':'+l)?cel.slice():cel)}:{}),cels:doc.frames[f].cels.map((cel,l)=>touched.has(f+':'+l)?cel.slice():cel)}));for(const change of entry.changes){const cel=metadata.frames[change.f].cels[change.l],values=change[side];for(let i=0;i<values.length;i++)cel[change.start+i]=values[i];}for(const change of entry.indexChanges||[]){const values=change[side],cel=metadata.frames[change.f].indices[change.l];for(let i=0;i<values.length;i++)cel[change.start+i]=values[i];}return hydrateLinks(metadata);}
export function snapshotCel(doc,frame,layer){const members=new Set(linkedMembers(doc,frame,layer)),copy=doc.frames[frame].cels[layer].slice(),indexCopy=doc.frames[frame].indices?.[layer]?.slice();return{...doc,frames:doc.frames.map((value,f)=>members.has(f)?{...value,...(value.indices?{indices:value.indices.map((pixels,l)=>l===layer?indexCopy:pixels)}:{}),cels:value.cels.map((pixels,l)=>l===layer?copy:pixels)}:value)};}
export class History{
 constructor(max=40,budget=96*1024*1024){this.max=max;this.budget=budget;this.reset();}
 reset(){this.undoStack=[];this.redoStack=[];this.revision=0;this.nextRevision=1;}
 get memoryBytes(){return[...this.undoStack,...this.redoStack].reduce((sum,entry)=>sum+entry.bytes,0);}
 trim(){while(this.memoryBytes>this.budget||this.undoStack.length+this.redoStack.length>this.max){if(this.undoStack.length)this.undoStack.shift();else if(this.redoStack.length)this.redoStack.shift();else break;}}
 push(before,after,{colorsReady=false}={}){if(after){finalizeBackground(after);if(!colorsReady)canonicalizeColors(after,{before});synchronizeLinks(before,after);}let entry;if(after)entry=difference(before,after);else{const state=packed(before);entry={kind:'pending',before:state,bytes:packedBytes(state)};}if(!entry)return false;entry.beforeRevision=this.revision;entry.afterRevision=this.nextRevision++;this.revision=entry.afterRevision;this.undoStack.push(entry);this.redoStack=[];this.trim();return true;}
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

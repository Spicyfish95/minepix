import {celPixels,celProperty,setCelProperty} from './cel-properties.js';
import {isReference,isBackground} from './layer-types.js';
import {layerState} from './layer-tree.js';
import { copyRegion, clearRegion, pasteRegion, flipRegion } from './model.js';
import { transformSelectionRegion } from './selection-mask.js';

export function celRectangle(a,b=a){
  return{fromFrame:Math.min(a.frame,b.frame),toFrame:Math.max(a.frame,b.frame),fromLayer:Math.min(a.layer,b.layer),toLayer:Math.max(a.layer,b.layer)};
}
export const containsCel=(range,frame,layer)=>!!range&&frame>=range.fromFrame&&frame<=range.toFrame&&layer>=range.fromLayer&&layer<=range.toLayer;
export function celTargets(range){
  const targets=[];
  for(let frame=range.fromFrame;frame<=range.toFrame;frame++)for(let layer=range.toLayer;layer>=range.fromLayer;layer--)targets.push({frame,layer});
  return targets;
}
function assertRange(doc,range){
  if(!Object.values(range).every(Number.isInteger)||range.fromFrame<0||range.toFrame<range.fromFrame||range.toFrame>=doc.frames.length||range.fromLayer<0||range.toLayer<range.fromLayer||range.toLayer>=doc.layers.length)throw new Error('cel 范围超出已有帧或图层');
}
export function assertEditableCels(doc,range){
  assertRange(doc,range);
  for(let layer=range.fromLayer;layer<=range.toLayer;layer++)if(layerState(doc,layer).locked||!layerState(doc,layer).visible)throw new Error('范围包含锁定或隐藏图层：'+doc.layers[layer].name);
}
function snapshot(doc,range){
  const data=[],indexData=[],properties=[];
  for(let f=range.fromFrame;f<=range.toFrame;f++){const row=[];for(let l=range.toLayer;l>=range.fromLayer;l--)row.push(doc.frames[f].cels[l].slice());data.push(row);properties.push(Array.from({length:range.toLayer-range.fromLayer+1},(_,i)=>celProperty(doc,f,range.toLayer-i)));if(doc.colorMode==='indexed')indexData.push(Array.from({length:range.toLayer-range.fromLayer+1},(_,i)=>doc.frames[f].indices[range.toLayer-i]?.slice()||null));}
  return{width:doc.width,height:doc.height,frames:range.toFrame-range.fromFrame+1,layers:range.toLayer-range.fromLayer+1,data,properties,...(doc.colorMode==='indexed'?{indexed:{palette:[...doc.palette],transparentIndex:doc.transparentIndex,data:indexData}}:{})};
}
export function copyCels(doc,range){assertRange(doc,range);if(doc.layers.slice(range.fromLayer,range.toLayer+1).some(isReference))throw new Error('参考层不参与cel剪贴板，请先转为普通图层');return snapshot(doc,range);}
function erase(doc,range){for(const {frame,layer}of celTargets(range)){if(doc.frames[frame].celProperties?.[doc.layers[layer].id])setCelProperty(doc,frame,layer,{x:0,y:0,width:doc.width,height:doc.height});doc.frames[frame].cels[layer]=new Array(doc.width*doc.height).fill(isBackground(doc.layers[layer])?doc.layers[layer].clearColor:0);if(doc.frames[frame].indices)doc.frames[frame].indices[layer]=new Array(doc.width*doc.height).fill(isBackground(doc.layers[layer])?doc.layers[layer].clearIndex:doc.transparentIndex);}}
export function clearCels(doc,range){assertEditableCels(doc,range);erase(doc,range);}
function paste(doc,clip,frame,topLayer){
  const same=clip.indexed&&JSON.stringify(clip.indexed.palette)===JSON.stringify(doc.palette)&&clip.indexed.transparentIndex===doc.transparentIndex;clip.data.forEach((row,f)=>row.forEach((pixels,l)=>{const property=clip.properties?.[f]?.[l];if(property&&(property.x||property.y||property.width!==doc.width||property.height!==doc.height||property.opacity!==100)||doc.frames[frame+f].celProperties?.[doc.layers[topLayer-l].id])setCelProperty(doc,frame+f,topLayer-l,property||{x:0,y:0,width:doc.width,height:doc.height,opacity:100});doc.frames[frame+f].cels[topLayer-l]=pixels.slice();if(same)doc.frames[frame+f].indices[topLayer-l]=clip.indexed.data[f][l]?.slice()||null;}));
}
export function pasteCels(doc,clip,frame,topLayer){
  if(clip.width!==doc.width||clip.height!==doc.height)throw new Error('cel 剪贴板与当前画布尺寸不同');
  const range={fromFrame:frame,toFrame:frame+clip.frames-1,fromLayer:topLayer-clip.layers+1,toLayer:topLayer};
  assertEditableCels(doc,range);paste(doc,clip,frame,topLayer);return range;
}
export function moveCels(doc,range,frames,layers){
  const target={fromFrame:range.fromFrame+frames,toFrame:range.toFrame+frames,fromLayer:range.fromLayer+layers,toLayer:range.toLayer+layers};
  assertEditableCels(doc,range);assertEditableCels(doc,target);
  const clip=snapshot(doc,range);erase(doc,range);paste(doc,clip,target.fromFrame,target.toLayer);return target;
}
export function celContentBounds(doc,range){
  let left=doc.width,top=doc.height,right=-1,bottom=-1;
  for(const {frame,layer}of celTargets(range))celPixels(doc,frame,layer).forEach((pixel,i)=>{
    if(!(pixel&255))return;const x=i%doc.width,y=Math.floor(i/doc.width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  });
  return right<left?null:{x:left,y:top,w:right-left+1,h:bottom-top+1};
}
export function transformCels(doc,range,bounds,state,regions=null){
  assertEditableCels(doc,range);
  for(const {frame,layer}of celTargets(range)){
    const pixels=celPixels(doc,frame,layer),region=regions?.get(frame+':'+layer)||copyRegion(doc,pixels,bounds),transformed=transformSelectionRegion(region,state);
    clearRegion(doc,pixels,bounds);pasteRegion(doc,pixels,transformed,transformed.x,transformed.y,null,true);
  }
}
export function flipCels(doc,range,bounds,axis){assertEditableCels(doc,range);for(const {frame,layer}of celTargets(range))flipRegion(doc,celPixels(doc,frame,layer),bounds,axis);}

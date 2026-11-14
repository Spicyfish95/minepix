import {isReference,isBackground} from './layer-types.js';
import {isGroup,layerState,ancestors} from './layer-tree.js';
import { composite } from './model.js';

function mergedCels(doc, indices) {
  const ids=new Set(indices.map(i=>doc.layers[i].id)),layers=indices.map(i=>{const layer={...doc.layers[i]};if(!ids.has(layer.parentId))delete layer.parentId;return layer;});
  return doc.frames.map(frame=>{
    const rgba=composite({width:doc.width,height:doc.height,layers,frames:[{cels:indices.map(i=>frame.cels[i]),celProperties:frame.celProperties}]},0);
    const pixels=[];
    for(let i=0;i<rgba.length;i+=4)pixels.push(((rgba[i]<<24)|(rgba[i+1]<<16)|(rgba[i+2]<<8)|rgba[i+3])>>>0);
    return pixels;
  });
}
function prune(doc){const ids=new Set(doc.layers.map(l=>String(l.id)));for(const frame of doc.frames)if(frame.celProperties)for(const id of Object.keys(frame.celProperties))if(!ids.has(id))delete frame.celProperties[id];}
function checkLayers(doc, indices) {
  if(indices.length<2)throw new Error('至少需要两个图层才能合并');
  if(indices.some(i=>layerState(doc,i).locked&&!isGroup(doc.layers[i])||doc.layers[i].locked))throw new Error('请先解锁要合并的图层');
  if(indices.some(i=>!layerState(doc,i).visible))throw new Error('请先显示要合并的图层');
}
export function mergeDown(doc, index) {
  if(index===0)throw new Error('当前已经是最底层');
  const indices=[index-1,index];if(indices.some(i=>isGroup(doc.layers[i]))||doc.layers[index].parentId!==doc.layers[index-1].parentId)throw new Error('向下合并需要同组的两个像素图层；组级合成请使用合并可见或扁平化');checkLayers(doc,indices);
  if(indices.some(i=>doc.layers[i].blendMode&&doc.layers[i].blendMode!=='normal'))throw new Error('带混合模式的图层请使用合并可见或扁平化，以保留与下方图层的合成结果');
  const cels=mergedCels(doc,indices),ids=indices.map(i=>doc.layers[i].id);
  doc.layers.splice(index-1,2,{...doc.layers[index-1],opacity:100,blendMode:'normal'});
  doc.frames.forEach((frame,i)=>{frame.cels.splice(index-1,2,cels[i]);for(const id of ids)delete frame.links?.[id];if(frame.celProperties){delete frame.celProperties[doc.layers[index-1].id];}});
  prune(doc);return index-1;
}
export function mergeVisible(doc) {
  const indices=doc.layers.flatMap((layer,i)=>!isGroup(layer)&&!isReference(layer)&&layerState(doc,i).visible?[i]:[]);checkLayers(doc,indices);
  const cels=mergedCels(doc,[...doc.layers.keys()]),chosen=new Set(indices),keep=doc.layers.flatMap((layer,i)=>{if(chosen.has(i))return[];if(isGroup(layer)&&!doc.layers.some((child,j)=>!isGroup(child)&&!chosen.has(j)&&ancestors(doc,j).includes(i)))return[];return[i];}),merged={id:Math.max(...doc.layers.map(l=>l.id))+1,name:'合并可见图层',visible:true,locked:false,opacity:100};
  const bg=doc.layers.find(layer=>isBackground(layer)&&layer.visible);if(bg){merged.type='background';merged.clearColor=bg.clearColor;}doc.layers=bg?[merged,...keep.map(i=>doc.layers[i])]:[...keep.map(i=>doc.layers[i]),merged];doc.frames.forEach((frame,f)=>frame.cels=bg?[cels[f],...keep.map(i=>frame.cels[i])]:[...keep.map(i=>frame.cels[i]),cels[f]]);prune(doc);return bg?0:doc.layers.length-1;
}
export function flattenSprite(doc) {
  if(doc.layers.some(layer=>layer.locked))throw new Error('请先解锁全部图层');
  const cels=mergedCels(doc,[...doc.layers.keys()]);
  const id=Math.max(...doc.layers.map(layer=>layer.id))+1;const bg=doc.layers.find(layer=>isBackground(layer)&&layer.visible);
  doc.layers=[{id,name:'扁平图层',visible:true,locked:false,opacity:100,...(bg?{type:'background',clearColor:bg.clearColor}:{})}];
  doc.frames.forEach((frame,i)=>frame.cels=[cels[i]]);
  prune(doc);return 0;
}

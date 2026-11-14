import {referencePixels,validateImageData} from './layer-types.js';
import {assertProjectCapacity,sourcePixelCount} from './project-capacity.js';
export const BOARD_MIN=512;
const ID_LIMIT=64,NAME_LIMIT=120,POSITION_LIMIT=1e6,MIN_SCALE=.125,MAX_SCALE=16;
export function validateBoardItem(item){
  if(!item||typeof item!=='object')throw new Error('参考图片数据无效');
  if(typeof item.id!=='string'||!item.id||item.id.length>ID_LIMIT)throw new Error('参考图片 id 无效');
  if(typeof item.name!=='string'||!item.name.trim()||item.name.length>NAME_LIMIT)throw new Error('参考图片名称无效');
  if(!Number.isInteger(item.width)||!Number.isInteger(item.height)||item.width<1||item.height<1)throw new Error('参考图片尺寸无效');
  validateImageData(item.width,item.height,item.data);
  if(!Number.isFinite(item.x)||!Number.isFinite(item.y)||Math.abs(item.x)>POSITION_LIMIT||Math.abs(item.y)>POSITION_LIMIT)throw new Error('参考图片位置无效');
  if(!Number.isFinite(item.scale)||item.scale<MIN_SCALE||item.scale>MAX_SCALE)throw new Error('参考图片缩放无效');
  return{id:item.id,name:item.name,width:item.width,height:item.height,data:item.data,x:item.x,y:item.y,scale:item.scale};
}
export function validateReferences(list){
  if(!Array.isArray(list))throw new Error('参考图片列表必须是数组');
  const ids=new Set();
  return list.map(item=>{const normalized=validateBoardItem(item);if(ids.has(normalized.id))throw new Error('参考图片 id 重复');ids.add(normalized.id);return normalized;});
}
export function boardItemPixels(item){return referencePixels(item);}
function findReference(doc,id){const item=doc.references?.find(reference=>reference.id===id);if(!item)throw new Error('参考图片不存在');return item;}
export function addReference(doc,item){
  if(!item||typeof item!=='object')throw new Error('参考图片数据无效');
  const normalized=validateBoardItem({...item,id:item.id??crypto.randomUUID()});
  assertProjectCapacity(doc,{sources:sourcePixelCount(doc)+normalized.width*normalized.height});
  doc.references=[...(doc.references||[]),normalized];
  doc.requiredFeatures=[...new Set([...(doc.requiredFeatures||[]),'reference-board'])];
  return normalized;
}
export function removeReference(doc,id){
  const index=(doc.references||[]).findIndex(reference=>reference.id===id);
  if(index<0)throw new Error('参考图片不存在');
  const [removed]=doc.references.splice(index,1);
  return removed;
}
export function moveReference(doc,id,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>POSITION_LIMIT||Math.abs(y)>POSITION_LIMIT)throw new Error('参考图片位置无效');
  const item=findReference(doc,id);item.x=x;item.y=y;return item;
}
export function resizeReference(doc,id,scale){
  if(!Number.isFinite(scale)||scale<MIN_SCALE||scale>MAX_SCALE)throw new Error('参考图片缩放无效');
  const item=findReference(doc,id);item.scale=scale;return item;
}
export function boardBounds(list=[]){
  if(!list||!list.length)return{x:0,y:0,w:BOARD_MIN,h:BOARD_MIN};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const {x,y,width,height,scale} of list){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+width*scale);maxY=Math.max(maxY,y+height*scale);}
  const left=Math.floor(minX),top=Math.floor(minY);
  return{x:left,y:top,w:Math.max(BOARD_MIN,Math.ceil(maxX)-left),h:Math.max(BOARD_MIN,Math.ceil(maxY)-top)};
}
export function referencePixelCount(list=[]){return (list||[]).reduce((sum,item)=>sum+item.width*item.height,0);}
export function reorderReference(doc,id,direction){
  const list=doc.references||[],index=list.findIndex(reference=>reference.id===id);
  if(index<0)throw new Error('参考图片不存在');
  if(!['front','up','down','back'].includes(direction))throw new Error('参考图片层次方向无效');
  const target={front:list.length-1,back:0,up:Math.min(list.length-1,index+1),down:Math.max(0,index-1)}[direction];
  if(target===index)return list[index];
  const next=[...list];
  const [item]=next.splice(index,1);
  next.splice(target,0,item);
  doc.references=next;
  return item;
}
export function resetReferencePosition(doc,id){
  const item=findReference(doc,id);
  item.x=0;item.y=0;item.scale=1;
  return item;
}

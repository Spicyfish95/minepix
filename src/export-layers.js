import {isReference} from './layer-types.js';
import {isGroup,layerState,subtree,ancestors} from './layer-tree.js';
export function exportLayerPlan(doc,mode='visible',current=0,selected=[]){
  let indices;
  if(mode==='visible')indices=doc.layers.flatMap((layer,i)=>!isGroup(layer)&&!isReference(layer)&&layerState(doc,i).visible?[i]:[]);
  else if(mode==='current')indices=[current];
  else if(mode==='custom')indices=[...new Set(selected)].sort((a,b)=>a-b);
  else throw new Error('未知图层导出范围');
  if(!indices.length)throw new Error('请至少选择一个图层；当前没有可见图层');
  if(indices.some(i=>!Number.isInteger(i)||i<0||i>=doc.layers.length))throw new Error('导出图层已不存在');
  indices=[...new Set(indices.flatMap(i=>isGroup(doc.layers[i])?subtree(doc,i).indices.filter(j=>!isGroup(doc.layers[j])):[i]))].sort((a,b)=>a-b);indices=indices.filter(i=>!isReference(doc.layers[i]));if(!indices.length)throw new Error('参考层不参与导出，请选择像素图层');
  const chosen=new Set(indices.flatMap(i=>[i,...ancestors(doc,i)]));
  return{indices,document:{...doc,layers:doc.layers.map((layer,i)=>({...layer,visible:chosen.has(i)}))},sourceLayers:indices.map(i=>({sourceIndex:i,name:doc.layers[i].name,opacity:doc.layers[i].opacity,visible:doc.layers[i].visible}))};
}

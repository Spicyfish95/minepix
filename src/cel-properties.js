import {assertProjectCapacity,celPixelCount} from './project-capacity.js';
export const celProperty=(doc,frame,layer)=>({x:0,y:0,width:doc.width,height:doc.height,opacity:100,...doc.frames[frame].celProperties?.[doc.layers[layer].id]});
export function setCelProperty(doc,frame,layer,value){const f=doc.frames[frame],key=doc.layers[layer].id;f.celProperties={...f.celProperties,[key]:{...celProperty(doc,frame,layer),...value}};doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'cel-properties'])];}
export function validateCelProperties(value,doc){
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('cel 属性无效');
 const result={};for(const [key,p]of Object.entries(value)){const layer=doc.layers.find(l=>String(l.id)===key);if(!layer||layer.type==='group'||layer.type==='reference')throw new Error('cel 属性引用非像素图层');
 if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x< -32768||p.x>32767||p.y< -32768||p.y>32767||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>65535||p.height>65535||p.width*p.height>32*1024*1024||!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>100)throw new Error('cel 位置、尺寸或透明度无效');
 if(layer.type==='background'&&(p.x||p.y||p.width!==doc.width||p.height!==doc.height||p.opacity!==100))throw new Error('背景 cel 必须覆盖画布且完全不透明');result[key]={x:p.x,y:p.y,width:p.width,height:p.height,opacity:p.opacity};}return result;
}
const locations=new WeakMap(),views=new WeakMap();
export const celViewLocation=pixels=>locations.get(pixels);
function growCel(doc,f,l,x,y){
 const frame=doc.frames[f],old=frame.cels[l],p=celProperty(doc,f,l),left=Math.min(p.x,x),top=Math.min(p.y,y),width=Math.max(p.x+p.width,x+1)-left,height=Math.max(p.y+p.height,y+1)-top,dx=left-p.x,dy=top-p.y;
 const members=doc.frames.flatMap((frame,i)=>frame.cels[l]===old?[i]:[]),total=celPixelCount(doc)+(width*height-old.length)*members.length;
 if(width>65535||height>65535)throw new Error('cel 图像超过 32M 像素容量');
 assertProjectCapacity(doc,{pixels:total});
 const copy=(source,empty)=>{const target=Array(width*height).fill(empty);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)target[(y-dy)*width+x-dx]=source[y*p.width+x];return target;};
 const pixels=copy(old,0),indices=frame.indices?.[l]&&copy(frame.indices[l],doc.transparentIndex);
 for(const index of members){const current=celProperty(doc,index,l);doc.frames[index].cels[l]=pixels;if(indices)doc.frames[index].indices[l]=indices;setCelProperty(doc,index,l,{...current,x:current.x+dx,y:current.y+dy,width,height});}
}
function view(doc,f,l,indexed){
 const frame=doc.frames[f],p=celProperty(doc,f,l),raw=indexed?frame.indices?.[l]:frame.cels[l];if(!raw)return null;
 if(!p.x&&!p.y&&p.width===doc.width&&p.height===doc.height)return raw;
 let cache=views.get(frame);if(!cache)views.set(frame,cache=new Map());const key=l+':'+indexed+':'+doc.width+':'+doc.height;if(cache.has(key))return cache.get(key);
 const empty=indexed?doc.transparentIndex:0,target=Array(doc.width*doc.height).fill(empty),numeric=k=>typeof k==='string'&&/^(0|[1-9]\d*)$/.test(k);
 const proxy=new Proxy(target,{
  get(target,key,receiver){if(!numeric(key))return Reflect.get(target,key,receiver);const p=celProperty(doc,f,l),i=+key,x=i%doc.width-p.x,y=Math.floor(i/doc.width)-p.y;return x>=0&&y>=0&&x<p.width&&y<p.height?(indexed?frame.indices[l]:frame.cels[l])[y*p.width+x]:empty;},
  set(target,key,value){if(!numeric(key))return Reflect.set(target,key,value);const i=+key,x=i%doc.width,y=Math.floor(i/doc.width);let p=celProperty(doc,f,l);if(x<p.x||y<p.y||x>=p.x+p.width||y>=p.y+p.height){if(value===empty)return true;growCel(doc,f,l,x,y);p=celProperty(doc,f,l);}const source=indexed?frame.indices[l]:frame.cels[l];source[(y-p.y)*p.width+x-p.x]=value;return true;}
 });locations.set(proxy,{doc,frame:f,layer:l});cache.set(key,proxy);return proxy;
}
export const celPixels=(doc,frame,layer)=>view(doc,frame,layer,false);
export const celIndexPixels=(doc,frame,layer)=>view(doc,frame,layer,true);
// Canvas-wide geometry commands deliberately bake positions and clip to the current canvas.
export function materializeCels(doc){for(let f=0;f<doc.frames.length;f++)for(let l=0;l<doc.layers.length;l++){const p=celProperty(doc,f,l);if(!p.x&&!p.y&&p.width===doc.width&&p.height===doc.height)continue;const pixels=celPixels(doc,f,l).slice(),indices=celIndexPixels(doc,f,l)?.slice();doc.frames[f].cels[l]=pixels;if(indices)doc.frames[f].indices[l]=indices;setCelProperty(doc,f,l,{x:0,y:0,width:doc.width,height:doc.height});delete doc.frames[f].links?.[doc.layers[l].id];}}

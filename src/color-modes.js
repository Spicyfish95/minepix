import {celViewLocation,celIndexPixels} from './cel-properties.js';
import {isGroup} from './layer-tree.js';
import {isReference,isBackground} from './layer-types.js';
export const modeOf=doc=>doc.colorMode||'rgba';
export const rgbaValue=hex=>parseInt(hex.slice(1).padEnd(8,'f'),16)>>>0;
const hexOf=value=>'#'+value.toString(16).padStart(8,'0');
export function grayPixel(pixel){const v=Math.round((pixel>>>24)*.299+(pixel>>>16&255)*.587+(pixel>>>8&255)*.114);return((v<<24)|(v<<16)|(v<<8)|(pixel&255))>>>0;}
export function indexColor(doc,index,layer){const pixel=rgbaValue(doc.palette[index]);return isBackground(layer)?(pixel|255)>>>0:index===(doc.transparentIndex??0)?0:pixel;}
const paletteColors=(doc,layer)=>doc.palette.map((_,i)=>indexColor(doc,i,layer));
const vector=p=>{const a=(p&255)/255;return[(p>>>24)*a,(p>>>16&255)*a,(p>>>8&255)*a,(p&255)*1.5];};
const distance=(a,b)=>{const r=a[0]-b[0],g=a[1]-b[1],blue=a[2]-b[2],alpha=a[3]-b[3];return r*r+g*g+blue*blue+alpha*alpha;};
export function createMapper(doc,layer,{dither=false}={}){const colors=paletteColors(doc,layer),vectors=colors.map(vector),hasOpaque=colors.some(c=>(c&255)===255),cache=new Map(),exact=new Map();colors.forEach((color,i)=>{if(!exact.has(color))exact.set(color,i);});const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];return(pixel,x=0,y=0,preferred=-1)=>{if(preferred>=0&&preferred<colors.length&&colors[preferred]===pixel)return{index:preferred,color:pixel};if(exact.has(pixel)){const index=exact.get(pixel);return{index,color:colors[index]};}let pair=cache.get(pixel);if(!pair){const source=vector(pixel),opaque=(pixel&255)===255&&hasOpaque;let first=0,second=0,best=Infinity,next=Infinity;vectors.forEach((v,i)=>{if(opaque&&(colors[i]&255)!==255)return;const d=distance(source,v);if(d<best){second=first;next=best;first=i;best=d;}else if(d<next){second=i;next=d;}});const a=vectors[first],b=vectors[second],denominator=distance(a,b),t=denominator?Math.max(0,Math.min(1,source.reduce((sum,v,i)=>sum+(v-a[i])*(b[i]-a[i]),0)/denominator)):0;pair={first,second,t};if(cache.size<65536)cache.set(pixel,pair);}const index=dither&&pair.t>(bayer[(y%4+4)%4*4+(x%4+4)%4]+.5)/16?pair.second:pair.first;return{index,color:colors[index]};};}
export function celIndices(doc,pixels){if(modeOf(doc)!=='indexed')return null;const location=celViewLocation(pixels);if(location)return celIndexPixels(doc,location.frame,location.layer);for(const frame of doc.frames){const layer=frame.cels.indexOf(pixels);if(layer>=0)return frame.indices?.[layer]||null;}return null;}
export function canonicalizeColors(doc,{dither=false,rebuild=false,before=null}={}){
 const mode=modeOf(doc);if(mode==='rgba'){for(const frame of doc.frames)delete frame.indices;delete doc.transparentIndex;for(const layer of doc.layers)delete layer.clearIndex;return;}
 if(mode!=='indexed')delete doc.transparentIndex;
 const force=!before||modeOf(before)!==mode||before.width!==doc.width||before.height!==doc.height||before.transparentIndex!==doc.transparentIndex||before.palette.length!==doc.palette.length||before.palette.some((c,i)=>c!==doc.palette[i]);
 for(const layer of doc.layers)if(isBackground(layer)&&mode==='grayscale'){layer.clearColor=grayPixel(layer.clearColor);delete layer.clearIndex;}
 const processed=new Map(),mappers=doc.layers.map(layer=>!isGroup(layer)&&!isReference(layer)&&mode==='indexed'?createMapper(doc,layer,{dither}):null);
 if(mode==='indexed')for(const [l,layer]of doc.layers.entries())if(isBackground(layer)){const mapped=Number.isInteger(layer.clearIndex)&&layer.clearIndex>=0&&layer.clearIndex<doc.palette.length?{index:layer.clearIndex,color:indexColor(doc,layer.clearIndex,layer)}:mappers[l](layer.clearColor);layer.clearIndex=mapped.index;layer.clearColor=mapped.color;}
 for(const [f,frame]of doc.frames.entries()){
  const old=frame.indices;
  if(mode==='indexed')frame.indices=doc.layers.map((layer,l)=>{
   if(!mappers[l])return null;const pixels=frame.cels[l];if(processed.has(pixels))return processed.get(pixels);
   const previous=before?.frames[f],sameRole=before?.layers[l]?.id===layer.id&&before.layers[l]?.type===layer.type,validOld=old?.[l]?.length===pixels.length,indices=validOld?old[l]:new Array(pixels.length);processed.set(pixels,indices);
   if(!force&&sameRole&&pixels===previous?.cels[l]&&indices===previous?.indices?.[l])return indices;
   const map=mappers[l],colors=rebuild&&validOld?paletteColors(doc,layer):null;for(let i=0;i<pixels.length;i++){
    if(!force&&sameRole&&validOld&&pixels[i]===previous?.cels[l]?.[i]&&indices[i]===previous?.indices?.[l]?.[i])continue;
    if(rebuild&&validOld)pixels[i]=colors[indices[i]];
    else{const result=map(pixels[i],i%doc.width,Math.floor(i/doc.width),!dither&&validOld?indices[i]:-1);indices[i]=result.index;pixels[i]=result.color;}
   }return indices;
  });
  else{delete frame.indices;for(const [l,pixels]of frame.cels.entries())if(!isGroup(doc.layers[l])&&!isReference(doc.layers[l])){const previous=before?.frames[f]?.cels[l];if(!force&&pixels===previous)continue;for(let i=0;i<pixels.length;i++)if(force||pixels[i]!==previous?.[i])pixels[i]=grayPixel(pixels[i]);}}
 }
 doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'color-modes'])];
}

export function validateColorMode(doc){
 const mode=modeOf(doc);
 if(!['rgba','indexed','grayscale'].includes(mode))throw new Error('未知颜色模式');
 if(mode==='indexed'&&(!Number.isInteger(doc.transparentIndex)||doc.transparentIndex<0||doc.transparentIndex>=doc.palette.length))throw new Error('透明索引无效');
 for(const frame of doc.frames){
  if(mode!=='indexed'&&frame.indices!==undefined)throw new Error('非索引模式不应包含索引像素');
  if(mode==='indexed'&&(!Array.isArray(frame.indices)||frame.indices.length!==doc.layers.length))throw new Error('缺少索引像素');
  for(const [l,layer]of doc.layers.entries()){
   if(isGroup(layer)||isReference(layer)){
    if(mode==='indexed'&&frame.indices[l]!==null)throw new Error('辅助层不能包含索引像素');
    continue;
   }
   const pixels=frame.cels[l];
   if(mode==='indexed'){
    const colors=paletteColors(doc,layer);
    if(isBackground(layer)&&(!Number.isInteger(layer.clearIndex)||layer.clearIndex<0||layer.clearIndex>=doc.palette.length||layer.clearColor!==colors[layer.clearIndex]))throw new Error('背景擦除索引无效');
    const indices=frame.indices[l];
    if(!Array.isArray(indices)||indices.length!==pixels.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=doc.palette.length))throw new Error('索引像素越界');
    if(pixels.some((v,i)=>v!==colors[indices[i]]))throw new Error('索引与RGBA缓存不一致');
   }else if(mode==='grayscale'&&pixels.some(v=>v!==grayPixel(v)))throw new Error('灰度像素通道不一致');
  }
 }
 return doc;
}
function adaptivePalette(doc,maximum){const exact=new Map(),buckets=new Map();let detailed=true;for(const frame of doc.frames)for(const [l,pixels]of frame.cels.entries()){if(isGroup(doc.layers[l])||isReference(doc.layers[l]))continue;for(const pixel of pixels){if(!(pixel&255))continue;if(detailed){exact.set(pixel,(exact.get(pixel)||0)+1);if(exact.size>4096){detailed=false;for(const [p,n]of exact)add(p,n);exact.clear();}}else add(pixel,1);}}function add(pixel,count){const key=((pixel>>>27)<<14)|(((pixel>>>19)&31)<<9)|(((pixel>>>11)&31)<<4)|((pixel&255)>>>4);let item=buckets.get(key);if(!item){item={sum:[0,0,0,0],count:0};buckets.set(key,item);}item.count+=count;const rgba=[pixel>>>24,pixel>>>16&255,pixel>>>8&255,pixel&255];rgba.forEach((v,i)=>item.sum[i]+=v*count);}
 const points=detailed?[...exact].map(([pixel,count])=>({rgba:[pixel>>>24,pixel>>>16&255,pixel>>>8&255,pixel&255],count})):Array.from(buckets.values(),item=>({rgba:item.sum.map(v=>Math.round(v/item.count)),count:item.count}));if(points.length<=maximum-1)return['#00000000',...points.sort((a,b)=>b.count-a.count).map(p=>hexOf(((p.rgba[0]<<24)|(p.rgba[1]<<16)|(p.rgba[2]<<8)|p.rgba[3])>>>0))];
 const boxes=[points];while(boxes.length<maximum-1){let chosen=-1,channel=0,score=-1;boxes.forEach((box,i)=>{if(box.length<2)return;for(let c=0;c<4;c++){let lo=255,hi=0,total=0;for(const p of box){lo=Math.min(lo,p.rgba[c]);hi=Math.max(hi,p.rgba[c]);total+=p.count;}const value=(hi-lo)*Math.sqrt(total);if(value>score){score=value;chosen=i;channel=c;}}});if(chosen<0)break;const box=boxes[chosen].sort((a,b)=>a.rgba[channel]-b.rgba[channel]),total=box.reduce((n,p)=>n+p.count,0);let weight=0,cut=1;for(let i=0;i<box.length-1;i++){weight+=box[i].count;if(weight>=total/2){cut=i+1;break;}cut=i+1;}boxes.splice(chosen,1,box.slice(0,cut),box.slice(cut));}
 return['#00000000',...boxes.map(box=>{const total=box.reduce((n,p)=>n+p.count,0),rgba=[0,1,2,3].map(c=>Math.round(box.reduce((n,p)=>n+p.rgba[c]*p.count,0)/total));return hexOf(((rgba[0]<<24)|(rgba[1]<<16)|(rgba[2]<<8)|rgba[3])>>>0);})];}
export function convertColorMode(doc,mode,{palette='adaptive',colors=256,dither=false}={}){if(!['rgba','indexed','grayscale'].includes(mode)||mode==='indexed'&&(!['adaptive','current'].includes(palette)||!Number.isInteger(colors)||colors<2||colors>256))throw new Error('颜色模式或色数无效');if(mode==='rgba'){delete doc.colorMode;canonicalizeColors(doc);return;}doc.colorMode=mode;if(mode==='grayscale')doc.palette=doc.palette.map(c=>hexOf(grayPixel(rgbaValue(c))));if(mode==='indexed'){let entries=palette==='current'?[...doc.palette]:adaptivePalette(doc,colors);let transparent=entries.findIndex(c=>(rgbaValue(c)&255)===0);if(transparent<0){entries.unshift('#00000000');transparent=0;}entries=entries.slice(0,colors);if(transparent>=entries.length){entries[0]='#00000000';transparent=0;}if(entries.length<2)entries.push('#000000ff');doc.palette=entries;doc.transparentIndex=transparent;for(const layer of doc.layers)delete layer.clearIndex;for(const frame of doc.frames)delete frame.indices;}canonicalizeColors(doc,{dither});}
export function applyIndexedPalette(doc,colors,origins=null){
 if(modeOf(doc)!=='indexed'){doc.palette=[...colors];return;}
 const oldTransparent=doc.transparentIndex;
 let palette=[...colors],mapping=origins?[...origins]:null,transparent=mapping?mapping.indexOf(oldTransparent):0;
 if(transparent<0){palette.unshift('#00000000');mapping?.unshift(null);transparent=0;}
 if(palette.length>256)throw new Error('索引色板最多256色（含透明槽）');
 doc.palette=palette;doc.transparentIndex=transparent;
 // Preserve indexOf's first occurrence when an old slot appears more than once.
 const remap=new Map();
 mapping?.forEach((old,index)=>{if(!remap.has(old))remap.set(old,index);});
 for(const layer of doc.layers)if(isBackground(layer)){
  const target=remap.get(layer.clearIndex);
  if(target!==undefined){layer.clearIndex=target;layer.clearColor=indexColor(doc,target,layer);}
  else delete layer.clearIndex;
 }
 const maps=doc.layers.map(layer=>createMapper(doc,layer));
 const tables=doc.layers.map(layer=>paletteColors(doc,layer));
 for(const frame of doc.frames)for(const [l,indices]of (frame.indices||[]).entries()){
  if(!indices)continue;
  frame.indices[l]=indices.map((index,i)=>remap.get(index)??maps[l](frame.cels[l][i]).index);
  frame.cels[l]=frame.indices[l].map(index=>tables[l][index]);
 }
 canonicalizeColors(doc,{rebuild:true});
}

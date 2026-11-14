import {validateCelProperties,celViewLocation} from './cel-properties.js';
import {validateSymmetryAxes} from './symmetry.js';
import {validateColorMode,celIndices,createMapper,rgbaValue,grayPixel,modeOf} from './color-modes.js';
import {hydrateLinks,initializeFrameLinks} from './cel-links.js';
import {isReference,isBackground,validateReference,overBackground} from './layer-types.js';
import {validateLayerTree,isGroup} from './layer-tree.js';
import {blendId,compositeInto} from './compositor.js';
import {validateSlices,remapSliceFrames} from './slices.js';
import {normalizeProject,PROJECT_VERSION} from './project-format.js';
import {validateReferences} from './reference-board.js';
import {isTileset,validateTileset} from './tilemap.js';
import {validatePreviewTerrain} from './terrain-preview.js';
import {validateCanvasBackground} from './canvas-background.js';
import {assertCapacity,assertProjectCapacity,celPixelCount,sourcePixelCount} from './project-capacity.js';
export {LIMIT,assertCapacity} from './project-capacity.js';
export const PALETTE = ['#171b2b','#29334c','#3e5068','#657b8b','#9aabb1','#e5e4d5','#fff4d2','#edb75b','#d88745','#b85740','#843c42','#542d40','#462c68','#72518b','#9c79b4','#cbb1d5','#354b58','#44766d','#69a27b','#a4c98a','#4d689b','#668fb7','#8cb5c7','#b9d9df','#9b4962','#cf6a78','#e89995','#f2c1ad','#6d5546','#99815c','#beb18a','#f8f7ee'];
export const clone = value => structuredClone(value);
export function colorValue(hex) { return parseInt(hex.slice(1).padEnd(8,'f'),16)>>>0; }
export function colorHex(value) { return '#' + (value >>> 8).toString(16).padStart(6,'0'); }
export function createDocument(width=32,height=32,name='未命名') {
  assertCapacity(width,height,1,1);
  return { format:'pixel-studio',version:PROJECT_VERSION,requiredFeatures:[],slices:[],name,width,height,palette:[...PALETTE],tags:[],layers:[{id:1,name:'图层 1',visible:true,locked:false,opacity:100}],frames:[{duration:100,cels:[new Array(width*height).fill(0)]}] };
}
export function validateDocument(input) {
  input=normalizeProject(input);
  if (!input || input.format!=='pixel-studio' || input.version!==PROJECT_VERSION || !Array.isArray(input.layers) || !Array.isArray(input.frames)) throw new Error('不是受支持的 MinePix 项目（.pix；不支持 .ase / .aseprite）。');
  assertCapacity(input.width,input.height,input.layers.length,input.frames.length);
  const {width,height}=input;
  const layerIds=new Set(input.layers.flatMap(l=>Number.isInteger(l?.id)?[l.id]:[]));
  const layers=input.layers.map((l,i)=>{
    if (!l || !Number.isFinite(l.opacity) || l.opacity<0 || l.opacity>100) throw new Error('无效的图层属性');
    if(l.continuous!==undefined&&typeof l.continuous!=='boolean')throw new Error('连续图层状态无效');
    if(l.continuous&&(isGroup(l)||isReference(l)))throw new Error('非像素层不支持连续cel');
    if(blendId(l.blendMode)<0)throw new Error('不支持的图层混合模式');
    return {...(l.continuous?{continuous:true}:{}),...(isReference(l)?{type:'reference',reference:validateReference(l.reference)}:{}),...(isBackground(l)?{type:'background',clearColor:l.clearColor,...(l.clearIndex!==undefined?{clearIndex:l.clearIndex}:{})}:{}),...(isTileset(l)?{type:'tileset',tileset:validateTileset(l.tileset,{width,height})}:{}),...(l.parentId!==undefined?{parentId:l.parentId}:{}),...(isGroup(l)?{type:'group',collapsed:!!l.collapsed,...(l.passThrough?{passThrough:true}:{})}:{}),...(l.blendMode&&l.blendMode!=='normal'?{blendMode:l.blendMode}:{}),id:Number.isInteger(l.id)?l.id:i+1,name:String(l.name||`图层 ${i+1}`).slice(0,80),visible:l.visible!==false,locked:!!l.locked,opacity:l.opacity};
  });
  validateLayerTree(layers);
  if(layers.filter(isBackground).length>1||layers.some((l,i)=>isBackground(l)&&(i!==0||l.parentId!==undefined||l.opacity!==100||l.blendMode&&l.blendMode!=='normal'||!Number.isInteger(l.clearColor)||l.clearColor<0||l.clearColor>0xffffffff||(l.clearColor&255)!==255)))throw new Error('背景层必须位于最底层、不透明且使用正常混合');
  const references=validateReferences(input.references??[]);
  assertProjectCapacity({...input,layers,references},{pixels:0});
  const frames=input.frames.map(f=>{
    if(f?.links!==undefined&&(typeof f.links!=='object'||!f.links||Array.isArray(f.links)))throw new Error('cel链接表无效');
    if (!f || !Number.isFinite(f.duration) || f.duration<20 || f.duration>10000 || !Array.isArray(f.cels) || f.cels.length!==layers.length) throw new Error('无效的帧数据');
    const celProperties=validateCelProperties(f.celProperties,{layers,width,height});
    return {...(celProperties?{celProperties}:{}),...(f.indices!==undefined?{indices:Array.isArray(f.indices)?f.indices.map(a=>Array.isArray(a)?a.slice():a):f.indices}:{}),...(f.links?{links:{...f.links}}:{}),duration:Math.round(f.duration),cels:f.cels.map((c,l)=>{
      if(!Array.isArray(c)||c.length!==(celProperties?.[layers[l].id]?.width||width)*(celProperties?.[layers[l].id]?.height||height)||!c.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff)) throw new Error('像素数据损坏');
      if(isBackground(layers[l])&&c.some(v=>(v&255)!==255))throw new Error('背景像素必须不透明');
      if(isGroup(layers[l])&&c.some(v=>v))throw new Error('图层组不能包含 cel 像素');
      return c.slice();
    })};
  });
  assertProjectCapacity({...input,layers,frames,references});
  const palette=Array.isArray(input.palette)?input.palette.filter(c=>/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(c)).slice(0,256):[];
  if(input.colorMode==='indexed'&&(!Array.isArray(input.palette)||!input.palette.length||input.palette.length>256||palette.length!==input.palette.length))throw new Error('索引色板无效');
  const normalizedTags=validateTags(input.tags,frames.length),previewTerrain=validatePreviewTerrain(input.previewTerrain);
  const result={...(input.symmetryAxes?{symmetryAxes:validateSymmetryAxes(input.symmetryAxes,width,height)}:{}),...(input.colorMode!==undefined?{colorMode:input.colorMode}:{}),...(input.canvasBackground?{canvasBackground:validateCanvasBackground(input.canvasBackground)}:{}),...(previewTerrain?{previewTerrain}:{}),...(input.transparentIndex!==undefined?{transparentIndex:input.transparentIndex}:{}),...(references.length?{references}:{}),format:'pixel-studio',version:PROJECT_VERSION,requiredFeatures:[...new Set([...input.requiredFeatures,...(input.slices?.some(s=>s.keys)?['slice-keyframes']:[]),...(references.length?['reference-board']:[]),...(layers.some(l=>l.blendMode)?['layer-blending']:[]),...(layers.some(isGroup)?['layer-groups']:[]),...(layers.some(l=>isReference(l)||isBackground(l))?['layer-types']:[]),...(layers.some(isTileset)?['tileset']:[]),...(frames.some(f=>f.celProperties)?['cel-properties']:[]),...(frames.some(f=>f.links)||layers.some(l=>l.continuous)?['linked-cels']:[]),...(input.colorMode&&input.colorMode!=='rgba'?['color-modes']:[])])],slices:validateSlices(input.slices,width,height,frames.length),name:String(input.name||'未命名').slice(0,120),width,height,layers,frames,palette:palette.length?palette:[...PALETTE],tags:normalizedTags};validateColorMode(result);return hydrateLinks(result,true);
}
export function validateTags(tags=[],frameCount){
  if(!Array.isArray(tags)||tags.length>256)throw new Error('动画标签无效（最多 256 个）');
  const ids=new Set();
  return tags.map(tag=>{
    if(!tag||typeof tag.id!=='string'||!tag.id||['all','selected'].includes(tag.id)||ids.has(tag.id)||typeof tag.name!=='string'||!tag.name.trim()||!/^#[a-f0-9]{6}$/i.test(tag.color)||!Number.isInteger(tag.from)||!Number.isInteger(tag.to)||tag.from<0||tag.to<tag.from||tag.to>=frameCount||!['forward','reverse','pingpong'].includes(tag.direction))throw new Error('动画标签的名称、范围、颜色或方向无效');
    ids.add(tag.id);return{id:tag.id,name:tag.name.slice(0,80),color:tag.color,from:tag.from,to:tag.to,direction:tag.direction};
  });
}
export function selectionContains(selection,x,y) {
  if(!selection)return true;
  const sx=x-selection.x,sy=y-selection.y;
  return sx>=0&&sy>=0&&sx<selection.w&&sy<selection.h&&(!selection.mask||!!selection.mask[sy*selection.w+sx]);
}
export function pixelSet(doc,pixels,x,y,color,size=1,selection=null,symmetry=false) {
  const offset=Math.floor((size-1)/2);
  const put=(px,py)=>{
    if(px<0||py<0||px>=doc.width||py>=doc.height) return;
    if(!selectionContains(selection,px,py)) return;
    pixels[py*doc.width+px]=color;
  };
  for(let dy=0;dy<size;dy++) for(let dx=0;dx<size;dx++) { const px=x+dx-offset,py=y+dy-offset; put(px,py); if(symmetry) put(doc.width-1-px,py); }
}
export function line(x0,y0,x1,y1,put) {
  let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
  for(;;){put(x0,y0);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}
}
export function shape(kind,a,b,put) {
  if(kind==='line') return line(a.x,a.y,b.x,b.y,put);
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
  if(kind==='rect'){line(x,y,x+w,y,put);line(x,y+h,x+w,y+h,put);line(x,y,x,y+h,put);line(x+w,y,x+w,y+h,put);return;}
  if(w===0||h===0) return line(a.x,a.y,b.x,b.y,put);
  // Sample both axes so narrow ellipses remain continuous in pixel space.
  const rx=w/2,ry=h/2,cx=x+rx,cy=y+ry;
  for(let xx=x;xx<=x+w;xx++){const d=ry*Math.sqrt(Math.max(0,1-((xx-cx)/rx)**2));put(xx,Math.round(cy-d));put(xx,Math.round(cy+d));}
  for(let yy=y;yy<=y+h;yy++){const d=rx*Math.sqrt(Math.max(0,1-((yy-cy)/ry)**2));put(Math.round(cx-d),yy);put(Math.round(cx+d),yy);}
}
export function floodFill(doc,pixels,x,y,color,selection=null) {
  if(x<0||y<0||x>=doc.width||y>=doc.height)return;
  const inside=(px,py)=>px>=0&&py>=0&&px<doc.width&&py<doc.height&&selectionContains(selection,px,py);
  if(!inside(x,y))return;
  const target=pixels[y*doc.width+x]; if(target===color)return;
  const queue=[y*doc.width+x];pixels[queue[0]]=color;
  for(let i=0;i<queue.length;i++){const pos=queue[i],px=pos%doc.width,py=Math.floor(pos/doc.width);for(const [nx,ny]of[[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){const n=ny*doc.width+nx;if(inside(nx,ny)&&pixels[n]===target){pixels[n]=color;queue.push(n);}}}
}
export function composite(doc,frameIndex,options={}) {
  const output=new Uint8ClampedArray(doc.width*doc.height*4);compositeInto(doc,frameIndex,{x:0,y:0,w:doc.width,h:doc.height},output,options);return output;
}
export function addFrame(doc,index,duplicate=false) {
  const position=index+1,source=doc.frames[Math.max(0,index)];
  const added=doc.layers.reduce((n,layer,l)=>n+(duplicate||layer.continuous?source.cels[l].length:doc.width*doc.height),0);
  assertProjectCapacity(doc,{frames:doc.frames.length+1,pixels:celPixelCount(doc)+added});
  const sources=doc.frames.map((_,i)=>i);sources.splice(position,0,Math.max(0,index));doc.slices=remapSliceFrames(doc.slices,sources);
  doc.frames.splice(position,0,duplicate?clone(source):{duration:doc.frames[Math.max(0,index)].duration,cels:doc.layers.map(layer=>new Array(doc.width*doc.height).fill(isBackground(layer)?layer.clearColor:0))});
  if(doc.colorMode==='indexed'&&!duplicate)doc.frames[position].indices=doc.layers.map(l=>isGroup(l)||isReference(l)?null:new Array(doc.width*doc.height).fill(isBackground(l)?l.clearIndex:doc.transparentIndex));
  initializeFrameLinks(doc,source,doc.frames[position]);
  for(const tag of doc.tags){if(position<=tag.from){tag.from++;tag.to++;}else if(position<=tag.to+1)tag.to++;}
}
export function addLayer(doc,index,duplicate=false) {
  const old=doc.layers[index],id=Math.max(...doc.layers.map(l=>l.id))+1;
  const added=doc.frames.reduce((n,frame)=>n+(duplicate?frame.cels[index].length:doc.width*doc.height),0),source=duplicate&&old.reference?.data?old.reference.width*old.reference.height:0;
  assertProjectCapacity(doc,{layers:doc.layers.length+1,pixels:celPixelCount(doc)+added,sources:sourcePixelCount(doc)+source});
  const position=isGroup(old)?index:index+1,parentId=isGroup(old)?old.id:old.parentId;
  doc.layers.splice(position,0,duplicate?{...clone(old),id,name:old.name+' 副本'}:{id,name:`图层 ${id}`,visible:true,locked:false,opacity:100,...(parentId!==undefined?{parentId}:{})});
  doc.frames.forEach(f=>{if(duplicate&&f.celProperties?.[old.id])f.celProperties={...f.celProperties,[id]:{...f.celProperties[old.id]}};f.cels.splice(position,0,duplicate?[...f.cels[index]]:new Array(doc.width*doc.height).fill(0));if(f.indices)f.indices.splice(position,0,duplicate?f.indices[index].slice():new Array(doc.width*doc.height).fill(doc.transparentIndex));f.tiles?.splice(position,0,null);});
  return position;
}
export function area(doc,selection) {return selection||{x:0,y:0,w:doc.width,h:doc.height};}
export function copyRegion(doc,pixels,selection){const r=area(doc,selection),data=[],indices=celIndices(doc,pixels),indexData=[];for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const px=r.x+x,py=r.y+y,inside=px>=0&&py>=0&&px<doc.width&&py<doc.height&&selectionContains(selection,px,py),i=py*doc.width+px;data.push(inside?pixels[i]:0);if(indices)indexData.push(inside?indices[i]:doc.transparentIndex);}return{...r,mask:r.mask?.slice(),data,...(indices?{indexed:{palette:[...doc.palette],transparentIndex:doc.transparentIndex,data:indexData}}:{})};}
export function clearRegion(doc,pixels,selection){const r=area(doc,selection),indices=celIndices(doc,pixels);let layer;if(indices||doc.layers.some(isBackground))for(const frame of doc.frames){const location=celViewLocation(pixels),l=location?.frame===doc.frames.indexOf(frame)?location.layer:frame.cels.indexOf(pixels);if(l>=0){layer=doc.layers[l];break;}}for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){if(x<0||y<0||x>=doc.width||y>=doc.height||!selectionContains(selection,x,y))continue;const i=y*doc.width+x;pixels[i]=layer&&isBackground(layer)?layer.clearColor:0;if(indices)indices[i]=isBackground(layer)?layer.clearIndex:doc.transparentIndex;}}
export function pasteRegion(doc,pixels,region,x,y,selection=null,includeTransparent=false){const indices=celIndices(doc,pixels);let layer;if(indices||doc.layers.some(isBackground))for(const frame of doc.frames){const location=celViewLocation(pixels),l=location?.frame===doc.frames.indexOf(frame)?location.layer:frame.cels.indexOf(pixels);if(l>=0){layer=doc.layers[l];break;}}const mapper=indices?createMapper(doc,layer):null,same=!!region.indexed&&region.indexed.transparentIndex===doc.transparentIndex&&region.indexed.palette.length===doc.palette.length&&region.indexed.palette.every((c,i)=>rgbaValue(c)===rgbaValue(doc.palette[i]));for(let py=0;py<region.h;py++)for(let px=0;px<region.w;px++){const i=py*region.w+px,c=region.data[i],tx=x+px,ty=y+py;if(region.mask&&!region.mask[i]||!includeTransparent&&!(c&255)||tx<0||ty<0||tx>=doc.width||ty>=doc.height||!selectionContains(selection,tx,ty))continue;const at=ty*doc.width+tx;if(mapper){const result=mapper(isBackground(layer)?overBackground(c,layer.clearColor):c,tx,ty,same?region.indexed.data[i]:-1);pixels[at]=result.color;indices[at]=result.index;}else{const value=layer&&isBackground(layer)?overBackground(c,layer.clearColor):c;pixels[at]=modeOf(doc)==='grayscale'?grayPixel(value):value;}}}
export function flipRegion(doc,pixels,selection,axis) {
  const r=copyRegion(doc,pixels,selection),indices=celIndices(doc,pixels),mask=r.mask?new Uint8Array(r.w*r.h):undefined;
  clearRegion(doc,pixels,selection);
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
    const source=(axis==='y'?r.h-1-y:y)*r.w+(axis==='x'?r.w-1-x:x),i=y*r.w+x;
    if(r.mask&&!r.mask[source])continue;
    if(mask)mask[i]=1;pixelSet(doc,pixels,r.x+x,r.y+y,r.data[source]);if(indices&&r.x+x>=0&&r.y+y>=0&&r.x+x<doc.width&&r.y+y<doc.height)indices[(r.y+y)*doc.width+r.x+x]=r.indexed.data[source];
  }
  return selection?{...selection,mask}:null;
}
export {History} from './history.js';
export function demoDocument(){
  const doc=createDocument(32,32,'林间微光');addLayer(doc,0);doc.layers[0].name='地面';doc.layers[1].name='小蘑菇';
  const paint=(pixels,x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixelSet(doc,pixels,i,j,colorValue(c));};
  const ground=doc.frames[0].cels[0];paint(ground,5,26,22,1,'#354b58');paint(ground,7,27,18,1,'#29334c');
  for(let f=0;f<4;f++){
    if(f>0)addFrame(doc,f-1,true);
    const p=doc.frames[f].cels[1];p.fill(0);const bob=f===1||f===2?-1:0;
    const rows=['      ####      ','    ########    ','  ############  ',' ############## ','################','################',' ############## ','   ##########   '];
    rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')pixelSet(doc,p,x+8,y+7+bob,colorValue(y<3?'#edb75b':y<6?'#d88745':'#b85740'));}));
    paint(p,13,15+bob,6,9-bob,'#e5e4d5');paint(p,13,15+bob,2,8-bob,'#beb18a');paint(p,12,23,8,2,'#e5e4d5');paint(p,11,10+bob,2,2,'#fff4d2');paint(p,17,9+bob,3,2,'#fff4d2');paint(p,20,12+bob,2,2,'#f2c1ad');paint(p,16,19+bob,1,2,'#462c40');paint(p,19,19+bob,1,2,'#462c40');
    pixelSet(doc,p,5+f,10-f,colorValue('#a4c98a'));pixelSet(doc,p,26-f,17+f,colorValue('#edb75b'));doc.frames[f].duration=160;
  }doc.tags=[{id:'idle',name:'待机',color:'#edb75b',from:0,to:3,direction:'pingpong'}];return doc;
}

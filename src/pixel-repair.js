import {detectWithAlgorithm,pixelateImage,manualPixelGrid} from '../node_modules/@xprite/pixelate/dist/index.js';

import {extractPalette,rgba} from './colors.js';

export function repairPalette(data){
 const colors=extractPalette(data).map(color=>{
  const {r,g,b,a}=rgba(color),v=Math.max(r,g,b),delta=v-Math.min(r,g,b),s=v?delta/v:0;
  let h=0;
  if(delta){h=v===r?(g-b)/delta:v===g?(b-r)/delta+2:(r-g)/delta+4;h=(h*60+360)%360;}
  // 30-degree hue families wrap around red; neutral colors form their own ramp.
  return{color,group:s===0?12:Math.floor(((h+15)%360)/30),v,s,h,a};
 });
 colors.sort((a,b)=>a.group-b.group||b.v-a.v||b.s-a.s||a.h-b.h||b.a-a.a||a.color.localeCompare(b.color));
 return colors.length?colors.map(entry=>entry.color):['#00000000'];
}

export const REPAIR_MIMES=['image/png','image/jpeg','image/webp','image/bmp'];
export function imageMime(name){return({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'})[name.split('.').pop().toLowerCase()]||null;}
export function canRepairImage(file){return file.type==='image'&&REPAIR_MIMES.includes(file.mime||imageMime(file.name||''));}

export const REPAIR_DEFAULTS={mode:'recover-grid',algorithm:'auto',colorPicker:'most-common',manual:false,cellWidth:8,cellHeight:8,targetWidth:64,targetHeight:64,method:'structure',blockPicker:false,prepass:'none',lineGuide:'union',outlineStrength:0,preserveDimensions:false,removeNoise:false,reduceColors:false,maxColors:16,adaptive:false,dither:'none',alphaMode:'straight'};

export function repairPixels(image,settings={}){
 const s={...REPAIR_DEFAULTS,...settings};let grid;
 if(s.mode==='recover-grid'){
  grid=s.manual?manualPixelGrid(image,s.cellWidth,s.cellHeight):detectWithAlgorithm(image,s.algorithm,{width:s.targetWidth,height:s.targetHeight});
  if(grid.reliable===false)throw new Error('未检测到可靠像素网格，请展开高级设置，指定网格尺寸或使用自定义输出尺寸。');
 }
 const output=pixelateImage(image,{mode:s.mode,algorithm:s.algorithm,grid,colorPicker:s.colorPicker,targetWidth:s.targetWidth,targetHeight:s.targetHeight,method:s.method,blockPicker:s.blockPicker,prepass:s.prepass,lineGuide:s.lineGuide,outlineStrength:s.outlineStrength,preserveDimensions:s.preserveDimensions,removeNoise:s.removeNoise,alphaMode:s.alphaMode,...(s.reduceColors?{paletteSnap:{colors:s.maxColors,adaptive:s.adaptive,dither:s.dither}}:{})});
 return{...output,palette:s.reduceColors?repairPalette(output.data):null,grid:grid?{width:grid.width,height:grid.height,confidence:grid.confidence}:null};
}

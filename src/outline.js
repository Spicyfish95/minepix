import {selectionFrom} from './selection-mask.js';
import {selectionContains} from './model.js';
import {modifySelection} from './selection-edit.js';
import {applyInk} from './brush-engine.js';

export function outlineImagePixels(doc,pixels,{outlineWidth=1,outlineShape='circle',outlinePlacement='outside',outlineColor=0x000000ff}={}){
 const silhouette=selectionFrom(doc,(x,y)=>!!(pixels[y*doc.width+x]&255)),inside=outlinePlacement==='inside';
 const boundary=modifySelection(doc,silhouette,inside?'border':'expand',outlineWidth,outlineShape),output=pixels.slice();
 for(let i=0;i<pixels.length;i++)if((inside?!!(pixels[i]&255):!(pixels[i]&255))&&selectionContains(boundary,i%doc.width,Math.floor(i/doc.width)))output[i]=applyInk(pixels[i],outlineColor,'over',1);
 return output;
}

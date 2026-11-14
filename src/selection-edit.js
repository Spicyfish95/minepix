import {selectionContains} from './model.js';
import {selectionFrom} from './selection-mask.js';
import {colorMatches} from './color-replace.js';

export const colorRangeSelection=(doc,pixels,color,tolerance=0)=>selectionFrom(doc,(x,y)=>colorMatches(pixels[y*doc.width+x],color,tolerance));

// Squared Euclidean distance transform of one row/column. The lower envelope of
// parabolas keeps circle morphology linear in image size instead of radius².
function euclideanLine(values,length,sites,edges,output){
 let k=0;sites[0]=0;edges[0]=-Infinity;edges[1]=Infinity;
 for(let q=1;q<length;q++){
  let cross;
  do{const p=sites[k];cross=((values[q]+q*q)-(values[p]+p*p))/(2*(q-p));if(cross<=edges[k])k--;else break;}while(k>=0);
  ++k;sites[k]=q;edges[k]=cross;edges[k+1]=Infinity;
 }
 k=0;for(let q=0;q<length;q++){while(edges[k+1]<q)k++;const delta=q-sites[k];output[q]=delta*delta+values[sites[k]];}
}

export function modifySelection(doc,selection,operation,radius=1,shape='circle'){
 if(!selection?.w||!selection.h)return selectionFrom(doc,()=>false);
 const left=Math.max(0,selection.x-radius),top=Math.max(0,selection.y-radius),right=Math.min(doc.width,selection.x+selection.w+radius),bottom=Math.min(doc.height,selection.y+selection.h+radius);
 const width=right-left+2,height=bottom-top+2,field=new Float32Array(width*height),target=operation==='expand';
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=left+x-1,py=top+y-1,inside=px>=0&&py>=0&&px<doc.width&&py<doc.height&&selectionContains(selection,px,py);
  field[y*width+x]=!!inside===target?0:1e12;
 }
 if(shape==='square'){
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;let best=field[i];if(x)best=Math.min(best,field[i-1]+1);if(y){best=Math.min(best,field[i-width]+1);if(x)best=Math.min(best,field[i-width-1]+1);if(x+1<width)best=Math.min(best,field[i-width+1]+1);}field[i]=best;}
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;let best=field[i];if(x+1<width)best=Math.min(best,field[i+1]+1);if(y+1<height){best=Math.min(best,field[i+width]+1);if(x)best=Math.min(best,field[i+width-1]+1);if(x+1<width)best=Math.min(best,field[i+width+1]+1);}field[i]=best;}
 }else{
  const length=Math.max(width,height),values=new Float64Array(length),output=new Float64Array(length),sites=new Int32Array(length),edges=new Float64Array(length+1);
  for(let y=0;y<height;y++){values.set(field.subarray(y*width,(y+1)*width));euclideanLine(values,width,sites,edges,output);field.set(output.subarray(0,width),y*width);}
  for(let x=0;x<width;x++){for(let y=0;y<height;y++)values[y]=field[y*width+x];euclideanLine(values,height,sites,edges,output);for(let y=0;y<height;y++)field[y*width+x]=output[y];}
 }
 const threshold=shape==='square'?radius:(radius+.5)**2;
 return selectionFrom(doc,(x,y)=>{
  if(x<left||x>=right||y<top||y>=bottom)return false;
  const close=field[(y-top+1)*width+x-left+1]<=threshold,selected=selectionContains(selection,x,y);
  return operation==='expand'?close:operation==='contract'?selected&&!close:selected&&close;
 });
}

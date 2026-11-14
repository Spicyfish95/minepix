import {celProperty} from './cel-properties.js';
import {isReference,isBackground,rasterReference,overBackground} from './layer-types.js';
export const BLEND_MODES=[['normal','正常'],['multiply','正片叠底'],['screen','滤色'],['overlay','叠加'],['darken','变暗'],['lighten','变亮'],['color-dodge','颜色减淡'],['color-burn','颜色加深'],['hard-light','强光'],['soft-light','柔光'],['difference','差值'],['exclusion','排除'],['hue','色相'],['saturation','饱和度'],['color','颜色'],['luminosity','明度'],['addition','相加'],['subtract','减去'],['divide','相除']];
export const blendId=mode=>BLEND_MODES.findIndex(([id])=>id===(mode||'normal'));
const lum=c=>.3*c[0]+.59*c[1]+.11*c[2],sat=c=>Math.max(...c)-Math.min(...c);
function clipColor(c){const l=lum(c),n=Math.min(...c),x=Math.max(...c);if(n<0)c=c.map(v=>l+(v-l)*l/(l-n));if(x>1)c=c.map(v=>l+(v-l)*(1-l)/(x-l));return c;}
function setLum(c,l){const d=l-lum(c);return clipColor(c.map(v=>v+d));}
function setSat(c,s){const order=[0,1,2].sort((a,b)=>c[a]-c[b]),[lo,mid,hi]=order,out=[0,0,0];if(c[hi]>c[lo]){out[mid]=(c[mid]-c[lo])*s/(c[hi]-c[lo]);out[hi]=s;}return out;}
const hardLight=(b,s)=>s<=.5?2*b*s:1-2*(1-b)*(1-s);
function channel(b,s,mode){switch(mode){case 'multiply':return b*s;case 'screen':return b+s-b*s;case 'overlay':return hardLight(s,b);case 'darken':return Math.min(b,s);case 'lighten':return Math.max(b,s);case 'color-dodge':return b===0?0:s===1?1:Math.min(1,b/(1-s));case 'color-burn':return b===1?1:s===0?0:1-Math.min(1,(1-b)/s);case 'hard-light':return hardLight(b,s);case 'soft-light':return s<=.5?b-(1-2*s)*b*(1-b):b+(2*s-1)*((b<=.25?((16*b-12)*b+4)*b:Math.sqrt(b))-b);case 'difference':return Math.abs(b-s);case 'exclusion':return b+s-2*b*s;case 'addition':return Math.min(1,b+s);case 'subtract':return Math.max(0,b-s);case 'divide':return b===0?0:s===0?1:Math.min(1,b/s);default:return s;}}
export function blendColor(b,s,mode){switch(mode){case 'hue':return setLum(setSat(s,sat(b)),lum(b));case 'saturation':return setLum(setSat(b,sat(s)),lum(b));case 'color':return setLum(s,lum(b));case 'luminosity':return setLum(b,lum(s));default:return b.map((v,i)=>channel(v,s[i],mode));}}
// Aseprite new-blender blends normal and mode results in two alpha-weighted stages.
// The combined mode weight is da + da * sa * (1 - da), not the W3C backdrop weight alone.
export function compositeInto(doc,index,rect,target,{includeReference=false}={}){
 const x0=Math.max(0,Math.floor(rect.x)),y0=Math.max(0,Math.floor(rect.y)),x1=Math.min(doc.width,Math.ceil(rect.x+rect.w)),y1=Math.min(doc.height,Math.ceil(rect.y+rect.h));
 if(x1<=x0||y1<=y0)return{x:x0,y:y0,w:0,h:0};
 const regionWidth=x1-x0,regionHeight=y1-y0;
 for(let y=y0;y<y1;y++)target.fill(0,(y*doc.width+x0)*4,(y*doc.width+x1)*4);
 const children=new Map();
 doc.layers.forEach((layer,l)=>{
  if(!children.has(layer.parentId))children.set(layer.parentId,[]);
  children.get(layer.parentId).push(l);
 });
 const paint=(indices,output,stride,originX,originY)=>{
  for(const l of indices){
   const layer=doc.layers[l];
   if(!layer.visible||!layer.opacity||isReference(layer)&&!includeReference)continue;
   if(layer.type==='group'&&layer.passThrough){paint(children.get(layer.id)||[],output,stride,originX,originY);continue;}
   let groupBuffer;
   let pixels;
   if(layer.type==='group'){
    // Isolated groups only need the dirty region, in the same RGBA layout as output.
    groupBuffer=new Uint8ClampedArray(regionWidth*regionHeight*4);
    paint(children.get(layer.id)||[],groupBuffer,regionWidth,x0,y0);
   }else pixels=isReference(layer)?rasterReference(doc,l,index,{x:x0,y:y0,w:regionWidth,h:regionHeight}):doc.frames[index].cels[l];
   const property=celProperty(doc,index,l),bg=isBackground(layer),opacity=layer.opacity/100*property.opacity/100,mode=layer.blendMode||'normal';
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    let source;
    if(groupBuffer){
     const offset=((y-y0)*regionWidth+x-x0)*4;
     source=((groupBuffer[offset]<<24)|(groupBuffer[offset+1]<<16)|(groupBuffer[offset+2]<<8)|groupBuffer[offset+3])>>>0;
    }else{
     const sx=x-property.x,sy=y-property.y;
     source=sx>=0&&sy>=0&&sx<property.width&&sy<property.height?pixels[sy*property.width+sx]:0;
    }
    const pixel=bg?overBackground(source,layer.clearColor):source,sa=(pixel&255)/255*opacity;
    if(!sa)continue;
    const j=((y-originY)*stride+x-originX)*4;
    if(mode==='normal'&&sa===1){
     output[j]=pixel>>>24;output[j+1]=pixel>>>16&255;output[j+2]=pixel>>>8&255;output[j+3]=255;
     continue;
    }
    const da=output[j+3]/255,oa=sa+da*(1-sa);
    if(mode==='normal'){
     output[j]=((pixel>>>24)*sa+output[j]*da*(1-sa))/oa;
     output[j+1]=(((pixel>>>16)&255)*sa+output[j+1]*da*(1-sa))/oa;
     output[j+2]=(((pixel>>>8)&255)*sa+output[j+2]*da*(1-sa))/oa;
    }else{
     const source=[pixel>>>24,pixel>>>16&255,pixel>>>8&255];
     const b=[output[j]/255,output[j+1]/255,output[j+2]/255],s=source.map(v=>v/255),mixed=blendColor(b,s,mode),weight=da+da*sa*(1-da);
     for(let c=0;c<3;c++)output[j+c]=255*(sa*((1-weight)*s[c]+weight*mixed[c])+(1-sa)*da*b[c])/oa;
    }
    output[j+3]=oa*255;
   }
  }
 };
 paint(children.get(undefined)||[],target,doc.width,0,0);
 return{x:x0,y:y0,w:regionWidth,h:regionHeight};
}

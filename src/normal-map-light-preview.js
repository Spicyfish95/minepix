import {defaultNormalMapLightOptions,prepareNormalMapLighting,renderPreparedNormalMapLighting} from '../node_modules/@xprite/lighter/dist/index.js';
import {fitPreview} from './import-preview.js';

export {defaultNormalMapLightOptions,prepareNormalMapLighting,renderPreparedNormalMapLighting};

export function lightingPreviewMarkup(){
 return '<section id="normal-light-preview" aria-label="光照效果预览"><canvas id="normal-light-canvas" tabindex="0" aria-label="拖动光源或使用方向键移动"></canvas><span id="normal-light-marker" aria-hidden="true" hidden>☀</span><span class="normal-preview-title">光照效果预览</span><p class="normal-light-hint">拖动光源查看光照</p></section>';
}

export function createLightingPreview(host,image){
 const canvas=host.querySelector('canvas'),context=canvas.getContext('2d'),marker=host.querySelector('#normal-light-marker'),bitmap=document.createElement('canvas');
 bitmap.width=image.width;bitmap.height=image.height;
 const bitmapContext=bitmap.getContext('2d'),options=defaultNormalMapLightOptions(image.width,image.height);
 let prepared=null,frame=null,view=null,drag=null;
 const draw=()=>{
  frame=null;if(!prepared)return;
  const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
  const result=renderPreparedNormalMapLighting(prepared,options);
  bitmapContext.putImageData(new ImageData(result.data,result.width,result.height),0,0);
  canvas.width=Math.round(width*devicePixelRatio);canvas.height=Math.round(height*devicePixelRatio);
  context.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);context.clearRect(0,0,width,height);context.imageSmoothingEnabled=false;
  view=fitPreview({width,height},image);context.drawImage(bitmap,view.x,view.y,image.width*view.scale,image.height*view.scale);
  marker.style.left=(view.x+options.position.x*view.scale)+'px';marker.style.top=(view.y+options.position.y*view.scale)+'px';marker.hidden=false;
 };
 const schedule=()=>{if(prepared&&frame===null)frame=requestAnimationFrame(draw);};
 const move=event=>{
  if(!prepared||!view)return;
  const bounds=canvas.getBoundingClientRect();options.position={x:Math.max(0,Math.min(image.width,(event.clientX-bounds.left-view.x)/view.scale)),y:Math.max(0,Math.min(image.height,(event.clientY-bounds.top-view.y)/view.scale))};schedule();
 };
 const down=event=>{if(event.button!==0||!prepared)return;event.preventDefault();drag=event.pointerId;canvas.setPointerCapture(drag);move(event);};
 const pointerMove=event=>{if(event.pointerId===drag)move(event);};
 const end=()=>{drag=null;};
 const key=event=>{
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!direction||!prepared)return;
  event.preventDefault();const step=event.shiftKey?10:1;options.position={x:Math.max(0,Math.min(image.width,options.position.x+direction[0]*step)),y:Math.max(0,Math.min(image.height,options.position.y+direction[1]*step))};schedule();
 };
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);canvas.addEventListener('keydown',key);
 const observer=new ResizeObserver(schedule);observer.observe(host);
 const clear=()=>{cancelAnimationFrame(frame);frame=null;prepared=null;view=null;drag=null;context.clearRect(0,0,canvas.width,canvas.height);marker.hidden=true;host.setAttribute('aria-busy','true');};
 return{
  setNormals(normals,invertY){prepared=prepareNormalMapLighting(image,normals);options.invertY=invertY;host.setAttribute('aria-busy','false');schedule();},
  clear,
  dispose(){clear();observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);canvas.removeEventListener('lostpointercapture',end);canvas.removeEventListener('keydown',key);}
 };
}

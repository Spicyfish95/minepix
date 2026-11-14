import {PROCESSING_MESSAGES} from './processing-state.js';
import {setButtonIcon} from './icons.js';

export function fitPreview(viewport,image){
 const scale=Math.min(viewport.width/image.width,viewport.height/image.height)*.94;
 return{scale,x:(viewport.width-image.width*scale)/2,y:(viewport.height-image.height*scale)/2};
}
export function zoomPreview(view,factor,point){
 const scale=Math.max(1/1024,Math.min(1024,view.scale*factor)),ratio=scale/view.scale;
 return{scale,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio};
}
export function panPreview(view,dx,dy){return{...view,x:view.x+dx,y:view.y+dy};}

export const previewMarkup='<section id="image-import-preview" aria-label="图片预览"><canvas id="sheet-import-preview"></canvas><div id="import-preview-loading" role="status" aria-label="正在处理图片" aria-live="polite" hidden><svg viewBox="0 0 80 80" aria-hidden="true"><rect x="12" y="12" width="56" height="56" rx="7"/><path d="M12 31h56M12 49h56M31 12v56M49 12v56"/><rect class="loading-pixel" x="31" y="31" width="18" height="18"/></svg><div class="processing-feedback"><strong id="import-preview-stage">等待参数稳定后开始处理…</strong><span>请耐心等待，处理完成后将自动更新预览。</span><progress id="import-preview-progress" aria-label="图片处理进度"></progress></div></div><button id="import-preview-fit" type="button" class="icon-button" title="适应内容" aria-label="适应内容"></button><output id="import-preview-zoom"></output></section>';

export function createImportPreview(host){
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),fitButton=host.querySelector('button'),placeholder=host.querySelector('[role=status]'),zoomLabel=host.querySelector('output');
 let source=null,rects=[],view=null,drag=null,needsFit=true;
 const size=()=>({width:host.clientWidth,height:host.clientHeight});
 const draw=()=>{
  const {width,height}=size();if(!width||!height)return;
  const dpr=devicePixelRatio;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);if(!source)return;
  if(needsFit||!view){view=fitPreview(size(),source);needsFit=false;}
  ctx.imageSmoothingEnabled=false;ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);ctx.drawImage(source,0,0);
  ctx.strokeStyle=getComputedStyle(host).getPropertyValue('--accent');ctx.lineWidth=1/view.scale;
  for(const r of rects)ctx.strokeRect(r.x,r.y,r.w,r.h);
  zoomLabel.textContent=Math.round(view.scale*100)+'%';
 };
 const setStatus=stage=>{host.querySelector('#import-preview-stage').textContent=PROCESSING_MESSAGES[stage];};
 const fit=()=>{needsFit=true;draw();};
 setButtonIcon(fitButton,'fit');fitButton.onclick=fit;
 canvas.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();if(!source||!view)return;const bounds=canvas.getBoundingClientRect();view=zoomPreview(view,Math.exp(-event.deltaY*.002),{x:event.clientX-bounds.left,y:event.clientY-bounds.top});draw();},{passive:false});
 canvas.addEventListener('pointerdown',event=>{if(event.button!==1||!source)return;event.preventDefault();event.stopPropagation();drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('panning');});
 canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;view=panPreview(view,event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;draw();});
 const end=()=>{drag=null;canvas.classList.remove('panning');};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);canvas.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
 const observer=new ResizeObserver(()=>{needsFit=true;draw();});observer.observe(host);
 return{
  setImage(image,frames=[]){if(source!==image)needsFit=true;source=image;rects=frames;canvas.hidden=false;placeholder.hidden=true;fitButton.disabled=false;host.setAttribute('aria-busy','false');draw();},
  setStatus,
  loading(){setStatus('queued');canvas.hidden=true;placeholder.hidden=false;fitButton.disabled=true;zoomLabel.textContent='';host.setAttribute('aria-busy','true');},
  clear(){source=null;draw();canvas.hidden=false;placeholder.hidden=true;fitButton.disabled=true;zoomLabel.textContent='';host.setAttribute('aria-busy','false');},
  state:()=>({...view}),
  dispose(){observer.disconnect();placeholder.hidden=true;host.setAttribute('aria-busy','false');}
 };
}

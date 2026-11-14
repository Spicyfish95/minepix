export function selectionRect(start,end,width,height){
 const clamp=(v,max)=>Math.max(0,Math.min(max,v));
 const x=clamp(Math.min(start.x,end.x),width),y=clamp(Math.min(start.y,end.y),height);
 return{x,y,width:clamp(Math.max(start.x,end.x),width)-x,height:clamp(Math.max(start.y,end.y),height)-y};
}
export function imageRegion(rect,viewport,image){
 const left=Math.round(rect.x/viewport.width*image.width),top=Math.round(rect.y/viewport.height*image.height);
 const right=Math.round((rect.x+rect.width)/viewport.width*image.width),bottom=Math.round((rect.y+rect.height)/viewport.height*image.height);
 return[left,top,right-left,bottom-top];
}
export function mountScreenshot(root,{image,width,height,pointer={x:width/2,y:height/2},confirm,cancel,lock=()=>{}}){
 const dom=root.ownerDocument,win=dom.defaultView;
 root.classList.add('capture-root');image.className='capture-image';image.draggable=false;
 const selection=dom.createElement('div');selection.className='capture-selection';
 const label=dom.createElement('span');label.className='capture-size';selection.append(label);
 const toolbar=dom.createElement('div');toolbar.className='capture-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','截图操作');
 const hint=dom.createElement('div');hint.className='capture-hint';hint.textContent='截图模式 · 拖动框选 · 双击截取整屏 · Esc 退出';
 const status=dom.createElement('span');status.className='capture-status';status.setAttribute('role','status');
 let rect=null,start=null,dragged=false,busy=false,lastPoint=null;
 const viewport=()=>({width:root.clientWidth,height:root.clientHeight});
 const region=()=>rect?imageRegion(rect,viewport(),{width,height}):null;
 const button=(text,run)=>{const node=dom.createElement('button');node.type='button';node.textContent=text;node.onclick=run;toolbar.append(node);return node;};
 const positionHint=(x,y)=>{
  hint.style.left=Math.max(8,Math.min(x+20,root.clientWidth-hint.offsetWidth-8))+'px';
  hint.style.top=Math.max(8,Math.min(y+24,root.clientHeight-hint.offsetHeight-8))+'px';
 };
 const render=()=>{
  image.hidden=!rect;selection.hidden=!rect;toolbar.hidden=!rect||!!start;hint.hidden=!!rect||!!start||busy;
  if(!rect)return;
  selection.style.cssText=`left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
  const r=region();label.textContent=r[2]+' × '+r[3];
  toolbar.style.left=Math.max(8,Math.min(rect.x+rect.width-toolbar.offsetWidth,root.clientWidth-toolbar.offsetWidth-8))+'px';
  toolbar.style.top=Math.max(8,Math.min(rect.y+rect.height+12,root.clientHeight-toolbar.offsetHeight-8))+'px';
  if(lastPoint){const box=toolbar.getBoundingClientRect(),base=root.getBoundingClientRect();
   if(lastPoint.x>=box.left-base.left&&lastPoint.x<=box.right-base.left&&lastPoint.y>=box.top-base.top&&lastPoint.y<=box.bottom-base.top)toolbar.style.top='8px';}
 };
 const reset=()=>{rect=null;start=null;dragged=false;status.textContent='';lock(false);render();};
 const full=()=>{rect={x:0,y:0,...viewport()};lock(true);render();};
 const finish=async()=>{
  if(busy||!rect?.width||!rect?.height)return;
  busy=true;for(const button of toolbar.querySelectorAll('button'))button.disabled=true;
  status.textContent='正在复制…';render();
  try{await confirm(region());}
  catch(error){status.textContent=error.message;busy=false;for(const button of toolbar.querySelectorAll('button'))button.disabled=false;render();}
 };
 button('当前整屏',full);button('重新框选',reset);button('取消 · Esc',()=>{if(!busy)void cancel();});button('复制截图 · Enter',finish).className='primary';
 root.append(image,selection,toolbar,hint,status);
 const point=event=>{const box=root.getBoundingClientRect();return{x:event.clientX-box.left,y:event.clientY-box.top};};
 root.onpointerdown=event=>{
  if(busy||event.button!==0||event.target.closest('.capture-toolbar'))return;
  start=point(event);lastPoint=start;dragged=false;
  lock(true);root.setPointerCapture(event.pointerId);event.preventDefault();render();
 };
 root.onpointermove=event=>{
  const p=point(event);positionHint(p.x,p.y);
  if(!start)return;
  if(Math.hypot(p.x-start.x,p.y-start.y)>=4)dragged=true;
  if(dragged){rect=selectionRect(start,p,root.clientWidth,root.clientHeight);render();}
 };
 root.onpointerup=event=>{
  if(!start)return;
  start=null;if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
  if(!rect?.width||!rect?.height)rect=null;
  lock(!!rect);render();
 };
 root.onpointercancel=reset;
 root.ondblclick=event=>{
  if(busy||event.button!==0||event.target.closest('.capture-toolbar')||dragged)return;
  event.preventDefault();const p=point(event);
  if(!rect||p.x<rect.x||p.x>=rect.x+rect.width||p.y<rect.y||p.y>=rect.y+rect.height)full();
  void finish();
 };
 const key=event=>{if(event.key==='Escape'){event.preventDefault();if(!busy)void cancel();}else if(event.key==='Enter'){event.preventDefault();void finish();}};
 const resize=()=>{if(rect){rect=selectionRect({x:rect.x,y:rect.y},{x:rect.x+rect.width,y:rect.y+rect.height},root.clientWidth,root.clientHeight);}render();};
 dom.addEventListener('keydown',key);win.addEventListener('resize',resize);
 render();positionHint(pointer.x/width*root.clientWidth,pointer.y/height*root.clientHeight);
 const ready=Promise.resolve();
 return{ready,reset,region,get idle(){return !rect&&!start&&!busy;},dispose:()=>{
  dom.removeEventListener('keydown',key);win.removeEventListener('resize',resize);
  root.onpointerdown=root.onpointermove=root.onpointerup=root.onpointercancel=root.ondblclick=null;root.replaceChildren();
 }};
}

export function selectionRect(start,end,width,height){
 const clamp=(v,max)=>Math.max(0,Math.min(max,Math.round(v)));
 const x=clamp(Math.min(start.x,end.x),width),y=clamp(Math.min(start.y,end.y),height);
 return{x,y,width:clamp(Math.max(start.x,end.x),width)-x,height:clamp(Math.max(start.y,end.y),height)-y};
}
export function imageRegion(rect,viewport,image){
 const left=Math.round(rect.x/viewport.width*image.width),top=Math.round(rect.y/viewport.height*image.height);
 const right=Math.round((rect.x+rect.width)/viewport.width*image.width),bottom=Math.round((rect.y+rect.height)/viewport.height*image.height);
 return[left,top,right-left,bottom-top];
}
export function mountScreenshot(root,{src,width,height,confirm,cancel}){
 const dom=root.ownerDocument,win=dom.defaultView;
 root.classList.add('capture-root');
 const image=dom.createElement('img');image.className='capture-image';image.src=src;image.draggable=false;
 const selection=dom.createElement('div');selection.className='capture-selection';
 const label=dom.createElement('span');label.className='capture-size';selection.append(label);
 const toolbar=dom.createElement('div');toolbar.className='capture-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','截图操作');
 const status=dom.createElement('span');status.className='capture-status';status.setAttribute('role','status');
 let rect,start,busy=false;
 const viewport=()=>({width:root.clientWidth,height:root.clientHeight});
 const button=(text,run)=>{const node=dom.createElement('button');node.type='button';node.textContent=text;node.onclick=run;toolbar.append(node);return node;};
 const render=()=>{
  selection.style.cssText=`left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
  const region=imageRegion(rect,viewport(),{width,height});label.textContent=region[2]+' × '+region[3];
  toolbar.style.left=Math.max(8,Math.min(rect.x+rect.width-toolbar.offsetWidth,root.clientWidth-toolbar.offsetWidth-8))+'px';
  toolbar.style.top=Math.max(8,Math.min(rect.y+rect.height+12,root.clientHeight-toolbar.offsetHeight-8))+'px';
 };
 const reset=()=>{rect={x:0,y:0,...viewport()};render();};
 const finish=async()=>{
  if(busy||!rect.width||!rect.height)return;
  busy=true;for(const button of toolbar.querySelectorAll('button'))button.disabled=true;
  status.textContent='正在复制…';
  try{await confirm(imageRegion(rect,viewport(),{width,height}));}
  catch(error){status.textContent=error.message;busy=false;for(const button of toolbar.querySelectorAll('button'))button.disabled=false;}
 };
 button('全屏',reset);button('重新框选',()=>{status.textContent='拖动鼠标选择区域';reset();});
 button('取消 · Esc',()=>{if(!busy)void cancel();});button('复制截图 · Enter',finish).className='primary';
 root.append(image,selection,toolbar,status);
 root.onpointerdown=event=>{
  if(busy||event.button!==0||event.target.closest('.capture-toolbar'))return;
  const box=root.getBoundingClientRect();start={x:event.clientX-box.left,y:event.clientY-box.top};
  root.setPointerCapture(event.pointerId);event.preventDefault();
 };
 root.onpointermove=event=>{
  if(!start)return;const box=root.getBoundingClientRect();
  rect=selectionRect(start,{x:event.clientX-box.left,y:event.clientY-box.top},root.clientWidth,root.clientHeight);render();
 };
 root.onpointerup=event=>{if(!start)return;start=null;if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);if(!rect.width||!rect.height)reset();};
 root.onpointercancel=()=>{start=null;reset();};
 const key=event=>{if(event.key==='Escape'){event.preventDefault();if(!busy)void cancel();}else if(event.key==='Enter'){event.preventDefault();void finish();}};
 dom.addEventListener('keydown',key);
 win.addEventListener('resize',reset);reset();
 return{reset,region:()=>imageRegion(rect,viewport(),{width,height}),dispose:()=>{dom.removeEventListener('keydown',key);win.removeEventListener('resize',reset);root.replaceChildren();}};
}

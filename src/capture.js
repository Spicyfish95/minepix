import {invoke} from '@tauri-apps/api/core';
import {mountScreenshot} from './screenshot-selection.js';
import {cursorStyle} from './interaction.js';
import {captureCanvas} from './capture-pixels.js';
const call=(method,...args)=>invoke('desktop_call',{method,args});
let selection,timer,running=false,generation=0;
async function fail(error){
 clearTimeout(timer);selection?.dispose();selection=null;document.body.classList.add('capture-error');document.body.textContent='无法打开截图：'+error;
 const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>call('finishCapture',null);document.body.append(close);
 await call('captureReady');
}
async function show(state){
 if(state.colorPicker){
  selection?.dispose();document.body.replaceChildren();document.body.classList.add('screen-color-picker');document.body.style.cursor=cursorStyle('eyedropper');
  const hint=document.createElement('div');hint.className='capture-hint';hint.style.left='12px';hint.style.top='12px';hint.textContent='Alt 取色 · 单击采集屏幕颜色 · 松开 Alt / Esc 取消';document.body.append(hint);
  let finishing=false;
  const finish=method=>{if(finishing)return;finishing=true;void call(method).catch(error=>fail(error));};
  const down=event=>{event.preventDefault();finish(event.button===0?'finishScreenColor':'finishCapture');};
  const key=event=>{if(event.key==='Escape'||event.type==='keyup'&&event.key==='Alt'){event.preventDefault();finish('finishCapture');}};
  document.addEventListener('pointerdown',down);document.addEventListener('keydown',key);document.addEventListener('keyup',key);
  selection={idle:true,dispose:()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);document.body.classList.remove('screen-color-picker');document.body.style.cursor='';}};
  await call('captureReady');return;
 }

 const image=document.createElement('canvas');image.width=state.screen.width;image.height=state.screen.height;
 const token=generation;
 selection?.dispose();document.body.classList.remove('capture-error');
 selection=mountScreenshot(document.body,{image,width:image.width,height:image.height,pointer:state.pointer,
  confirm:region=>call('finishCapture',region),cancel:()=>call('finishCapture',null),
  lock:value=>{void call('captureLock',value).catch(error=>{if(token===generation&&running)void fail(error);});}});
 const current=selection;
 await selection.ready;
 await call('captureReady');
 // Ready mode is transparent; only a selected region reveals the frozen screenshot.
 void invoke('capture_pixels').then(bytes=>{
  if(token!==generation||selection!==current)return;
  const source=captureCanvas(bytes,document);image.getContext('2d').drawImage(source,0,0);
 }).catch(error=>{if(token===generation&&selection===current)void fail(error);});
}
async function follow(token){
 try{
  if(selection?.idle){const state=await call('captureMonitor');if(token!==generation)return;if(state.changed)await show(state);}
  if(running&&token===generation)timer=setTimeout(()=>follow(token),40);
 }catch(error){if(running&&token===generation)await fail(error);}
}
window.startCapture=async()=>{
 if(running)return;
 running=true;const token=++generation;
 try{
  const state=await call('captureMonitor');
  if(token!==generation)return;
  await show(state);
  if(token===generation)timer=setTimeout(()=>follow(token),40);
 }catch(error){if(token===generation)await fail(error);}
};
window.stopCapture=()=>{running=false;generation++;clearTimeout(timer);selection?.dispose();selection=null;document.body.replaceChildren();document.body.classList.remove('capture-error');};
if(await call('captureActive'))void window.startCapture();

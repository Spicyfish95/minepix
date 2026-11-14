import {invoke} from '@tauri-apps/api/core';
import {mountScreenshot} from './screenshot-selection.js';
import {captureCanvas} from './capture-pixels.js';
const call=(method,...args)=>invoke('desktop_call',{method,args});
let selection,timer,running=false,generation=0;
async function fail(error){
 clearTimeout(timer);selection?.dispose();selection=null;document.body.classList.add('capture-error');document.body.textContent='无法打开截图：'+error;
 const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>call('finishCapture',null);document.body.append(close);
 await call('captureReady');
}
async function show(state){
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

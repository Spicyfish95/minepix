import {invoke} from '@tauri-apps/api/core';
import {mountScreenshot} from './screenshot-selection.js';
const call=(method,...args)=>invoke('desktop_call',{method,args});
try{
 const file=await call('captureImage'),image=new Image();image.src='data:image/png;base64,'+file.data;await image.decode();
 mountScreenshot(document.body,{src:image.src,width:image.naturalWidth,height:image.naturalHeight,confirm:region=>call('finishCapture',region),cancel:()=>call('finishCapture',null)});
}catch(error){
 document.body.textContent='无法打开截图：'+error;
 const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>call('finishCapture',null);document.body.append(close);
}

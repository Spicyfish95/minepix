import {createThumbnailCache} from './thumbnails.js';
import {createExportClient} from './export-client.js';
import {packBinaryPacket} from './binary-packet.js';
import {packDocumentWire,unpackDocumentWire} from './document-wire.js';
import {createRecoveryClient} from './recovery-client.js';
﻿import {createDocumentSaver} from './document-save.js';
import {encodeSingleImage} from './single-image-save.js';
import {readSaveFormat} from './save-format.js';
import {encodeReference} from './layer-types.js';
import {loadReferenceFiles} from './reference-files.js';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow';
import {getCurrentWindow,Window} from '@tauri-apps/api/window';
import {applicationMenu} from './application-menu.js';
import {unpackProjectReadPacket,openedProject} from './project-transfer.js';
import {createProjectSaveClient} from './project-save-client.js';

// 拦截 WebView2 原生浏览器快捷键，防止刷新/查找/打印/源码/缩放重置等操作破坏编辑器状态。
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229)return;
  const ctrl=event.ctrlKey||event.metaKey;
  if(ctrl&&!event.altKey&&event.code==='KeyR'){event.preventDefault();return;}
  if(event.code==='F5'){event.preventDefault();return;}
  if(ctrl&&!event.altKey&&!event.shiftKey&&event.code==='KeyF'){event.preventDefault();return;}
  if(event.code==='F3'){event.preventDefault();return;}
  if(ctrl&&!event.altKey&&!event.shiftKey&&event.code==='KeyP'){event.preventDefault();return;}
  if(ctrl&&!event.altKey&&!event.shiftKey&&event.code==='KeyU'){event.preventDefault();return;}
  if(ctrl&&!event.altKey&&!event.shiftKey&&event.code==='Digit0'){event.preventDefault();return;}
},true);

const handlers=new Map(),current=getCurrentWindow();
const dispatch=(name,payload)=>{for(const callback of handlers.get(name)||[])callback(payload);};
const subscribe=(name,callback)=>{if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(callback);return()=>handlers.get(name).delete(callback);};
const invokeBackend=(command,args)=>invoke(command,args).catch(error=>{throw error instanceof Error?error:new Error(String(error));});
async function readProjectPacket(filePath,record=true,references=true){
 if(record)dispatch('file:loading',true);
 try{
  const packet=unpackProjectReadPacket(await invokeBackend('read_project_packed',{filePath,record}),{typed:true});
  if(references)packet.document=await loadReferenceFiles(packet.document,path=>readReference(path));return packet;
 }finally{if(record)dispatch('file:loading',false);}
}
const readProject=async(filePath,record=true)=>(await readProjectPacket(filePath,record)).document;
async function readReference(path){
 const file=await call('readReference',path),image=new Image();image.src='data:'+file.mime+';base64,'+file.data;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
 const {width,height,data}=encodeReference(image.width,image.height,context.getImageData(0,0,image.width,image.height).data);return{width,height,data};
}
async function resolveOpened(value){
 if(Array.isArray(value)){const files=[];for(const file of value)files.push(await resolveOpened(file));return files;}
 if(!value?.rawProject)return value;
 const packet=await readProjectPacket(value.filePath);return openedProject(value,packet.document,packet.info);
}
async function call(method,...args){
 const value=decodeWire(await invokeBackend('desktop_call',{method,args}));
 if(method==='startupFiles'){
  const files=[];for(const file of value)try{files.push(await resolveOpened(file));}catch(error){files.push({type:'error',message:error.message});}
  return files;
 }
 return ['open','openRecent','openDroppedPath'].includes(method)?resolveOpened(value):value;
}
function encodeWire(value){
 if(value instanceof ArrayBuffer)return{$wire:'ArrayBuffer',data:Array.from(new Uint8Array(value))};
 if(ArrayBuffer.isView(value))return{$wire:value.constructor.name,data:Array.from(value)};
 if(value instanceof Set)return{$wire:'Set',data:[...value].map(encodeWire)};
 if(value instanceof Map)return{$wire:'Map',data:[...value].map(([key,value])=>[encodeWire(key),encodeWire(value)])};
 if(Array.isArray(value))return value.map(encodeWire);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,encodeWire(value)]));
 return value;
}
function decodeWire(value){
 if(Array.isArray(value))return value.map(decodeWire);
 if(value&&typeof value==='object'){
  if(value.$wire==='Set')return new Set(value.data.map(decodeWire));
  if(value.$wire==='Map')return new Map(value.data.map(([key,value])=>[decodeWire(key),decodeWire(value)]));
  if(value.$wire==='ArrayBuffer')return new Uint8Array(value.data).buffer;
  const constructors={Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};
  if(constructors[value.$wire])return new constructors[value.$wire](value.data);
  return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,decodeWire(value)]));
 }
 return value;
}
const menu=applicationMenu(command=>dispatch('command',command),{development:import.meta.env.DEV});
const menuItems=new Map();
const visit=items=>{for(const item of items){if(item.id)menuItems.set(item.id,{item,base:item.label,keys:'',label:''});if(item.submenu)visit(item.submenu);}};
visit(menu);
function updateMenu(values,field){
 for(const [id,value]of Object.entries(values)){const entry=menuItems.get(id);if(!entry)continue;if(field==='keys'||field==='label'){entry[field]=value;entry.item.label=(entry.label||entry.base)+(entry.keys?' ('+entry.keys+')':'');}else entry.item[field]=value;}
 dispatch('menu-changed');
}
function windowBridge(target){
 const bridge={};
 bridge.windowState=async()=>({maximized:await target.isMaximized(),alwaysOnTop:await target.isAlwaysOnTop()});
 bridge.setAlwaysOnTop=async value=>{await target.setAlwaysOnTop(value);return bridge.windowState();};
 bridge.onWindowState=callback=>target.onResized(async()=>callback(await bridge.windowState()));
 bridge.windowControl=async action=>{if(action==='minimize')await target.minimize();else if(action==='maximize')await target.toggleMaximize();else if(action==='close'){await target.close();return;}return bridge.windowState();};
 bridge.startDragging=()=>target.startDragging();
 return bridge;
}

export async function initializeDesktop(){
 const bridge={testing:false,secondary:current.label!=='main'},projectSaveClient=createProjectSaveClient();
 const exports=createExportClient({invoke:bytes=>invokeBackend('export_packed',bytes),packProject:(...args)=>projectSaveClient.pack(...args)});
 const methods=['cancelScreenColor','readReference','saveReference','captureScreen','clipboardImages','openRepository','appInfo','editorInfo','editorReady','detachDocument','moveDocument','recordInputAudit','testNotification','recentFiles','recentThumbs','removeRecent','clearRecent','openRecent','startupFiles','openKeymap','openPalette','open','exportAseprite','pickExportDirectory','exportSheetMetadata','exportSheet','exportAnimation','save','saveProject','activateDocument','setDirty','checkUpdates','installUpdate','downloadUpdate','cancelUpdate','updateState','openUpdateRelease','setAutoUpdate','setLocale'];
 for(const method of methods)bridge[method]=(...args)=>call(method,...args);
 bridge.readReference=readReference;
 bridge.pickScreenColor=()=>new Promise((resolve,reject)=>{
  const unsubscribe=subscribe('capture:color',value=>{unsubscribe();resolve(value);});
  call('pickScreenColor').catch(error=>{unsubscribe();reject(error);});
 });
 // Internal smoke helpers may select a fresh entry by index; IPC always receives its path.
 bridge.openRecent=async entry=>{
  const path=typeof entry==='number'?(await call('recentFiles'))[entry]?.path:entry;
  if(!path)throw new Error('最近文件条目已失效');
  return call('openRecent',path);
 };
 bridge.saveProject=createDocumentSaver({
  getDefaultFormat:()=>readSaveFormat(localStorage),choosePath:options=>call('chooseProjectPath',options),encodeImage:encodeSingleImage,
  savePacked:async(data,name,filePath)=>invokeBackend('save_project_packed',await projectSaveClient.pack(data,name,false,{filePath})),
  saveImage:(filePath,encoded)=>exports.image({filePath,...encoded})
 });
 window.addEventListener('unload',()=>projectSaveClient.dispose(),{once:true});
 const recentThumbnails=createThumbnailCache({storage:localStorage,generate:async path=>{
  const {composite}=await import('./model.js'),size=32;
  let doc,bytes;
  if(/\.(pix|ase|aseprite)$/i.test(path)){doc=(await readProjectPacket(path,false,false)).document;const source=composite(doc,0);bytes=new Uint8Array(source.buffer,source.byteOffset,source.byteLength);}
  else{doc=await readReference(path);bytes=Uint8Array.from(atob(doc.data),value=>value.charCodeAt(0));}
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const from=(Math.min(doc.height-1,Math.floor(y*doc.height/size))*doc.width+Math.min(doc.width-1,Math.floor(x*doc.width/size)))*4;pixels.set(bytes.subarray(from,from+4),(y*size+x)*4);}
  return{path,width:doc.width,height:doc.height,size,pixels:btoa(String.fromCharCode(...pixels))};
 }});
 bridge.recentThumbs=async paths=>recentThumbnails(await call('recentFiles'),paths);
 bridge.exportAnimation=options=>exports.animation(options);
 bridge.exportAseprite=(document,destination)=>exports.aseprite(document,destination);
 bridge.save=(...args)=>exports.save(...args);
 bridge.exportSheetMetadata=options=>exports.sheet(options,true);
 bridge.exportSheet=async options=>{
  const {engineFiles}=await import('./formats/engine-export.js');
  const name=String(options.name||'animation').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,100)||'animation',base=name+'-sheet';
  return exports.sheet({...options,engineFiles:engineFiles({...options.metadata,image:base+'.png'},base,options.engineFormat||'native')});
 };
 for(const [method,event]of Object.entries({onFileLoading:'file:loading',onScreenColorRequest:'capture:request-color',onCapture:'capture:complete',onCommand:'command',onEditorError:'editor:error',onUpdateState:'update:state',onNotificationAction:'notification:action',onWindowMenu:'menu-changed'}))bridge[method]=callback=>subscribe(event,callback);
 let incoming=Promise.resolve();
 bridge.onOpenFile=callback=>subscribe('open-file-data',file=>{incoming=incoming.then(async()=>callback(await resolveOpened(file))).catch(error=>dispatch('editor:error',error.message));});
 bridge.onDocumentRequest=callback=>subscribe('editor:request',async({requestId,operation,data})=>{
  async function resolve(value){
   if(value?.$binary)return unpackDocumentWire(await invokeBackend('document_transfer_get',{token:value.$binary}));
   if(Array.isArray(value))return Promise.all(value.map(resolve));
   if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,value])=>[key,await resolve(value)])));
   return value;
  }
  try{
   const result=await callback(operation,operation==='adopt'?await resolve(data):decodeWire(data));
   const encoded=['take','take-all'].includes(operation)?await invokeBackend('document_transfer_put',packBinaryPacket({requestId},[packDocumentWire(result)])):encodeWire(result);
   await call('editorReply',{requestId,result:encoded});
  }
  catch(error){await call('editorReply',{requestId,error:error.message});}
 });
 Object.assign(bridge,windowBridge(current));
 bridge.windowControl=async action=>{if(action==='close'){await call('closeWindow');return;}return windowBridge(current).windowControl(action);};
 bridge.closeConfirmed=()=>call('closeConfirmed');
 bridge.panelBridge=child=>windowBridge(new Window(child.__MINEPIX_PANEL_LABEL__));
 bridge.windowMenu=async()=>menu;
 bridge.menuCommand=async({id,role})=>{if(id)dispatch('command',id);else if(role==='quit')await call('quit');else if(role==='togglefullscreen')await current.setFullscreen(!await current.isFullscreen());};
 bridge.setKeymapLabels=labels=>updateMenu(labels,'keys');
 bridge.setMenuLabels=labels=>updateMenu(labels,'label');
 bridge.setMenuEnabled=values=>updateMenu(values,'enabled');
 bridge.setMenuChecked=values=>updateMenu(values,'checked');
 const recoveryClient=createRecoveryClient({pack:(...args)=>projectSaveClient.pack(...args),write:bytes=>invokeBackend('recovery_write_packed',bytes),load:(id,previous)=>invokeBackend('recovery_load_packed',{id,previous}),discard:filePath=>invokeBackend('recovery_discard',{filePath}),readReference});
 bridge.saveRecovery=record=>recoveryClient.save(record);
 bridge.listRecovery=()=>invokeBackend('recovery_list');
 bridge.recoveryForPath=filePath=>invokeBackend('recovery_for_path',{filePath});
 bridge.discardRecovery=filePath=>recoveryClient.discard(filePath);
 bridge.loadRecovery=(id,previous=false)=>recoveryClient.load(id,previous);
 bridge.pixelRepairWasm=()=>fetch(new URL('../node_modules/@xprite/pixelate/wasm/pixelfixer_detect_bg.wasm',import.meta.url)).then(response=>response.arrayBuffer());
 let dropSerial=0;
 const pendingPaths=new Map();
 subscribe('drop:path',({id,path,error})=>{const pending=pendingPaths.get(id);if(!pending)return;pendingPaths.delete(id);clearTimeout(pending.timer);error?pending.reject(new Error(error)):pending.resolve(path);});
 bridge.openDroppedFile=async file=>{
  if(!window.chrome?.webview?.postMessageWithAdditionalObjects)throw new Error('当前 WebView2 不支持本地文件路径，请更新 WebView2');
  const id=++dropSerial,path=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pendingPaths.delete(id);reject(new Error('读取拖入文件路径超时'));},10000);
   pendingPaths.set(id,{resolve,reject,timer});
   try{window.chrome.webview.postMessageWithAdditionalObjects(JSON.stringify({minepixFilePath:id}),[file]);}
   catch(error){pendingPaths.delete(id);clearTimeout(timer);reject(error);}
  });
  return call('openDroppedPath',path);
 };
 await getCurrentWebviewWindow().listen('desktop:event',({payload})=>dispatch(payload.name,payload.data));
 document.addEventListener('pointerdown',event=>{
  if(event.button===0&&event.target.closest('.window-drag-space,.window-caption'))void current.startDragging();
 });
 bridge.inputAudit=(await bridge.appInfo()).inputAudit;
 window.desktop=bridge;
}

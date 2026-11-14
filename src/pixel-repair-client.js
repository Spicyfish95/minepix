import {PROCESSING_DEBOUNCE_MS} from './processing-state.js';
export function createRepairClient({onState,onResult,onError,onStatus=()=>{},createWorker=()=>new Worker(new URL('./pixel-repair-worker.js',import.meta.url),{type:'module'}),loadWasm=()=>window.desktop?window.desktop.pixelRepairWasm():fetch(new URL('../node_modules/@xprite/pixelate/wasm/pixelfixer_detect_bg.wasm',import.meta.url)).then(r=>r.arrayBuffer()),delay=PROCESSING_DEBOUNCE_MS}){
 let worker=null,timer=null,revision=0,disposed=false,wasmPromise;
 const stop=()=>{clearTimeout(timer);worker?.terminate();worker=null;};
 return{
  request(image,settings){
   stop();const current=++revision;onState(true);onStatus('queued');
   timer=setTimeout(async()=>{
    try{
     onStatus('initializing');
     const wasm=await(wasmPromise??=loadWasm());if(disposed||current!==revision)return;
     worker=createWorker();worker.onmessage=({data})=>{
      if(disposed||current!==revision)return;
      if(data.status){onStatus(data.status);return;}
      stop();onState(false);if(data.error)onError(new Error(data.error));else onResult(data.result);
     };
     worker.onerror=event=>{if(disposed||current!==revision)return;event.preventDefault();stop();onState(false);onError(new Error(event.message||'像素处理 Worker 加载失败'));};
     worker.postMessage({image,settings,wasm});
    }catch(error){if(disposed||current!==revision)return;stop();onState(false);onError(error);}
   },delay);
  },
  cancel(){++revision;stop();onState(false);},
  dispose(){disposed=true;++revision;stop();}
 };
}

import {PROCESSING_DEBOUNCE_MS} from './processing-state.js';
export function createNormalMapClient({onResult,onError,onStatus=()=>{},createWorker=()=>new Worker(new URL('./normal-map-worker.js',import.meta.url),{type:'module'}),delay=PROCESSING_DEBOUNCE_MS}){
 let worker=null,timer=null,revision=0;
 const stop=()=>{clearTimeout(timer);worker?.terminate();worker=null;};
 return{
  request(image,settings){
   stop();const current=++revision;onStatus('queued');
   timer=setTimeout(()=>{
    try{
     onStatus('initializing');
     worker=createWorker();worker.onmessage=({data})=>{
      if(current!==revision)return;if(data.status){onStatus(data.status);return;}stop();if(data.error)onError(new Error(data.error));else onResult(data.result);
     };
     worker.onerror=event=>{if(current!==revision)return;event.preventDefault();stop();onError(new Error(event.message||'法线贴图计算失败'));};
     worker.postMessage({image,settings});
    }catch(error){stop();onError(error);}
   },delay);
  },
  cancel(){++revision;stop();},
  dispose(){++revision;stop();}
 };
}

import {projectForSave} from './reference-files.js';
import {releaseIndexedCaches} from './pixel-storage.js';
export function snapshotProject(document){const snapshot=structuredClone(projectForSave(document));releaseIndexedCaches(document);return snapshot;}

export function createProjectSaveClient({createWorker=()=>new Worker(new URL('./project-save-worker.js',import.meta.url),{type:'module'})}={}){
 let worker=null,nextId=0;
 const pending=new Map();
 const stop=error=>{worker?.terminate();worker=null;for(const request of pending.values())request.reject(error);pending.clear();};
 return{
  pack(document,name,saveAs=false,target){
   return new Promise((resolve,reject)=>{
    const id=++nextId;
    try{
     if(!worker){
      worker=createWorker();
      worker.onmessage=({data})=>{const request=pending.get(data.id);if(!request)return;pending.delete(data.id);if(data.error)request.reject(new Error(data.error));else request.resolve(data.bytes);};
      worker.onerror=event=>{event.preventDefault();stop(new Error(event.message||'项目保存打包失败'));};
      worker.onmessageerror=()=>stop(new Error('项目保存数据传输失败'));
     }
     pending.set(id,{resolve,reject});worker.postMessage({id,document,name,saveAs,target});releaseIndexedCaches(document);
    }catch(error){pending.delete(id);reject(error);}
   });
  },
  dispose(){stop(new Error('项目保存已停止'));}
 };
}

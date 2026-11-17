import {packBinaryPacket,unpackBinaryPacket} from './binary-packet.js';
import {unpackProjectReadPacket,openedProject} from './project-transfer.js';
import {snapshotProject} from './project-save-client.js';
import {loadReferenceFiles} from './reference-files.js';
export function createRecoveryClient({pack,write,load,readReference,capture=snapshotProject,discard}){
 let active=null,epoch=0;
 const pending=new Map(),completed=new Map();
 const signature=metadata=>metadata.revision===undefined?null:JSON.stringify([epoch,metadata.filePath,metadata.dirty,metadata.revision,metadata.boardRevision,metadata.name]);
 function run(job){
  active=job;
  void(async()=>{
   try{
    const bytes=job.document?await pack(job.document,job.metadata.name||'',false):null;
    const result=job.operation?await job.operation():await write(packBinaryPacket(job.metadata,bytes?[bytes]:[]));
    if(job.operation)completed.clear();else completed.set(job.metadata.id,{signature:job.signature,result});
    for(const waiter of job.waiters)waiter.resolve(result);
   }catch(error){for(const waiter of job.waiters)waiter.reject(error);}
   finally{
    active=null;
    const next=pending.values().next().value;
    if(next){pending.delete(next.metadata.id);run(next);}
   }
  })();
 }
 async function drain(){while(active||pending.size)await Promise.allSettled([...(active?[active.promise]:[]),...Array.from(pending.values(),job=>job.promise)]);}
 return{
  save(record){
   const {document,data,...metadata}=record,key=signature(metadata),previous=pending.get(metadata.id);
   if(key!==null){
    if(previous?.signature===key)return previous.promise;
    if(!previous&&active?.metadata.id===metadata.id&&active.signature===key)return active.promise;
    if(!previous&&active?.metadata.id!==metadata.id&&completed.get(metadata.id)?.signature===key)return Promise.resolve(completed.get(metadata.id).result);
   }
   let snapshot;
   try{snapshot=metadata.filePath&&metadata.dirty?capture(document??data):null;}catch(error){return Promise.reject(error);}
   const waiters=previous?.waiters||[];
   const promise=new Promise((resolve,reject)=>waiters.push({resolve,reject})),job={metadata,document:snapshot,signature:key,promise,waiters};
   if(active){pending.delete(metadata.id);pending.set(metadata.id,job);}else run(job);
   return promise;
  },
  discard(filePath){
   epoch++;completed.clear();
   const waiters=[],promise=new Promise((resolve,reject)=>waiters.push({resolve,reject})),job={metadata:{id:Symbol('discard')},operation:()=>discard(filePath),promise,waiters};
   if(active)pending.set(job.metadata.id,job);else run(job);return promise;
  },
  async load(id,previous=false){
   await drain();const packet=unpackBinaryPacket(await load(id,previous));
   if(packet.payloads.length!==1)throw new Error('恢复快照缺少像素数据');
   const document=await loadReferenceFiles(unpackProjectReadPacket(packet.payloads[0],{typed:true}).document,readReference);
   return openedProject(packet.metadata,document);
  }
 };
}

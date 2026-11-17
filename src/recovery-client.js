import {packBinaryPacket,unpackBinaryPacket} from './binary-packet.js';
import {unpackProjectRead,openedProject} from './project-transfer.js';
import {loadReferenceFiles} from './reference-files.js';
export function createRecoveryClient({pack,write,load,readReference}){
 let queue=Promise.resolve();
 return{
  save(record){
   const {document,data,...metadata}=record;
   // Start packing now: Worker.postMessage captures this revision before later edits.
   const packed=metadata.filePath&&metadata.dirty?pack(document??data,metadata.name||'',false).then(bytes=>({bytes}),error=>({error})):Promise.resolve({});
   const job=queue.catch(()=>{}).then(async()=>{const result=await packed;if(result.error)throw result.error;return write(packBinaryPacket(metadata,result.bytes?[result.bytes]:[]));});
   queue=job;return job;
  },
  async load(id,previous=false){
   await queue.catch(()=>{});const packet=unpackBinaryPacket(await load(id,previous));
   if(packet.payloads.length!==1)throw new Error('恢复快照缺少像素数据');
   const document=await loadReferenceFiles(unpackProjectRead(packet.payloads[0]),readReference);
   return openedProject(packet.metadata,document);
  }
 };
}

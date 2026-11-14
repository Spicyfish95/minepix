import {createHash} from 'node:crypto';

export const MIN_BLOCK=2048,MAX_BLOCK=32768;
const gear=[];let seed=0x12345678;
for(let i=0;i<256;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;gear.push(seed>>>0);}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function chunks(bytes){
 const result=[];let offset=0,hash=0;
 for(let i=0;i<bytes.length;i++){
  hash=((hash<<1)+gear[bytes[i]])>>>0;const size=i+1-offset;
  if(size>=MIN_BLOCK&&((hash&8191)===0||size===MAX_BLOCK)){
   result.push({offset,size,sha256:sha256(bytes.subarray(offset,i+1))});offset=i+1;hash=0;
  }
 }
 if(offset<bytes.length)result.push({offset,size:bytes.length-offset,sha256:sha256(bytes.subarray(offset))});
 return result;
}
export function blockmap(bytes,version,url){
 if(!bytes.length||bytes.length>512*1024*1024)throw new Error('Installer must be between 1 byte and 512 MiB');
 return{format:'minepix-blockmap-v1',version,url,size:bytes.length,sha256:sha256(bytes),chunks:chunks(bytes)};
}
export function fixtureBytes(seed,length){
 const bytes=Buffer.alloc(length);let value=seed>>>0;
 for(let i=0;i<length;i++){value^=value<<13;value^=value>>>17;value^=value<<5;bytes[i]=value&255;}
 return bytes;
}

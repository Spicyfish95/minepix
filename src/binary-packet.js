const magic=new TextEncoder().encode('MPXDATA1'),MAX_BYTES=512*1024*1024;
export function packBinaryPacket(metadata,payloads=[]){
 const parts=payloads.map(value=>value instanceof Uint8Array?value:new Uint8Array(value));
 const header=new TextEncoder().encode(JSON.stringify({metadata,lengths:parts.map(value=>value.byteLength)}));
 const length=header.length+parts.reduce((sum,value)=>sum+value.byteLength,0);
 if(length>MAX_BYTES)throw new Error('二进制传输超过 512 MiB');
 const result=new Uint8Array(12+length);result.set(magic);new DataView(result.buffer).setUint32(8,header.length,true);result.set(header,12);
 let offset=12+header.length;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
export function unpackBinaryPacket(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<12||bytes.length-12>MAX_BYTES||!magic.every((value,i)=>bytes[i]===value))throw new Error('二进制传输头无效');
 const end=12+new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true);
 if(end>bytes.length)throw new Error('二进制元数据截断');
 const {metadata,lengths}=JSON.parse(new TextDecoder().decode(bytes.subarray(12,end)));
 if(!Array.isArray(lengths))throw new Error('二进制块列表无效');
 let offset=end;const payloads=lengths.map(length=>{if(!Number.isSafeInteger(length)||length<0||offset+length>bytes.length)throw new Error('二进制块长度无效');const part=bytes.subarray(offset,offset+length);offset+=length;return part;});
 if(offset!==bytes.length)throw new Error('二进制传输包含多余数据');return{metadata,payloads};
}

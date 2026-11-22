import {packBinaryPacket,unpackBinaryPacket} from './binary-packet.js';
import {prepareDocumentPixels} from './pixel-storage.js';
const constructors={Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};
export function packDocumentWire(value){
 const nodes=[],seen=new Map(),payloads=[],derived=new WeakMap();
 const add=bytes=>{payloads.push(bytes);return payloads.length-1;};
 function visit(value){
  if(value===undefined)return{undefined:true};
  if(typeof value==='string'&&value.length>1024)return{text:add(new TextEncoder().encode(value))};
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return{ref:seen.get(value)};
  const id=nodes.length;seen.set(value,id);nodes.push(null);let node;
  if(value.format==='pixel-studio'&&value.colorMode==='indexed'&&value.frames?.every(frame=>Array.isArray(frame.cels)))for(const frame of value.frames)derived.set(frame.cels,frame);
  if(derived.has(value)){const frame=derived.get(value);node={type:'Array',values:Array.from({length:value.length},(_,l)=>frame.indices?.[l]?null:visit(value[l]))};}
  else if(value instanceof ArrayBuffer)node={type:'ArrayBuffer',block:add(new Uint8Array(value))};
  else if(ArrayBuffer.isView(value))node={type:value.constructor.name,block:add(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
  else if(value instanceof Set)node={type:'Set',values:[...value].map(visit)};
  else if(value instanceof Map)node={type:'Map',values:[...value].map(([key,value])=>[visit(key),visit(value)])};
  else if(Array.isArray(value)&&value.length&&value.every(Number.isFinite)){
   const type=value.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff)?'Uint32Array':'Float64Array',array=constructors[type].from(value);
   node={type:'NumberArray',storage:type,block:add(new Uint8Array(array.buffer))};
  }else if(Array.isArray(value))node={type:'Array',values:value.map(visit)};
  else node={type:'Object',values:Object.entries(value).map(([key,value])=>[key,visit(value)])};
  nodes[id]=node;return{ref:id};
 }
 const root=visit(value);return packBinaryPacket({root,nodes},payloads);
}
export function unpackDocumentWire(input){
 const {metadata:{root,nodes},payloads}=unpackBinaryPacket(input);
 const objects=nodes.map(node=>{
  if(node.type==='ArrayBuffer')return payloads[node.block].slice().buffer;
  if(node.type==='NumberArray'||constructors[node.type]){const Type=constructors[node.storage||node.type],bytes=payloads[node.block];if(!bytes||bytes.length%Type.BYTES_PER_ELEMENT)throw new Error('窗口像素块无效');const array=new Type(bytes.slice().buffer);return node.type==='NumberArray'?Array.from(array):array;}
  return node.type==='Set'?new Set():node.type==='Map'?new Map():node.type==='Array'?[]:{};
 });
 const read=value=>value&&typeof value==='object'?value.undefined?undefined:value.text!==undefined?new TextDecoder().decode(payloads[value.text]):objects[value.ref]:value;
 nodes.forEach((node,id)=>{
  const object=objects[id];
  if(node.type==='Object')for(const[key,value]of node.values)Object.defineProperty(object,key,{value:read(value),enumerable:true,writable:true,configurable:true});
  if(node.type==='Array')for(const value of node.values)object.push(read(value));
  if(node.type==='Set')node.values.forEach(value=>object.add(read(value)));
  if(node.type==='Map')node.values.forEach(([key,value])=>object.set(read(key),read(value)));
 });
 objects.forEach(value=>{if(value?.format==='pixel-studio'&&value.frames?.every(frame=>Array.isArray(frame.cels)))prepareDocumentPixels(value);});
 return read(root);
}

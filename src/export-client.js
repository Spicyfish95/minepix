import {packBinaryPacket} from './binary-packet.js';
const bytes=value=>value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):Uint8Array.from(atob(value),char=>char.charCodeAt(0));
export function createExportClient({invoke,packProject}){
 const send=(method,args,payloads)=>invoke(packBinaryPacket({method,args},payloads));
 return{
  async aseprite(document,destination){return send('exportAseprite',[null,destination??null],[await packProject(document,document.name,false)]);},
  animation(options){const payloads=[],frames=options.frames.map(frame=>{const copy={...frame};for(const field of['rgba','png'])if(frame[field]!==undefined){copy[field+'Block']=payloads.length;payloads.push(bytes(frame[field]));delete copy[field];}return copy;});return send('exportAnimation',[{...options,frames}],payloads);},
  sheet(options,metadataOnly=false){const {png,...metadata}=options;return send(metadataOnly?'exportSheetMetadata':'exportSheet',[metadata],[bytes(png)]);},
  save(data,kind,name,binary,destination){return send('save',[null,kind,name,binary,destination??null],[binary?bytes(data):new TextEncoder().encode(data)]);},
  image(options){const {data,...metadata}=options;return send('saveImageProject',[metadata],[options.binary===false?new TextEncoder().encode(data):bytes(data)]);}
 };
}

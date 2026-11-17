import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),source=path.resolve(process.argv[2]||'../scene.ase'),input=await readFile(source),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Independent fixture oracle: read indexed cels and palette directly from the ASE bytes.
function expectedScene(bytes){
 const count=bytes.readUInt16LE(6),width=bytes.readUInt16LE(8),height=bytes.readUInt16LE(10),transparent=bytes[28],speed=bytes.readUInt16LE(18);
 assert.equal(bytes.readUInt16LE(12),8,'This smoke fixture must use indexed color');
 const layers=[],frames=[],palette=[];let offset=128;
 for(let f=0;f<count;f++){
  const length=bytes.readUInt32LE(offset),chunks=bytes.readUInt32LE(offset+12)||bytes.readUInt16LE(offset+6),cels=new Map(),duration=Math.max(20,Math.min(10000,bytes.readUInt16LE(offset+8)||speed||100));let p=offset+16;
  for(let i=0;i<chunks;i++){
   const size=bytes.readUInt32LE(p),kind=bytes.readUInt16LE(p+4);
   if(kind===0x2004){assert.equal(bytes.readUInt16LE(p+8),0,'Expected ordinary pixel layers');layers.push({name:bytes.toString('utf8',p+24,p+24+bytes.readUInt16LE(p+22)),visible:!!(bytes.readUInt16LE(p+6)&1),locked:!(bytes.readUInt16LE(p+6)&2)});}
   if(kind===0x2019){const first=bytes.readUInt32LE(p+10),last=bytes.readUInt32LE(p+14);let q=p+26;for(let j=first;j<=last;j++){const flags=bytes.readUInt16LE(q);palette[j]=bytes.subarray(q+2,q+6);q+=6;if(flags&1)q+=2+bytes.readUInt16LE(q);}}
   if(kind===0x2005){
    const layer=bytes.readUInt16LE(p+6),type=bytes.readUInt16LE(p+13);let cel={x:bytes.readInt16LE(p+8),y:bytes.readInt16LE(p+10),opacity:bytes[p+12]*100/255};
    if(type===1){const linked=frames[bytes.readUInt16LE(p+22)].cels.get(layer);cel={...linked,...cel};}
    else{assert.ok(type===0||type===2,'Expected raw or compressed pixel cels');cel.w=bytes.readUInt16LE(p+22);cel.h=bytes.readUInt16LE(p+24);cel.indices=type===2?inflateSync(bytes.subarray(p+26,p+size)):bytes.subarray(p+26,p+size);assert.equal(cel.indices.length,cel.w*cel.h);}
    cels.set(layer,cel);
   }
   p+=size;
  }
  frames.push({duration,cels});offset+=length;
 }
 const cells=[];
 for(const [f,frame]of frames.entries())for(let l=0;l<layers.length;l++){
  const cel=frame.cels.get(l)||{x:0,y:0,w:1,h:1,opacity:100,indices:Buffer.from([transparent])},rgba=Buffer.alloc(cel.indices.length*4);
  for(let i=0;i<cel.indices.length;i++){const index=cel.indices[i];if(index!==transparent)rgba.writeUInt32LE(palette[index].readUInt32BE(),i*4);}
  cells.push({f,l,x:cel.x,y:cel.y,w:cel.w,h:cel.h,opacity:cel.opacity,count:cel.indices.length,indices:sha(cel.indices),rgba:sha(rgba)});
 }
 return{width,height,layers,frames:frames.map(frame=>frame.duration),transparent,palette:palette.map(color=>'#'+color.toString('hex')),cells};
}
const expected=expectedScene(input),root=path.resolve('artifacts/scene-ase-desktop',String(Date.now()));await mkdir(root,{recursive:true});
const sample=path.join(root,'scene.ase'),broken=path.join(root,'broken.ase'),profile=await mkdtemp(path.join(root,'webview-'));await writeFile(sample,input);await writeFile(broken,'not an ASE file');
const results=[],observed={},check=(name,pass)=>{assert.ok(pass,name);results.push({name,pass:true});};
const wait=async(test,label)=>{for(let i=0;i<450;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);};
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
let main,logs='';app.stdout.on('data',data=>logs+=data);app.stderr.on('data',data=>logs+=data);
const snapshot=()=>main.evaluate(`(()=>{const a=window.documentWindowAudit();return{id:a.id,path:a.path,busy:a.busy,mode:a.mode,documents:a.documents.length,frames:document.querySelectorAll('.frame-head').length,layers:document.querySelectorAll('.layer').length,status:document.getElementById('status').textContent,error:document.getElementById('error-dialog').open};})()`);
async function choose(file){
 await main.evaluate(`document.querySelector('[data-menu-command="open"]').click()`);
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',file],{windowsHide:true,timeout:20000});
}
try{
 await wait(async()=>{try{const target=(await targets()).find(target=>target.type==='page'&&!/capture|panel/.test(target.url));if(target){main=await connect(target);return true;}}catch{return false;}},'editor');
 await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'ready');
 await main.evaluate(`window.__sceneLoading=[];window.__sceneMessages=[];window.desktop.onFileLoading(value=>{window.__sceneLoading.push(value);if(value)window.__sceneMessages.push(document.getElementById('status').textContent);});`);
 const started=Date.now();await choose(sample);await wait(async()=>{const state=await snapshot();if(state.error)throw Error(await main.evaluate(`document.getElementById('error-dialog').textContent`));return state.path===sample&&!state.busy&&state.frames===8;},'scene opens');observed.openMs=Date.now()-started;
 check('native Open loads the original scene bytes without an import modal',(await snapshot()).mode==='indexed'&&!await main.evaluate(`document.getElementById('modal').open`));
 check('loading status is visible and busy state is released',same(await main.evaluate('window.__sceneLoading'),[true,false])&&(await main.evaluate('window.__sceneMessages')).includes('正在读取文件…'));
 observed.pixelStorage=await main.evaluate('window.documentPixelStorage()');
 check('indexed editing stores byte indices without retaining all RGBA frames',observed.pixelStorage.indexBytes===8996048&&observed.pixelStorage.rgbaBytes<8996048*4);
 await main.screenshot(path.join(root,'opened.png'));
 for(const frame of[1,7,0]){
  await main.evaluate(`document.querySelectorAll('.frame-head')[${frame}].click()`);
  check('frame '+(frame+1)+' renders after opening',await main.evaluate(`document.querySelectorAll('.frame-head')[${frame}].classList.contains('current')&&!document.getElementById('error-dialog').open`));
 }
 observed.data=await main.evaluate(`(async()=>{
  const started=performance.now(),result=await window.__TAURI_INTERNALS__.invoke('read_project_packed',{filePath:${JSON.stringify(sample)},record:false});
  const bytes=new Uint8Array(result),end=12+new DataView(bytes.buffer).getUint32(8,true),metadata=JSON.parse(new TextDecoder().decode(bytes.subarray(12,end))),doc=metadata.document,cells=[];
  const wire={readMs:Math.round(performance.now()-started),binary:result instanceof ArrayBuffer||ArrayBuffer.isView(result),bytes:bytes.length,metadataBytes:end-12,magic:new TextDecoder().decode(bytes.subarray(0,8)),pixelPlaceholders:doc.frames.every(frame=>frame.cels.every(cel=>cel===null)),payloadBytes:bytes.length-end,indexedSource:!!metadata.info?.indexedSource};
  const hash=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),value=>value.toString(16).padStart(2,'0')).join('');
  for(let f=0;f<doc.frames.length;f++)for(let l=0;l<doc.layers.length;l++){
   const p={x:0,y:0,width:doc.width,height:doc.height,opacity:100,...doc.frames[f].celProperties?.[doc.layers[l].id]};
   cells.push({f,l,x:p.x,y:p.y,w:p.width,h:p.height,opacity:p.opacity,count:0});
  }
  let offset=end;
  for(const block of metadata.blocks){
   const parts=block.path.split('/'),cell=cells[+parts[2]*doc.layers.length+(+parts[4])],size=block.count*(block.kind==='u32'?4:1),raw=bytes.subarray(offset,offset+size);offset+=size;
   if(block.kind==='u32'){cell.count=block.count;cell.rgba=await hash(raw);}else{cell.count=block.count;cell.indices=await hash(raw);const colors=Uint32Array.from(raw,index=>index===doc.transparentIndex?0:parseInt(doc.palette[index].slice(1).padEnd(8,'f'),16)>>>0);cell.rgba=await hash(colors.buffer);}
  }
  return{wire,width:doc.width,height:doc.height,frames:doc.frames.map(frame=>frame.duration),layers:doc.layers.map(layer=>({name:layer.name,visible:layer.visible,locked:layer.locked})),palette:doc.palette,transparent:doc.transparentIndex,cells,warnings:metadata.info.warnings};
 })()`);
 const actual=observed.data;check('canvas frame timing layers and palette match independent source parsing',same({...expected,cells:undefined},{width:actual.width,height:actual.height,layers:actual.layers,frames:actual.frames,transparent:actual.transparent,palette:actual.palette,cells:undefined}));
 check('all cel source sizes positions indices and RGBA hashes match',same(actual.cells,expected.cells));
 const pixels=expected.cells.reduce((n,cel)=>n+cel.count,0);check('cel arrays are not padded to the canvas',pixels<expected.width*expected.height*expected.frames.length*expected.layers.length&&pixels===8996048);
 check('native transfer carries raw binary pixels and small metadata',actual.wire.binary&&actual.wire.magic==='MPXREAD1'&&actual.wire.pixelPlaceholders&&actual.wire.payloadBytes===pixels&&actual.wire.indexedSource&&actual.wire.metadataBytes<65536);
 const before=await snapshot();await choose(broken);await wait(async()=>(await snapshot()).error,'visible decode error');
 check('invalid ASE reports a visible error and clears busy state',!(await snapshot()).busy&&(await main.evaluate(`document.getElementById('error-dialog').textContent`)).includes('打开失败'));
 check('failed open keeps the loaded scene and document tabs',(await snapshot()).path===before.path&&(await snapshot()).documents===before.documents);
 await main.screenshot(path.join(root,'invalid.png'));await main.evaluate(`document.getElementById('error-dialog').close()`);
 check('original workspace scene remains byte-for-byte unchanged',sha(await readFile(source))===sha(input));
 await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(sample)})`);
 await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results,source,sourceSha256:sha(input),observed,logs},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,openMs:observed.openMs,pixelCount:pixels,wire:actual.wire,root}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'failure.json'),JSON.stringify({ok:false,results,error:error.stack,observed,logs},null,2)+'\n');throw error;}
finally{main?.close();if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}}

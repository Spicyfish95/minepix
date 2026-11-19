import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
import {unpackProjectReadPacket} from '../src/project-transfer.js';
import {validateDocument} from '../src/model.js';
import {createDocument,colorValue} from '../src/model.js';

const source=path.resolve(process.argv[2]||'../decorates.ase'),bytes=await readFile(source),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory=path.resolve('artifacts/decorates-ase',String(Date.now())),sample=path.join(directory,'decorates.ase'),saved=path.join(directory,'roundtrip.ase');
const wide=path.join(directory,'wide.pix'),wideAse=path.join(directory,'wide.ase');
await mkdir(directory,{recursive:true});await writeFile(sample,bytes);
// Independent source oracle: this sample has a single indexed frame and ordinary cels.
assert.equal(bytes.readUInt16LE(6),1);assert.equal(bytes.readUInt16LE(12),8);
const expected={width:bytes.readUInt16LE(8),height:bytes.readUInt16LE(10),transparent:bytes[28],palette:[],layers:[],cels:[]};
for(let p=144;p<bytes.length;){
 const size=bytes.readUInt32LE(p),kind=bytes.readUInt16LE(p+4),b=bytes.subarray(p+6,p+size);
 if(kind===0x2019){let q=20;for(let i=b.readUInt32LE(4);i<=b.readUInt32LE(8);i++){const flags=b.readUInt16LE(q);expected.palette[i]='#'+b.subarray(q+2,q+6).toString('hex');q+=6;if(flags&1)q+=2+b.readUInt16LE(q);}assert.equal(q,b.length);}
 if(kind===0x2004){assert.equal(b.readUInt16LE(2),0);expected.layers.push({name:b.toString('utf8',18,18+b.readUInt16LE(16)),visible:!!(b.readUInt16LE(0)&1),locked:!(b.readUInt16LE(0)&2)});}
 if(kind===0x2005){const type=b.readUInt16LE(7);assert.ok(type===0||type===2);const raw=type===2?inflateSync(b.subarray(20)):b.subarray(20);const w=b.readUInt16LE(16),h=b.readUInt16LE(18);assert.equal(raw.length,w*h);expected.cels[b.readUInt16LE(0)]={x:b.readInt16LE(2),y:b.readInt16LE(4),width:w,height:h,opacity:b[6]*100/255,raw};}
 p+=size;
}
assert.equal(expected.palette.length,263);assert.equal(expected.layers.length,3);
const exec=promisify(execFile),results=[],check=(name,pass)=>{assert.ok(pass,name);results.push({name,pass:true});};
function verify(packet){
 const doc=validateDocument(packet.document);
 assert.deepEqual([doc.width,doc.height,doc.frames.length,doc.colorMode,doc.transparentIndex],[expected.width,expected.height,1,'indexed',expected.transparent]);
 assert.deepEqual(doc.palette,expected.palette);
 assert.deepEqual(doc.layers.map(({name,visible,locked})=>({name,visible,locked})),expected.layers);
 for(let l=0;l<expected.layers.length;l++){
  const cel=expected.cels[l],frame=doc.frames[0];
  const {raw,...properties}=cel;
  assert.deepEqual({x:0,y:0,width:doc.width,height:doc.height,opacity:100,...frame.celProperties?.[doc.layers[l].id]},properties);
  assert.equal(hash(Uint8Array.from(frame.indices[l])),hash(raw));
  const rgba=Uint32Array.from(raw,index=>index===expected.transparent?0:parseInt(expected.palette[index].slice(1),16)>>>0);
  assert.deepEqual(Array.from(frame.cels[l]),Array.from(rgba));
 }
 return doc;
}
let app,session,observed={},logs='';
async function wait(test,label){for(let i=0;i<300;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'A desktop debugger is already active');
 app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[],{cwd:directory,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.stdout.on('data',data=>logs+=data);app.stderr.on('data',data=>logs+=data);app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;if(app.exitCode!==null)throw Error(logs||'Editor exited');try{const target=(await targets()).find(t=>t.type==='page'&&t.url.includes('tauri.localhost'));if(target){session=await connect(target);return true;}}catch{}},'editor');
 await wait(()=>session.evaluate('!!window.desktop&&!!window.documentWindowAudit'),'ready');
 await session.evaluate(`document.querySelector('[data-menu-command="open"]').click()`);
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',sample],{windowsHide:true,timeout:20000});
 await wait(()=>session.evaluate(`(()=>{if(document.getElementById('error-dialog').open)throw Error(document.getElementById('error-dialog').textContent);const a=window.documentWindowAudit();return a.path===${JSON.stringify(sample)}&&!a.busy;})()`),'native open');
 observed=await session.evaluate(`({mode:window.documentWindowAudit().mode,layers:document.querySelectorAll('.layer').length,frames:document.querySelectorAll('.frame-head').length,status:document.getElementById('status').textContent,modal:document.getElementById('modal').open})`);
 check('native Open loads indexed decorates without a modal',observed.mode==='indexed'&&observed.layers===3&&observed.frames===1&&!observed.modal);
 check('native status has no palette truncation warning',!observed.status.includes('仅保留前 256 项'));
 check('opening a saved ASE has no dirty marker in tab or title',await session.evaluate(`!window.documentWindowAudit().dirty&&!document.querySelector('.document-tab.active [role="tab"]').textContent.includes('●')&&!document.title.startsWith('●')`));
 await session.evaluate(`document.querySelector('[data-menu-command="rename-layer"]').click()`);
 await wait(()=>session.evaluate(`document.getElementById('modal').open`),'rename dialog');
 await session.evaluate(`(()=>{const form=document.getElementById('modal-form');form.elements.name.value+=' test';form.requestSubmit(document.getElementById('modal-submit'));})()`);
 await wait(()=>session.evaluate('window.documentWindowAudit().dirty'),'ASE edited');
 check('editing the opened ASE shows its dirty dot',await session.evaluate(`document.querySelector('.document-tab.active [role="tab"]').textContent.includes('●')&&document.title.startsWith('●')`));
 await session.evaluate(`document.querySelector('[data-menu-command="undo"]').click()`);
 check('undoing to ASE open save point clears all dirty markers',await session.evaluate(`!window.documentWindowAudit().dirty&&!document.querySelector('.document-tab.active [role="tab"]').textContent.includes('●')&&!document.title.startsWith('●')`));
 const wire=await session.evaluate(`(async()=>Array.from(new Uint8Array(await window.__TAURI_INTERNALS__.invoke('read_project_packed',{filePath:${JSON.stringify(sample)},record:false}))))()`);
 const packet=unpackProjectReadPacket(Uint8Array.from(wire)),doc=verify(packet);
 check('all source cel positions indices RGBA and all 263 palette slots match',true);
 check('binary read preserves the full palette without warnings',packet.info.indexedSource&&packet.info.warnings.length===0);
 await session.evaluate(`(async()=>{const file=await window.desktop.openRecent(${JSON.stringify(sample)});await window.desktop.saveProject(file.doc,file.doc.name,false,${JSON.stringify(saved)},0);})()`);
 const output=path.join(directory,'roundtrip.json');
 await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['ase-import',saved,output],{windowsHide:true});
 const roundtrip=JSON.parse(await readFile(output,'utf8'));
 verify({document:roundtrip.doc});check('native ASE save and reload preserve all 263 colors and pixels',true);
 check('source workspace file is byte-for-byte unchanged',hash(await readFile(source))===hash(bytes));
 await session.screenshot(path.join(directory,'opened.png'));
 observed.sourceSha256=hash(bytes);observed.sourcePaletteEntries=expected.palette.length;observed.loadedPaletteEntries=doc.palette.length;
 const high=createDocument(2,1,'wide');high.colorMode='indexed';high.requiredFeatures=['color-modes','indexed-16'];high.palette=Array.from({length:300},(_,i)=>'#'+i.toString(16).padStart(6,'0'));high.transparentIndex=299;high.frames[0].indices=[[256,299]];high.frames[0].cels=[[colorValue(high.palette[256]),0]];
 const highJson=path.join(directory,'wide.json');await writeFile(highJson,JSON.stringify(high));await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',highJson,wide],{windowsHide:true});
 await session.evaluate(`document.querySelector('[data-menu-command="open"]').click()`);
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',wide],{windowsHide:true,timeout:20000});
 await wait(()=>session.evaluate(`window.documentWindowAudit().path===${JSON.stringify(wide)}`),'wide project');
 check('native 16-bit indexed project opens with high transparent slot and 300 colors',await session.evaluate(`window.documentWindowAudit().mode==='indexed'&&document.getElementById('palette').querySelectorAll('.swatch').length===300&&document.getElementById('doc-color-mode').dataset.mode==='INDEXED 16'`));
 await session.evaluate(`document.querySelector('#palette [data-index="257"]').click();document.querySelector('[data-tool="pencil"]')?.click();`);
 const point=await session.evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.left+z*.5,y:r.top+z*.5};})()`);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(()=>session.evaluate('window.documentWindowAudit().undo===1'),'paint high index');
 check('native stroke records index 257 without byte truncation',await session.evaluate('window.documentWindowAudit().indices[0]===257&&window.documentWindowAudit().dirty'));
 await session.evaluate(`document.querySelector('[data-menu-command="undo"]').click()`);check('native undo restores index 256',await session.evaluate('window.documentWindowAudit().indices[0]===256'));
 await session.evaluate(`document.querySelector('[data-menu-command="redo"]').click()`);check('native redo restores index 257',await session.evaluate('window.documentWindowAudit().indices[0]===257'));
 await session.evaluate(`document.querySelector('[data-menu-command="save"]').click()`);await wait(()=>session.evaluate('!window.documentWindowAudit().dirty'),'wide save');
 const native=await session.evaluate(`(async()=>{const doc=(await window.desktop.openRecent(${JSON.stringify(wide)})).document;await window.desktop.saveRecovery({id:'wide-index-native',filePath:${JSON.stringify(wide)},name:doc.name,dirty:true,revision:1,boardRevision:0,document:doc});const recovered=(await window.desktop.loadRecovery('wide-index-native')).document;const result=await window.desktop.saveProject(doc,doc.name,false,${JSON.stringify(wideAse)},0);return{indices:Array.from(doc.frames[0].indices[0]),type:doc.frames[0].indices[0].constructor.name,recovered:Array.from(recovered.frames[0].indices[0]),palette:doc.palette.length,aseRgba:result.aseRgba};})()`);
 check('native Worker save and PIX reload preserve 16-bit indices',native.type==='Uint16Array'&&native.indices.join(',')==='257,299'&&native.palette===300);
 check('native recovery preserves high indices',native.recovered.join(',')==='257,299');
 check('ASE save explicitly reports RGBA conversion',native.aseRgba===true);
 const highOutput=path.join(directory,'wide-ase.json');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['ase-import',wideAse,highOutput],{windowsHide:true});
 const highRoundtrip=JSON.parse(await readFile(highOutput,'utf8')).doc;
 check('native ASE fallback preserves all colors RGBA and transparency',!highRoundtrip.colorMode&&highRoundtrip.palette.length===300&&highRoundtrip.frames[0].cels[0][0]===colorValue(high.palette[257])&&highRoundtrip.frames[0].cels[0][1]===0);
}catch(error){process.exitCode=1;results.push({name:'failure',pass:false,error:error.stack});}
finally{
 if(session){try{for(const file of [sample,saved,wide,wideAse])await session.evaluate(`(async()=>{await window.desktop.discardRecovery(${JSON.stringify(file)});await window.desktop.removeRecent(${JSON.stringify(file)});})()`);}finally{session.close();}}
 if(app&&app.exitCode===null&&app.signalCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}
 const report={ok:!process.exitCode,results,observed,logs};await writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({directory,...report},null,2));
}

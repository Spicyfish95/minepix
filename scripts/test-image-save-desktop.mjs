import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {GifReader} from 'omggif';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';
const exec=promisify(execFile),root=path.resolve('artifacts/image-save-desktop',String(Date.now())),port=9223,results=[];await mkdir(root,{recursive:true});
const profile=await mkdtemp(path.join(root,'webview-'));
const wait=async(test,label)=>{for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);};
const check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
let main,logs='';app.stdout.on('data',data=>logs+=data);app.stderr.on('data',data=>logs+=data);
try{
 await wait(async()=>{try{const target=(await targets(port)).find(t=>t.type==='page'&&!t.url.includes('capture.html')&&!t.url.includes('panel.html'));if(target){main=await connect(target);return true;}}catch{return false;}},'editor');
 await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'ready');
 const doc=createDocument(2,1,'single-image');doc.frames[0].cels[0]=[0xff0000ff,0xff0000ff];doc.frames.push({duration:100,cels:[[0x00ff00ff,0]]});doc.layers.push({id:2,name:'hidden',visible:false,locked:false,opacity:100});for(const frame of doc.frames)frame.cels.push([0x0000ffff,0x0000ffff]);
 const imagePaths=[];
 for(const format of ['png','webp','jpg','jpeg','svg','ico','gif']){
  const target=path.join(root,'current.'+format);imagePaths.push(target);
  const saved=await main.evaluate(`window.desktop.saveProject(${JSON.stringify(doc)},'single-image',false,${JSON.stringify(target)},1)`);check(format+' saves through document save as single image',saved.singleImage&&saved.filePath===target&&saved.format===format);
  const bytes=await readFile(target);
  if(format==='png')check('PNG signature',bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  if(format==='webp')check('WebP RIFF signature',bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP');
  if(format==='jpg'||format==='jpeg')check(format+' JPEG signature',bytes[0]===255&&bytes[1]===216);
  if(format==='svg')check('SVG contains current frame color only',bytes.toString().includes('#00ff00')&&!bytes.toString().includes('#ff0000')&&!bytes.toString().includes('#0000ff'));
  if(format==='ico')check('ICO header contains one image',bytes.readUInt16LE(2)===1&&bytes.readUInt16LE(4)===1);
  if(format==='gif'){const reader=new GifReader(bytes);check('GIF contains exactly one frame',reader.numFrames()===1&&reader.width===2&&reader.height===1);check('GIF has no animation loop extension',!bytes.includes(Buffer.from('NETSCAPE2.0')));}
  const image=await main.evaluate(`window.desktop.readReference(${JSON.stringify(target)})`),rgba=Buffer.from(image.data,'base64');check(format+' saved output has current frame visible pixels',image.width===2&&image.height===1&&rgba[1]>rgba[0]+60&&rgba[1]>rgba[2]+60);
  if(!['jpg','jpeg'].includes(format))check(format+' preserves transparent pixel',rgba[7]===0);
 }
 const thumbnails=await main.evaluate('window.desktop.recentThumbs()');check('saved images receive recent-file thumbnails',imagePaths.every(file=>thumbnails.some(thumb=>thumb.path===file)));
 const overwrite=imagePaths[0];await main.evaluate(`window.desktop.saveProject(${JSON.stringify(doc)},'single-image',false,${JSON.stringify(overwrite)},0)`);const replaced=await main.evaluate(`window.desktop.readReference(${JSON.stringify(overwrite)})`);check('normal save overwrites existing image with newly selected frame',Buffer.from(replaced.data,'base64')[0]===255);
 const selected=path.join(root,'chosen.png');const saving=main.evaluate(`window.desktop.saveProject(${JSON.stringify(doc)},'native-dialog',true,null,1)`);
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',selected],{windowsHide:true,timeout:20000});const result=await saving;check('native save dialog routes actual chosen PNG extension',result.filePath===selected&&result.singleImage);
 const cancelled=main.evaluate(`window.desktop.saveProject(${JSON.stringify(doc)},'cancelled',true,null,1)`);await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-Cancel'],{windowsHide:true,timeout:20000});check('native save dialog cancellation writes nothing',await cancelled===null);
 await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results,logs},null,2)+'\n');console.log(JSON.stringify({ok:true,results},null,2));
}catch(error){await writeFile(path.join(root,'failure.json'),JSON.stringify({error:error.stack,results,logs},null,2)+'\n');throw error;}
finally{main?.close();if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}await writeFile(path.join(root,'native.log'),logs);}

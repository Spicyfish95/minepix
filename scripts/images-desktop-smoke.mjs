import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {composite} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','images-'+Date.now()),project=path.join(directory,'静态格式验收.pix'),root='artifacts/images-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});await copyFile('examples/mushroom.pix',project);
const originalBytes=await readFile(project),results=[],created=[],decoded={};
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const mimes={bmp:'image/bmp',ico:'image/x-icon',jpeg:'image/jpeg',jpg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
let app,session,baseline;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const submit=()=>session.evaluate("document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))");
const cancel=()=>session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.querySelector('#modal .modal-actions [value=cancel]').click();}).then(()=>true)");
async function dialog(file,cancelSave=false){await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),...(cancelSave?['-Cancel']:['-FilePath',file])],{windowsHide:true,timeout:20000});}
async function idle(){await wait(async()=>!(await audit()).busy&&await session.evaluate("!document.getElementById('modal').open"),'编辑器空闲');}
async function readDocument(file){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(file)}))).data);})()`);}
const decodeFunction=`async function decode(base64,mime){const image=new Image();image.src='data:'+mime+';base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);return{width:canvas.width,height:canvas.height,data:[...context.getImageData(0,0,canvas.width,canvas.height).data]};}`;
async function decode(bytes,format){return session.evaluate(`(async()=>{${decodeFunction}return decode(${JSON.stringify(bytes.toString('base64'))},${JSON.stringify(mimes[format])});})()`);}
async function exportFile(format,file,cancelSave=false){
 await command('png');await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('modal-form').elements.format"),'导出设置');
 await session.evaluate(`(()=>{const f=document.getElementById('modal-form');f.elements.format.value=${JSON.stringify(format)};f.elements.format.dispatchEvent(new Event('change',{bubbles:true}));f.elements.scale.value=1;f.elements.scale.dispatchEvent(new Event('change',{bubbles:true}));f.requestSubmit(document.getElementById('modal-submit'));})()`);
 await dialog(file,cancelSave);await wait(async()=>!(await audit()).busy&&await session.evaluate(`!document.getElementById('modal').open&&document.getElementById('status').textContent===${JSON.stringify(cancelSave?'已取消导出':'导出完成')}`),'文件写入或取消完成');
 check(format+' 原生导出无错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
}
async function openImage(file){await command('open');await dialog(file);await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('modal-form').elements.processing"),'图片导入预览');}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'源项目加载');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh')");
 const source=await readDocument(project),pixels=[...composite(source,0)],initial=await audit(),white=[];
 for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;white.push(...[0,1,2].map(channel=>Math.round(pixels[i+channel]*alpha+255*(1-alpha))),255);}
 check('源作品具备透明与不透明像素',pixels[3]===0&&pixels.some((value,i)=>i%4===3&&value===255));
 const references=await session.evaluate(`(async()=>{${decodeFunction}const canvas=document.createElement('canvas');canvas.width=${source.width};canvas.height=${source.height};canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(${JSON.stringify(pixels)}),canvas.width,canvas.height),0,0);const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const context=output.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,output.width,output.height);context.drawImage(canvas,0,0);const jpeg=await decode(output.toDataURL('image/jpeg',.92).split(',')[1],'image/jpeg');context.clearRect(0,0,output.width,output.height);context.drawImage(canvas,0,0);const webp=await decode(output.toDataURL('image/webp',1).split(',')[1],'image/webp');return{jpeg,webp};})()`);
 for(const format of ['bmp','ico','jpeg','jpg','webp','svg']){
  const file=path.join(directory,'actual.'+format);await exportFile(format,file);const bytes=await readFile(file);decoded[format]=await decode(bytes,format);const actual=decoded[format];
  await writeFile(root+'/'+format+'-decoded.json',JSON.stringify(actual)+'\n');
  check(format+' 标准解码尺寸正确',actual.width===source.width&&actual.height===source.height);
  if(format==='bmp'){
   check('BMP文件头与24位像素布局',bytes.toString('ascii',0,2)==='BM'&&bytes.readUInt32LE(2)===bytes.length&&bytes.readInt32LE(18)===source.width&&bytes.readInt32LE(22)===source.height&&bytes.readUInt16LE(28)===24);
   check('BMP完整像素等于白底合成',same(actual.data,white));
  }else if(format==='ico'){
   check('ICO目录及嵌入PNG完整',bytes.readUInt16LE(0)===0&&bytes.readUInt16LE(2)===1&&bytes.readUInt16LE(4)===1&&bytes[6]===source.width&&bytes[7]===source.height&&bytes.readUInt32LE(14)===bytes.length-22&&bytes.readUInt32LE(18)===22&&bytes.subarray(22,30).equals(Buffer.from([137,80,78,71,13,10,26,10])));
   check('ICO完整像素和alpha保留',same(actual.data,pixels));
  }else if(format==='jpeg'||format==='jpg'){
   check(format+' 有效JPEG标识及白色透明角',bytes[0]===255&&bytes[1]===216&&actual.data.slice(0,3).every(value=>value>=248)&&actual.data[3]===255);
   check(format+' 完整像素等于显式白底JPEG参考',same(actual,references.jpeg));
  }else if(format==='webp'){
   check('静态WebP完整像素等于单帧编码参考',same(actual,references.webp));
   check('静态WebP保留源alpha',actual.data.every((value,i)=>i%4!==3||value===pixels[i]));
  }else check('SVG完整像素与源透明度一致',same(actual.data,pixels));
 }
 check('JPG与JPEG两种扩展解码一致',same(decoded.jpg,decoded.jpeg));
 await exportFile('jpeg',null,true);check('全部静态导出与原生取消保持源项目和历史',same(await audit(),initial));
 for(const format of ['bmp','jpeg','jpg','webp']){
  const before=await audit(),file=path.join(directory,'actual.'+format);await openImage(file);await cancel();await idle();
  check(format+' 取消原生导入预览保留当前文档',same(await audit(),before));
  await openImage(file);await submit();await wait(async()=>{const state=await audit();return state.dirty&&!state.path&&!state.busy;},format+' 导入新文档');await idle();
  const target=path.join(directory,'imported-'+format+'.pix');created.push(target);await command('save');await dialog(target);await wait(async()=>{const state=await audit();return state.path===target&&!state.dirty&&!state.busy;},'二进制保存完成');
  const imported=await readDocument(target),actualPixels=[...composite(imported,0)];await writeFile(root+'/'+format+'-imported.json',JSON.stringify(imported)+'\n');
  if(!same(actualPixels,decoded[format].data)){const index=actualPixels.findIndex((value,i)=>value!==decoded[format].data[i]);console.error(JSON.stringify({format,width:imported.width,height:imported.height,frames:imported.frames.length,firstDifference:index,actual:actualPixels.slice(index,index+12),expected:decoded[format].data.slice(index,index+12)}));}
  check(format+' 原生导入另存Rust重读像素一致',imported.width===source.width&&imported.height===source.height&&imported.frames.length===1&&same(actualPixels,decoded[format].data));
 }
 check('静态格式流程未改变源文件且无错误弹窗',same(await readFile(project),originalBytes)&&await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of [project,...created]){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

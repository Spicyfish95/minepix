import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,composite} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','webp-'+Date.now()),project=path.join(directory,'透明动画.pix'),root='artifacts/webp-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(4,2,'透明动画');
source.frames=[{duration:40,cels:[[0xff0000ff,0,0,0,0,0,0,0]]},{duration:70,cels:[[0,0x00ff00ff,0,0,0,0,0,0]]},{duration:110,cels:[[0,0,0x0000ff80,0,0,0,0,0]]},{duration:50,cels:[Array(8).fill(0)]}];
const model=path.join(directory,'source.json');await writeFile(model,JSON.stringify(source)+'\n');
await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',model,project],{windowsHide:true});
const originalBytes=await readFile(project);
let app,session,baseline;
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function dialog(file,cancel=false){await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),...(cancel?['-Cancel']:['-FilePath',file])],{windowsHide:true,timeout:20000});}
async function exportWebp(values,file,cancelSave=false){
 await session.evaluate("document.querySelector('[data-menu-command=gif]').click()");
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('modal-form').elements.format"),'动画导出设置');
 await session.evaluate(`(()=>{const f=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify({format:'webp',scope:'all',scale:1,...values})})){f.elements[name].value=value;f.elements[name].dispatchEvent(new Event('change',{bubbles:true}));}f.requestSubmit(document.getElementById('modal-submit'));})()`);
 await dialog(file,cancelSave);
 await wait(async()=>!(await audit()).busy&&await session.evaluate(`!document.getElementById('modal').open&&document.getElementById('status').textContent===${JSON.stringify(cancelSave?'已取消导出':'导出完成')}`),'实际WebP写入或取消完成');
 check('导出WebP '+(values.direction||'timeline')+' 无错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
}
const decodeScript=`async function decode(bytes){const decoder=new ImageDecoder({data:new Uint8Array(bytes),type:'image/webp',preferAnimation:true});try{await decoder.tracks.ready;const frames=[];for(let i=0;i<decoder.tracks.selectedTrack.frameCount;i++){const {image}=await decoder.decode({frameIndex:i});try{const canvas=document.createElement('canvas');canvas.width=image.displayWidth;canvas.height=image.displayHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);frames.push({width:canvas.width,height:canvas.height,duration:image.duration,data:[...context.getImageData(0,0,canvas.width,canvas.height).data]});}finally{image.close();}}return frames;}finally{decoder.close();}}`;
function chunks(bytes){const parts=[];for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset+4);parts.push({type:bytes.toString('ascii',offset,offset+4),data:bytes.subarray(offset+8,offset+8+length)});offset+=8+length+(length&1);}return parts;}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await session.evaluate("window.minepixLocale.set('zh')");
 check('正式WebView2可使用标准WebP动画解码器',await session.evaluate("typeof ImageDecoder==='function'&&ImageDecoder.isTypeSupported('image/webp')"));
 const expected=await session.evaluate(`(async()=>{${decodeScript}const frames=${JSON.stringify(source.frames.map((frame,index)=>({duration:frame.duration,data:[...composite(source,index)]})))};const decoded=[];for(const frame of frames){const canvas=document.createElement('canvas');canvas.width=4;canvas.height=2;const context=canvas.getContext('2d');context.putImageData(new ImageData(new Uint8ClampedArray(frame.data),4,2),0,0);const output=document.createElement('canvas');output.width=4;output.height=2;output.getContext('2d').drawImage(canvas,0,0);const bytes=Uint8Array.from(atob(output.toDataURL('image/webp',1).split(',')[1]),character=>character.charCodeAt(0));decoded.push((await decode([...bytes]))[0]);}return decoded;})()`);
 check('静态参考解码保留各帧原始alpha',expected.every((frame,i)=>frame.data.every((value,c)=>c%4!==3||value===composite(source,i)[c])));
 await writeFile(root+'/static-reference.json',JSON.stringify(expected,null,2)+'\n');
 const initial=await audit();
 for(const [direction,repeat,indices]of [['timeline','once',[0,1,2,3]],['reverse','loop',[3,2,1,0]],['pingpong','once',[0,1,2,3,2,1]]]){
  const file=path.join(directory,direction+'.webp');await exportWebp({direction,repeat},file);
  const bytes=await readFile(file),parts=chunks(bytes),anmf=parts.filter(part=>part.type==='ANMF'),animation=parts.find(part=>part.type==='ANIM');
  check(direction+' 容器完整矩形覆盖与循环次数',bytes.readUInt32LE(4)===bytes.length-8&&anmf.length===indices.length&&anmf.every(frame=>frame.data.readUIntLE(0,3)===0&&frame.data.readUIntLE(3,3)===0&&frame.data.readUIntLE(6,3)===3&&frame.data.readUIntLE(9,3)===1&&frame.data[15]===2)&&animation.data.readUInt16LE(4)===(repeat==='loop'?0:1));
  const actual=await session.evaluate(`(async()=>{${decodeScript}return decode(${JSON.stringify([...bytes])});})()`);
  await writeFile(root+'/'+direction+'-decoded.json',JSON.stringify({actual,expectedIndices:indices},null,2)+'\n');
  check(direction+' 标准解码逐帧像素与静态参考一致',actual.length===indices.length&&actual.every((frame,i)=>frame.width===4&&frame.height===2&&same(frame.data,expected[indices[i]].data)));
  check(direction+' 每帧透明度清除旧像素无残影',actual.every((frame,i)=>frame.data.every((value,c)=>c%4!==3||value===composite(source,indices[i])[c])));
  check(direction+' 时长与源帧毫秒一致',actual.every((frame,i)=>frame.duration===source.frames[indices[i]].duration*1000)&&anmf.every((frame,i)=>frame.data.readUIntLE(12,3)===source.frames[indices[i]].duration));
 }
 await exportWebp({direction:'timeline',repeat:'once'},null,true);
 check('WebP所有导出与取消保留源项目状态和历史',same(await audit(),initial));
 check('WebP导出不修改磁盘二进制项目',same(await readFile(project),originalBytes)&&await session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.stringify(JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data));})()`).then(value=>same(JSON.parse(value),source)));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

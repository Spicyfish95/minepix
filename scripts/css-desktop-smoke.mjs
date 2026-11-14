import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {composite} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','css-'+Date.now()),project=path.join(directory,'CSS透明原点.pix'),root='artifacts/css-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});await copyFile('examples/mushroom.pix',project);
let app,session,baseline;
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function readDocument(){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目加载');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await session.evaluate("window.minepixLocale.set('zh')");
 const source=await readDocument(),pixels=composite(source,0),initial=await audit();
 check('回归作品原点透明且后续有非透明像素',pixels[3]===0&&pixels.some((value,i)=>i%4===3&&value>0));
 check('正式内嵌页面使用Rust后端',await session.evaluate("window.desktop.appInfo().then(info=>info.backend==='tauri-rust'&&typeof window.runParitySmoke==='undefined')"));
 for(const scale of [1,2]){
  await session.evaluate("document.querySelector('[data-menu-command=png]').click()");
  await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('modal-form').elements.format"),'导出设置');
  await session.evaluate(`(()=>{const f=document.getElementById('modal-form');f.elements.format.value='css';f.elements.format.dispatchEvent(new Event('change',{bubbles:true}));f.elements.scale.value=${scale};f.elements.scale.dispatchEvent(new Event('change',{bubbles:true}));f.requestSubmit(document.getElementById('modal-submit'));})()`);
  const file=path.join(directory,'actual-'+scale+'.css');
  await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',file],{windowsHide:true,timeout:20000});
  await wait(async()=>!(await audit()).busy&&await session.evaluate("!document.getElementById('modal').open&&document.getElementById('status').textContent==='导出完成'"),'CSS写入完成');
  const css=await readFile(file,'utf8'),width=source.width*scale,height=source.height*scale;
  check(scale+'倍CSS原点背景保持透明',/background: transparent;/.test(css)&&css.includes('box-shadow:'));
  await session.evaluate(`(()=>{const host=document.createElement('div');host.id='css-export-render';Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:'${width}px',height:'${height}px',background:'white',zIndex:'2147483647',pointerEvents:'none'});const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=${JSON.stringify(css)}+'\\n.minepix-image {position:absolute;left:0;top:0;}';const image=document.createElement('div');image.className='minepix-image';shadow.append(style,image);document.body.append(host);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);
  const {data}=await session.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height,scale:1}});
  await writeFile(root+'/render-'+scale+'.png',Buffer.from(data,'base64'));
  await session.evaluate("document.getElementById('css-export-render').remove()");
  const actual=await session.evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${data}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);return{width:canvas.width,height:canvas.height,data:[...context.getImageData(0,0,canvas.width,canvas.height).data]};})()`);
  const expected=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(Math.floor(y/scale)*source.width+Math.floor(x/scale))*4,alpha=pixels[i+3]/255;expected.push(...[0,1,2].map(channel=>Math.round(pixels[i+channel]*alpha+255*(1-alpha))),255);}
  check(scale+'倍真实CSS浏览器渲染逐像素保留原图坐标',actual.width===width&&actual.height===height&&same(actual.data,expected));
 }
 check('CSS导出不修改源项目状态和历史',same(await audit(),initial));
 check('CSS导出保留磁盘项目且无错误弹窗',same(await readDocument(),source)&&await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{document.getElementById('css-export-render')?.remove();const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

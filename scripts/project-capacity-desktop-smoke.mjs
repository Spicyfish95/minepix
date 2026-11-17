import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,validateDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve('src-tauri/target/debug/minepix-tauri.exe'),root=path.resolve('artifacts/project-capacity-desktop');
const directory=path.resolve('../minepix-tauri-validation','project-capacity-'+Date.now()),project=path.join(directory,'容量边界.pix');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(1,1,'超过旧容量');source.width=1024;source.height=1024;source.frames[0].cels[0][0]=0x448844ff;source.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};source.requiredFeatures=['cel-properties'];
source.frames=Array.from({length:33},()=>structuredClone(source.frames[0]));validateDocument(source);
await writeFile(project+'.json',JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const results=[],observed={};let app,main,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<400;i++){const v=await test();if(v)return v;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()'),command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const s=await audit();return !s.dirty&&!s.busy;},'保存'+label);const doc=await readDocument();await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
async function launch(){app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'启动');main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');}
async function stop(){main?.close();main=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}app=null;await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP释放');}
async function click(selector){const p=await main.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');await launch();baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');
 check('超过旧32M的项目正常打开',!(await audit()).dirty&&(await audit()).undo===0&&await main.evaluate("document.getElementById('canvas').width===1024&&document.querySelectorAll('.frame-head').length===33"));
 await command('duplicate-frame');await wait(async()=>(await audit()).undo===1,'复制帧');let doc=await saved('over-old-limit');validateDocument(doc);
 check('超过旧像素预算仍可复制帧保存',doc.frames.length===34&&doc.width*doc.height*doc.frames.length>32*1024*1024&&doc.frames.every(frame=>frame.cels[0].length===1&&frame.cels[0][0]===0x448844ff));
 await command('undo');await wait(async()=>(await audit()).redo===1,'撤销');check('大项目撤销恢复帧数',await main.evaluate("document.querySelectorAll('.frame-head').length===33"));
 await command('redo');await wait(async()=>(await audit()).undo===1,'重做');check('大项目重做恢复复制',await main.evaluate("document.querySelectorAll('.frame-head').length===34"));
 await command('duplicate-layer');await wait(async()=>(await audit()).undo===2,'复制层');doc=await saved('duplicated-layer');validateDocument(doc);
 check('大项目复制层保留稀疏像素和cel属性',doc.layers.length===2&&doc.frames.every(frame=>frame.cels.length===2&&frame.cels[1][0]===0x448844ff&&frame.cels[1].length===1));
 observed.saved=validateDocument(doc);const bytes=await readFile(project);await stop();await launch();
 check('保存后真实重启仍可打开',!(await audit()).dirty&&(await audit()).undo===0&&await main.evaluate("document.querySelectorAll('.frame-head').length===34"));
 doc=await saved('reopened');check('重开再保存保持规范化作品与二进制',same(validateDocument(doc),observed.saved)&&(await readFile(project)).equals(bytes));
 check('结束没有错误对话框',!await main.evaluate("document.getElementById('error-dialog').open"));await main.screenshot(path.join(root,'complete.png'));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,directory,executable,logicalPixels:doc.width*doc.height*doc.layers.length*doc.frames.length,actualCelPixels:doc.frames.reduce((n,frame)=>n+frame.cels.reduce((sum,cel)=>sum+cel.length,0),0)},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 await stop();
}

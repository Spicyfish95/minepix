import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve(process.env.MINEPIX_PROJECT_IO_ROOT||'artifacts/project-io-desktop');
const directory=path.resolve('../minepix-tauri-validation','project-io-'+Date.now()),project=path.join(directory,'原作品 中文.pix'),copy=path.join(directory,'另存 新作品.pix');
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});
const source=createDocument(8,8,'原作品 中文');source.frames[0].cels[0][0]=0x112233ff;
const fixture=path.join(directory,'source.json');await writeFile(fixture,JSON.stringify(source)+'\n');
await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',fixture,project],{windowsHide:true});
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),results=[],paths=[project,copy];
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,session,baseline;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const readDocument=file=>session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(file)}))).data);})()`);
async function nativeSave(cancel){
 const job=exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-file-dialog.ps1'),'-ProcessId',String(app.pid),...(cancel?['-Cancel']:['-FilePath',copy])],{windowsHide:true});
 await command('save-as');await job;await wait(async()=>!(await audit()).busy,'原生另存完成');
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用');
 session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'原作品就绪');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh');window.workspaceLayout.reset()");
 check('正式最近文件读取保留中文及完整像素',same((await readDocument(project)).frames,source.frames));
 await session.evaluate("(()=>{for(const[id,value]of Object.entries({brush:1,'brush-shape':'square','paint-opacity':100,hex:'#abcdef'})){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool=\"pencil\"]').click();})()");
 const p=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+r.width*.5/8,y:r.y+r.height*.5/8};})()");
 const before=await audit();
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
 check('可信绘画置脏且生成一条历史',(await audit()).dirty&&(await audit()).undo===before.undo+1&&(await audit()).pixel===0xabcdefff);
 await wait(()=>session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`),'实际自动恢复');
 await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},'实际菜单保存');
 const saved=await readDocument(project),stored=await readFile(project);
 check('正式菜单保存实际写入二进制',stored.subarray(0,8).equals(Buffer.from('MINEPIX\0'))&&saved.frames[0].cels[0][0]===0xabcdefff&&(await audit()).path===project);
 check('正常保存清理该项目恢复副本',!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`));
 const beforeCancel=await audit();await nativeSave(true);
 check('原生另存取消保持路径历史与磁盘',same(await audit(),beforeCancel)&&(await readFile(project)).equals(stored));
 await nativeSave(false);
 check('原生另存中文路径绑定且保存状态正确',(await audit()).path===copy&&!(await audit()).dirty&&(await audit()).undo===beforeCancel.undo);
 const copied=await readDocument(copy);
 check('新二进制重读完整帧层及中文名称',same(copied.frames,saved.frames)&&same(copied.layers,saved.layers)&&copied.name==='另存 新作品');
 check('另存原磁盘文件逐字节保持',(await readFile(project)).equals(stored));
 const invalid=await session.evaluate("window.desktop.openRecent(-1).then(()=>false,error=>typeof error.message==='string'&&error.message.length>0)");
 check('后端读取错误正常拒绝且文档保持',invalid&&(await audit()).path===copy&&!await session.evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of paths){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}
}

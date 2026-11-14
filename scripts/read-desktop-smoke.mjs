import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve('artifacts/project-read/desktop'),directory=path.resolve('../minepix-tauri-validation','project-read-'+Date.now());
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),tool=path.resolve('src-tauri/target/debug/examples/project-tool.exe');
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});
const docs=[createDocument(8,8,'启动 中文'),createDocument(5,3,'原生 读取'),createDocument(4,2,'第二实例')];
for(const [i,doc]of docs.entries())doc.frames[0].cels[0][0]=[0xff0000ff,0x00ff00ff,0x0000ffff][i];
const paths=docs.map(doc=>path.join(directory,doc.name+'.pix')),bad=path.join(directory,'损坏 读取.pix');
for(const [i,file]of paths.entries()){await writeFile(file+'.json',JSON.stringify(docs[i])+'\n');await exec(tool,['encode',file+'.json',file],{windowsHide:true});}
await writeFile(bad,(await readFile(paths[0])).subarray(0,31));
const results=[],children=[];let app,session,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function stop(){session?.close();session=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次退出');}await wait(async()=>{try{await targets();return false;}catch{return true;}},'端口释放');}
async function start(files){
 app=spawn(executable,files,{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.type==='page');}catch{return false;}},'正式启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate('!!window.documentWindowAudit'),'编辑器就绪');
}
async function nativeOpen(file){
 const chosen=exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-file-dialog.ps1'),'-ProcessId',String(app.pid),...(file?['-FilePath',file]:['-Cancel'])],{windowsHide:true,timeout:20000});
 await session.evaluate("document.querySelector('[data-menu-command=open]').click()");await chosen;
}
async function second(files){const child=spawn(executable,files,{cwd:directory,windowsHide:true,stdio:'ignore'});children.push(child);child.on('error',error=>{child.launchError=error;});await wait(()=>{if(child.launchError)throw child.launchError;return child.exitCode!==null||child.signalCode!==null;},'第二实例退出');}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');
 await start([paths[0]]);await wait(async()=>(await audit()).path===paths[0],'启动项目载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh')");
 check('启动队列通过原始读取保持路径像素与干净状态',(await audit()).pixel===docs[0].frames[0].cels[0][0]&&!(await audit()).dirty&&(await audit()).undo===0);
 await session.evaluate("window.readStringifies=0;window.originalProjectStringify=JSON.stringify;JSON.stringify=function(value,...args){if(value?.format==='pixel-studio')window.readStringifies++;return window.originalProjectStringify.call(this,value,...args);};");
 await nativeOpen(paths[1]);await wait(async()=>(await audit()).path===paths[1],'原生打开');
 check('正常原生打开不触发整项目JSON字符串',await session.evaluate('window.readStringifies===0'));
 check('原生打开实际像素名称正确且无历史',(await audit()).pixel===docs[1].frames[0].cels[0][0]&&(await audit()).name===docs[1].name&&(await audit()).undo===0);
 const direct=await session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles(),opened=await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(paths[1])}));window.readFixture=opened;return{document:opened.document,getter:typeof Object.getOwnPropertyDescriptor(opened,'data').get==='function',raw:opened.rawProject??null};})()`);
 check('最近文件直接返回完整普通数组文档',same(direct.document,docs[1])&&direct.getter&&direct.raw===null&&await session.evaluate('window.readStringifies===0'));
 check('诊断data按需访问保持旧桥接结果',same(await session.evaluate('JSON.parse(window.readFixture.data)'),docs[1])&&await session.evaluate('window.readStringifies===1'));
 await session.evaluate('window.readStringifies=0');
 const beforeCancel=await audit();await nativeOpen(null);check('原生取消保持当前项目与历史',same(await audit(),beforeCancel));
 const beforeError=await audit(),recentBeforeError=await session.evaluate('window.desktop.recentFiles()');
 await nativeOpen(bad);await wait(()=>session.evaluate("document.getElementById('error-dialog').open"),'损坏错误');
 check('损坏原生读取保持当前作品且不加入最近',same(await audit(),beforeError)&&same(await session.evaluate('window.desktop.recentFiles()'),recentBeforeError));
 await session.evaluate("document.querySelector('#error-dialog .primary').click()");
 await second([paths[2],paths[0]]);await wait(async()=>(await audit()).path===paths[0]&&(await audit()).documents.length===3,'第二实例串行');
 check('第二实例多项目交接保持次序且不生成项目JSON',await session.evaluate('window.readStringifies===0')&&(await audit()).pixel===docs[0].frames[0].cels[0][0]&&(await audit()).undo===0);
 const recentBeforeThumb=await session.evaluate('window.desktop.recentFiles()'),beforeThumb=await audit(),thumbs=await session.evaluate('window.desktop.recentThumbs()');
 const thumb=thumbs.find(item=>item.path===paths[0]);
 check('缩略图正常读取保持红色首像素',thumb?.width===8&&thumb.height===8&&thumb.size===32&&same([...Buffer.from(thumb.pixels,'base64').subarray(0,4)],[255,0,0,255]));
 check('缩略图读取不重排最近不改历史或触发项目JSON',same(await session.evaluate('window.desktop.recentFiles()'),recentBeforeThumb)&&same(await audit(),beforeThumb)&&await session.evaluate('window.readStringifies===0'));
 await session.screenshot(root+'/complete.png');
 await session.evaluate('JSON.stringify=window.originalProjectStringify');
 for(const file of paths){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}
 await stop();await start([bad,paths[0]]);await wait(async()=>(await audit()).path===paths[0]&&await session.evaluate("document.getElementById('error-dialog').open"),'错误启动继续');
 check('启动队列损坏项报错后仍读取后续合法项目',(await audit()).pixel===docs[0].frames[0].cels[0][0]&&(await audit()).documents.length===1);
 check('启动损坏项不写入最近',!(await session.evaluate('window.desktop.recentFiles()')).some(entry=>entry.path===bad));
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,executable,executableSha256:createHash('sha256').update(await readFile(executable)).digest('hex'),directory},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{if(window.originalProjectStringify)JSON.stringify=window.originalProjectStringify;const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of [...paths,bad]){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill();
 await stop();
}

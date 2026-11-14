import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const root=path.resolve('artifacts/recovery-desktop');
const directory=path.resolve('../minepix-tauri-validation','recovery-'+Date.now());
const project=path.join(directory,'恢复验收 项目.pix');
await mkdir(root,{recursive:true});
await mkdir(directory,{recursive:true});
await copyFile('examples/mushroom.pix',project);
const original=await readFile(project);
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,session,baselineRecent;
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(test,label){
 for(let i=0;i<150;i++){const value=await test();if(value)return value;await pause();}
 throw new Error('等待超时：'+label);
}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const recovery=()=>session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`);
async function launch(files=[]){
 app=spawn(executable,files,{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{
  if(app.launchError)throw app.launchError;
  if(app.exitCode!==null||app.signalCode!==null)throw new Error('验证程序提前退出：'+(app.exitCode??app.signalCode));
  try{return(await targets()).some(target=>target.type==='page'&&target.url.startsWith('http://tauri.localhost'));}catch{return false;}
 },'内嵌页面');
 session=await connect((await targets()).find(target=>target.type==='page'&&target.url.startsWith('http://tauri.localhost')));
 await wait(()=>session.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'桌面就绪');
}
async function stop(){
 session?.close();session=null;
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次程序终止');}
 app=null;
 await wait(async()=>{try{await targets();return false;}catch{return true;}},'调试端口释放');
}
async function command(id){
 await session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
}
async function click(selector){
 const p=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
async function draw(color){
 await click('#layers .layer[data-index="0"]');
 await session.evaluate(`(()=>{const el=document.getElementById('hex');el.value=${JSON.stringify(color)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const p=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*.5,y:r.y+z*.5};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
 await wait(async()=>(await audit()).dirty,'绘画后未保存');
 return(await audit()).pixel;
}
async function recent(confirm){
 await command('recent-files');
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('recent-preview')"),'最近文件弹窗');
 await session.evaluate(`(()=>{const select=document.querySelector('select[name="index"]'),option=[...select.options].find(option=>option.textContent===${JSON.stringify(project)});if(!option)throw new Error('验证项目不在最近列表');select.value=option.value;select.dispatchEvent(new Event('change'));})()`);
 await wait(()=>session.evaluate("document.querySelector('#recent-preview canvas')?.width===32&&document.getElementById('recent-preview').textContent==='32 × 32'"),'真实缩略图');
 await click(confirm?'#modal-submit':'#modal .modal-actions [value="cancel"]');
}
async function closeDiscard(){
 await command('close-document');
 await wait(()=>session.evaluate("document.getElementById('modal').open"),'关闭确认');
 await session.evaluate("[...document.querySelectorAll('#modal .modal-actions button')].find(button=>button.textContent==='不保存').click()");
 await wait(async()=>(await audit()).documents.length===0,'关闭文档');
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}
 assert.ok(!occupied,'已有 CDP 会话，不能启动独立恢复验收');
 await launch([project]);
 await wait(async()=>(await audit()).path===project,'初次项目打开');
 baselineRecent=await session.evaluate('window.desktop.recentFiles()');
 const initial=await audit();
 const painted=await draw('#ff0000');
 check('真实绘画修改像素',painted!==initial.pixel);
 await wait(recovery,'自动恢复任务');
 const copy=await recovery();
 const stored=await session.evaluate(`window.desktop.loadRecovery(${JSON.stringify(copy.id)})`);
 const document=JSON.parse(stored.data);
 check('自动恢复副本匹配路径和实际像素',stored.filePath===project&&document.frames[0].cels[0][0]===painted);
 check('恢复副本没有覆盖磁盘项目',(await readFile(project)).equals(original));
 const dirty=await audit();
 await recent(false);
 check('最近文件缩略图与取消保持文档',JSON.stringify(await audit())===JSON.stringify(dirty));
 await recent(true);
 await wait(()=>session.evaluate("!document.getElementById('modal').open"),'重复打开结束');
 check('最近重复打开保留未保存像素和历史',JSON.stringify(await audit())===JSON.stringify(dirty));
 await stop();
 await launch();
 check('异常终止后空白启动不自动恢复',(await audit()).documents.length===0&&await session.evaluate("!document.getElementById('modal').open")&&!!await recovery());
 await recent(true);
 await wait(()=>session.evaluate("document.getElementById('modal-title').textContent==='恢复未保存内容？'&&document.getElementById('modal').open"),'匹配路径恢复询问');
 const disk=await audit();
 check('恢复询问前展示磁盘原内容',disk.path===project&&!disk.dirty&&disk.pixel===initial.pixel);
 await click('#modal .modal-actions [value="cancel"]');
 await wait(async()=>!await recovery(),'取消后清理副本');
 check('取消恢复保留磁盘文档',!(await audit()).dirty&&(await audit()).pixel===initial.pixel);
 await draw('#ff0000');
 await wait(recovery,'第二次自动恢复任务');
 await stop();
 await launch([project]);
 await wait(()=>session.evaluate("document.getElementById('modal').open&&document.getElementById('modal-title').textContent==='恢复未保存内容？'"),'再次启动恢复询问');
 await click('#modal-submit');
 await wait(async()=>(await audit()).dirty&&(await audit()).pixel===painted,'接受恢复');
 check('接受恢复还原未保存像素与原路径',(await audit()).path===project);
 await command('save');
 await wait(async()=>!(await audit()).dirty&&!(await audit()).busy&&!await recovery(),'保存并清理副本');
 const saved=await readFile(project);
 check('保存恢复结果写二进制并清理副本',saved.subarray(0,8).equals(Buffer.from('MINEPIX\0'))&&!saved.equals(original));
 await command('close-document');
 await wait(async()=>(await audit()).documents.length===0,'保存后关闭');
 await recent(true);
 await wait(async()=>(await audit()).path===project,'正常重新打开');
 check('已保存项目重开不提示恢复',!(await audit()).dirty&&(await audit()).pixel===painted&&await session.evaluate("!document.getElementById('modal').open"));
 await draw('#00ff00');
 await wait(recovery,'明确丢弃前副本');
 await closeDiscard();
 check('明确不保存清理副本并保留磁盘',!await recovery()&&(await readFile(project)).equals(saved));
 await command('new');
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.querySelector('input[name=\"width\"]')"),'新建弹窗');
 await session.evaluate("(()=>{const form=document.getElementById('modal-form');form.elements.name.value='未保存恢复验收';form.elements.width.value=4;form.elements.height.value=4;form.requestSubmit(document.getElementById('modal-submit'));})()");
 await wait(async()=>(await audit()).documents.length===1&&!(await audit()).path,'未命名新项目');
 await draw('#00ff00');
 const unsaved=(await audit()).id;
 await new Promise(resolve=>setTimeout(resolve,1000));
 check('从未保存的项目不产生恢复记录',await session.evaluate(`window.desktop.listRecovery().then(list=>!list.some(item=>item.id===${JSON.stringify(unsaved)}))`));
 await closeDiscard();
 await wait(()=>session.evaluate(`!![...document.querySelectorAll('#welcome-recent .welcome-recent-item')].find(button=>button.title===${JSON.stringify(project)})`),'欢迎页最近项目');
 await session.evaluate(`[...document.querySelectorAll('#welcome-recent .welcome-recent-item')].find(button=>button.title===${JSON.stringify(project)}).parentElement.querySelector('.welcome-recent-remove').click()`);
 await wait(()=>session.evaluate(`window.desktop.recentFiles().then(entries=>!entries.some(entry=>entry.path===${JSON.stringify(project)}))`),'单项移除');
 check('欢迎页单项删除只移除本次记录',JSON.stringify(await session.evaluate('window.desktop.recentFiles()'))===JSON.stringify(baselineRecent.filter(entry=>entry.path!==project)));
 await stop();
 await launch();
 check('单项删除重启持久化且无恢复提示',await session.evaluate(`window.desktop.recentFiles().then(entries=>!entries.some(entry=>entry.path===${JSON.stringify(project)}))`)&&await session.evaluate("!document.getElementById('modal').open"));
 check('恢复流程没有错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,project,executable},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length,project}));
}catch(error){
 await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,project,executable},null,2)+'\n');
 throw error;
}finally{
 if(session){
  try{await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}catch{}
 }
 if(app)await stop();
}

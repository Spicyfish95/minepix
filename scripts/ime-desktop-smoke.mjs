import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve('artifacts/ime-native');
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe');
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const directory=path.resolve('../minepix-tauri-validation','ime-'+Date.now()),project=path.join(directory,'IME现有作品.pix');
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});await copyFile('examples/mushroom.pix',project);
const original=await readFile(project),results=[],nativeInput=[];
let app,session,baseline,imeToggleAttempted=false,initial,record,ok=false;
const cleanup={preferencesRestored:false,ownRecentRemoved:false,ownRecoveryRemoved:false,cdpReleased:false,sourceUnchanged:false};
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const result=await test();if(result)return result;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function native(action,letters='',screenshot){
 const response=await exec('powershell.exe',['-NoProfile','-File','scripts/native-keyboard.ps1','-ProcessId',String(app.pid),'-Action',action,...(letters?['-Letters',letters]:[]),...(screenshot?['-Screenshot',path.join(root,screenshot)]:[])],{windowsHide:true,timeout:20000});
 const value=JSON.parse(response.stdout.replace(/^\uFEFF/,''));nativeInput.push(value);return value;
}
async function state(){return session.evaluate("({value:document.querySelector('#modal-form [name=name]')?.value,open:document.getElementById('modal').open,events:window.imeEvents})");}
async function click(selector){
 const p=await session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'现有作品载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await session.evaluate("window.minepixLocale.set('zh')");
 initial=await audit();
 await session.evaluate("document.querySelector('[data-menu-command=new]').click()");
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.querySelector('#modal-form [name=name]')"),'实际新建对话框');
 await session.evaluate("window.imeEvents=[];const input=document.querySelector('#modal-form [name=name]');for(const type of ['compositionstart','compositionupdate','compositionend','beforeinput','input','keydown','keyup'])input.addEventListener(type,e=>window.imeEvents.push({type,trusted:e.isTrusted,data:e.data,inputType:e.inputType,composing:e.isComposing,key:e.key,code:e.code,keyCode:e.keyCode}));true");
 await click('#modal-form [name=name]');await native('select-all');
 await native('ctrl-space');imeToggleAttempted=true;
 await session.evaluate('window.imeEvents=[]');
 await native('letters','XIANGSU','chinese-mode-composition-screen.png');
 let composing=await state();
 await writeFile(root+'/composition-observed.json',JSON.stringify(composing,null,2)+'\n');
 check('Windows字母键产生实际受信IME组字',composing.events.some(e=>e.type==='compositionstart'&&e.trusted)&&composing.events.some(e=>e.type==='input'&&e.trusted&&e.composing));
 check('组字不触发新建提交或作品快捷键',composing.open&&same(await audit(),initial));
 await native('space');check('候选空格提交第一词像素',(await state()).value==='像素');
 await native('letters','CESHI','second-composition-screen.png');await native('space','', 'committed-screen.png');
 record=await state();await writeFile(root+'/events.json',JSON.stringify(record,null,2)+'\n');
 const starts=record.events.filter(e=>e.type==='compositionstart'),ends=record.events.filter(e=>e.type==='compositionend');
 check('完整组字提交文本而非直接插入',record.value==='像素测试'&&starts.length===2&&ends.length===2&&starts.every(e=>e.trusted)&&ends.map(e=>e.data).join('')===record.value);
 check('候选确认后仍需用户明确创建',record.open&&same(await audit(),initial));
 await click('#modal-submit');
 await wait(async()=>(await audit()).documents.length===initial.documents.length+1,'明确创建新项目');
 check('明确确定后新作品名称准确',(await audit()).name==='像素测试'&&(await audit()).dirty&&!(await audit()).path&&(await audit()).undo===0);
 check('源作品磁盘未改且无错误弹窗',(await readFile(project)).equals(original)&&!await session.evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');
 ok=true;
}catch(error){
 results.push({name:'IME native failure',pass:false,error:error.stack});process.exitCode=1;
 if(session){record=await state().catch(()=>record);await session.screenshot(root+'/failure.png').catch(()=>{});}
}finally{
 try{
  if(session&&baseline){
   if(imeToggleAttempted)await native('ctrl-space');
   await session.evaluate("document.getElementById('modal').close('cancel')");
   await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
   await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);
   cleanup.preferencesRestored=same(await session.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
   cleanup.ownRecentRemoved=!(await session.evaluate('window.desktop.recentFiles()')).some(entry=>entry.path===project);
   cleanup.ownRecoveryRemoved=!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`);
  }
 }finally{
  session?.close();
  if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
  await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP释放');cleanup.cdpReleased=true;
  cleanup.sourceUnchanged=(await readFile(project)).equals(original);
  ok=ok&&Object.values(cleanup).every(Boolean);
  await writeFile(root+'/report.json',JSON.stringify({ok,executable,executableSha256,directory,results,nativeInput,record,cleanup,imeToggleAttempted,imeToggle:'Ctrl+Space as instructed by user',source:'OS IME with Windows SendInput letter/space scan codes; automated, not physical keyboard'},null,2)+'\n');
 }
}
if(!ok)process.exitCode=1;
console.log(JSON.stringify({ok,checks:results.length,cleanup,executableSha256},null,2));

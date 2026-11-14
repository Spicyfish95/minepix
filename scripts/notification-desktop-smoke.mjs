import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),pid=Number(process.argv[2]),executable=path.resolve(process.argv[3]),project=path.resolve(process.argv[4]),root=path.resolve('artifacts/notification-desktop');
assert.ok(Number.isInteger(pid)&&pid>0,'需要本次安装验证进程');
await mkdir(root,{recursive:true});
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const results=[],observed={},check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let main,baseline,nativeJob;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()');
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);}
async function click(selector){const point=await main.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});}
try{
 main=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'安装作品载入');
 baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await main.evaluate("window.minepixLocale.set('zh')");
 await command('save');await wait(async()=>{const state=await audit();return !state.busy&&!state.dirty;},'准备作品保存');
 const before={audit:await audit(),document:await readDocument(),bytes:await readFile(project),update:await main.evaluate('window.desktop.updateState()')};
 await main.evaluate("window.notificationActions=[];window.desktop.onNotificationAction(action=>window.notificationActions.push(action))");
 await command('about');await wait(()=>main.evaluate("document.getElementById('modal').open&&!!document.getElementById('about-notification-test')"),'关于界面');
 check('正式关于界面提供独立文字测试通知按钮',await main.evaluate("document.getElementById('about-notification-test').textContent==='发送测试通知'&&document.getElementById('about-notification-test').type==='button'"));
 await writeFile(path.join(root,'native-ready.json'),'');
 nativeJob=exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-notification.ps1'),'-ProcessId',String(pid),'-ExpectedTitle','MinePix 通知测试','-OutputDirectory',root],{windowsHide:true});
 // Attach a handler immediately; a missing OS banner must be reported without an unhandled rejection.
 const nativeResult=nativeJob.then(result=>({result}),error=>({error}));
 await wait(async()=>{const text=await readFile(path.join(root,'native-ready.json'),'utf8');if(!text)return false;const state=JSON.parse(text);return state.ready&&state.expectedTitle==='MinePix 通知测试';},'原生观察器就绪');
 await click('#about-notification-test');
 await wait(()=>main.evaluate("document.getElementById('about-notification-status').textContent.includes('已提交测试通知')"),'Rust提交通知');
 check('提交结果说明系统设置而未冒充实际展示',await main.evaluate("document.getElementById('about-notification-status').textContent.includes('Windows 通知设置')"));
 await click('#modal .modal-actions [value="cancel"]');await wait(()=>main.evaluate("!document.getElementById('modal').open"),'关闭关于');
 await main.evaluate("window.desktop.windowControl('minimize')");
 const native=await nativeResult;if(native.error)throw native.error;observed.native=JSON.parse(native.result.stdout);
 check('实际Windows横幅被准确定位并可信点击',observed.native.title.includes('MinePix 通知测试')&&observed.native.minimizedBeforeClick&&observed.native.clicked);
 await wait(()=>main.evaluate("window.notificationActions.includes('test')&&document.hasFocus()"),'真实通知返回回调');
 check('通知点击回调实际送达且主窗获得焦点',await main.evaluate("window.notificationActions.length===1&&window.notificationActions[0]==='test'&&document.hasFocus()"));
 const geometry=await exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-window-pointer.ps1'),'-ProcessId',String(pid),'-Title','MinePix Tauri'],{windowsHide:true});observed.geometry=JSON.parse(geometry.stdout);
 check('最小化的原生主窗实际还原可见',!observed.geometry.before.minimized&&observed.geometry.before.visible);
 check('界面显示系统通知返回结果',await main.evaluate("document.body.textContent.includes('系统通知已返回 MinePix')"));
 check('通知不更改作品和绘画历史',same(await audit(),before.audit)&&same(await readDocument(),before.document)&&(await readFile(project)).equals(before.bytes));
 check('测试通知不检查更新不下载不安装',same(await main.evaluate('window.desktop.updateState()'),before.update));
 await main.screenshot(path.join(root,'returned.png'));
 await command('save');await wait(async()=>{const s=await audit();return !s.busy&&!s.dirty;},'返回后保存');
 check('返回后正常保存二进制保持',same(await readDocument(),before.document)&&(await readFile(project)).equals(before.bytes));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,observed,executable,executableSha256,pid,project},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,error:error.stack,executable,executableSha256,pid,project},null,2)+'\n');throw error;}
finally{
 if(nativeJob)await nativeJob.catch(()=>{});
 if(main&&baseline){await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 main?.close();
}

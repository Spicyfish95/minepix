import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),pid=Number(process.argv[2]),executable=path.resolve(process.argv[3]),project=path.resolve(process.argv[4]);
const root=path.resolve(process.env.MINEPIX_ASSOCIATIONS_ROOT,'notification-return');
assert.ok(Number.isInteger(pid)&&pid>0);
await mkdir(root,{recursive:true});
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const cleanup={preferencesRestored:false,ownRecoveryRemoved:false,serverExited:false,serverReleased:false};
let session,baseline,server,before,after,error,ok=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(test,label,attempts=200){for(let i=0;i<attempts;i++){const value=await test();if(value)return value;await pause(100);}throw new Error('Timeout: '+label);}
async function stats(){try{const r=await fetch('http://127.0.0.1:19412/stats');return r.ok?await r.json():null;}catch{return null;}}
async function native(){const r=await exec('powershell.exe',['-NoProfile','-File','scripts/native-window-pointer.ps1','-ProcessId',String(pid),'-Title','MinePix'],{windowsHide:true});return JSON.parse(r.stdout.replace(/^\uFEFF/,''));}
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function saved(){await session.evaluate("window.desktop.menuCommand({id:'save'})");await wait(async()=>{const s=await audit();return !s.busy&&!s.dirty;},'save');}
async function document(){return session.evaluate(`(async()=>{const files=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(files.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
try{
 check('Local notification fixture port is free',!await stats());
 server=spawn(process.execPath,['scripts/update-test-server.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let serverError;server.on('error',value=>serverError=value);
 await wait(async()=>{if(serverError)throw serverError;return stats();},'fixture server');
 await fetch('http://127.0.0.1:19412/control',{method:'POST',body:JSON.stringify({mode:'slow'})});
 session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'project');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await session.evaluate("window.minepixLocale.set('zh');window.workspaceLayout.reset();for(const[id,value]of Object.entries({hex:'#abcdef',brush:1,'brush-shape':'square','paint-opacity':100})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool=\"pencil\"]').click();");
 await session.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('[data-action=\"fit\"]').click();resolve();})))");
 const point=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*.5,y:r.y+z*.5}})()");
 for(const type of ['mousePressed','mouseReleased'])await session.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
 check('Real canvas mouse input creates history',!!await wait(async()=>{const a=await audit();return a.dirty&&a.undo>0;},'drawing'));
 await saved();
 before={audit:await audit(),document:await document(),diskSha256:createHash('sha256').update(await readFile(project)).digest('hex')};
 await session.evaluate("window.notificationReturnActions=[];window.notificationReturnTimeline=[];window.desktop.onNotificationAction(action=>window.notificationReturnActions.push({action,time:Date.now()}));window.desktop.onUpdateState(state=>{window.notificationReturnTimeline.push({status:state.status,time:Date.now()});if(state.status==='downloaded')document.getElementById('update-panel').hidden=true;});");
 await session.evaluate("window.desktop.menuCommand({id:'check-updates'})");
 await wait(()=>session.evaluate("window.desktop.updateState().then(s=>s.status==='available')"),'available signed version');
 await session.evaluate("window.desktop.windowControl('minimize')");
 before.geometry=await native();
 check('Own native editor is minimized before notification',before.geometry.after.minimized);
 console.log(JSON.stringify({stage:'waiting-for-user-banner-click',instruction:'点击 MinePix 更新已下载 横幅；不要点击重启并更新',pid}));
 const download=await session.evaluate("window.desktop.downloadUpdate()");
 check('Production signed download reaches downloaded state',download.status==='downloaded'&&download.version==='2.0.0-alpha.2');
 await wait(()=>session.evaluate("window.notificationReturnActions.some(item=>item.action==='update')"),'user click on actual update notification',1200);
 check('Production update notification callback arrives exactly once',await session.evaluate("window.notificationReturnActions.length===1&&window.notificationReturnActions[0].action==='update'"));
 await wait(()=>session.evaluate("document.hasFocus()&&!document.getElementById('update-panel').hidden"),'focused current update panel');
 after={audit:await audit(),document:await document(),diskSha256:createHash('sha256').update(await readFile(project)).digest('hex'),geometry:await native(),update:await session.evaluate('window.desktop.updateState()'),actions:await session.evaluate('window.notificationReturnActions'),timeline:await session.evaluate('window.notificationReturnTimeline'),server:await stats()};
 check('Native editor restores visible and focused',!after.geometry.after.minimized&&after.geometry.after.visible&&await session.evaluate('document.hasFocus()'));
 check('Notification preserves full document, disk and history',same(before.audit,after.audit)&&same(before.document,after.document)&&before.diskSha256===after.diskSha256);
 check('Callback reveals current downloaded update panel',after.update.status==='downloaded'&&await session.evaluate("!document.getElementById('update-panel').hidden&&document.getElementById('update-status-text').textContent==='更新已就绪'&&document.getElementById('update-primary').textContent==='重启并更新'"));
 check('Exactly one real check/download and no install transition',after.server.checks===1&&after.server.downloads===1&&!after.timeline.some(s=>['installing','preparing'].includes(s.status)));
 await session.screenshot(path.join(root,'returned.png'));
 await session.evaluate("document.getElementById('update-hide').click();window.desktop.menuCommand({id:'undo'});");
 await wait(async()=>(await audit()).undo===before.audit.undo-1,'continued undo');
 await saved();
 check('Returned editor still undoes and saves',!(await audit()).dirty&&(await audit()).redo===1);
 ok=true;
}catch(value){error=value.stack;console.error(value);if(session)await session.screenshot(path.join(root,'failure.png')).catch(()=>{});}
finally{
 try{if(session&&baseline){
  await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
  cleanup.preferencesRestored=same(await session.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
  await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);
  cleanup.ownRecoveryRemoved=!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`);
 }}finally{
  session?.close();
  if(server&&server.exitCode===null&&server.signalCode===null){server.kill();await wait(()=>server.exitCode!==null||server.signalCode!==null,'own server exit');}
  cleanup.serverExited=!server||server.exitCode!==null||server.signalCode!==null;
  await wait(async()=>!await stats(),'server port released');cleanup.serverReleased=true;
  ok=ok&&Object.values(cleanup).every(Boolean);
  await writeFile(path.join(root,'report.json'),JSON.stringify({ok,results,before,after,cleanup,error,pid,executable,executableSha256,project,inputSource:'User clicks actual Windows update notification; no synthetic notification callback',installsDownloadedPackage:false},null,2)+'\n');
  console.log(JSON.stringify({ok,checks:results.length,cleanup}));
  if(!ok)process.exitCode=1;
 }
}

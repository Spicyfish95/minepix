import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]);
const publicUpdate=process.env.MINEPIX_PUBLIC_UPDATE==='1',targetVersion=process.argv[4]||'2.0.0-alpha.2',sourceVersion=process.argv[5]||'2.0.0-alpha.1';
const target=path.resolve(process.argv[3]),root=path.resolve('artifacts/native-upgrade');
const project=path.join(root,'升级 作品.pix'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(target),signature=(await readFile(target+'.sig','utf8')).trim();
const results=[],cleanup={preferencesRestored:false,ownRecoveryRemoved:false,appExited:false,cdpReleased:false,serverReleased:false};
let app,session,baseline,server,restarted,ok=false,downloadRequests=0,downloadBytes=0,manifestRequests=0;
const snapshots={target:{file:target,sha256:sha(bytes),bytes:bytes.length,version:targetVersion}};
const check=(name,value)=>{results.push({name,pass:!!value});assert.ok(value,name);};
async function wait(test,label,limit=200){
 for(let i=0;i<limit;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('Timeout: '+label);
}
async function processes(){
 const {stdout}=await exec('powershell.exe',['-NoProfile','-Command',"$taskApps=@(Get-Process minepix-tauri -ErrorAction SilentlyContinue | ForEach-Object {[pscustomobject]@{pid=$_.Id;path=$_.Path;created=$_.StartTime.ToUniversalTime().ToString('o')}});ConvertTo-Json -InputObject $taskApps -Compress"],{windowsHide:true});
 return JSON.parse(stdout.replace(/^\uFEFF/,''))||[];
}
async function attach(previousId){
 const page=await wait(async()=>{try{return(await targets()).find(t=>t.type==='page'&&t.url.startsWith('http://tauri.localhost')&&t.id!==previousId);}catch{return null;}},'embedded page',900);
 const connected=await connect(page);await wait(()=>connected.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'editor ready');return connected;
}
async function click(selector){
 const point=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function draw(pixel){
 const before=(await audit()).undo;
 const point=await session.evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*(${pixel}+.5),y:r.y+z*.5}})()`);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(async()=>(await audit()).undo===before+1,'actual paint history');
}
async function documentData(){
 return session.evaluate(`(async()=>{const entries=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(entries.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);
}
async function canvasHash(){
 const pixels=await session.evaluate("(()=>{const c=document.getElementById('canvas');return [...c.getContext('2d').getImageData(0,0,c.width,c.height).data]})()");
 return sha(Buffer.from(pixels));
}
try{
 await mkdir(root,{recursive:true});assert.equal((await processes()).length,0,'No pre-existing app');
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP occupied');
 await copyFile('examples/mushroom.pix',project);
 if(!publicUpdate){
 server=http.createServer((request,response)=>{
  if(request.url==='/latest.json'){
   manifestRequests++;const payload=JSON.stringify({version:targetVersion,notes:'Local real signed NSIS upgrade verification.',platforms:{'windows-x86_64':{url:'http://127.0.0.1:19412/setup.exe',signature}}});
   response.writeHead(200,{'Content-Type':'application/json'});response.end(payload);
  }else if(request.url==='/setup.exe'){
   downloadRequests++;downloadBytes+=bytes.length;response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length});response.end(bytes);
  }else{response.writeHead(404);response.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(19412,'127.0.0.1',resolve);});
 }
 app=spawn(executable,publicUpdate?[project]:['--update-validation=http://127.0.0.1:19412/latest.json',project],{
  windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}
 });
 app.on('error',error=>{app.launchError=error;});
 session=await attach();await wait(async()=>(await audit()).path===project,'project opened');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 snapshots.before={process:(await processes()).find(p=>p.pid===app.pid),executableSha256:sha(await readFile(executable)),info:await session.evaluate('window.desktop.appInfo()')};
 check('Installed source is the packaged baseline',snapshots.before.info.packaged&&snapshots.before.info.version===sourceVersion);
 await session.evaluate("window.minepixLocale.set('zh');document.getElementById('theme-toggle').click();document.getElementById('hex').value='#a944ff';document.getElementById('hex').dispatchEvent(new Event('change',{bubbles:true}))");
 await session.evaluate('window.desktop.setAutoUpdate(true)');
 await draw(0);await command('save');await wait(async()=>!(await audit()).dirty,'real Rust save');
 const projectBytes=await readFile(project),model=await documentData(),paintHash=await canvasHash();
 const preferences=await session.evaluate("({theme:localStorage.getItem('pixel-studio-theme'),locale:localStorage.getItem('pixpix-locale-v1')})");
 snapshots.saved={projectSha256:sha(projectBytes),modelSha256:sha(JSON.stringify(model)),canvasSha256:paintHash,preferences};
 check('Source edit is saved as binary PIX',projectBytes.subarray(0,1).toString()!=='{'&&(await audit()).undo===1);
 await command('check-updates');
 await wait(()=>session.evaluate('window.desktop.updateState().then(s=>s.status==="available")'),'available target',600);
 check('Native UI offers the expected signed target',await session.evaluate(`window.desktop.updateState().then(s=>s.version===${JSON.stringify(targetVersion)})`));
 await click('#update-primary');await wait(async()=>{
  const state=await session.evaluate('window.desktop.updateState()');
  snapshots.download=state;
  if(state.status==='error')throw new Error('Installer download failed: '+JSON.stringify(state.error));
  return state.status==='downloaded';
 },'verified real installer',publicUpdate?6000:1200);
 snapshots.download=await session.evaluate('window.desktop.updateState()');
 check('Real target installer downloaded through production verifier',(publicUpdate||(downloadRequests===1&&downloadBytes===bytes.length))&&sha(await readFile(path.join(process.env.APPDATA,'com.minepix.tauri/update-cache/base.exe')))===sha(bytes));
 await session.screenshot(path.join(root,'before-install.png'));
 const previousTarget=session.target.id;
 // Actual UI installation; the official plugin exits the old process after starting NSIS.
 await click('#update-primary').catch(error=>{snapshots.installDispatchError=error.message;});
 await wait(()=>app.launchError?Promise.reject(app.launchError):app.exitCode!==null||app.signalCode!==null,'old process exit',900);
 check('Official updater exits source process',app.exitCode===0);
 session.close();session=null;
 restarted=await wait(async()=>(await processes()).find(p=>p.path?.toLowerCase()===executable.toLowerCase()&&p.pid!==app.pid),'automatic installed app restart',900);
 session=await attach(previousTarget);
 snapshots.after={process:restarted,executableSha256:sha(await readFile(executable)),info:await session.evaluate('window.desktop.appInfo()')};
 snapshots.restartCommandLine=(await exec('powershell.exe',['-NoProfile','-Command',`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);(Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(restarted.pid)}").CommandLine`],{windowsHide:true})).stdout.trim();
 snapshots.afterLaunchAudit=await audit();
 await wait(async()=>(await audit()).path===project,'Chinese spaced argument restored');
 check('NSIS automatically restarts target version at the same installed path',snapshots.after.info.version===targetVersion&&snapshots.after.info.packaged&&restarted.pid!==app.pid);
 check('Installed executable changed between versions',snapshots.after.executableSha256!==snapshots.before.executableSha256);
 check('Restart preserves Chinese spaced project argument and saved state',(await audit()).path===project&&!(await audit()).dirty);
 check('Upgrade preserves complete project bytes',(await readFile(project)).equals(projectBytes));
 check('Upgrade preserves every model pixel and metadata field',same(await documentData(),model));
 check('Restart preserves the full displayed canvas',await canvasHash()===paintHash);
 check('Theme and language preferences survive overlay',same(await session.evaluate("({theme:localStorage.getItem('pixel-studio-theme'),locale:localStorage.getItem('pixpix-locale-v1')})"),preferences));
 check('Automatic-check preference survives overlay',snapshots.after.info.autoUpdate===true);
 await session.screenshot(path.join(root,'after-restart.png'));
 await draw(16);await command('undo');
 await wait(async()=>!(await audit()).dirty,'post-upgrade undo');
 check('Upgraded editor can draw and undo to its saved document',await canvasHash()===paintHash&&(await readFile(project)).equals(projectBytes));
 check('No editor error dialog after real upgrade',!await session.evaluate("document.getElementById('error-dialog').open"));
 ok=true;
}catch(error){
 results.push({name:'native overlay failure',pass:false,error:error.stack});process.exitCode=1;
 if(session){
  snapshots.failurePage=await session.evaluate("({audit:window.documentWindowAudit?.(),text:document.getElementById('error-dialog')?.textContent})").catch(()=>null);
  await session.screenshot(path.join(root,'failure.png')).catch(()=>{});
 }
}finally{
 try{
  if(session&&baseline){
   await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);
   cleanup.ownRecoveryRemoved=!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`);
   await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
   cleanup.preferencesRestored=same(await session.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
  }
 }catch(error){results.push({name:'native overlay cleanup failure',pass:false,error:error.stack});ok=false;}
 session?.close();
 const own=(await processes()).filter(p=>p.path?.toLowerCase()===executable.toLowerCase());
 for(const record of own)process.kill(record.pid);
 await wait(async()=>!(await processes()).some(p=>p.path?.toLowerCase()===executable.toLowerCase()),'own installed app exit');
 cleanup.appExited=true;
 await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP release');cleanup.cdpReleased=true;
 if(server?.listening)await new Promise(resolve=>server.close(resolve));cleanup.serverReleased=true;
 ok=ok&&Object.values(cleanup).every(Boolean);
 await writeFile(path.join(root,'desktop.json'),JSON.stringify({ok,results,cleanup,snapshots,traffic:{manifestRequests,downloadRequests,downloadBytes},realInstallerExecuted:true,automaticRestartVerified:!!snapshots.after,publicUpdate,productionEndpoint:publicUpdate?JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8')).plugins.updater.endpoints[0]:null},null,2)+'\n');
 console.log(JSON.stringify({ok,checks:results.length,cleanup,beforePid:snapshots.before?.process?.pid,afterPid:restarted?.pid},null,2));
 if(!ok)process.exitCode=1;
}

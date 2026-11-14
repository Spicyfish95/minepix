import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),action=process.argv[2]||'status';
assert.ok(['start','status','finish','cancel'].includes(action),'Use start, status, finish or cancel');
const root=path.resolve('artifacts/physical-input'),statePath=path.join(root,'session.json');
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe');
const inputPath=path.join(process.env.APPDATA,'com.minepix.tauri','input-device','report.json');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(test,label){for(let i=0;i<200;i++){const result=await test();if(result)return result;await pause(100);}throw new Error('等待超时：'+label);}
async function identity(pid){
 const result=await exec('powershell.exe',['-NoProfile','-Command',`$taskProcess=Get-Process -Id ${Number(pid)};[pscustomobject]@{pid=$taskProcess.Id;created=$taskProcess.StartTime.ToUniversalTime().ToString('o');path=$taskProcess.Path}|ConvertTo-Json -Compress`],{windowsHide:true});
 return JSON.parse(result.stdout.replace(/^\uFEFF/,''));
}
async function attach(){
 await wait(async()=>{try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost')&&!t.url.endsWith('panel.html'));}catch{return false;}},'内嵌正式页面');
 const session=await connect((await targets()).find(t=>t.url.startsWith('http://tauri.localhost')&&!t.url.endsWith('panel.html')));
 await wait(()=>session.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'正式界面就绪');
 return session;
}
async function portReleased(){await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP端口释放');}
async function restore(session,baseline){
 await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
 return same(await session.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
}
async function liveSession(state){
 assert.equal(state.status,'ready','No active physical input handoff');
 assert.ok(same(await identity(state.process.pid),state.process),'Process identity changed; refusing to operate on a different process');
 return attach();
}
if(action==='start'){
 await mkdir(root,{recursive:true});
 let occupied=false;try{await targets();occupied=true;}catch{}
 assert.ok(!occupied,'CDP is occupied; an existing application will not be replaced');
 const beforeState=await readFile(statePath,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 assert.notEqual(beforeState?.status,'ready','A physical input handoff already exists; inspect or cancel it first');
 const originalReport=await readFile(inputPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(originalReport)await writeFile(path.join(root,'report-before.json'),originalReport);
 const baselineApp=spawn(executable,[],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 let baselineSession,baseline;
 try{
  baselineSession=await attach();
  baseline=await baselineSession.evaluate('Object.fromEntries(Object.entries(localStorage))');
  assert.equal((await baselineSession.evaluate('window.desktop.appInfo()')).inputAudit,false);
 }finally{
  baselineSession?.close();
  if(baselineApp.exitCode===null&&baselineApp.signalCode===null){baselineApp.kill();await wait(()=>baselineApp.exitCode!==null||baselineApp.signalCode!==null,'基线程序关闭');}
  await portReleased();
 }
 const app=spawn(executable,['--input-audit'],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.unref();
 const processIdentity=await identity(app.pid);
 const state={status:'preparing',executable,executableSha256:createHash('sha256').update(await readFile(executable)).digest('hex'),process:processIdentity,baseline,inputPath,hadOriginalReport:!!originalReport,startedAt:new Date().toISOString(),inputSource:'User physical input only; this tool dispatches no input events'};
 await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
 let session;
 try{
  session=await attach();
  await wait(()=>session.evaluate("!!document.querySelector('.device-audit button')"),'实际数位笔诊断控件');
  assert.equal((await session.evaluate('window.desktop.appInfo()')).inputAudit,true);
  await session.evaluate("window.physicalSubmitted=false;window.physicalSavePending=false;window.physicalLastManualSave=null;document.querySelector('.device-audit button').addEventListener('click',event=>{if(event.isTrusted){window.physicalSubmitted=true;window.physicalSavePending=true;}},true);const original=window.desktop.recordInputAudit;window.desktop.recordInputAudit=async record=>{const manual=window.physicalSavePending;window.physicalSavePending=false;const result=await original(record);if(manual)window.physicalLastManualSave={record,result};return result;};true");
  await session.screenshot(path.join(root,'ready.png'));
  state.status='ready';
  await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
  console.log(JSON.stringify({status:'ready',pid:app.pid,executableSha256:state.executableSha256,instructions:'Draw real light-to-heavy pen strokes; use eraser/touch if supported; click 保存验收记录. Then run status and finish.'},null,2));
 }catch(error){
  if(session)await restore(session,baseline);
  process.kill(app.pid);
  await portReleased();
  if(originalReport)await writeFile(inputPath,originalReport);else await unlink(inputPath).catch(error=>{if(error.code!=='ENOENT')throw error;});
  state.status='failed';state.error=error.stack;
  await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
  throw error;
 }finally{session?.close();}
}else{
 const state=JSON.parse(await readFile(statePath,'utf8'));
 const session=await liveSession(state);
 try{
  const view=await session.evaluate('({submitted:window.physicalSubmitted,manual:window.physicalLastManualSave})');
  const record=view.manual?.record;
  const evidence={submitted:!!view.submitted,manualSaved:!!view.manual,pressureVerified:!!view.manual?.result.ok,
   penSamples:record?.trustedPenSamples??0,pressureMin:record?.pressureMin??null,pressureMax:record?.pressureMax??null,
   strokes:record?.strokes??0,eraserVerified:(record?.eraserSamples??0)>0,touchObserved:record?.types?.includes('touch')??false};
  if(action==='status'){
   console.log(JSON.stringify({status:evidence.manualSaved&&evidence.pressureVerified?'ready-to-finish':'waiting-for-physical-input',pid:state.process.pid,...evidence},null,2));
  }else{
   if(action==='finish')assert.ok(evidence.submitted&&evidence.manualSaved&&evidence.pressureVerified,'Real pen samples and a trusted manual Save click are required; keep drawing or cancel');
   const preferencesRestored=await restore(session,state.baseline);
   assert.ok(preferencesRestored,'Preferences could not be restored');
   if(action==='finish'){
    await session.screenshot(path.join(root,'completed.png'));
    await writeFile(path.join(root,'record.json'),JSON.stringify(record,null,2)+'\n');
   }
   session.close();
   process.kill(state.process.pid);
   await portReleased();
   if(action==='cancel'){
    if(state.hadOriginalReport)await writeFile(inputPath,await readFile(path.join(root,'report-before.json')));
    else await unlink(inputPath).catch(error=>{if(error.code!=='ENOENT')throw error;});
   }
   state.status=action==='finish'?'completed':'cancelled';
   state.finishedAt=new Date().toISOString();
   await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
   const report={ok:action==='finish',status:state.status,executableSha256:state.executableSha256,evidence,preferencesRestored,cdpReleased:true,inputSource:state.inputSource,recordPreserved:action==='finish',priorRecordRestored:action==='cancel'};
   await writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
   console.log(JSON.stringify(report,null,2));
  }
 }finally{session.close();}
}

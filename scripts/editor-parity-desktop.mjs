import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const allowed=['parity-toolbar','parity-fill','parity-symmetry','parity-stabilizer','parity-selection','parity-gradient','parity-adjustments','parity-outline','parity-rotsprite','parity-slice-controls','parity-tiled','parity-shading'];
const entries={'layer-groups':['runGroupSmoke','groups-test'],'layer-blend':['runBlendSmoke','blend-test'],'cel-links':['runCelLinksSmoke','cel-links-test'],'color-modes':['runColorModesSmoke','color-modes-test']};
const native=['parity-slices','parity-cels',...Object.keys(entries)];
const selected=process.argv.slice(2).length?process.argv.slice(2):allowed;
for(const suite of selected)assert.ok([...allowed,...native].includes(suite),'Suite not mapped: '+suite);
const executable=path.resolve('src-tauri/target/debug/minepix-tauri.exe'),root=selected.some(suite=>native.includes(suite))?'artifacts/editor-native-parity':'artifacts/editor-parity';
const directory=path.resolve('../minepix-tauri-validation','editor-parity-'+Date.now()),created=[],exec=promisify(execFile);
await mkdir(root,{recursive:true});
if(selected.some(suite=>native.includes(suite)))await mkdir(directory,{recursive:true});
let app,session,baseline;
const results=[];
async function wait(test,label){
 for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('等待超时：'+label);
}
async function save(){await writeFile(root+'/report.json',JSON.stringify({ok:results.length===selected.length&&results.every(result=>result.ok),selected,results},null,2)+'\n');}
async function restore(){
 await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
}
async function dialog(file){await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',file],{windowsHide:true,timeout:20000});}
try{
 assert.equal((await fetch('http://127.0.0.1:14200/')).status,200,'Vite must already be running');
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'Debugger occupied');
 app=spawn(executable,[],{cwd:path.resolve('..'),windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;if(app.exitCode!==null||app.signalCode!==null)throw new Error('Debug application exited');try{return(await targets()).some(target=>target.type==='page');}catch{return false;}},'应用页面');
 session=await connect((await targets()).find(target=>target.type==='page'));
 await wait(()=>session.evaluate("typeof window.runParitySmoke==='function'&&!!window.workspaceLayout"),'开发入口');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await writeFile(root+'/preferences-before.json',JSON.stringify(baseline,null,2)+'\n');
 assert.equal(await session.evaluate('window.desktop.appInfo().then(info=>info.backend)'),'tauri-rust');
 for(const suite of selected){
  await restore();
  await session.evaluate("localStorage.setItem('pixpix-locale-v1','zh');localStorage.setItem('pixel-studio-theme','light');for(const key of ['pixel-studio-brush','pixel-studio-colors','pixel-studio-input-v1','pixel-studio-pen-v1','pixel-studio-onion','pixel-studio-layout-v1','pixel-studio-application-v1','pixel-studio-keymap-v1','pixel-studio-tool-brush-shapes','minepix-appearance-v1'])localStorage.removeItem(key)");
  await session.send('Page.reload',{ignoreCache:true});
  await wait(()=>session.evaluate("typeof window.runParitySmoke==='function'&&!!window.workspaceLayout&&window.documentWindowAudit().documents.length===0"),'新验收页面');
  let result;
  if(native.includes(suite)){
   const project=path.join(directory,(entries[suite]?.[1]||suite)+'.pix'),ase=path.join(directory,suite+'.ase'),gray=path.join(directory,suite+'-gray.ase');created.push(project);
   const invocation=entries[suite]?`window.${entries[suite][0]}()`:`window.runParitySmoke(${JSON.stringify(suite)})`;
   await session.evaluate(`window.nativeParityResult=null;void ${invocation}.then(result=>window.nativeParityResult=result);true`);
   try{for(const file of [project,ase,ase,...(suite==='color-modes'?[gray,gray]:[])])await dialog(file);}
   catch(error){const current=await session.evaluate('window.nativeParityResult');if(!current||current.ok)throw error;result=current;}
   if(!result){await wait(()=>session.evaluate('window.nativeParityResult'),'原生往返结果');result=await session.evaluate('window.nativeParityResult');}
  }else result=await session.evaluate(`window.runParitySmoke(${JSON.stringify(suite)})`);
  await writeFile(root+'/'+suite+'.json',JSON.stringify({suite,...result},null,2)+'\n');
  results.push({suite,...result});await save();
  await session.screenshot(root+'/'+suite+'.png');
  if(!result.ok)console.error(JSON.stringify(await session.evaluate(`({toolName:document.getElementById('tool-name').textContent,sliceButtons:[...document.querySelectorAll('#slice-controls button')].map(button=>({action:button.dataset.action,label:button.getAttribute('aria-label'),title:button.title})),canvasButtons:[...document.querySelectorAll('.canvas-actions button')].map(button=>({action:button.dataset.action,toggle:button.dataset.toggle,label:button.getAttribute('aria-label')}))})`)));
  assert.ok(result.ok,suite+': '+result.error);
  console.log(JSON.stringify({suite,passed:result.results.length}));
 }
 console.log(JSON.stringify({ok:true,suites:results.length,passed:results.reduce((n,result)=>n+result.results.length,0)}));
}finally{
 if(session&&baseline){await restore();for(const file of created){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 session?.close();
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
 await save();
}

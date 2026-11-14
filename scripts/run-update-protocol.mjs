import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {targets} from './cdp.mjs';

const root=path.resolve('artifacts/updater-native-protocol');
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe');
const project=path.join(root,'first.pix');
const appdata=path.join(process.env.APPDATA,'com.minepix.tauri');
const preserved=['updater-settings.json','recent-files.json','update-cache/base.exe','update-cache/pending.exe','update-cache/pending.json'];
const before=new Map(),children=[];
let ok=false;
const cleanup={appExited:false,serverExited:false,cdpReleased:false,serverReleased:false,filesRestored:false};
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(test,label){for(let i=0;i<200;i++){if(await test())return;await pause();}throw new Error('Timeout: '+label);}
async function occupied(url){try{await fetch(url);return true;}catch{return false;}}
function launch(command,args,options={}){
 const child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],...options});
 const record={child,stdout:'',stderr:'',error:null};children.push(record);
 child.stdout.on('data',data=>record.stdout+=data);child.stderr.on('data',data=>record.stderr+=data);
 child.on('error',error=>record.error=error);return record;
}
try{
 assert.ok(!await occupied('http://127.0.0.1:9223/json/list'),'CDP occupied');
 assert.ok(!await occupied('http://127.0.0.1:19412/stats'),'Test server occupied');
 await mkdir(root,{recursive:true});
 for(const name of preserved)before.set(name,await readFile(path.join(appdata,name)).catch(error=>{if(error.code==='ENOENT')return null;throw error;}));
 assert.equal(before.get('update-cache/pending.json'),null,'Existing pending update must not be replaced by a protocol test');
 await mkdir(appdata,{recursive:true});
 await writeFile(path.join(appdata,'updater-settings.json'),JSON.stringify({autoUpdate:false}));
 await copyFile('examples/mushroom.pix',project);
 const server=launch(process.execPath,['scripts/update-test-server.mjs']);
 await wait(async()=>{if(server.error)throw server.error;return occupied('http://127.0.0.1:19412/stats');},'local fixture server');
 const app=launch(executable,['--update-validation=http://127.0.0.1:19412/latest.json',project],{
  env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}
 });
 await wait(async()=>{if(app.error)throw app.error;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'packaged app');
 const test=launch(process.execPath,['scripts/update-desktop-smoke.mjs'],{
  env:{...process.env,MINEPIX_UPDATER_ROOT:root,MINEPIX_UPDATER_EXE:executable,MINEPIX_UPDATER_PROJECT:project}
 });
 await new Promise((resolve,reject)=>{test.child.once('error',reject);test.child.once('exit',code=>code===0?resolve():reject(new Error('Native protocol test failed: '+code)));});
 assert.equal(JSON.parse(await readFile(path.join(root,'protocol-validation.json'),'utf8')).ok,true);
 ok=true;
}catch(error){
 await mkdir(root,{recursive:true});await writeFile(path.join(root,'failure.json'),JSON.stringify({error:error.stack},null,2)+'\n');
 process.exitCode=1;
}finally{
 for(const record of children.slice().reverse()){
  if(record.child.exitCode===null&&record.child.signalCode===null&&!record.error){
   record.child.kill();await wait(()=>record.child.exitCode!==null||record.child.signalCode!==null,'own process exit');
  }
 }
 cleanup.appExited=children.filter(record=>record.child.spawnfile===executable).every(record=>record.child.exitCode!==null||record.child.signalCode!==null);
 cleanup.serverExited=children.filter(record=>record.child.spawnargs.includes('scripts/update-test-server.mjs')).every(record=>record.child.exitCode!==null||record.child.signalCode!==null);
 await wait(async()=>!await occupied('http://127.0.0.1:9223/json/list'),'CDP release');cleanup.cdpReleased=true;
 await wait(async()=>!await occupied('http://127.0.0.1:19412/stats'),'server release');cleanup.serverReleased=true;
 for(const[name,bytes]of before){
  const file=path.join(appdata,name);
  if(bytes){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
  else await unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});
 }
 cleanup.filesRestored=(await Promise.all([...before].map(async([name,bytes])=>{
  const after=await readFile(path.join(appdata,name)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  return bytes?after?.equals(bytes):after===null;
 }))).every(Boolean);
 for(let i=0;i<children.length;i++)await writeFile(path.join(root,`process-${i}.json`),JSON.stringify({
  pid:children[i].child.pid,args:children[i].child.spawnargs,stdout:children[i].stdout,stderr:children[i].stderr,error:children[i].error?.message
 },null,2)+'\n');
 ok=ok&&Object.values(cleanup).every(Boolean);
 await writeFile(path.join(root,'run.json'),JSON.stringify({ok,cleanup,installsRealPackage:false},null,2)+'\n');
 console.log(JSON.stringify({ok,cleanup,installsRealPackage:false},null,2));
 if(!ok)process.exitCode=1;
}

import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {targets,connect} from './cdp.mjs';
import {encodePalette,paletteBase64} from '../src/palette-file.js';

const root=path.resolve('artifacts/palette-desktop');await mkdir(root,{recursive:true});
const profile=await mkdtemp(path.join(root,'webview-')),port=9223;
const palette=path.join(root,'opened-palette.pix');
await writeFile(palette,encodePalette(['#12345678','#abcdef']));
const settings=path.join(process.env.APPDATA,'com.minepix.tauri'),backups=new Map();
let app,session,logs='';
const results=[],check=(name,value)=>{results.push({name,pass:!!value});assert.ok(value,name);};
const wait=async task=>{for(let i=0;i<150;i++){const value=await task();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Desktop palette test timed out');};
try{
 for(const file of ['recent-files.json','updater-settings.json']){
  const target=path.join(settings,file);try{backups.set(target,await readFile(target));}catch(error){if(error.code!=='ENOENT')throw error;backups.set(target,null);}
 }
 await mkdir(settings,{recursive:true});await writeFile(path.join(settings,'updater-settings.json'),'{"autoUpdate":false}');
 app=spawn(path.resolve(process.env.MINEPIX_TEST_EXE||'src-tauri/target/debug/minepix-tauri.exe'),[palette],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
 app.stdout.on('data',data=>{logs+=data;});app.stderr.on('data',data=>{logs+=data;});
 app.on('error',error=>{logs+=error.stack;});
 await wait(async()=>{if(app.exitCode!==null)throw new Error('Desktop exited: '+app.exitCode+' '+logs);try{const target=(await targets(port)).find(target=>target.type==='page'&&!target.url.includes('capture.html')&&!target.url.includes('panel.html'));if(target)session=await connect(target);return !!session;}catch{return false;}});
 await wait(()=>session.evaluate("!!window.documentWindowAudit&&window.documentWindowAudit().documents.length===1"));
 check('文件关联启动识别 PIX 色板而非项目',await session.evaluate("window.documentWindowAudit().path===null&&!document.getElementById('error-dialog').open&&document.querySelector('#palette .swatch')?.title.includes('123456')"));
 const descriptor=await session.evaluate(`window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'openDroppedPath',args:[${JSON.stringify(palette)}]})`);
 check('原生拖入路径按文件头识别色板',descriptor.type==='palette'&&descriptor.data===paletteBase64(encodePalette(['#12345678','#abcdef'])));
 const sample={png:(await readFile('tests/fixtures/palettes/bright24.png')).toString('base64'),ase:(await readFile('tests/fixtures/palettes/lost-century.ase')).toString('base64')};
 const result=await session.evaluate(`window.runPaletteWorkflowSmoke(${JSON.stringify(sample)})`);
 results.push(...result.results);assert.ok(result.ok,result.error);
 await session.screenshot(path.join(root,'palette.png'));
 check('原生运行无错误日志',logs.trim()==='');
 await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results},null,2)+'\n');
 console.log(JSON.stringify({ok:true,results},null,2));
}finally{
 if(app&&app.exitCode===null){
  try{await session?.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'closeConfirmed',args:[]})");}catch{}
  if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}
 }
 session?.close();
 for(const [file,bytes]of backups)if(bytes===null)await rm(file,{force:true});else await writeFile(file,bytes);
 await writeFile(path.join(root,'native.log'),logs);
}

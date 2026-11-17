import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {GifReader} from 'omggif';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve('artifacts/export-directory-desktop',String(Date.now())),results=[];
await mkdir(root,{recursive:true});const directory=path.join(root,'导出目录 with spaces');await mkdir(directory);
const profile=await mkdtemp(path.join(root,'webview-')),project=path.join(root,'direct-export.pix');
const doc=createDocument(2,2,'direct-export');doc.frames[0].cels[0]=[0xff0000ff,0,0,0x0000ffff];doc.frames.push({duration:80,cels:[[0x00ff00ff,0,0,0]]});
await writeFile(project+'.json',JSON.stringify(doc));await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const check=(name,pass)=>{assert.ok(pass,name);results.push({name,pass:true});};
const wait=async(test,label)=>{for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);};
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[project],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
let main,logs='';app.stdout.on('data',data=>logs+=data);app.stderr.on('data',data=>logs+=data);
const record=()=>main.evaluate(`JSON.parse(localStorage.getItem('minepix-project-exports-v1')).projects[window.documentWindowAudit().id]`);
async function open(command){
 await main.evaluate(`document.querySelector('[data-menu-command="${command}"]').click()`);
 await wait(()=>main.evaluate(`document.getElementById('modal').open`),'export form '+command);
}
async function submit(mode='png',format='png',output=directory){
 await main.evaluate(`(()=>{const form=document.getElementById('modal-form');form.elements.directory.value=${JSON.stringify(output)};
  if(form.elements.mode){form.elements.mode.value=${JSON.stringify(mode)};form.elements.mode.dispatchEvent(new Event('change'));form.elements.format.value=${JSON.stringify(format)};
   for(const[key,value]of Object.entries({scale:1,columns:2,margin:0,gapX:0,gapY:0,order:'rows',extrude:0,scope:'all',engineFormat:'native'}))form.elements[key].value=value;
   form.elements.trim.checked=false;form.elements.pack.checked=false;}
  document.getElementById('status').textContent='';})()`);
 await wait(()=>main.evaluate(`!document.getElementById('modal-submit').disabled`),'export preview');
 await main.evaluate(`document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))`);
 await wait(()=>main.evaluate(`document.getElementById('error-dialog').open||(!document.getElementById('modal').open&&!window.documentWindowAudit().busy&&/^(导出完成|法线贴图已导出)/.test(document.getElementById('status').textContent))`),'direct export '+mode);
 return main.evaluate(`!document.getElementById('error-dialog').open`);
}
async function ordinary(mode,format='png',output=directory){await open('png');return submit(mode,format,output);}
try{
 await wait(async()=>{try{const target=(await targets()).find(target=>target.type==='page'&&!/capture|panel/.test(target.url));if(target){main=await connect(target);return true;}}catch{return false;}},'editor');
 await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'project open');
 for(const format of ['png','webp','jpg','jpeg','svg','ico','gif','bmp','css']){
  check(format+' confirmation exports directly to configured directory',await ordinary('png',format));const saved=await record(),target=path.join(directory,'direct-export.'+format),bytes=await readFile(target);
  check(format+' records exact output path without changing directory',saved.destination.filePath===target&&path.resolve(saved.destination.directory)===directory&&bytes.length>0);
 }
 const png=path.join(directory,'direct-export.png'),first=await readFile(png);await writeFile(png,'replace-me');
 check('repeated single-file export needs no overwrite picker',await ordinary('png','png')&&(await readFile(png)).equals(first));
 check('GIF animation exports directly',await ordinary('gif','gif'));const gif=new GifReader(await readFile(path.join(directory,'direct-export.gif')));check('GIF retains both frames',gif.numFrames()===2);
 check('animated WebP exports directly',await ordinary('gif','webp'));check('WebP contains animation data',(await readFile(path.join(directory,'direct-export.webp'))).includes(Buffer.from('ANIM')));
 check('PNG sequence exports without a folder picker',await ordinary('sequence'));const sequence=await record();check('sequence writes a timing manifest',(await readdir(sequence.destination.folder)).includes('animation.json'));
 check('paired sheet exports without a folder picker',await ordinary('sheet-pair'));const pair=await record();check('paired sheet contains image and JSON',(await readdir(pair.destination.folder)).includes('direct-export-sheet.png')&&(await readdir(pair.destination.folder)).includes('direct-export-sheet.json'));
 check('repeated paired export creates another numbered folder',await ordinary('sheet-pair')&&(await record()).destination.folder!==pair.destination.folder);
 check('sheet PNG exports directly',await ordinary('sheet','png'));const sheet=path.join(directory,'direct-export-sheet.png');await readFile(sheet);
 check('metadata associates the same-name PNG without either path picker',await ordinary('metadata'));const metadata=JSON.parse(await readFile(path.join(directory,'direct-export-sheet.json'),'utf8'));check('metadata references the selected-directory image',metadata.image==='direct-export-sheet.png');
 await open('export-aseprite');check('ASE export confirmation writes directly',await submit());const ase=await readFile(path.join(directory,'direct-export.aseprite'));check('ASE file has its native header',ase.readUInt16LE(4)===0xa5e0);
 await open('normal-map');check('normal-map confirmation writes directly',await submit());const normal=path.join(directory,'direct-export-normal.png');check('normal-map output is PNG',(await readFile(normal)).subarray(1,4).toString()==='PNG');
 const before=JSON.stringify(await record());await main.evaluate(`document.getElementById('status').textContent='';document.querySelector('[data-menu-command="quick-export"]').click()`);
 await wait(()=>main.evaluate(`!window.documentWindowAudit().busy&&document.getElementById('status').textContent.startsWith('导出完成')`),'quick export');check('quick export keeps its exact remembered path',JSON.stringify(await record())===before);
 check('invalid directory reports an error without choosing another path',!await ordinary('png','png',path.join(root,'missing')));check('failed export preserves remembered destination',JSON.stringify(await record())===before);await main.evaluate(`document.getElementById('error-dialog').close()`);
 const other=path.join(root,'wrong-image');await mkdir(other);await copyFile(png,path.join(other,'direct-export-sheet.png'));const json=path.join(other,'direct-export-sheet.json');await writeFile(json,'unchanged');
 check('metadata rejects mismatched PNG instead of opening a picker',!await ordinary('metadata','png',other));check('failed metadata export preserves existing JSON',(await readFile(json,'utf8'))==='unchanged');await main.evaluate(`document.getElementById('error-dialog').close()`);
 const empty=path.join(root,'empty');await mkdir(empty);check('metadata rejects a missing associated PNG without a picker',!await ordinary('metadata','png',empty));check('missing PNG leaves directory empty',(await readdir(empty)).length===0);await main.evaluate(`document.getElementById('error-dialog').close()`);
 const cancelled=main.evaluate(`window.desktop.save('eA==','png','cancelled',true,{directory:''})`);
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-Cancel'],{windowsHide:true,timeout:20000});check('empty directory still allows cancelling the native file picker',await cancelled===null);
 await main.evaluate(`document.getElementById('status').textContent='';document.querySelector('[data-menu-command="quick-export"]').click()`);
 await wait(()=>main.evaluate(`!window.documentWindowAudit().busy&&document.getElementById('status').textContent.startsWith('导出完成')`),'export after failures');check('export continues normally after invalid paths and cancellation',!await main.evaluate(`document.getElementById('error-dialog').open`));
 const audit=await main.evaluate('window.documentWindowAudit()');check('all exports preserve project history and saved state',audit.undo===0&&!audit.dirty);
 await main.screenshot(path.join(root,'complete.png'));await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results,root,logs},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,root}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'failure.json'),JSON.stringify({ok:false,results,error:error.stack,logs},null,2)+'\n');throw error;}
finally{main?.close();if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}}

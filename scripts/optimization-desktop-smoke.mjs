import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,addFrame} from '../src/model.js';
import {linkCels} from '../src/cel-links.js';
import {targets,connect} from './cdp.mjs';

const executable=path.resolve(process.argv[2]||'src-tauri/target/debug/minepix-tauri.exe'),root=path.resolve('artifacts/optimization-desktop'),directory=path.join(root,String(Date.now())),project=path.join(directory,'linked-indexed.pix');
await mkdir(directory,{recursive:true});
const document=createDocument(16,12,'linked-indexed');document.palette=['#00000000','#ff0000ff','#ff0000ff','#00ff00ff'];document.colorMode='indexed';document.transparentIndex=0;document.requiredFeatures=['color-modes'];document.frames[0].cels[0].fill(0xff0000ff);document.frames[0].indices=[Array(16*12).fill(2)];addFrame(document,0,true);linkCels(document,0,[0,1]);
await writeFile(project+'.json',JSON.stringify(document)+'\n');
await promisify(execFile)(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
let app,session,baseline;const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);}
const evaluate=code=>session.evaluate(code),audit=()=>evaluate('window.documentWindowAudit()'),command=id=>evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'A desktop debugger is already active');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).find(target=>target.type==='page'&&target.url.includes('tauri.localhost'));}catch{return false;}},'desktop');
 session=await connect((await targets()).find(target=>target.type==='page'&&target.url.includes('tauri.localhost')));
 await wait(()=>evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'document');
 baseline=await evaluate('Object.fromEntries(Object.entries(localStorage))');
 check('native indexed project opens with linked cel sharing',(await audit()).linked);
 check('native layer panel uses 32px preview',await evaluate("document.querySelector('#layers canvas.mini')?.width===32"));
 const before=await audit();
 await evaluate("(()=>{const el=document.getElementById('hex');el.value='#00ff00';el.dispatchEvent(new Event('change',{bubbles:true}));})()");
 const point=await evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*.5,y:r.y+z*.5};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(async()=>(await audit()).undo===before.undo+1,'paint history');check('native linked stroke commits with exact index',(await audit()).pixel===0x00ff00ff&&(await audit()).linked);
 await command('undo');check('native undo restores pixels and index',(await audit()).pixel===before.pixel&&(await audit()).indices[0]===2);
 await command('redo');check('native redo restores painted pixels',(await audit()).pixel===0x00ff00ff);await command('undo');
 const thumbs=await evaluate(`window.desktop.recentThumbs([${JSON.stringify(project)}])`);check('native recent preview keeps source dimensions',thumbs.length===1&&thumbs[0].size===32&&thumbs[0].width===16&&thumbs[0].height===12);
 const stamp=await evaluate(`window.desktop.recentFiles().then(entries=>entries.find(e=>e.path===${JSON.stringify(project)}).fileStamp)`);check('native recent metadata includes file fingerprint',typeof stamp==='string');
 await evaluate(`window.desktop.openRecent(${JSON.stringify(project)}).then(file=>{window.nativeOptimizationDocument=file.document;file.document.frames[1].indices[0]=file.document.frames[0].indices[0];})`);
 const queued=await evaluate(`(async()=>{
  const doc=window.nativeOptimizationDocument,id='optimization-native',save=revision=>window.desktop.saveRecovery({id,filePath:${JSON.stringify(project)},name:doc.name,dirty:true,revision,boardRevision:0,document:doc});
  doc.frames[0].indices[0][0]=1;const first=save(1);doc.frames[0].indices[0][0]=2;const middle=save(2);doc.frames[0].indices[0][1]=1;const latest=save(3);doc.frames[0].indices[0][1]=0;await Promise.all([first,middle,latest]);
  const restored=(await window.desktop.loadRecovery(id)).document;return{slots:[...restored.frames[0].indices[0].slice(0,2)],linked:restored.frames[0].links[1]===restored.frames[1].links[1]&&restored.frames[1].indices[0][1]===1,live:doc.frames[0].indices[0][1]};
 })()`);
 check('native recovery captures latest queued revision before later edits',queued.slots[0]===2&&queued.slots[1]===1&&queued.live===0&&queued.linked);
 await evaluate(`(async()=>{const doc=window.nativeOptimizationDocument;doc.frames[0].indices[0][0]=3;doc.frames[0].indices[0][1]=2;await window.desktop.saveProject(doc,doc.name,false,${JSON.stringify(project)},0);})()`);
 const after=await evaluate(`(async()=>{const doc=(await window.desktop.openRecent(${JSON.stringify(project)})).document;return{slots:[...doc.frames[0].indices[0].slice(0,2)],pixel:doc.frames[0].cels[0][0],linked:doc.frames[0].links[1]===doc.frames[1].links[1]&&doc.frames[1].indices[0][0]===3};})()`);
 check('native snapshot save preserves exact slots and links',after.slots[0]===3&&after.slots[1]===2&&after.pixel===0x00ff00ff&&after.linked);
 const refreshed=await evaluate(`window.desktop.recentFiles().then(entries=>entries.find(e=>e.path===${JSON.stringify(project)}).fileStamp)`);check('saving changes the native preview fingerprint',refreshed!==stamp);
 const updated=await evaluate(`window.desktop.recentThumbs([${JSON.stringify(project)}])`);check('native preview regenerates after save',updated[0].pixels!==thumbs[0].pixels);
 const state=await audit(),child=await evaluate(`window.desktop.detachDocument(${JSON.stringify(state.id)})`);await evaluate(`window.desktop.moveDocument(${JSON.stringify({owner:child,id:state.id,after:false})})`);
 await wait(async()=>(await audit()).id===state.id&&(await audit()).documents.length===1,'document roundtrip');check('native window roundtrip preserves typed history and linked indices',(await audit()).redo===state.redo&&(await audit()).linked);
 await evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);check('native discard is ordered after snapshot writes',await evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)}).then(value=>!value)`));
 check('no native error dialog',!await evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(path.join(root,'complete.png'));
}catch(error){results.push({name:'failure',pass:false,error:error.stack});process.exitCode=1;}
finally{
 if(session){
  try{await evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);if(baseline)await evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);}finally{session.close();}
 }
 if(app&&app.exitCode===null&&app.signalCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}
 const report={ok:!process.exitCode,results,executable,project};await writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}

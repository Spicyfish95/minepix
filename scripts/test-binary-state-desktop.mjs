import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,addFrame} from '../src/model.js';
import {convertColorMode} from '../src/color-modes.js';
import {linkCels} from '../src/cel-links.js';
import {targets,connect} from './cdp.mjs';
const exec=promisify(execFile),root=path.resolve('artifacts/binary-state-desktop',String(Date.now()));await mkdir(root,{recursive:true});
const project=path.join(root,'linked.pix'),profile=await mkdtemp(path.join(root,'webview-')),source=createDocument(4,3,'linked');source.frames[0].cels[0].fill(0xff0000ff);source.palette=['#00000000','#ff0000ff','#00ff00ff'];convertColorMode(source,'indexed',{palette:'current'});addFrame(source,0,true);linkCels(source,0,[0,1]);
await writeFile(project+'.json',JSON.stringify(source));await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[project],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}}),sessions=[],results=[];
const wait=async(test,label)=>{for(let i=0;i<250;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);};
const check=(name,pass)=>{assert.ok(pass,name);results.push({name,pass:true});};let main,child,recoveryId='architecture-'+Date.now();
const audit=session=>session.evaluate('window.documentWindowAudit()');
try{
 await wait(async()=>{try{const target=(await targets()).find(target=>target.type==='page'&&!/capture|panel/.test(target.url));if(target){main=await connect(target);sessions.push(main);return true;}}catch{return false;}},'editor');await wait(()=>main.evaluate('!!window.documentWindowAudit'),'ready');await wait(async()=>(await audit(main)).path===project,'source');
 const first={...structuredClone(source),references:[{id:'ref',name:'ref',width:1,height:1,path:path.join(root,'missing.png'),data:'/wAA/w==',x:0,y:0,scale:1}]},second=structuredClone(first);second.frames[0].cels[0][0]=0;second.frames[0].indices[0][0]=0;
 await main.evaluate(`window.desktop.saveRecovery({id:${JSON.stringify(recoveryId)},filePath:${JSON.stringify(project+'-recovery')},dirty:true,name:'first',document:${JSON.stringify(first)}})`);
 await main.evaluate(`window.desktop.saveRecovery({id:${JSON.stringify(recoveryId)},filePath:${JSON.stringify(project+'-recovery')},dirty:true,name:'second',document:${JSON.stringify(second)}})`);
 const recovered=await main.evaluate(`(async()=>{const current=await window.desktop.loadRecovery(${JSON.stringify(recoveryId)}),previous=await window.desktop.loadRecovery(${JSON.stringify(recoveryId)},true);return{current:current.document.frames[0].indices[0][0],previous:previous.document.frames[0].indices[0][0],reference:current.document.references[0]};})()`);
 check('binary recovery loads current and previous indexed snapshots',recovered.current===0&&recovered.previous===1);check('recovery reference is reloaded by path and missing source is explicit',!!recovered.reference.missing&&recovered.reference.data===undefined);
 const recoveryFolder=path.join(process.env.APPDATA,'com.minepix.tauri','recovery',recoveryId);const raw=await readFile(path.join(recoveryFolder,'current.recovery'));check('recovery on disk is a binary project container',raw.subarray(0,8).toString()==='MINEPIX\0');
 await main.evaluate(`(()=>{document.querySelector('#tools [data-tool="eraser"]').click();const canvas=document.getElementById('canvas'),r=canvas.getBoundingClientRect(),v=document.getElementById('viewport'),zoom=window.documentWindowAudit().zoom;v.setPointerCapture=()=>{};for(const type of['pointerdown','pointerup'])v.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+zoom/2,clientY:r.top+zoom/2,pointerId:15,button:0,buttons:type==='pointerdown'?1:0}));})()`);
 check('source edit produces linked indexed history',(await audit(main)).undo===1&&(await audit(main)).indices[0]===0&&(await audit(main)).linked);
 const id=(await audit(main)).id;let detachError;const detaching=main.evaluate(`window.desktop.detachDocument(${JSON.stringify(id)})`).catch(error=>{detachError=error;return null;});
 await wait(async()=>{if(detachError)throw detachError;const pages=(await targets()).filter(target=>target.type==='page'&&!/capture|panel/.test(target.url)&&target.id!==main.target.id);for(const page of pages){const session=await connect(page);try{if(await session.evaluate('!!window.documentWindowAudit')){child=session;sessions.push(child);return true;}}catch{}session.close();}},'child window');
 const label=await detaching;await wait(async()=>(await audit(child)).id===id,'adopt');check('detached window preserves links pixel edits and history',(await audit(child)).linked&&(await audit(child)).undo===1&&(await audit(child)).indices[0]===0);
 await child.evaluate('window.documentWindowUndo()');check('undo remains functional after binary migration',(await audit(child)).indices[0]===1&&(await audit(child)).redo===1);
 await child.evaluate(`document.querySelector('[data-menu-command="redo"]').click()`);check('redo remains functional after binary migration',(await audit(child)).indices[0]===0&&(await audit(child)).undo===1);
 await main.evaluate(`window.desktop.moveDocument({id:${JSON.stringify(id)},owner:${JSON.stringify(label)}})`);await wait(async()=>(await audit(main)).id===id,'return');check('returning to the main window keeps document and history',(await audit(main)).linked&&(await audit(main)).indices[0]===0&&(await audit(main)).undo===1);
 await main.evaluate('window.documentWindowUndo()');check('undo after roundtrip restores original indexed color',(await audit(main)).indices[0]===1);
 await main.evaluate(`window.desktop.saveRecovery({id:${JSON.stringify(recoveryId)},filePath:${JSON.stringify(project+'-recovery')},dirty:false})`);check('clean request removes binary recovery',await main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project+'-recovery')})`)===null);
 await main.screenshot(path.join(root,'complete.png'));await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,root}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'failure.json'),JSON.stringify({results,error:error.stack},null,2)+'\n');throw error;}
finally{if(main)try{await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project+'-recovery')})`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);}catch{}sessions.forEach(session=>session.close());if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}}

import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','frame-drag-'+Date.now()),project=path.join(directory,'帧拖动.pix'),root='artifacts/frame-drag-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(6,6,'帧拖动');source.layers=Array.from({length:3},(_,i)=>({id:i+1,name:'层'+(i+1),visible:true,locked:false,opacity:100}));
source.frames=Array.from({length:5},(_,f)=>({duration:120+f*20,cels:source.layers.map((_,l)=>{const pixels=Array(36).fill(0);pixels[l*6+f]=((40+f*35)<<24|(30+l*70)<<16|(20+f*10)<<8|255)>>>0;return pixels;})}));
source.tags=[{id:'walk',name:'行走',from:1,to:3,color:'#668fb7',direction:'reverse'}];
const model=path.join(directory,'source.json');await writeFile(model,JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',model,project],{windowsHide:true});
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};let app,session,baseline;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const selection=()=>session.evaluate("[...document.querySelectorAll('.frame-head.selected')].map(el=>+el.dataset.frame)");
async function readDocument(){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},label+'保存');const doc=await readDocument();await writeFile(root+'/'+label+'.json',JSON.stringify(doc)+'\n');return doc;}
async function point(f,part=.5){return session.evaluate(`(()=>{const el=document.querySelector('.frame-head[data-frame="${f}"]');el.scrollIntoView({block:'nearest',inline:'nearest'});const r=el.getBoundingClientRect();return{x:r.x+r.width*${part},y:r.y+r.height/2};})()`);}
async function frame(f,modifiers=0){const p=await point(f);await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1,modifiers});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1,modifiers});if(modifiers)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:modifiers===8?'Shift':'Control',code:modifiers===8?'ShiftLeft':'ControlLeft',modifiers:0});}
async function drag(from,to,after=false,cancel=false){
 const eventStart=session.events.length,start=await point(from),end=await point(to,after?.8:.2);
 await session.send('Input.setInterceptDrags',{enabled:true});
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...start,buttons:0});
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',buttons:1,clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+8,y:start.y,button:'left',buttons:1});
 const intercepted=await wait(()=>session.events.slice(eventStart).find(event=>event.method==='Input.dragIntercepted'),'浏览器拖动数据');
 const data=intercepted.params.data;assert.equal(data.items[0]?.mimeType,'text/plain');
 await session.send('Input.dispatchDragEvent',{type:'dragEnter',...end,data});await session.send('Input.dispatchDragEvent',{type:'dragOver',...end,data});
 check('真实拖动目标显示'+(after?'after':'before'),await session.evaluate(`document.querySelector('.frame-head[data-frame="${to}"]').dataset.drop===${JSON.stringify(after?'after':'before')}`));
 if(cancel){await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await session.send('Input.dispatchDragEvent',{type:'dragCancel',...end,data});await session.send('Input.cancelDragging');}
 else await session.send('Input.dispatchDragEvent',{type:'drop',...end,data});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',buttons:0,clickCount:1});await session.send('Input.setInterceptDrags',{enabled:false});
 await wait(()=>session.evaluate("document.querySelectorAll('.frame-head[data-drop]').length===0"),'拖放标记清理');
}
async function order(label,indices,tagFrom,tagTo){const doc=await saved(label);check(label+'全部层像素和时长随帧移动',same(doc.frames,indices.map(i=>source.frames[i])));check(label+'标签映射和层属性保持',same(doc.tags,[{...source.tags[0],from:tagFrom,to:tagTo}])&&same(doc.layers,source.layers));return doc;}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh');window.workspaceLayout.reveal('timeline');window.frameDragEvents=[];for(const type of ['dragstart','dragover','drop','dragend'])document.addEventListener(type,event=>{if(event.target.closest('.frame-head'))window.frameDragEvents.push({type,trusted:event.isTrusted,frame:event.target.closest('.frame-head').dataset.frame,effect:event.dataTransfer.dropEffect});},true)");
 await frame(1);await frame(2,8);const before=await audit();await drag(1,4,true);await order('continuous',[0,3,4,1,2],1,4);check('连续多帧拖后选中目标组且仅一条历史',same(await selection(),[3,4])&&(await audit()).undo===before.undo+1);await command('undo');check('连续拖动撤销还原全部帧',same((await saved('continuous-undone')).frames,source.frames));
 await frame(1);await frame(3,2);const disjoint=await audit();await drag(3,0);await order('disjoint',[1,3,0,2,4],0,3);check('离散多帧拖前保持组序且一条历史',same(await selection(),[0,1])&&(await audit()).undo===disjoint.undo+1);await command('undo');await saved('disjoint-undone');
 await frame(1);await frame(2,8);const unchanged=await audit();await drag(1,2,true);check('原位置放回不增加历史',(await audit()).undo===unchanged.undo);check('原位置放回内容不变',same((await saved('no-op')).frames,source.frames));
 await frame(1);const cancelled=await audit();await drag(1,4,true,true);check('Escape取消拖动不增加历史',(await audit()).undo===cancelled.undo);check('取消拖动保存内容不变',same((await saved('cancelled')).frames,source.frames));
 await frame(0);const single=await audit();await drag(3,0);await order('unselected',[3,0,1,2,4],0,3);check('拖动未选帧自动选中且仅移动该帧',same(await selection(),[0])&&(await audit()).undo===single.undo+1);await command('undo');check('取消后的后续拖放可正常撤销',same((await saved('final')).frames,source.frames));
 const events=await session.evaluate('window.frameDragEvents');await writeFile(root+'/events.json',JSON.stringify(events,null,2)+'\n');check('实际dragstart和drop来自可信浏览器输入',events.filter(e=>e.type==='dragstart').length===5&&events.filter(e=>e.type==='drop').length===4&&events.every(e=>e.trusted));check('最终无拖放标记和错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open&&document.querySelectorAll('.frame-head[data-drop]').length===0"));
 await session.screenshot(root+'/complete.png');await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session){await session.screenshot(root+'/failure.png');await writeFile(root+'/events.json',JSON.stringify(await session.evaluate('window.frameDragEvents'),null,2)+'\n');}await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.send('Input.setInterceptDrags',{enabled:false});await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

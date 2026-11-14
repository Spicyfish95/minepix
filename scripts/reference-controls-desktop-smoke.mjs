import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {addReference} from '../src/reference-board.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),root=path.resolve('artifacts/reference-controls-desktop');
const directory=path.resolve('../minepix-tauri-validation','reference-controls-'+Date.now()),project=path.join(directory,'参考控件.pix');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(8,8,'参考控件');source.frames[0].cels[0].fill(0x448844ff);
for(const[id,x,scale]of [['normal',48,1],['small',160,.25]])addReference(source,{id,name:id+'.png',width:24,height:16,data:Buffer.from(Array.from({length:24*16},()=>[40,80,210,255]).flat()).toString('base64'),x,y:80,scale});
await writeFile(project+'.json',JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const results=[],sessions=[],observed={};let app,main,child,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const frame=id=>`.reference-frame[data-reference-id="${id}"]`,image=id=>`.reference-image[data-reference-id="${id}"]`;
const audit=()=>main.evaluate('window.documentWindowAudit()');
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const s=await audit();return !s.dirty&&!s.busy;},label+'保存');const doc=await readDocument();await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
const point=(session,selector)=>session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
async function click(session,selector){const p=await point(session,selector);await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
async function confirm(session,accepted){await session.evaluate(`new Promise(resolve=>{const dlg=document.querySelector('dialog.reference-dialog');dlg.addEventListener('close',resolve,{once:true});dlg.querySelector('button[value=${accepted?'ok':'cancel'}]').click();}).then(()=>true)`);await wait(()=>session.evaluate("!document.querySelector('dialog.reference-dialog')"),'参考确认结束');}
async function inspect(session,id,label){
 const p=await point(session,frame(id)+' .reference-delete');await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
 const geometry=await session.evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(frame(id)+' .reference-delete')}),b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{button:{x:b.x,y:b.y,w:b.width,h:b.height},hit:hit?.closest('button')?.className,opacity:getComputedStyle(button).opacity,overlapping:[...button.parentNode.querySelectorAll('.reference-handle')].filter(el=>{const r=el.getBoundingClientRect();return Math.min(r.right,b.right)>Math.max(r.left,b.left)&&Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top);}).map(el=>el.className)};})()`);
 observed[label]=geometry;check(label+'删除按钮中心可实际命中',geometry.hit==='reference-delete');check(label+'删除按钮与角柄无重叠',geometry.overlapping.length===0);
 await wait(()=>session.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(frame(id)+' .reference-delete')})).opacity==='1'`),'删除按钮悬停显示');check(label+'悬停按钮保持可见',true);
}
async function cancelDelete(session,id,label){
 const before=await audit(),disk=await readDocument();await click(session,frame(id)+' .reference-delete');
 check(label+'可信删除按钮开启所属确认',await session.evaluate("!!document.querySelector('dialog.reference-dialog')?.open"));
 await session.screenshot(path.join(root,label+'-dialog.png'));await confirm(session,false);
 check(label+'取消不改变作品与状态',same(await audit(),before)&&same(await readDocument(),disk));
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'应用启动');
 main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));sessions.push(main);await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'作品载入');
 baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh');window.workspaceLayout.reveal('reference')");
 await inspect(main,'normal','main-normal');await cancelDelete(main,'normal','main-normal');
 const p=await point(main,image('normal'));await main.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await wait(()=>main.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(frame('normal')+' .reference-delete')})).opacity==='1'`),'图像悬停显示控件');check('悬停图像可发现删除控件',true);
 await inspect(main,'small','main-small');await cancelDelete(main,'small','main-small');
 const resize=await point(main,frame('normal')+' .reference-ne');await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...resize,button:'left',buttons:1,clickCount:1});for(let i=1;i<=4;i++)await main.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:resize.x+12*i/4,y:resize.y,button:'left',buttons:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:resize.x+12,y:resize.y,button:'left',buttons:0,clickCount:1});
 let doc=await saved('resized');check('真实右上缩放柄仍等比改变目标',doc.references[0].scale===1.5&&doc.references[1].scale===.25);check('缩放保存保持参考像素和作品帧层',doc.references[0].data===source.references[0].data&&same(doc.frames,source.frames)&&same(doc.layers,source.layers)&&(await audit()).undo===0);
 const selector=await main.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(name=>window.workspaceLayout.state().slots[name].includes('reference'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");await click(main,selector);
 await wait(async()=>{for(const target of(await targets()).filter(t=>t.url.endsWith('panel.html'))){const candidate=await connect(target);if(await candidate.evaluate("!!document.getElementById('reference-panel')")){child=candidate;sessions.push(child);return true;}candidate.close();}return false;},'原生参考子窗');
 await inspect(child,'small','floating-small');await cancelDelete(child,'small','floating-small');check('浮窗确认没有落到主窗',!await main.evaluate("!!document.querySelector('dialog.reference-dialog')"));
 await click(child,frame('small')+' .reference-delete');await confirm(child,true);doc=await saved('floating-deleted');check('子窗真实按钮确认仅删除小图并保存',doc.references.length===1&&doc.references[0].id==='normal'&&(await audit()).undo===0);await child.screenshot(path.join(root,'floating.png'));
 await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>main.evaluate("!window.workspaceLayout.floats.has('reference')"),'原生关闭回停靠');
 await inspect(main,'normal','docked-normal');await click(main,frame('normal')+' .reference-delete');await confirm(main,true);doc=await saved('final');
 check('停靠后真实按钮确认删除最后参考',!doc.references?.length&&await main.evaluate("document.querySelector('[data-reference-clear]').disabled"));
 check('全程作品像素与绘画历史保持',same(doc.frames,source.frames)&&same(doc.layers,source.layers)&&(await audit()).undo===0&&!await main.evaluate("document.getElementById('error-dialog').open"));await main.screenshot(path.join(root,'complete.png'));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,observed,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,directory,executable,error:error.stack},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate("for(const id of [...window.workspaceLayout.floats.keys()])window.workspaceLayout.dock(id,'left-top')");await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 for(const session of sessions)session.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP端口释放');
}

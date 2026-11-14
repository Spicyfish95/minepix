import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {addReference} from '../src/reference-board.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','reference-history-'+Date.now()),project=path.join(directory,'参考历史.pix'),root=path.resolve('artifacts/reference-history-desktop');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(8,8,'参考历史');source.frames[0].cels[0].fill(0x448844ff);
for(const[id,x,color]of [['warm',32,[220,60,40,255]],['cool',128,[40,80,210,255]]])addReference(source,{id,name:id+'.png',width:24,height:16,data:Buffer.from(Array.from({length:24*16},()=>color).flat()).toString('base64'),x,y:64,scale:1});
await writeFile(project+'.json',JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
let app,main,child,baseline;const sessions=[],results=[],observed={};
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()');
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const image=id=>`.reference-image[data-reference-id="${id}"]`;
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},label+'保存');const doc=await readDocument();await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
async function click(session,selector,button='left'){const p=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);await press(session,p,button);}
async function press(session,p,button='left'){await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button,buttons:button==='left'?1:2,clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button,buttons:0,clickCount:1});}
async function move(session,id,dx,dy){const p=await session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(image(id))}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,zoom:r.width/24};})()`);await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});for(let i=1;i<=4;i++)await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+dx*p.zoom*i/4,y:p.y+dy*p.zoom*i/4,button:'left',buttons:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+dx*p.zoom,y:p.y+dy*p.zoom,button:'left',buttons:0,clickCount:1});}
async function paint(){await main.evaluate("(()=>{for(const[id,value]of Object.entries({brush:1,'brush-shape':'square','paint-opacity':100,hex:'#abcdef'})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool=\"pencil\"]').click();})()");const p=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+r.width*.5/8,y:r.y+r.height*.5/8};})()");await press(main,p);check('可信画笔写入像素并生成绘画历史',(await audit()).undo===1&&(await audit()).pixel===0xabcdefff);}
async function history(action,undo,redo){await command(action);await wait(async()=>{const s=await audit();return s.undo===undo&&s.redo===redo;},action);}
async function confirm(session,accepted){await session.evaluate(`new Promise(resolve=>{const dlg=document.querySelector('dialog.reference-dialog');dlg.addEventListener('close',resolve,{once:true});dlg.querySelector('button[value=${accepted?'ok':'cancel'}]').click();}).then(()=>true)`);await wait(()=>session.evaluate("!document.querySelector('dialog.reference-dialog')"),'参考确认结束');}
async function remove(session,id){await click(session,image(id),'right');await click(session,'[data-menu-action="删除"]');await confirm(session,true);}
async function launch(){app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'应用启动');main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));sessions.push(main);await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');}
async function stop(){for(const session of sessions.splice(0))session.close();main=null;child=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP端口释放');}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');await launch();baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh');window.workspaceLayout.reveal('reference')");
 check('原生载入两张参考且作品未修改',await main.evaluate("document.querySelectorAll('.reference-image').length===2")&&!(await audit()).dirty);
 await paint();await move(main,'warm',32,16);let doc=await saved('moved-after-stroke');observed.moved=doc.references;check('画笔之后的参考移动真实保存',doc.references[0].x===64&&doc.references[0].y===80&&(await audit()).undo===1);
 await history('undo',0,1);doc=await saved('undo-old-stroke');observed.undone=doc.references;
 check('撤销旧画笔不移回之后编辑的参考',same(doc.references,observed.moved)&&same(doc.frames,source.frames));
 await move(main,'warm',8,0);const current=structuredClone(observed.moved);current[0].x=72;
 await history('redo',1,0);check('参考修改后重做不清除dirty',(await audit()).dirty&&(await audit()).pixel===0xabcdefff);
 const recovery=await wait(()=>main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`),'参考恢复副本');let restored;
 await wait(async()=>{restored=JSON.parse((await main.evaluate(`window.desktop.loadRecovery(${JSON.stringify(recovery.id)})`)).data);return same(restored.references,current)&&restored.frames[0].cels[0][0]===0xabcdefff;},'恢复内容与当前修改匹配');
 check('恢复保留新参考而磁盘仍是旧坐标',same(restored.references,current)&&same((await readDocument()).references,observed.moved));
 doc=await saved('redo-keeps-reference');check('重做后保存参考和画笔分别正确',same(doc.references,current)&&doc.frames[0].cels[0][0]===0xabcdefff);check('显式保存清理对应恢复',!await main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`));
 await remove(main,'warm');check('删除参考不进入绘画历史',(await audit()).undo===1&&await main.evaluate("document.querySelectorAll('.reference-image').length===1"));
 await history('undo',0,1);doc=await saved('deleted-undo');check('撤销画笔不复活已删除参考',doc.references.length===1&&doc.references[0].id==='cool'&&same(doc.frames,source.frames));
 await history('redo',1,0);doc=await saved('deleted-redo');check('重做画笔仍保持参考删除',doc.references.length===1&&doc.references[0].id==='cool'&&doc.frames[0].cels[0][0]===0xabcdefff);
 const png=path.join(directory,'新增参考.png'),base64=await main.evaluate("(()=>{const c=document.createElement('canvas');c.width=24;c.height=16;const ctx=c.getContext('2d');ctx.fillStyle='#25bb66';ctx.fillRect(0,0,24,16);return c.toDataURL('image/png').split(',')[1];})()");await writeFile(png,Buffer.from(base64,'base64'));
 await click(main,'#reference-panel [aria-label="导入图片"]');await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),'-FilePath',png],{windowsHide:true,timeout:20000});await wait(()=>main.evaluate("document.querySelectorAll('.reference-image').length===2"),'原生导入新增参考');doc=await saved('imported-after-stroke');const added=doc.references[1];check('旧绘画之后原生新增参考保存',added.name==='新增参考.png'&&added.width===24&&added.height===16);
 await history('undo',0,1);doc=await saved('imported-undo');check('撤销旧画笔不丢失后来导入参考',doc.references.length===2&&same(doc.references[1],added)&&same(doc.frames,source.frames));
 await history('redo',1,0);await command('add-layer');await wait(async()=>(await audit()).undo===2,'增加图层结构历史');await move(main,'cool',16,8);const withStructure=await saved('snapshot-reference');
 await history('undo',1,1);doc=await saved('snapshot-undo');check('撤销图层快照保留较新参考',doc.layers.length===1&&same(doc.references,withStructure.references));
 await history('redo',2,0);doc=await saved('snapshot-redo');check('重做图层快照保留较新参考',doc.layers.length===2&&same(doc.references,withStructure.references));
 const selector=await main.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(name=>window.workspaceLayout.state().slots[name].includes('reference'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");await click(main,selector);
 await wait(async()=>{for(const target of(await targets()).filter(t=>t.url.endsWith('panel.html'))){const s=await connect(target);if(await s.evaluate("!!document.getElementById('reference-panel')")){child=s;sessions.push(s);return true;}s.close();}return false;},'参考原生浮窗');await move(child,'cool',8,8);doc=await saved('floating-move');const floating=doc.references;
 await history('undo',1,1);doc=await saved('floating-history');check('浮窗编辑也不被主窗结构撤销覆盖',doc.layers.length===1&&same(doc.references,floating)&&await child.evaluate("document.querySelectorAll('.reference-image').length===2"));await child.screenshot(path.join(root,'floating.png'));
 await click(child,'[data-reference-clear]');await confirm(child,true);await history('undo',0,2);doc=await saved('cleared-history');check('浮窗清空后撤销旧绘画不复活参考',!doc.references?.length&&same(doc.frames,source.frames));
 await history('redo',1,1);await history('redo',2,0);doc=await saved('cleared-redo');check('重做绘画及结构后参考仍为空',!doc.references?.length&&doc.layers.length===2&&doc.frames[0].cels[0][0]===0xabcdefff);
 await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>main.evaluate("!window.workspaceLayout.floats.has('reference')"),'回停靠');check('回停靠后参考空态正确',await main.evaluate("document.querySelector('[data-reference-clear]').disabled&&document.querySelectorAll('.reference-image').length===0"));
 check('结束没有错误对话框',!await main.evaluate("document.getElementById('error-dialog').open"));await main.screenshot(path.join(root,'complete.png'));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,observed,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate("for(const id of [...window.workspaceLayout.floats.keys()])window.workspaceLayout.dock(id,'left-top')");await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 await stop();
}

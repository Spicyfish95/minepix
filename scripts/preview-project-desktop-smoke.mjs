import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {toTileset} from '../src/tilemap.js';
import {resizePreviewTerrain} from '../src/terrain-preview.js';
import {PREVIEW_SETTINGS_KEY} from '../src/preview-settings.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve('artifacts/preview-project-desktop'),dirtyOnly=process.argv.includes('--dirty-only');
const historyOnly=process.argv.includes('--history-only');
const directory=path.resolve('../minepix-tauri-validation','preview-project-'+Date.now()),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe');
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});
const sources={},files={};
for(const[name,size]of Object.entries({A:[3,2],B:[5,4],C:null})){
 const doc=createDocument(8,8,'预览 '+name);doc.frames[0].cels[0].fill(0x448844ff);toTileset(doc,0,{w:8,h:8});doc.requiredFeatures=['tileset'];
 doc.layers[0].tileset.terrains=[{id:0,name:'草地',color:'#66c266'}];doc.layers[0].tileset.tiles[0]={terrain:0,peering:Array(8).fill(0),weight:1};
 if(size)doc.previewTerrain={layerId:doc.layers[0].id,w:size[0],h:size[1],cells:Array.from({length:size[0]*size[1]},(_,i)=>i%2?-1:0)};
 sources[name]=doc;files[name]=path.join(directory,'预览 '+name+'.pix');const model=files[name]+'.json';await writeFile(model,JSON.stringify(doc)+'\n');
 await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',model,files[name]],{windowsHide:true});
}
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,main,child,baseline,observed;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()');
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const readDocument=file=>main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(file)}))).data);})()`);
const view=(session=main)=>session.evaluate("(()=>{const c=document.querySelector('.terrain-preview-canvas');return{w:c.width,h:c.height,cols:+document.querySelector('.terrain-preview-cols').value,rows:+document.querySelector('.terrain-preview-rows').value};})()");
const defaults=()=>main.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PREVIEW_SETTINGS_KEY)}))`);
async function launch(args=[]){
 app=spawn(executable,args,{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'应用就绪');
 if(args.length)await wait(()=>main.evaluate(`window.documentWindowAudit().path===${JSON.stringify(args[0])}`),'启动项目');
}
async function stop(){
 child?.close();child=null;main?.close();main=null;
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次进程退出');}app=null;
 await wait(async()=>{try{await targets();return false;}catch{return true;}},'本次调试端口释放');
}
async function open(name){
 const job=exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-file-dialog.ps1'),'-ProcessId',String(app.pid),'-FilePath',files[name]],{windowsHide:true});
 await command('open');await job;await wait(()=>main.evaluate(`window.documentWindowAudit().path===${JSON.stringify(files[name])}&&!window.documentWindowAudit().busy`),'打开'+name);
 await main.evaluate("window.workspaceLayout.reveal('terrain-preview')");
}
async function saved(name,label){await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},'保存'+label);const doc=await readDocument(files[name]);await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
async function resize(cols,rows,session=main){await session.evaluate(`(()=>{const c=document.querySelector('.terrain-preview-cols'),r=document.querySelector('.terrain-preview-rows');c.value=${cols};r.value=${rows};c.dispatchEvent(new Event('change',{bubbles:true}));c.blur();r.blur();})()`);}
async function press(session,p){await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
async function tab(name){const p=await main.evaluate(`(()=>{const e=[...document.querySelectorAll('.document-tab [role=tab]')].find(e=>e.title===${JSON.stringify(files[name])}),r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await press(main,p);await wait(()=>main.evaluate(`window.documentWindowAudit().path===${JSON.stringify(files[name])}`),'切换'+name);}
async function paintCanvas(){
 await main.evaluate("(()=>{for(const[id,value]of Object.entries({brush:1,'brush-shape':'square','paint-opacity':100,hex:'#abcdef'})){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool=\"pencil\"]').click();})()");
 const p=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+r.width*.5/8,y:r.y+r.height*.5/8};})()");await press(main,p);
 check('可信画笔确实生成独立绘画历史',(await audit()).undo===1&&(await audit()).pixel===0xabcdefff);
}
async function paintAndUndo(){
 await paintCanvas();
 await command('undo');await wait(async()=>(await audit()).undo===0&&(await audit()).redo===1,'撤销画笔');
 const state=await audit();observed={...observed,afterUndo:state};check('撤销画笔后预览修改仍保持置脏',state.dirty&&state.pixel===sources.A.frames[0].cels[0][0]);
}
async function paintPreview(col,row){const p=await main.evaluate(`(()=>{const r=document.querySelector('.terrain-preview-canvas').getBoundingClientRect(),cols=+document.querySelector('.terrain-preview-cols').value,rows=+document.querySelector('.terrain-preview-rows').value;return{x:r.x+(${col}+.5)*r.width/cols,y:r.y+(${row}+.5)*r.height/rows};})()`);await press(main,p);}
async function detach(){
 const selector=await main.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(key=>window.workspaceLayout.state().slots[key].includes('terrain-preview'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");
 const p=await main.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await press(main,p);
 await wait(async()=>{for(const target of(await targets()).filter(t=>t.url.endsWith('panel.html'))){const candidate=await connect(target);if(await candidate.evaluate("!!document.getElementById('terrain-preview-panel')")){child=candidate;return true;}candidate.close();}return false;},'地形预览子窗');
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');await launch();baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');
 const preset=dirtyOnly||historyOnly?{cols:3,rows:2}:{cols:7,rows:5};
 await main.evaluate(`localStorage.setItem(${JSON.stringify(PREVIEW_SETTINGS_KEY)},${JSON.stringify(JSON.stringify(preset))});window.minepixLocale.set('zh');window.workspaceLayout.reset()`);
 const loader=(await main.send('Page.getFrameTree')).frameTree.frame.loaderId;await main.send('Page.reload');await wait(async()=>(await main.send('Page.getFrameTree')).frameTree.frame.loaderId!==loader,'页面重新加载');await wait(async()=>{try{return await main.evaluate('!!window.documentWindowAudit&&!!window.desktop');}catch{return false;}},'重新读取本机默认');await open('A');observed={loaded:await view(),audit:await audit(),preset};
 if(historyOnly){
  await paintCanvas();await paintPreview(1,0);check('真实预览绘制已保存到目标格',(await saved('A','history-painted')).previewTerrain.cells[1]===0);
  await command('undo');await wait(async()=>(await audit()).undo===0,'撤销早先画笔');const doc=await saved('A','history-undone');check('撤销较早画笔不删除之后编辑的预览格',doc.previewTerrain.cells[1]===0&&same(doc.frames,sources.A.frames));
 }
 else if(dirtyOnly){await resize(7,5);await paintAndUndo();}
 else{
  let doc=await saved('A','opened-saved');check('不同本机默认下打开保存保留项目网格和格子',same(doc.previewTerrain,sources.A.previewTerrain));
  check('输入框与画布显示作品尺寸且默认设置保持',same(await view(),{w:24,h:16,cols:3,rows:2})&&same(await defaults(),preset));
  check('打开保存不改作品像素规则和绘画历史',same(doc.frames,sources.A.frames)&&same(doc.layers,sources.A.layers)&&!(await audit()).dirty&&(await audit()).undo===0);
  await resize(3,2);check('输入作品原尺寸不置脏也不改本机默认',!(await audit()).dirty&&same(await defaults(),preset));
  await resize(7,5);check('改到与本机默认相同尺寸仍重采样作品',(await audit()).dirty&&same(await view(),{w:56,h:40,cols:7,rows:5}));
  let expected=resizePreviewTerrain(sources.A.previewTerrain,7,5);await paintAndUndo();
  const recovery=await wait(()=>main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(files.A)})`),'预览独立修改恢复');const restored=JSON.parse((await main.evaluate(`window.desktop.loadRecovery(${JSON.stringify(recovery.id)})`)).data);
  check('绘画撤销后恢复保留预览而磁盘仍是旧尺寸',same(restored.previewTerrain,expected)&&same(restored.frames,sources.A.frames)&&same((await readDocument(files.A)).previewTerrain,sources.A.previewTerrain));
  doc=await saved('A','resized-A');check('预览修改单独保存且绘画像素保持',same(doc.previewTerrain,expected)&&same(doc.frames,sources.A.frames));
  await command('redo');await wait(async()=>(await audit()).undo===1,'重做旧画笔');await paintPreview(3,0);expected.cells[3]=0;check('旧历史之后真实预览绘制保存正确',(await saved('A','preview-after-history')).previewTerrain.cells[3]===0);await command('undo');await wait(async()=>(await audit()).undo===0,'撤销旧画笔');doc=await saved('A','preview-history-preserved');check('撤销旧绘画保留之后编辑的预览内容',same(doc.previewTerrain,expected)&&same(doc.frames,sources.A.frames));
  await open('B');doc=await saved('B','opened-B');check('第二作品显示并保存自己的尺寸',same(doc.previewTerrain,sources.B.previewTerrain)&&same(await view(),{w:40,h:32,cols:5,rows:4}));
  await resize(4,3);const expectedB=resizePreviewTerrain(sources.B.previewTerrain,4,3);check('第二作品调整尺寸保存正确',same((await saved('B','resized-B')).previewTerrain,expectedB));
  await tab('A');check('真实切回第一作品不按第二作品默认重采样',same(await view(),{w:56,h:40,cols:7,rows:5})&&same((await saved('A','switched-A')).previewTerrain,expected));
  await open('C');check('无作品预览时采用本机默认',same(await view(),{w:32,h:24,cols:4,rows:3}));await resize(6,4);doc=await saved('C','default-only-C');check('无预览尺寸设置只改偏好不写作品预览',!doc.previewTerrain&&!(await audit()).dirty&&(await audit()).undo===0&&same(await defaults(),{cols:6,rows:4}));
  await tab('A');check('修改新预览默认不影响已有作品',same(await view(),{w:56,h:40,cols:7,rows:5}));await detach();check('原生预览子窗显示作品尺寸',same(await view(child),{w:56,h:40,cols:7,rows:5}));
  await resize(8,3,child);expected=resizePreviewTerrain(expected,8,3);doc=await saved('A','floating-A');check('子窗修改网格经主窗保存保持像素',same(doc.previewTerrain,expected)&&same(doc.frames,sources.A.frames));await child.screenshot(path.join(root,'floating.png'));
  await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>main.evaluate("!window.workspaceLayout.floats.has('terrain-preview')"),'原生关闭回停靠');child.close();child=null;check('回停靠保持实际作品尺寸',same(await view(),{w:64,h:24,cols:8,rows:3}));
  const beforeRestart=await readFile(files.A);await main.evaluate(`localStorage.setItem(${JSON.stringify(PREVIEW_SETTINGS_KEY)},JSON.stringify({cols:9,rows:6}))`);await stop();await launch([files.A]);await main.evaluate("window.workspaceLayout.reveal('terrain-preview')");
  check('重启后不同本机默认仍显示已存作品尺寸',same(await view(),{w:64,h:24,cols:8,rows:3})&&!(await audit()).dirty&&(await audit()).undo===0&&same(await defaults(),{cols:9,rows:6}));
  check('重启再保存预览及整个二进制逐字节保持',same((await saved('A','restarted-A')).previewTerrain,expected)&&(await readFile(files.A)).equals(beforeRestart));
  await resize(0,3);check('非法尺寸报错并恢复作品输入值',await main.evaluate("document.getElementById('error-dialog').open")&&same(await view(),{w:64,h:24,cols:8,rows:3})&&!(await audit()).dirty&&(await readFile(files.A)).equals(beforeRestart));
  const p=await main.evaluate("(()=>{const r=document.querySelector('#error-dialog button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");await press(main,p);check('验证结束无残留错误且其他项目保持',!await main.evaluate("document.getElementById('error-dialog').open")&&same((await readDocument(files.B)).previewTerrain,expectedB)&&!(await readDocument(files.C)).previewTerrain);await main.screenshot(path.join(root,'complete.png'));
 }
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,dirtyOnly,historyOnly,results,observed,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,dirtyOnly,historyOnly}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,dirtyOnly,historyOnly,results,observed,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate("for(const id of [...window.workspaceLayout.floats.keys()])window.workspaceLayout.dock(id,'right-bottom')");await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of Object.values(files)){await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 await stop();
}

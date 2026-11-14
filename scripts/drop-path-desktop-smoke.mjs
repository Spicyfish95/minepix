import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {sheetMetadata} from '../src/timeline-commands.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),probe=process.argv.includes('--probe'),executable=path.resolve(process.argv.slice(2).find(arg=>arg.endsWith('.exe'))||`src-tauri/target/${probe?'debug':'release'}/minepix-tauri.exe`);
const root=path.resolve(process.env.MINEPIX_DROP_PATH_ROOT||'artifacts/drop-path-desktop',probe?'probe':'formal'),directory=path.resolve('../minepix-tauri-validation','drop-path-'+Date.now());
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});
const seed=path.join(directory,'已有项目.pix'),dropped=path.join(directory,'拖入 中文作品.pix'),created=[seed,dropped],source=createDocument(4,3,'拖入 中文作品');
source.frames[0].cels[0]=Array.from({length:12},(_,i)=>i%2?0x228844ff:0x441188ff);source.frames[0].duration=75;
source.frames.push({duration:125,cels:[Array.from({length:12},(_,i)=>i%2?0x1166bbff:0xdd7722ff)]});
source.tags=[{id:'walk',name:'行走',color:'#336699',from:0,to:1,direction:'reverse'}];
for(const [doc,file]of [[createDocument(8,8,'已有项目'),seed],[source,dropped]]){
 const input=file+'.json';await writeFile(input,JSON.stringify(doc)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',input,file],{windowsHide:true});
}
const results=[],observed={drops:[]},check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};let app,session,baseline,paintCount=0,child;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const readDocument=file=>session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(file)}))).data);})()`);
async function point(selector,context=session){return context.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);}
async function click(selector,context=session){const p=await point(selector,context);for(const type of ['mousePressed','mouseReleased'])await context.send('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function drop(files,selector='#viewport',context=session){
 await context.evaluate("window.pathDropEvidence=null;document.addEventListener('drop',event=>window.pathDropEvidence={trusted:event.isTrusted,names:[...event.dataTransfer.files].map(file=>file.name)},{once:true,capture:true})");
 const p=await point(selector,context),data={items:[],files,dragOperationsMask:1};for(const type of ['dragEnter','dragOver','drop'])await context.send('Input.dispatchDragEvent',{type,...p,data});
 observed.drops.push(await context.evaluate('window.pathDropEvidence'));
}
async function cancel(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.querySelector('#modal .modal-actions [value=cancel]').click();}).then(()=>true)");}
async function submit(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'));}).then(()=>true)");}
async function start(){
 app=spawn(executable,[seed],{cwd:directory,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.stderr.on('data',data=>{observed.stderr=(observed.stderr||'')+data.toString();});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.type==='page');}catch{return false;}},'应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(seed)}`),'已有作品');
}
async function stop(){session?.close();session=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次进程退出');}await wait(async()=>{try{await targets();return false;}catch{return true;}},'调试端口释放');}
async function paint(){
 const color=paintCount++?'#fedcba':'#abcdef';
 await session.evaluate(`(()=>{for(const[id,value]of Object.entries({brush:1,'brush-shape':'square','paint-opacity':100,hex:${JSON.stringify(color)}})){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool="pencil"]').click();})()`);
 const p=await point('#canvas');for(const type of ['mousePressed','mouseReleased'])await session.send('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
 await wait(async()=>(await audit()).dirty,'真实绘画');
}
async function saveNew(name){
 const file=path.join(directory,name+'.pix');created.push(file);
 await command('save');await exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-file-dialog.ps1'),'-ProcessId',String(app.pid),'-FilePath',file],{windowsHide:true});
 await wait(async()=>{const s=await audit();return s.path===file&&!s.dirty&&!s.busy;},name+'另存');return readDocument(file);
}
function imported(name,doc){check(name+'保留尺寸与两帧全部像素',doc.width===4&&doc.height===3&&same(doc.frames.map(frame=>frame.cels),source.frames.map(frame=>frame.cels)));check(name+'保留完整时长与标签方向',same(doc.frames.map(frame=>frame.duration),[75,125])&&doc.tags.length===1&&doc.tags[0].name==='行走'&&doc.tags[0].direction==='reverse'&&doc.tags[0].from===0&&doc.tags[0].to===1);}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');
 await start();baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh')");
 const initial=await audit(),original=await readFile(dropped);await drop([dropped]);await wait(async()=>(await audit()).path===dropped,'PIX保留原磁盘路径');
 check('真实File拖入经Rust绑定原中文空格路径',(await audit()).documents.length===initial.documents.length+1&&!(await audit()).dirty);
 check('真实文件路径读取保留全部源文档',same((await readDocument(dropped)).frames,source.frames));
 if(!probe){
  await paint();const edited=await audit();await wait(()=>session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(dropped)})`),'产品定时恢复');
  const recovery=await session.evaluate(`(async()=>{const record=await window.desktop.recoveryForPath(${JSON.stringify(dropped)});return window.desktop.loadRecovery(record.id);})()`);
  check('真实绘画按拖入原路径产生恢复副本',recovery.filePath===dropped&&!same(JSON.parse(recovery.data).frames,source.frames)&&(await readFile(dropped)).equals(original));
  await drop([dropped]);await new Promise(resolve=>setTimeout(resolve,400));
  check('重复拖入已打开PIX保留未保存文档和历史',same(await audit(),edited));
  await command('save');await wait(async()=>!(await audit()).dirty,'原路径保存');const saved=await readDocument(dropped);
  check('保存沿用拖入路径实际写入新像素',(await audit()).path===dropped&&!same(saved.frames,source.frames)&&!(await readFile(dropped)).equals(original));
  check('原路径保存清除对应恢复副本',!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(dropped)})`));
  await paint();await wait(()=>session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(dropped)})`),'第二次定时恢复');await stop();await start();
  await session.evaluate("window.minepixLocale.set('zh')");await drop([dropped]);
  await wait(()=>session.evaluate("document.getElementById('modal').open&&document.getElementById('modal-title').textContent==='恢复未保存内容？'"),'原路径恢复询问');
  check('异常终止重启后拖入原路径实际询问恢复',(await audit()).path===dropped);
  await cancel();await wait(async()=>!await session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(dropped)})`),'取消恢复清理');
  check('取消恢复保留上次原路径已存文档',same((await readDocument(dropped)).frames,saved.frames)&&!(await audit()).dirty);
  const pngs=await session.evaluate(`(()=>{const doc=${JSON.stringify(source)},canvas=document.createElement('canvas');canvas.width=4;canvas.height=3;const cx=canvas.getContext('2d');return doc.frames.map(frame=>{const rgba=Uint8ClampedArray.from(frame.cels[0].flatMap(p=>[p>>>24,p>>>16&255,p>>>8&255,p&255]));cx.putImageData(new ImageData(rgba,4,3),0,0);return canvas.toDataURL('image/png').split(',')[1];});})()`);
  for(let i=0;i<pngs.length;i++)await writeFile(path.join(directory,`帧 ${i}.png`),Buffer.from(pngs[i],'base64'));
  const sequence=path.join(directory,'序列 中文.json');await writeFile(sequence,JSON.stringify({format:'pixel-studio-png-sequence',version:1,width:4,height:3,tags:source.tags,frames:source.frames.map((frame,i)=>({file:`帧 ${i}.png`,duration:frame.duration,sourceIndex:i}))})+'\n');
  const sheetPng=await session.evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=3;const cx=canvas.getContext('2d');for(const [i,png]of ${JSON.stringify(pngs)}.entries()){const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/png;base64,'+png;});cx.drawImage(image,i*4,0);}return canvas.toDataURL('image/png').split(',')[1];})()`);
  await writeFile(path.join(directory,'图集 图片.png'),Buffer.from(sheetPng,'base64'));const sheet=path.join(directory,'图集 中文.json');await writeFile(sheet,JSON.stringify({...sheetMetadata(source,[0,1],2,1),image:'图集 图片.png'})+'\n');
  const preview=kind=>wait(()=>session.evaluate(`document.getElementById('modal').open&&document.getElementById('modal-title').textContent===${JSON.stringify(kind==='sequence'?'导入 PNG 序列':'导入精灵表 JSON')}`),'清单预览');
  for(const [file,kind,name]of [[sequence,'sequence','序列拖入'],[sheet,'sheet','图集拖入']]){
   const before=await audit();await drop([file]);await preview(kind);await cancel();check(name+'取消保持原文档和历史',same(await audit(),before));
   await drop([file]);await preview(kind);await submit();await wait(async()=>{const s=await audit();return s.id!==before.id&&s.dirty&&!s.path&&!s.busy;},name+'导入');imported(name,await saveNew(name));
  }
  const before=await audit();await drop([sequence,sheet]);await preview('sequence');await cancel();await preview('sheet');await cancel();
  check('两种清单同次拖入按顺序预览且取消不新增作品',same(await audit(),before));
  const invalid=path.join(directory,'无效清单.json');await writeFile(invalid,JSON.stringify({...sheetMetadata(source,[0,1],2,1),image:'../outside.png'})+'\n');
  await drop([invalid]);await wait(()=>session.evaluate("document.getElementById('error-dialog').open"),'依赖越界错误');
  check('无效依赖拖入保留当前文档历史',same(await audit(),before));await click('#error-dialog .primary');
  await session.evaluate("window.workspaceLayout.reveal('reference')");
  const detach=await session.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(name=>window.workspaceLayout.state().slots[name].includes('reference'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");
  await click(detach);await wait(()=>session.evaluate("window.workspaceLayout.floats.has('reference')"),'原生参考浮窗');
  await wait(async()=>{for(const target of(await targets()).filter(target=>target.url.endsWith('panel.html'))){const candidate=await connect(target);if(await candidate.evaluate("!!document.getElementById('reference-panel')")){child=candidate;return true;}candidate.close();}return false;},'参考子WebView');
  await drop([path.join(directory,'帧 0.png')],'#reference-panel .reference-viewport',child);
  await wait(()=>child.evaluate("document.querySelectorAll('.reference-image').length===1"),'子窗File引用');
  check('真实参考浮窗File可跨窗口取得本地路径',(await audit()).documents.length===before.documents.length&&(await audit()).id===before.id&&(await audit()).undo===before.undo);
  await command('save');await wait(async()=>!(await audit()).dirty,'子窗拖入后保存');const reference=await readDocument((await audit()).path);
  check('子窗参考拖入经Rust持久化完整原图',reference.references.length===1&&reference.references[0].width===4&&reference.references[0].height===3&&same([...Buffer.from(reference.references[0].data,'base64')],source.frames[0].cels[0].flatMap(p=>[p>>>24,p>>>16&255,p>>>8&255,p&255])));
  await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>session.evaluate("!window.workspaceLayout.floats.has('reference')"),'参考回停靠');child.close();child=null;
  check('所有磁盘FileList拖入事件均可信',observed.drops.length===10&&observed.drops.every(event=>event?.trusted)&&observed.drops.some(event=>event.names.length===2));
  check('正式包最终没有错误或导入弹窗',await session.evaluate("!document.getElementById('error-dialog').open&&!document.getElementById('modal').open"));
 }
 await session.screenshot(path.join(root,'complete.png'));
 const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,probe,results,observed,directory,executable,executableSha256},null,2)+'\n');console.log(JSON.stringify({ok:true,probe,passed:results.length}));
}catch(error){if(session)await session.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,probe,results,observed,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 child?.close();
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of created){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 await stop();
}

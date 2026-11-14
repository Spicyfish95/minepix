import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
const exec=promisify(execFile),root=path.resolve('artifacts/capture-desktop'),port=9223,results=[],sessions=[];
await mkdir(root,{recursive:true});
const profile=await mkdtemp(path.join(root,'webview-'));
await copyFile('src/assets/app-icon.png',path.join(root,'one.png'));await copyFile('src/assets/app-icon.png',path.join(root,'two.png'));
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail?{detail}:{})});assert.ok(pass,name);};
const wait=async(test,label)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);};
const executable=path.resolve(process.env.MINEPIX_TEST_EXE||'src-tauri/target/debug/minepix-tauri.exe');
const app=spawn(executable,[],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
let main;
let logs='';
app.stdout.on('data',bytes=>{logs+=bytes;});app.stderr.on('data',bytes=>{logs+=bytes;});
app.on('error',error=>{logs+=error.stack;});
const clipboard=async mode=>(await exec('powershell.exe',['-NoProfile','-STA','-File','scripts/clipboard-fixture.ps1','-Mode',mode,'-Directory',root],{windowsHide:true})).stdout;
const captureWindow=async(mode='inspect')=>JSON.parse((await exec('powershell.exe',['-NoProfile','-File','scripts/capture-window-fixture.ps1','-ProcessId',String(app.pid),'-Mode',mode],{windowsHide:true})).stdout);
const moveCursor=async screen=>exec('powershell.exe',['-NoProfile','-File','scripts/capture-window-fixture.ps1','-Mode','move','-X',String(screen.x+Math.floor(screen.width/2)),'-Y',String(screen.y+Math.floor(screen.height/2))],{windowsHide:true});
const captureInfo=session=>session.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureMonitor',args:[]})");
const inactive=session=>session.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureActive',args:[]}).then(active=>!active)");
const click=async(session,x,y,count=1)=>{
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:count});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:count});
};
const escape=session=>session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
async function capture(){
 await main.evaluate('window.desktop.captureScreen()');
 const target=await wait(async()=>{try{return(await targets(port)).find(t=>t.url.includes('capture.html'));}catch{return false;}},'截图窗口');
 const session=await connect(target);sessions.push(session);
 await wait(()=>session.evaluate("!!document.querySelector('.capture-selection')"),'截图界面就绪');return session;
}
async function paste(session){
 const p=await session.evaluate("(()=>{const r=document.querySelector('#reference-panel .reference-viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
 await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV',modifiers:2});
 await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV',modifiers:2});
}
try{
 const target=await wait(async()=>{try{return(await targets(port)).find(t=>t.type==='page'&&/^(http:\/\/tauri\.localhost|tauri:)/.test(t.url)&&!t.url.includes('panel.html')&&!t.url.includes('capture.html'));}catch{return false;}},'主窗口');
 main=await connect(target);sessions.push(main);await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.workspaceLayout'),'编辑器就绪');
 check('启动无项目可使用截图',await main.evaluate('window.documentWindowAudit().documents.length===0'));
 await clipboard('image');
 const before=await main.evaluate('window.desktop.clipboardImages()');
 const cancel=await capture();
 check('进入仅待选并显示准星提示',await cancel.evaluate("document.querySelector('.capture-selection').hidden&&document.querySelector('.capture-toolbar').hidden&&!document.querySelector('.capture-hint').hidden&&getComputedStyle(document.body).cursor==='crosshair'"));
 await escape(cancel);
 await wait(()=>inactive(cancel),'取消截图');
 await cancel.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureReady',args:[]})");
 check('取消后预载窗口隐藏并复用',!(await captureWindow()).visible&&(await targets()).filter(t=>t.url.includes('capture.html')).length===1);
 check('取消保留原系统剪贴板',JSON.stringify(await main.evaluate('window.desktop.clipboardImages()'))===JSON.stringify(before));
 // Observe the real startup HWND without changing visibility outside Tauri's state.
 const watcher=spawn('powershell.exe',['-NoProfile','-File','scripts/capture-window-fixture.ps1','-ProcessId',String(app.pid),'-Mode','watch'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let timeline='',watchErrors='';
 watcher.stdout.on('data',bytes=>{timeline+=bytes;});watcher.stderr.on('data',bytes=>{watchErrors+=bytes;});
 const watched=new Promise((resolve,reject)=>{watcher.on('error',reject);watcher.on('exit',code=>code===0?resolve():reject(new Error(watchErrors)));});
 await wait(()=>timeline.includes('watching'),'原生窗口观察器启动');
 const captureStarted=Date.now(),readiness=await capture();await watched;
 const firstVisible=JSON.parse(timeline.trim().split(/\r?\n/).at(-1));
 firstVisible.modeEntryMs=firstVisible.visibleAt-captureStarted;
 check('真实截图窗口经历隐藏准备后才显示',firstVisible.visible&&firstVisible.hiddenSamples>0,firstVisible);
 await wait(async()=>{const state=await captureWindow();return state.visible&&state.focused;},'就绪后显示聚焦');
 check('真实渲染就绪后显示聚焦且保持待选',await readiness.evaluate("document.querySelector('.capture-image').tagName==='CANVAS'&&document.querySelector('.capture-selection').hidden&&document.querySelector('.capture-toolbar').hidden&&!document.querySelector('.capture-hint').hidden"));
 const initial=await captureInfo(readiness);
 check('原生截图窗口仅覆盖鼠标所在显示器',JSON.stringify(await readiness.evaluate("({width:document.querySelector('canvas').width,height:document.querySelector('canvas').height})"))===JSON.stringify({width:initial.screen.width,height:initial.screen.height}),initial);
 if(initial.screens.length>1){
  const other=initial.screens.find((screen,index)=>index!==initial.index);
  await moveCursor(other);
  let moved;
  try{await wait(async()=>{moved=await captureWindow();return moved.visible&&moved.x===other.x&&moved.y===other.y&&moved.width===other.width&&moved.height===other.height;},'移动到另一显示器');}
  catch(error){throw new Error(error.message+' '+JSON.stringify({native:moved,page:await readiness.evaluate("({width:document.querySelector('canvas')?.width,height:document.querySelector('canvas')?.height,visibility:document.visibilityState,text:document.body.innerText})")}));}
  await wait(()=>readiness.evaluate(`document.querySelector('canvas').width===${other.width}&&document.querySelector('canvas').height===${other.height}`),'另一显示器画面');
  check('多屏只使用一个截图窗口并随鼠标切换',(await targets()).filter(t=>t.url.includes('capture.html')).length===1&&(await captureInfo(readiness)).screen.x===other.x);
  await click(readiness,100,100);
  check('单击保持待选并解锁显示器',!(await captureInfo(readiness)).locked&&await readiness.evaluate("document.querySelector('.capture-selection').hidden&&document.querySelector('.capture-toolbar').hidden"));
  await moveCursor(initial.screen);
  await wait(async()=>{const state=await captureWindow();return state.visible&&state.x===initial.screen.x&&state.y===initial.screen.y;},'单击后仍可跨屏跟随');
  check('单击后可继续切换到鼠标所在屏幕',(await captureInfo(readiness)).screen.x===initial.screen.x);
  await moveCursor(other);
  await wait(async()=>{const state=await captureWindow();return state.visible&&state.x===other.x&&state.y===other.y;},'返回另一显示器');
  await readiness.send('Input.dispatchMouseEvent',{type:'mousePressed',x:100,y:100,button:'left',buttons:1,clickCount:1});
  await readiness.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:300,y:250,button:'left',buttons:1});
  await readiness.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:300,y:250,button:'left',buttons:0,clickCount:1});
  await wait(async()=>(await captureInfo(readiness)).locked,'拖动框选锁屏');
  check('拖动框选锁屏并显示工具栏',await readiness.evaluate("!document.querySelector('.capture-selection').hidden&&!document.querySelector('.capture-toolbar').hidden"));
  await moveCursor(initial.screen);await new Promise(resolve=>setTimeout(resolve,200));
  check('有选区时鼠标越屏不会切换',(await captureInfo(readiness)).locked&&(await captureWindow()).x===other.x);
  await readiness.evaluate("document.querySelectorAll('.capture-toolbar button')[1].click()");
  await wait(async()=>{const state=await captureWindow();return state.visible&&state.x===initial.screen.x&&state.y===initial.screen.y;},'重选恢复跟随');
  check('重新框选恢复待选和跨屏跟随',await readiness.evaluate("document.querySelector('.capture-selection').hidden&&document.querySelector('.capture-toolbar').hidden"));
 }
 await readiness.screenshot(path.join(root,'ready.png'));
 // A failed canvas upload must expose a close button and release the active capture.
 const broken=await readiness.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__captureOriginalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(){throw new Error('capture readiness test');};"});
 await readiness.send('Page.reload');
 await wait(()=>readiness.evaluate("document.body.textContent.includes('无法打开截图')"),'错误界面');
 await wait(async()=>(await captureWindow()).visible,'错误界面显示');
 check('截图准备失败仍显示可关闭的错误界面',await readiness.evaluate("!!document.querySelector('body>button')"));
 await readiness.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:broken.identifier});
 await readiness.evaluate("HTMLCanvasElement.prototype.getContext=window.__captureOriginalContext;");
 await readiness.evaluate("document.querySelector('body>button').click()");
 await wait(()=>inactive(readiness),'错误界面关闭');
 check('准备失败关闭后剪贴板保持且可重新截图',JSON.stringify(await main.evaluate('window.desktop.clipboardImages()'))===JSON.stringify(before));
 await main.send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',modifiers:2});
 await main.send('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',modifiers:2});
 const targetCapture=await wait(async()=>(await targets()).find(t=>t.url.includes('capture.html')),'Ctrl+1启动截图');
 const overlay=await connect(targetCapture);sessions.push(overlay);
 await wait(()=>overlay.evaluate("!!document.querySelector('.capture-selection')"),'快捷键截图就绪');
 await wait(()=>overlay.evaluate("document.querySelector('canvas').getContext('2d').getImageData(0,0,1,1).data[3]===255"),'当前屏原始像素就绪');
 const original=await overlay.evaluate(`(()=>{const image=document.querySelector('.capture-image');const c=document.createElement('canvas');c.width=64;c.height=48;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {width:image.width,height:image.height,pixels:[...ctx.getImageData(0,0,64,48).data]};})()`);
 check('原生截图取得完整桌面像素',original.width>=1000&&original.height>=600,{width:original.width,height:original.height});
 // Use real drag events; screen pixel dimensions are independent of CSS scaling.
 const bounds=await overlay.evaluate("({width:document.body.clientWidth,height:document.body.clientHeight})");
 const end={x:64/original.width*bounds.width,y:48/original.height*bounds.height};
 await overlay.send('Input.dispatchMouseEvent',{type:'mousePressed',x:0,y:0,button:'left',buttons:1,clickCount:1});
 await overlay.send('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});
 await overlay.send('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',buttons:0,clickCount:1});
 await click(overlay,end.x/2,end.y/2);
 await click(overlay,end.x/2,end.y/2,2);
 await wait(()=>main.evaluate("document.querySelector('#modal').open"),'无项目截图导入处理');
 check('截图结束自动打开图片处理且未直接修改作品',await main.evaluate("document.querySelector('#modal').open&&window.documentWindowAudit().documents.length===0"));
 const clip=JSON.parse(await clipboard('inspect'));check('选区内真实双击保持64×48裁剪并复制系统位图',clip.image&&clip.width===64&&clip.height===48,clip);
 const pixels=await main.evaluate(`(async()=>{const [file]=await window.desktop.clipboardImages(),image=new Image();image.src='data:'+file.mime+';base64,'+file.data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return[...ctx.getImageData(0,0,c.width,c.height).data];})()`);
 check('截图剪贴板像素等于遮罩出现前的原始像素',JSON.stringify(pixels)===JSON.stringify(original.pixels));
 await main.evaluate("document.querySelector('#modal-submit').click()");
 await wait(()=>main.evaluate("!document.querySelector('#modal').open&&window.documentWindowAudit().documents.length===1"),'导入截图项目');
 const baseline=await main.evaluate('window.documentWindowAudit()');
 await paste(main);await wait(()=>main.evaluate("document.querySelectorAll('.reference-image').length===1"),'截图粘贴参考板');
 check('系统截图实际粘贴至参考画布',await main.evaluate("document.querySelector('.reference-image').width===64&&document.querySelector('.reference-image').height===48"));
 await clipboard('files');await paste(main);
 await wait(()=>main.evaluate("document.querySelectorAll('.reference-image').length===3"),'多文件参考粘贴');
 check('两个图片文件按顺序导入',await main.evaluate("document.querySelectorAll('.reference-image').length===3"));
 await main.evaluate("window.workspaceLayout.detach('reference')");
 const referenceTarget=await wait(async()=>(await targets()).find(t=>t.url.includes('panel.html')),'参考独立窗口');
 const reference=await connect(referenceTarget);sessions.push(reference);
 await wait(()=>reference.evaluate("!!document.querySelector('[data-window-control=pin]')"),'Pin显示');
 await reference.evaluate("document.querySelector('[data-window-control=pin]').click()");
 await wait(()=>reference.evaluate("document.querySelector('[data-window-control=pin]').getAttribute('aria-pressed')==='true'"),'Pin开启');
 check('真实原生窗口已置顶',(await reference.evaluate('window.desktop.windowState()')).alwaysOnTop);
 await reference.evaluate("document.querySelector('[data-window-control=pin]').click()");
 await wait(async()=>!(await reference.evaluate('window.desktop.windowState()')).alwaysOnTop&&await reference.evaluate("document.querySelector('[data-window-control=pin]').getAttribute('aria-pressed')==='false'"),'Pin关闭');
 check('真实原生窗口可取消置顶',await reference.evaluate("document.querySelector('[data-window-control=pin]').getAttribute('aria-pressed')==='false'"));
 await clipboard('image');await paste(reference);await wait(()=>reference.evaluate("document.querySelectorAll('.reference-image').length===4"),'独立参考粘贴');
 check('独立窗口通过系统位图导入图片',await reference.evaluate("document.querySelectorAll('.reference-image').length===4"));
 await main.evaluate("window.workspaceLayout.dock('reference','left-top')");
 const after=await main.evaluate('window.documentWindowAudit()');
 check('参考粘贴不改变绘画像素与撤销栈',baseline.pixel===after.pixel&&baseline.undo===after.undo);
 const whole=await capture(),wholeInfo=await captureInfo(whole);
 await click(whole,200,200);await click(whole,200,200,2);
 await wait(()=>inactive(whole),'双击截取当前屏');
 const wholeClip=JSON.parse(await clipboard('inspect'));
 check('真实双击直接复制单台显示器整屏',wholeClip.image&&wholeClip.width===wholeInfo.screen.width&&wholeClip.height===wholeInfo.screen.height,wholeClip);
 const final=await main.evaluate('window.documentWindowAudit()');
 check('已有项目整屏截图保留作品及历史',baseline.pixel===final.pixel&&baseline.undo===final.undo);
 await main.screenshot(path.join(root,'complete.png'));
 await main.evaluate("setTimeout(()=>window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'closeConfirmed',args:[]}),0);true");
 try{await wait(()=>app.exitCode!==null||app.signalCode!==null,'最后编辑器关闭后退出');}
 catch(error){throw new Error(error.message+' '+JSON.stringify({targets:(await targets().catch(()=>[])).map(({id,url,title})=>({id,url,title}))}));}
 check('最后编辑器关闭时释放预载截图窗口并正常退出',app.exitCode===0);
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,executable,results},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length},null,2));
}catch(error){
 if(main)try{if((await targets()).some(target=>target.id===main.target.id))await main.screenshot(path.join(root,'failure.png'));}catch{}
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,error:error.stack},null,2)+'\n');throw error;
}finally{
 for(const session of sessions)session.close();
 if(app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'测试应用退出');}
 await writeFile(path.join(root,'native.log'),logs);
}

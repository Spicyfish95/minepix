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
const wait=async(test,label)=>{for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);};
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
let main;
let logs='';
app.stdout.on('data',bytes=>{logs+=bytes;});app.stderr.on('data',bytes=>{logs+=bytes;});
app.on('error',error=>{logs+=error.stack;});
const clipboard=async mode=>(await exec('powershell.exe',['-NoProfile','-STA','-File','scripts/clipboard-fixture.ps1','-Mode',mode,'-Directory',root],{windowsHide:true})).stdout;
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
 const cancel=await capture();await cancel.evaluate("document.querySelectorAll('.capture-toolbar button')[2].click()");
 await wait(async()=>!(await targets()).some(t=>t.url.includes('capture.html')),'取消截图');
 check('取消保留原系统剪贴板',JSON.stringify(await main.evaluate('window.desktop.clipboardImages()'))===JSON.stringify(before));
 await main.send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',modifiers:2});
 await main.send('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',modifiers:2});
 const targetCapture=await wait(async()=>(await targets()).find(t=>t.url.includes('capture.html')),'Ctrl+1启动截图');
 const overlay=await connect(targetCapture);sessions.push(overlay);
 await wait(()=>overlay.evaluate("!!document.querySelector('.capture-selection')"),'快捷键截图就绪');
 const original=await overlay.evaluate(`(async()=>{const image=document.querySelector('.capture-image');await image.decode();const c=document.createElement('canvas');c.width=64;c.height=48;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {width:image.naturalWidth,height:image.naturalHeight,pixels:[...ctx.getImageData(0,0,64,48).data]};})()`);
 check('原生截图取得完整桌面像素',original.width>=1000&&original.height>=600,{width:original.width,height:original.height});
 // Use real drag events; screen pixel dimensions are independent of CSS scaling.
 const bounds=await overlay.evaluate("({width:document.body.clientWidth,height:document.body.clientHeight})");
 const end={x:64/original.width*bounds.width,y:48/original.height*bounds.height};
 await overlay.send('Input.dispatchMouseEvent',{type:'mousePressed',x:0,y:0,button:'left',buttons:1,clickCount:1});
 await overlay.send('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});
 await overlay.send('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',buttons:0,clickCount:1});
 await overlay.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});
 await wait(()=>main.evaluate("document.querySelector('#modal').open"),'无项目截图导入处理');
 check('截图结束自动打开图片处理且未直接修改作品',await main.evaluate("document.querySelector('#modal').open&&window.documentWindowAudit().documents.length===0"));
 const clip=JSON.parse(await clipboard('inspect'));check('系统剪贴板实际包含框选位图',clip.image&&clip.width===64&&clip.height===48,clip);
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
 await main.screenshot(path.join(root,'complete.png'));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length},null,2));
}catch(error){
 if(main)try{await main.screenshot(path.join(root,'failure.png'));}catch{}
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,error:error.stack},null,2)+'\n');throw error;
}finally{
 for(const session of sessions)session.close();
 if(app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'测试应用退出');}
 await writeFile(path.join(root,'native.log'),logs);
}

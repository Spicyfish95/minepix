import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const differentDpi=process.argv.includes('--different-dpi'),multiMonitor=differentDpi||process.argv.includes('--multi-monitor');
const exec=promisify(execFile),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),root=path.resolve(differentDpi?'artifacts/native-window-drag-dpi':multiMonitor?'artifacts/native-window-drag-multi':'artifacts/native-window-drag');
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const directory=path.resolve('../minepix-tauri-validation','native-drag-'+Date.now()),project=path.join(directory,'原生拖窗.pix');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});const source=createDocument(8,8,'原生拖窗');source.frames[0].cels[0].fill(0x448844ff);
await writeFile(project+'.json',JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const sessions=[],results=[],geometry=[];let app,main,child,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()');
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function native(title,action='inspect',args=[]){const response=await exec('powershell.exe',['-NoProfile','-File','scripts/native-window-pointer.ps1','-ProcessId',String(app.pid),'-Title',title,'-Action',action,...args],{windowsHide:true,timeout:30000});return JSON.parse(response.stdout.replace(/^\uFEFF/,''));}
async function click(session,selector){const p=await session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
const dpr=session=>session.evaluate('({dpr:devicePixelRatio,width:innerWidth,height:innerHeight})');
async function crossMonitor(session,title,selector,monitor,label,position){
 await session.evaluate(`(async()=>{if(window.nativeDpiEvents)return;window.nativeDpiEvents=[];const api=window.__TAURI_INTERNALS__;await api.invoke('plugin:event|listen',{event:'tauri://scale-change',target:{kind:'Window',label:window.__MINEPIX_PANEL_LABEL__||'main'},handler:api.transformCallback(event=>window.nativeDpiEvents.push(event.payload))});})()`);
 const before=await native(title),view=await dpr(session);
 const point=await session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const area=monitor.workingArea,rect=before.after.rect;
 const destination=position||{x:Math.round(area.x+(area.width-rect.width)/2),y:Math.round(area.y+(area.height-rect.height)/2)};
 let state=await native(title,'drag',['-ClientX',String(Math.round(point.x*before.after.dpi/96)),'-ClientY',String(Math.round(point.y*before.after.dpi/96)),'-DeltaX',String(destination.x-rect.x),'-DeltaY',String(destination.y-rect.y)]);
 if(differentDpi){
  // Cross-DPI dragging keeps the cursor's title-bar anchor, so center using the actual new rect.
  const crossed=state.after,finalPosition=position||{x:Math.round(area.x+(area.width-crossed.rect.width)/2),y:Math.round(area.y+(area.height-crossed.rect.height)/2)};
  if(crossed.rect.x!==finalPosition.x||crossed.rect.y!==finalPosition.y){
   const p=await session.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   const placement=await native(title,'drag',['-ClientX',String(Math.round(p.x*crossed.dpi/96)),'-ClientY',String(Math.round(p.y*crossed.dpi/96)),'-DeltaX',String(finalPosition.x-crossed.rect.x),'-DeltaY',String(finalPosition.y-crossed.rect.y)]);
   state={...state,crossed,placement,after:placement.after};
  }
 }
 const afterView=await dpr(session),after=state.after;
 geometry.push({label,...state,view,afterView,scaleEvents:await session.evaluate('window.nativeDpiEvents'),targetMonitor:monitor.name});
 check(label+'进入目标活动显示区域',after.monitor===monitor.name&&state.input.source==='Windows SendInput + SetCursorPos');
 if(differentDpi)check(label+'实际跨越不同原生DPI',before.after.dpi!==after.dpi);
 check(label+'原生DPI与页面比例及逻辑尺寸一致',Math.abs(afterView.dpr-after.dpi/96)<.001&&Math.abs(afterView.width-view.width)<=2&&Math.abs(afterView.height-view.height)<=2&&Math.abs(after.client.width/afterView.dpr-afterView.width)<=1&&Math.abs(after.client.height/afterView.dpr-afterView.height)<=1);
 check(label+'窗口完整位于目标工作区',after.rect.x>=area.x&&after.rect.y>=area.y&&after.rect.x+after.rect.width<=area.x+area.width&&after.rect.y+after.rect.height<=area.y+area.height);
 return state;
}
async function drag(session,title,selector,dx,dy,label){
 const before=await native(title),view=await dpr(session),p=await session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,visible:el.checkVisibility()};})()`);
 assert.ok(p.visible);const scale=before.after.dpi/96;
 const state=await native(title,'drag',['-ClientX',String(Math.round(p.x*scale)),'-ClientY',String(Math.round(p.y*scale)),'-DeltaX',String(dx),'-DeltaY',String(dy)]);
 geometry.push({label,...state,view});check(label+'原生RECT按实际鼠标平移',state.after.rect.x-state.before.rect.x===dx&&state.after.rect.y-state.before.rect.y===dy);
 check(label+'尺寸DPI与客户区保持',state.after.rect.width===state.before.rect.width&&state.after.rect.height===state.before.rect.height&&state.after.client.width===state.before.client.width&&state.after.client.height===state.before.client.height&&state.after.dpi===state.before.dpi&&same(await dpr(session),view));
 return state;
}
async function saved(label){await command('save');await wait(async()=>{const s=await audit();return !s.dirty&&!s.busy;},'保存');const doc=await main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'应用启动');
 main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));sessions.push(main);await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'作品载入');
 baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh')");
 if((await main.evaluate('window.desktop.windowState()')).maximized)await main.evaluate("window.desktop.windowControl('maximize')");
 if(differentDpi){
  const before=await native('MinePix'),scale=before.after.dpi/96;
  const resized=await native('MinePix','resize',['-DeltaX',String(Math.round(1184*scale)-before.after.client.width),'-DeltaY',String(Math.round(780*scale)-before.after.client.height)]);
  geometry.push({label:'main-prepare-resize',...resized});
  check('真实边缘调整主窗至两屏可容纳尺寸',Math.abs(resized.after.client.width/scale-1184)<=1&&Math.abs(resized.after.client.height/scale-780)<=1);
  await wait(async()=>{const v=await dpr(main);return Math.abs(v.width-1184)<=1&&Math.abs(v.height-780)<=1;},'调整后客户区布局');
 }
 const initial=await audit(),initialWindow=await native('MinePix');await writeFile(path.join(root,'environment.json'),JSON.stringify(initialWindow,null,2)+'\n');
 check('主窗处于正常可见可拖动态',initialWindow.after.visible&&!initialWindow.after.minimized&&!initialWindow.after.maximized);
 if(multiMonitor){
  const origin=initialWindow.monitors.find(m=>m.name===initialWindow.after.monitor),other=initialWindow.monitors.find(m=>m.name!==initialWindow.after.monitor);
  assert.ok(origin&&other,'需要两个当前活动显示区域');
  await crossMonitor(main,'MinePix','.window-drag-space',other,'main-cross-forward');
  check('主窗跨屏不改变作品与历史',same(await audit(),initial));
  await main.screenshot(path.join(root,'main-other-monitor.png'));
  await crossMonitor(main,'MinePix','.window-drag-space',origin,'main-cross-back',initialWindow.after.rect);
  check('主窗跨屏往返恢复原位置',same((await native('MinePix')).after.rect,initialWindow.after.rect));
 }
 await main.evaluate("window.nativeDragSamples=[];document.addEventListener('pointerdown',e=>{if(e.target.closest('.window-drag-space'))window.nativeDragSamples.push({trusted:e.isTrusted,type:e.pointerType,button:e.button})},true)");
 await drag(main,'MinePix','.window-drag-space',120,80,'main-forward');await main.screenshot(path.join(root,'main-moved.png'));
 check('主窗拖动未改作品与绘画历史',same(await audit(),initial));const pointerSamples=await main.evaluate('window.nativeDragSamples');geometry.find(entry=>entry.label==='main-forward').pointerSamples=pointerSamples;check('主窗拖动经过原生拖动区域',await main.evaluate("getComputedStyle(document.querySelector('.window-drag-space')).webkitAppRegion==='drag'"));
 await drag(main,'MinePix','.window-drag-space',-120,-80,'main-back');const returned=await native('MinePix');check('主窗往返恢复原位置',same(returned.after.rect,initialWindow.after.rect));
 const selector=await main.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(name=>window.workspaceLayout.state().slots[name].includes('colors'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");await click(main,selector);
 await wait(async()=>{for(const target of(await targets()).filter(t=>t.url.endsWith('panel.html'))){const s=await connect(target);if(await s.evaluate("!!document.querySelector('[data-panel=colors]')")){child=s;sessions.push(s);return true;}s.close();}return false;},'颜色浮窗');
 const title=await child.evaluate('document.title'),parentBefore=await native('MinePix');
 let childOrigin;
 if(multiMonitor){
  childOrigin=await native(title);
  const other=childOrigin.monitors.find(m=>m.name!==childOrigin.after.monitor);
  assert.ok(other,'颜色浮窗需要另一活动显示区域');
  await crossMonitor(child,title,'.window-caption',other,'colors-cross-forward');
  check('子窗跨屏保持主窗几何和作品历史',same((await native('MinePix')).after.rect,parentBefore.after.rect)&&same(await audit(),initial));
  await child.screenshot(path.join(root,'floating-other-monitor.png'));
 }
 await drag(child,title,'.window-caption',64,48,'colors-forward');await child.screenshot(path.join(root,'floating-moved.png'));
 check('拖动原生子窗不会移动主窗',same((await native('MinePix')).after.rect,parentBefore.after.rect));
 await child.evaluate("(()=>{const el=document.getElementById('hex');el.value='#abcdef';el.dispatchEvent(new Event('change',{bubbles:true}));})()");
 await main.evaluate("(()=>{for(const[id,value]of Object.entries({brush:1,'brush-shape':'square','paint-opacity':100})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-tool=\"pencil\"]').click();})()");
 const p=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+r.width*.5/8,y:r.y+r.height*.5/8};})()");await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
 check('移动后子窗颜色与主窗真实绘画仍共享作品',(await audit()).pixel===0xabcdefff&&(await audit()).undo===1&&(await audit()).dirty);let doc=await saved('after-native-drag');const expected=structuredClone(source.frames);expected[0].cels[0][0]=0xabcdefff;check('移动后保存Rust重读像素和全部元数据',same(doc.frames,expected)&&same(doc.layers,source.layers));
 await drag(child,title,'.window-caption',-64,-48,'colors-back');
 if(multiMonitor){
  const origin=childOrigin.monitors.find(m=>m.name===childOrigin.after.monitor);
  await crossMonitor(child,title,'.window-caption',origin,'colors-cross-back',childOrigin.after.rect);
  check('子窗跨屏往返恢复原位置',same((await native(title)).after.rect,childOrigin.after.rect));
 }
 await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>main.evaluate("!window.workspaceLayout.floats.has('colors')"),'原生关闭回停靠');
 check('原生关闭回停靠保留颜色与作品',await main.evaluate("document.getElementById('hex').value.toLowerCase()==='#abcdef'")&&(await audit()).pixel===0xabcdefff);
 await command('undo');await wait(async()=>(await audit()).undo===0,'撤销绘画');doc=await saved('final');check('拖窗后绘画仍可撤销保存还原',same(doc.frames,source.frames));check('全程没有产品错误弹窗',!await main.evaluate("document.getElementById('error-dialog').open"));await main.screenshot(path.join(root,'complete.png'));
 const differentDpiVerified=multiMonitor&&geometry.some(g=>g.targetMonitor&&g.before.dpi!==g.after.dpi);
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,geometry,monitors:initialWindow.monitors,multiMonitorVerified:multiMonitor,differentDpiVerified,directory,executable,executableSha256},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,monitors:initialWindow.monitors.length,multiMonitorVerified:multiMonitor,differentDpiVerified}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,geometry,error:error.stack,directory,executable,executableSha256},null,2)+'\n');throw error;}
finally{
 const cleanup={preferencesRestored:false,ownRecentRemoved:false,ownRecoveryRemoved:false,cdpReleased:false};
 try{
  if(main&&baseline){
   await main.evaluate("for(const id of [...window.workspaceLayout.floats.keys()])window.workspaceLayout.dock(id,'left-top')");
   await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
   await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);
   cleanup.preferencesRestored=same(await main.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
   cleanup.ownRecentRemoved=!(await main.evaluate('window.desktop.recentFiles()')).some(entry=>entry.path===project);
   cleanup.ownRecoveryRemoved=!await main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(project)})`);
  }
 }finally{
  for(const session of sessions)session.close();
  if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}
  await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP端口释放');
  cleanup.cdpReleased=true;
  await writeFile(path.join(root,'cleanup.json'),JSON.stringify(cleanup,null,2)+'\n');
 }
 if(baseline)assert.ok(Object.values(cleanup).every(Boolean),'偏好 / 本次最近恢复 / CDP清理核对');
}

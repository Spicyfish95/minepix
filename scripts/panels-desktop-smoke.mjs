import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','panels-'+Date.now());
const project=path.join(directory,'浮动编辑验收.pix'),root=process.env.MINEPIX_PANELS_ROOT||'artifacts/panels-desktop';
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
await copyFile('examples/mushroom.pix',project);
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const sessions=[];
let app,main,baseline;
const keys=['pixel-studio-layout-v1','pixel-studio-colors','pixel-studio-input-v1','pixel-studio-brush','pixel-studio-tool-brush-shapes','pixel-studio-theme','pixpix-locale-v1'];
async function wait(test,label){
 for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('等待超时：'+label);
}
const audit=()=>main.evaluate('window.documentWindowAudit()');
async function click(session,selector,button='left'){
 const point=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button,clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button,clickCount:1});
}
async function detach(id){
 await main.evaluate(`window.workspaceLayout.reveal(${JSON.stringify(id)})`);
 const selector=await main.evaluate(`(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(name=>window.workspaceLayout.state().slots[name].includes(${JSON.stringify(id)}));return '[data-slot="'+slot+'"] .dock-detach';})()`);
 await click(main,selector);
 await wait(()=>main.evaluate(`window.workspaceLayout.floats.has(${JSON.stringify(id)})`),'浮动 '+id);
 let child;
 await wait(async()=>{
  for(const target of(await targets()).filter(target=>target.url.endsWith('panel.html'))){
   if(sessions.some(session=>session.target.id===target.id))continue;
   const candidate=await connect(target);
   if(await candidate.evaluate(`!!document.querySelector('[data-panel="${id}"]')`)){sessions.push(candidate);child=candidate;return true;}
   candidate.close();
  }
  return false;
 },'真实子页面 '+id);
 return child;
}
async function closePanel(id,child){
 await child.evaluate("void window.desktop.windowControl('close');true");
 await wait(()=>main.evaluate(`!window.workspaceLayout.floats.has(${JSON.stringify(id)})&&window.workspaceLayout.panels[${JSON.stringify(id)}].ownerDocument===document`),'回停靠 '+id);
 check(id+' 原生关闭后返回父文档',true);
}
const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function shortcut(session,shift=false){
 await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:shift?'Z':'z',code:'KeyZ',modifiers:shift?10:2});
 await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:shift?'Z':'z',code:'KeyZ',modifiers:0});
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}
 assert.ok(!occupied,'已有CDP会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'应用启动');
 main=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));sessions.push(main);
 await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目就绪');
 baseline=await main.evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key=>[key,localStorage.getItem(key)]))`);
 await writeFile(root+'/preferences-before.json',JSON.stringify(baseline,null,2)+'\n');
 await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh')");
 const initial=await audit();
 const colors=await detach('colors');
 await colors.evaluate("document.getElementById('hex').value='#ff3300';document.getElementById('hex').dispatchEvent(new Event('change',{bubbles:true}))");
 check('浮动颜色控件更新实际前景色',await colors.evaluate("document.getElementById('hex').value.toLowerCase()==='#ff3300'"));
 const tools=await detach('tools');
 await click(tools,'[data-tool="eraser"]');
 check('浮动工具切换主画布橡皮',await main.evaluate("document.getElementById('viewport').dataset.tool==='eraser'"));
 await click(tools,'[data-tool="pencil"]');
 await click(main,'#layers .layer[data-index="0"]');
 const point=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*.5,y:r.y+z*.5};})()");
 await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(async()=>(await audit()).dirty,'绘画');
 check('浮动颜色与工具共同影响真实绘画像素',(await audit()).pixel===0xff3300ff&&(await audit()).undo===initial.undo+1);
 await colors.screenshot(root+'/colors.png');await tools.screenshot(root+'/tools.png');
 await main.screenshot(root+'/drawing.png');
 await closePanel('tools',tools);await closePanel('colors',colors);
 const layers=await detach('layers');
 await click(layers,'[data-action="add-layer"]');
 await wait(()=>layers.evaluate("document.querySelectorAll('#layers .layer').length===3"),'新增图层');
 const row='#layers .layer.selected';
 await click(layers,row+' .layer-visibility');
 check('浮动图层可见性进入主历史',(await audit()).undo===initial.undo+3&&await layers.evaluate("document.querySelector('#layers .layer.selected .layer-visibility').getAttribute('aria-label')==='显示图层'"));
 await command('undo');
 check('父窗撤销同步浮动图层',await layers.evaluate("document.querySelector('#layers .layer.selected .layer-visibility').getAttribute('aria-label')==='隐藏图层'"));
 await command('redo');
 await click(layers,row+' .layer-lock');
 check('浮动图层锁定更新控件',await layers.evaluate("document.querySelector('#layers .layer.selected .layer-lock').getAttribute('aria-label')==='解锁图层'"));
 await closePanel('layers',layers);
 const timeline=await detach('timeline');
 await click(timeline,'[data-action="add-frame"]');
 await wait(()=>timeline.evaluate("document.querySelectorAll('.frame-head').length===5"),'新增帧');
 const history=(await audit()).undo;
 await timeline.evaluate("document.getElementById('duration').value=230;document.getElementById('duration').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('duration').blur();document.getElementById('timeline-grid').focus()");
 check('浮动时间轴时长与主历史同步',(await audit()).undo===history+1&&await timeline.evaluate("document.getElementById('duration').value==='230'"));
 await shortcut(timeline);
 check('子窗Ctrl+Z撤销文档时长',(await audit()).undo===history&&await timeline.evaluate("document.getElementById('duration').value!=='230'"));
 await shortcut(timeline,true);
 check('子窗Ctrl+Shift+Z重做文档时长',(await audit()).undo===history+1&&await timeline.evaluate("document.getElementById('duration').value==='230'"));
 await timeline.screenshot(root+'/timeline.png');
 await closePanel('timeline',timeline);
 await command('previous');
 const preview=await detach('preview');
 check('浮动预览显示当前真实像素',await preview.evaluate("(()=>{const pixel=document.getElementById('preview').getContext('2d').getImageData(0,0,1,1).data;return pixel[0]===255&&pixel[1]===51&&pixel[2]===0&&pixel[3]===255;})()"));
 await main.evaluate("document.getElementById('theme-toggle').click();document.querySelector('#theme-options [data-theme=dark]').click();window.minepixLocale.set('en')");
 await wait(()=>preview.evaluate("document.documentElement.dataset.theme==='dark'&&document.documentElement.lang==='en'"),'子窗主题语言');
 check('主题与语言同步浮动页面',true);
 check('浮动标题与动态栏头翻译英文',await preview.evaluate("document.title==='MinePix · Preview'&&document.querySelector('.floating-header').getAttribute('aria-label')==='Preview'"));
 const englishLayers=await detach('layers');
 await wait(()=>englishLayers.evaluate("document.documentElement.lang==='en'&&document.querySelector('.floating-header')?.getAttribute('aria-label')==='Layers'"),'英文新浮动控件');
 const newLayerTitle=await englishLayers.evaluate("document.querySelector('[data-action=\"add-layer\"]').getAttribute('title')");
 await writeFile(root+'/new-layer-title.json',JSON.stringify({newLayerTitle})+'\n');
 check('英文期间新浮动控件自动翻译',newLayerTitle.startsWith('New layer')&&!/[\u3400-\u9fff]/.test(newLayerTitle));
 await closePanel('layers',englishLayers);
 await main.evaluate("window.minepixLocale.set('zh')");
 await wait(()=>preview.evaluate("document.documentElement.lang==='zh-CN'&&document.querySelector('.floating-header').getAttribute('aria-label')==='预览'"),'浮动恢复中文');
 check('浮动页面切回中文恢复标题与属性',await preview.evaluate("document.title==='MinePix · 预览'"));
 await preview.screenshot(root+'/preview.png');
 await closePanel('preview',preview);
 await command('save');
 await wait(async()=>!(await audit()).dirty&&!(await audit()).busy,'保存浮动编辑');
 const document=await main.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);
 check('浮动编辑完整写入Rust二进制项目',document.layers.length===3&&document.frames.length===5&&document.frames[1].duration===230&&document.frames[0].cels[0][0]===0xff3300ff&&document.layers[1].visible===false&&document.layers[1].locked===true);
 check('保存文件魔数与所有面板回停靠',(await readFile(project)).subarray(0,8).equals(Buffer.from('MINEPIX\0'))&&await main.evaluate('window.workspaceLayout.floats.size===0'));
 check('面板流程没有错误弹窗',await main.evaluate("!document.getElementById('error-dialog').open"));
 await main.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,project,executable,executableSha256},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){
 await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,project,executable,executableSha256},null,2)+'\n');throw error;
}finally{
 if(main&&baseline){
  await main.evaluate(`(()=>{window.workspaceLayout.reset();for(const [key,value]of Object.entries(${JSON.stringify(baseline)})){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}})()`);
  await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);
  await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);
 }
 for(const session of sessions)session.close();
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'终止本次程序');}
}

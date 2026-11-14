import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const root=path.resolve('artifacts/settings-desktop');
const directory=path.resolve('../minepix-tauri-validation','settings-'+Date.now());
const project=path.join(directory,'设置验收.pix');
await mkdir(root,{recursive:true});
await mkdir(directory,{recursive:true});
await copyFile('examples/mushroom.pix',project);
const original=await readFile(project);
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,session,baseline;
const settingsKeys=['pixel-studio-application-v1','pixel-studio-input-v1','pixel-studio-pen-v1','pixel-studio-brush','pixel-studio-tool-brush-shapes','pixel-studio-onion','pixel-studio-keymap-v1','pixel-studio-export-settings-v1','pixel-studio-theme','minepix-appearance-v1','pixel-studio-colors','pixpix-locale-v1'];
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(test,label){
 for(let i=0;i<150;i++){const value=await test();if(value)return value;await pause();}
 throw new Error('等待超时：'+label);
}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const preferences=()=>session.evaluate(`Object.fromEntries(${JSON.stringify(settingsKeys)}.map(key=>[key,localStorage.getItem(key)]))`);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function launch(){
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{
  if(app.launchError)throw app.launchError;
  if(app.exitCode!==null||app.signalCode!==null)throw new Error('验证程序提前退出');
  try{return(await targets()).some(target=>target.type==='page'&&target.url.startsWith('http://tauri.localhost'));}catch{return false;}
 },'内嵌页面');
 session=await connect((await targets()).find(target=>target.type==='page'&&target.url.startsWith('http://tauri.localhost')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目加载');
}
async function stop(graceful=false){
 if(graceful)await session.evaluate("void window.desktop.menuCommand({role:'quit'})");
 session?.close();session=null;
 if(app&&app.exitCode===null&&app.signalCode===null){
  if(!graceful)app.kill();
  await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');
 }
 app=null;
 await wait(async()=>{try{await targets();return false;}catch{return true;}},'调试端口释放');
}
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function click(selector){
 const point=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
async function open(){
 await command('settings');
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('settings-tabs')"),'设置弹窗');
}
async function cancel(){
 await click('#modal .modal-actions [value="cancel"]');
 await wait(()=>session.evaluate("!document.getElementById('modal').open&&!document.getElementById('modal').classList.contains('application-settings')"),'取消设置');
}
async function setFields(values){
 await session.evaluate(`(()=>{const form=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements[name];if(!el)throw new Error('不存在的设置：'+name);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
}
const readFields=()=>session.evaluate("Object.fromEntries([...document.getElementById('modal-form').elements].filter(el=>el.name).map(el=>[el.name,el.type==='checkbox'?el.checked:el.type==='number'?+el.value:el.value]))");
const submit=()=>session.evaluate("document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))");
async function key(key,code,modifiers=0){
 await session.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});
 await session.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});
 if(modifiers&1)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Alt',code:'AltLeft',modifiers:modifiers&~1});
 if(modifiers&2)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',modifiers:0});
}
async function wheel(modifiers=0){
 const point=await session.evaluate("(()=>{const r=document.getElementById('viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:120,deltaX:0,modifiers});
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}
 assert.ok(!occupied,'已有 CDP 会话，不能启动设置验收');
 await launch();
 baseline=await preferences();
 await writeFile(root+'/preferences-before.json',JSON.stringify(baseline,null,2)+'\n');
 const initial=await audit();
 await open();
 const fields=await readFields();
 check('正式设置提供十类且分类与面板关联',await session.evaluate("document.querySelectorAll('#settings-tabs [role=tab]').length===10&&[...document.querySelectorAll('#settings-tabs [role=tab]')].every(tab=>document.getElementById(tab.getAttribute('aria-controls'))?.getAttribute('aria-labelledby')===tab.id)"));
 await click('#settings-tab-visual');
 await click('#settings-page-visual [data-theme="dark"]');
 await session.evaluate("document.getElementById('visual-accent').value='#33aa77';document.getElementById('visual-accent').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('visual-font').value='mono';document.getElementById('visual-font').dispatchEvent(new Event('change',{bubbles:true}))");
 check('外观实时预览主题颜色和字体',await session.evaluate("document.documentElement.dataset.theme==='dark'&&document.documentElement.style.getPropertyValue('--accent')==='#33aa77'&&document.documentElement.style.getPropertyValue('--ui-font').includes('Consolas')"));
 await setFields({'appearance.width':77,'input.wheel':'brush','pen.gamma':2});
 await cancel();
 check('取消设置恢复偏好且作品和磁盘不变',same(await preferences(),baseline)&&same(await audit(),initial)&&(await readFile(project)).equals(original));
 await open();
 await setFields({'pen.gamma':0});
 await submit();
 check('隐藏无效数值自动定位数位笔分类',await session.evaluate("document.getElementById('modal').open&&document.getElementById('settings-tab-pen').getAttribute('aria-selected')==='true'"));
 check('无效设置没有写偏好',same(await preferences(),baseline));
 await setFields({'pen.gamma':fields['pen.gamma'],'keys.bindings.tool:pencil':'E','keys.bindings.tool:eraser':'E'});
 await submit();
 check('快捷键冲突阻止保存并展示错误',await session.evaluate("document.getElementById('modal').open&&document.getElementById('modal-error').textContent.includes('冲突')"));
 await cancel();
 await open();
 const savedFields={
  'appearance.width':48,'appearance.height':24,'appearance.duration':80,'appearance.grid':true,'appearance.symmetry':false,'appearance.language':'zh',
  'input.left':'tool','input.right':'erase','input.wheel':'frames','input.invert':false,'input.zoomStep':1.5,'input.panSpeed':1.25,
  'pen.mode':'both','pen.gamma':1.4,'pen.minSize':.2,'pen.touch':'pan',
  'brush.size':3,'brush.shape':'circle','brush.opacity':75,'brush.angle':15,'brush.ink':'over','brush.pixelPerfect':false,
  'onion.enabled':true,'onion.before':2,'onion.after':1,'onion.opacity':30,'onion.falloff':20,
  'canvasBackground.defaultSize':5,'canvasBackground.defaultColor1':'#112233','canvasBackground.defaultColor2':'#445566',
  'canvasBackground.currentSize':7,'canvasBackground.currentColor1':'#abcdef','canvasBackground.currentColor2':'#112233',
  'keys.bindings.tool:pencil':'Ctrl+Alt+J','exports.png.scale':2,'exports.sheet.columns':4,'exports.sheet.engineFormat':'godot',
 };
 await setFields(savedFields);
 await click('#settings-tab-visual');
 await click('#settings-page-visual [data-theme="dark"]');
 await session.evaluate("document.getElementById('visual-accent').value='#4477cc';document.getElementById('visual-accent').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('visual-font').value='mono';document.getElementById('visual-font').dispatchEvent(new Event('change',{bubbles:true}))");
 await submit();
 await wait(()=>session.evaluate("!document.getElementById('modal').open"),'保存设置');
 check('设置应用笔刷网格洋葱皮并建立作品历史',await session.evaluate("document.getElementById('brush').value==='3'&&document.getElementById('brush-shape').value==='circle'&&document.getElementById('paint-opacity').value==='75'&&document.getElementById('grid').checked&&document.getElementById('onion').checked")&&(await audit()).dirty&&(await audit()).undo===initial.undo+1);
 const background=await session.evaluate("({size:getComputedStyle(document.getElementById('canvas-wrap')).backgroundSize,color:getComputedStyle(document.getElementById('canvas-wrap')).backgroundColor})");
 check('当前透明背景按作品像素缩放显示',background.size===`${14*(await audit()).zoom}px ${14*(await audit()).zoom}px`&&background.color==='rgb(171, 205, 239)');
 await command('undo');
 check('透明背景修改可撤销',!(await audit()).dirty);
 await command('redo');
 await command('save');
 await wait(async()=>!(await audit()).dirty&&!(await audit()).busy,'保存作品背景');
 const persisted=await preferences();
 await open();
 const applied=await readFields();
 check('各类设置保存后重新打开逐项一致',Object.entries(savedFields).every(([name,value])=>applied[name]===value));
 await click('#settings-tab-workspace');
 check('工作区动作使用有文字的常规按钮',await session.evaluate("[...document.querySelectorAll('#settings-page-workspace button')].length===2&&[...document.querySelectorAll('#settings-page-workspace button')].every(button=>button.type==='button'&&button.textContent.includes('应用并'))"));
 await cancel();
 await stop(true);
 await launch();
 check('应用退出重启后偏好持久化',same(await preferences(),persisted));
 await open();
 const restarted=await readFields();
 check('重启后设置字段与保存值一致',Object.entries(savedFields).every(([name,value])=>restarted[name]===value));
 await cancel();
 await click('#tools [data-tool="eraser"]');
 await click('#viewport');
 await key('j','KeyJ',3);
 check('自定义快捷键实际切回铅笔',await session.evaluate("document.getElementById('viewport').dataset.tool==='pencil'"));
 const frameBefore=await session.evaluate("document.getElementById('preview-frame').textContent");
 await wheel();
 await wait(()=>session.evaluate(`document.getElementById('preview-frame').textContent!==${JSON.stringify(frameBefore)}`),'滚轮切帧');
 const zoomBefore=(await audit()).zoom;
 await wheel(2);
 await wait(async()=>(await audit()).zoom!==zoomBefore,'Ctrl滚轮缩放');
 check('滚轮切帧与Ctrl强制缩放实际生效',true);
 await command('new');
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.querySelector('input[name=\"width\"]')"),'新建默认值');
 check('新建采用默认宽高',await session.evaluate("document.querySelector('input[name=\"width\"]').value==='48'&&document.querySelector('input[name=\"height\"]').value==='24'"));
 await click('#modal-submit');
 await wait(async()=>(await audit()).documents.length===2,'新建文档');
 check('新建采用默认帧时长',await session.evaluate("document.getElementById('duration').value==='80'"));
 await open();
 await setFields({'appearance.language':'en'});
 await submit();
 await wait(()=>session.evaluate("document.documentElement.lang==='en'"),'切换英文');
 check('英文设置和菜单可访问',await session.evaluate("[...document.querySelectorAll('[data-top-menu]')].some(el=>el.textContent==='File')"));
 await open();
 check('英文设置分类可访问',await session.evaluate("document.getElementById('settings-tab-input').textContent==='Mouse and wheel'"));
 await cancel();
 check('设置验收没有错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,project,executable},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){
 await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,project,executable},null,2)+'\n');
 throw error;
}finally{
 if(session){
  if(baseline)await session.evaluate(`(()=>{for(const [key,value]of Object.entries(${JSON.stringify(baseline)})){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}})()`);
  await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);
  await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);
 }
 if(app)await stop();
}

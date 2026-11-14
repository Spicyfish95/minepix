import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {composite} from '../src/model.js';
import {defaultNormalMapOptions,generateNormalMap} from '../src/normal-map.js';
import {repairPalette} from '../src/pixel-repair.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','processing-'+Date.now()),project=path.join(directory,'像素处理验收.pix'),root='artifacts/processing-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});await copyFile('examples/mushroom.pix',project);
const results=[],created=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const inputImage={width:64,height:64,data:[]},expected=[];
for(let y=0;y<64;y++)for(let x=0;x<64;x++)inputImage.data.push(...[[220,60,40,255],[30,180,90,255],[40,70,210,255]][((x>>3)+(y>>3))%3]);
for(let y=0;y<8;y++)for(let x=0;x<8;x++)expected.push(...inputImage.data.slice((y*8*64+x*8)*4,(y*8*64+x*8)*4+4));
let app,session,baseline;
async function wait(test,label){
 for(let i=0;i<300;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('等待超时：'+label);
}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const submit=()=>session.evaluate("document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))");
const cancel=()=>session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.querySelector('#modal .modal-actions [value=cancel]').click();}).then(()=>true)");
async function dialog(file,cancelSave=false){await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),...(cancelSave?['-Cancel']:['-FilePath',file])],{windowsHide:true,timeout:20000});}
async function idle(){await wait(async()=>!(await audit()).busy&&await session.evaluate("!document.getElementById('modal').open"),'编辑器空闲');}
async function ready(){await wait(()=>session.evaluate("document.getElementById('modal').open&&!document.getElementById('modal-submit').disabled&&!document.getElementById('error-dialog').open"),'处理完成');}
async function readDocument(file){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(file)}))).data);})()`);}
async function inputs(values){await session.evaluate(`(()=>{const form=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements[name];if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);}
async function decodePng(file){return session.evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${(await readFile(file)).toString('base64')}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);return{width:canvas.width,height:canvas.height,data:[...context.getImageData(0,0,canvas.width,canvas.height).data]};})()`);}
async function openImage(file){await command('open');await dialog(file);await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('modal-form').elements.processing"),'图片导入预览');}
async function confirmAndSave(name){
 await submit();await wait(async()=>{const state=await audit();return state.dirty&&!state.path&&!state.busy;},'新导入项目');await idle();
 const file=path.join(directory,name+'.pix');created.push(file);await command('save');await dialog(file);await idle();return readDocument(file);
}
async function openNormal(){await command('normal-map');await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.getElementById('normal-preview-pair')"),'法线界面');await ready();}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有 CDP 会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;if(app.exitCode!==null)throw new Error('验证应用已退出');try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目加载');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await writeFile(root+'/preferences-before.json',JSON.stringify(baseline,null,2)+'\n');
 await session.evaluate("window.minepixLocale.set('zh')");
 check('正式内嵌页面使用真实Rust且无开发验收入口',await session.evaluate("window.desktop.appInfo().then(info=>info.backend==='tauri-rust'&&typeof window.runNormalMapSmoke==='undefined')"));
 const source=await readDocument(project),sourcePixels=composite(source,0),initial=await audit();
 await openNormal();
 check('法线菜单打开双预览并由真实计算解锁',await session.evaluate("document.getElementById('modal-title').textContent==='导出法线贴图'&&!document.getElementById('normal-light-marker').hidden&&document.getElementById('sheet-import-preview').width>0"));
 const beforeLight=await session.evaluate("({light:document.getElementById('normal-light-canvas').toDataURL(),normal:document.getElementById('sheet-import-preview').toDataURL(),rect:(()=>{const r=document.getElementById('normal-light-canvas').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()})");
 const r=beforeLight.rect;
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x+r.w*.3,y:r.y+r.h*.3,button:'left',buttons:1,clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+r.w*.7,y:r.y+r.h*.7,button:'left',buttons:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+r.w*.7,y:r.y+r.h*.7,button:'left',buttons:0,clickCount:1});
 await wait(()=>session.evaluate(`document.getElementById('normal-light-canvas').toDataURL()!==${JSON.stringify(beforeLight.light)}`),'光照更新');
 check('真实光源拖动改变光照并保留法线',await session.evaluate(`document.getElementById('sheet-import-preview').toDataURL()===${JSON.stringify(beforeLight.normal)}`));
 await session.evaluate("document.getElementById('normal-map-advanced').open=true;window.minepixLocale.set('en')");
 await wait(()=>session.evaluate("document.getElementById('modal-title').textContent==='Export normal map'"),'法线英文');
 check('法线高级设置和等待控件英文可访问',await session.evaluate("!/[\\u3400-\\u9fff]/.test(document.getElementById('normal-map-advanced').textContent)&&document.getElementById('import-preview-progress').getAttribute('aria-label')==='Image processing progress'"));
 await session.evaluate("window.minepixLocale.set('zh')");
 await cancel();await idle();check('取消法线预览保留源文档和历史',same(await audit(),initial));
 await openNormal();await submit();await dialog(null,true);await wait(()=>session.evaluate("document.getElementById('status').textContent.includes('已取消导出')"),'原生取消返回产品流程');await idle();check('取消法线原生保存不修改源文档',same(await audit(),initial));
 await openNormal();await session.evaluate("document.getElementById('normal-map-advanced').open=true");
 const options={...defaultNormalMapOptions('character'),preset:'character',shapeStrength:65,normalStrength:80,paintedLightAngle:60,invertY:true,mergeOutlines:true};
 await inputs({preset:'character',autoLight:false,shapeStrength:options.shapeStrength,normalStrength:options.normalStrength,paintedLightAngle:options.paintedLightAngle,invertY:options.invertY});await ready();
 const formSettings=await session.evaluate("(()=>{const f=document.getElementById('modal-form');return{preset:f.elements.preset.value,angle:f.elements.paintedLightAngle.value,angleEnabled:!f.elements.paintedLightAngle.disabled,invertY:f.elements.invertY.checked};})()");
 await writeFile(root+'/normal-settings.json',JSON.stringify(formSettings,null,2)+'\n');
 check('法线预设手动光照与DirectX参数生效',formSettings.preset==='character'&&formSettings.angle==='60'&&formSettings.angleEnabled&&formSettings.invertY);
 await session.screenshot(root+'/normal-preview.png');
 const normalFile=path.join(directory,'normal-directx.png');await submit();await dialog(normalFile);await wait(()=>session.evaluate("document.getElementById('status').textContent.includes('法线贴图已导出')"),'法线文件实际写入完成');await idle();
 const normal=await decodePng(normalFile),generated=generateNormalMap({width:source.width,height:source.height,data:sourcePixels},options),expectedNormal=[...generated.data];
 for(let i=0;i<expectedNormal.length;i+=4)if(!expectedNormal[i+3])expectedNormal.fill(0,i,i+4);
 check('实际法线PNG像素与Node同算法逐字节一致',normal.width===source.width&&normal.height===source.height&&same(normal.data,expectedNormal));
 check('法线PNG保留完整透明度',normal.data.every((value,i)=>i%4!==3||value===sourcePixels[i]));
 check('法线导出不改变原项目内容和状态',same(await audit(),initial)&&same(await readDocument(project),source));
 const png=path.join(directory,'彩色网格.png');
 const base64=await session.evaluate(`(()=>{const image=${JSON.stringify(inputImage)},canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);return canvas.toDataURL('image/png').split(',')[1];})()`);
 await writeFile(png,Buffer.from(base64,'base64'));
 await openImage(png);check('原生图片打开默认普通导入且高级参数隐藏',await session.evaluate("document.getElementById('modal-form').elements.processing.value==='normal'&&document.getElementById('repair-advanced').hidden&&!document.getElementById('modal-submit').disabled"));
 await cancel();await idle();check('取消普通图片预览保留原项目',same(await audit(),initial));
 await openImage(png);const plain=await confirmAndSave('普通导入');
 check('普通PNG导入另存后Rust重读像素无损',plain.width===64&&plain.height===64&&same([...composite(plain,0)],inputImage.data));
 const beforeRepair=await audit();
 await openImage(png);await inputs({processing:'repair'});await cancel();await idle();
 await new Promise(resolve=>setTimeout(resolve,350));check('计算期间取消保留作品且无过期错误',same(await audit(),beforeRepair)&&await session.evaluate("!document.getElementById('error-dialog').open"));
 await openImage(png);await inputs({processing:'repair'});await ready();
 check('自动网格检测真实Worker完成并解锁确认',await session.evaluate("!document.getElementById('repair-advanced').hidden&&document.getElementById('repair-status').textContent.includes('完成')&&document.getElementById('sheet-import-preview').width>0"));
 await session.evaluate("document.getElementById('repair-advanced').open=true");
 await inputs({'repair.manual':true,'repair.cellWidth':8,'repair.cellHeight':8,'repair.reduceColors':true,'repair.maxColors':3});await ready();
 const palette=await session.evaluate("[...document.querySelectorAll('#repair-palette-colors code')].map(el=>el.textContent)");
 check('手动网格和限色列表来自实际处理结果',palette.length===3&&same(palette,repairPalette(new Uint8ClampedArray(expected))));
 await session.screenshot(root+'/repair-preview.png');
 const repaired=await confirmAndSave('修复导入');
 check('修复确认另存后Rust重读为8×8已知像素',repaired.width===8&&repaired.height===8&&same([...composite(repaired,0)],expected));
 check('实际修复色板与输出像素和预览一致',same(repaired.palette,palette));
 const repairedState=await audit();await openImage(png);await inputs({processing:'repair','repair.targetWidth':0});await inputs({processing:'normal'});
 check('切回普通导入恢复原尺寸并忽略禁用高级参数',await session.evaluate("(()=>{const f=document.getElementById('modal-form');return f.elements.width.value==='64'&&f.elements.height.value==='64'&&f.elements['repair.targetWidth'].disabled&&f.checkValidity()&&!document.getElementById('modal-submit').disabled&&document.getElementById('repair-advanced').hidden;})()"));
 await cancel();await idle();check('切换处理模式并取消保留已保存修复文档',same(await audit(),repairedState));
 check('处理流程无错误弹窗且原二进制文件不变',await session.evaluate("!document.getElementById('error-dialog').open")&&same(await readDocument(project),source));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){
  await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
  for(const file of [project,...created]){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}
 }
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

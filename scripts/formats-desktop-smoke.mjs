import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {mkdir,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {GifReader} from 'omggif';
import {composite} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','formats-'+Date.now()),project=path.join(directory,'格式验收.pix'),root=process.env.MINEPIX_FORMATS_ROOT||'artifacts/formats-desktop';
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
await copyFile('examples/mushroom.pix',project);
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const same=isDeepStrictEqual;
let app,session,baseline;
const preferenceKeys=['pixel-studio-export-settings-v1','pixpix-locale-v1'];
const created=[];
async function wait(test,label){
 for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}
 throw new Error('等待超时：'+label);
}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const submit=()=>session.evaluate("document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))");
const cancel=()=>session.evaluate("document.querySelector('#modal .modal-actions [value=cancel]').click()");
async function dialog(file,cancel=false){
 await exec('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(app.pid),...(cancel?['-Cancel']:['-FilePath',file])],{windowsHide:true,timeout:20000});
}
async function idle(){await wait(async()=>!(await audit()).busy&&await session.evaluate("!document.getElementById('modal').open"),'编辑器空闲');}
async function readDocument(file){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(file)}))).data);})()`);}
async function decodePng(file){
 const base64=(await readFile(file)).toString('base64');
 return session.evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${base64}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);return{width:canvas.width,height:canvas.height,data:[...context.getImageData(0,0,canvas.width,canvas.height).data]};})()`);
}
async function exportFile(commandId,values,file,cancelSave=false){
 await command(commandId);
 await wait(()=>session.evaluate("document.getElementById('modal').open&&!!document.querySelector('select[name=mode]')"),'导出设置');
 await session.evaluate(`(()=>{const form=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements[name];if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
 if(commandId==='png'&&!cancelSave)await session.screenshot(root+'/png-options.png');
 await submit();await dialog(file,cancelSave);await idle();
 check('导出 '+commandId+' 未显示错误',await session.evaluate("!document.getElementById('error-dialog').open"));
}
async function exportDirectory(values){
 const before=await readdir(directory,{withFileTypes:true});
 await exportFile('sheet-pair',values,directory);
 const after=await readdir(directory,{withFileTypes:true});
 const folder=after.find(entry=>entry.isDirectory()&&!before.some(old=>old.name===entry.name));
 assert.ok(folder,'New atomic export directory');return path.join(directory,folder.name);
}
function checkDocument(name,document,source,expected,metadata=true){
 check(name+' 尺寸帧数像素与时长',document.width===source.width&&document.height===source.height&&document.frames.length===source.frames.length&&document.frames.every((frame,i)=>frame.duration===source.frames[i].duration&&same([...composite(document,i)],expected[i])));
 if(metadata)check(name+' 标签保留',same(document.tags,source.tags));
}
async function importAndSave(commandId,file,name){
 await command(commandId);await dialog(file);
 await wait(()=>session.evaluate("document.getElementById('modal').open"),'导入预览');
 await session.screenshot(root+'/'+name+'-preview.png');
 await submit();
 await wait(async()=>{const state=await audit();return state.dirty&&!state.path&&!state.busy;},name+' 导入完成');
 await idle();
 await writeFile(root+'/'+name+'-state.json',JSON.stringify({audit:await audit(),ui:await session.evaluate("({status:document.getElementById('status').textContent,error:document.getElementById('error-dialog').textContent})")},null,2)+'\n');
 check(name+' 确认形成未保存新项目',(await audit()).dirty&&!(await audit()).path);
 const target=path.join(directory,name+'.pix');created.push(target);
 await command('save');await dialog(target);await idle();
 return readDocument(target);
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有 CDP 会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目加载');
 baseline=await session.evaluate(`Object.fromEntries(${JSON.stringify(preferenceKeys)}.map(key=>[key,localStorage.getItem(key)]))`);
 await session.evaluate("window.minepixLocale.set('zh')");
 const source=await readDocument(project),expected=source.frames.map((_,i)=>[...composite(source,i)]),initial=await audit();
 const png=path.join(directory,'frame.png');
 await exportFile('png',{format:'png',scale:1},png);
 const image=await decodePng(png);
 check('原生PNG保存逐像素无损',image.width===32&&image.height===32&&same(image.data,expected[0]));
 await exportFile('png',{format:'png',scale:1},null,true);
 check('取消原生导出保留源项目',same(await audit(),initial));
 const gif=path.join(directory,'animation.gif');
 await exportFile('gif',{format:'gif',scope:'all',scale:1,direction:'timeline',repeat:'once',colors:256,alphaMode:'threshold',threshold:127},gif);
 const reader=new GifReader(await readFile(gif));
 check('Rust GIF导出帧数尺寸时长',reader.width===32&&reader.height===32&&reader.numFrames()===4&&source.frames.every((frame,i)=>reader.frameInfo(i).delay*10===frame.duration));
 check('Rust GIF独立解码逐帧像素',source.frames.every((_,i)=>{const bytes=Buffer.alloc(32*32*4);reader.decodeAndBlitFrameRGBA(i,bytes);return same([...bytes],expected[i]);}));
 const beforeSequence=await readdir(directory,{withFileTypes:true});
 await exportFile('sequence',{scope:'all',scale:1},directory);
 const sequenceFolder=(await readdir(directory,{withFileTypes:true})).find(entry=>entry.isDirectory()&&!beforeSequence.some(old=>old.name===entry.name));
 assert.ok(sequenceFolder,'Sequence export folder');
 const sequencePath=path.join(directory,sequenceFolder.name),manifestPath=path.join(sequencePath,'animation.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 check('PNG序列清单帧时长标签完整',manifest.frames.length===4&&manifest.frames.every((frame,i)=>frame.duration===source.frames[i].duration&&frame.sourceIndex===i)&&same(manifest.tags,source.tags));
 for(let i=0;i<4;i++){const frame=await decodePng(path.join(sequencePath,manifest.frames[i].file));assert.ok(same(frame.data,expected[i]));}
 check('PNG序列四帧磁盘解码像素一致',true);
 let nativeManifest;
 for(const engineFormat of ['native','phaser','godot']){
  const folder=await exportDirectory({scope:'all',scale:1,columns:2,margin:1,gapX:1,gapY:1,trim:true,pack:true,extrude:1,engineFormat,layerScope:'visible'});
  const files=await readdir(folder),metadataFile=files.find(file=>engineFormat==='native'?file.endsWith('.json'):file.endsWith('.pixpix.json'));
  const metadata=JSON.parse(await readFile(path.join(folder,metadataFile),'utf8'));
  const atlas=await decodePng(path.join(folder,metadata.image));
  check(engineFormat+' 图集元数据与PNG一致',metadata.frames.length===4&&metadata.packed&&metadata.extrude===1&&atlas.width===metadata.size.w&&atlas.height===metadata.size.h&&same(metadata.tags,source.tags));
  for(let i=0;i<4;i++){
   const item=metadata.frames[i],restored=Array(32*32*4).fill(0);
   for(let y=0;y<item.frame.h;y++)for(let x=0;x<item.frame.w;x++){
    const from=((item.frame.y+y)*atlas.width+item.frame.x+x)*4,to=((item.spriteSourceSize.y+y)*32+item.spriteSourceSize.x+x)*4;
    for(let c=0;c<4;c++)restored[to+c]=atlas.data[from+c];
   }
   assert.ok(same(restored,expected[item.sourceIndex]),engineFormat+' atlas frame '+i);
   assert.equal(item.duration,source.frames[item.sourceIndex].duration);
  }
  check(engineFormat+' 裁边打包图集逐帧复原像素时长',true);
  if(engineFormat==='native')nativeManifest=path.join(folder,metadataFile);
  if(engineFormat==='phaser'){
   const file=files.find(file=>file.endsWith('.json')&&!file.endsWith('.pixpix.json')&&!file.endsWith('.animations.json'));
   const phaser=JSON.parse(await readFile(path.join(folder,file),'utf8'));
   const animations=JSON.parse(await readFile(path.join(folder,files.find(file=>file.endsWith('.animations.json'))),'utf8'));
   check('Phaser引擎图集与动画引用完整',phaser.meta.image===metadata.image&&Object.keys(phaser.frames).length===4&&animations.anims.some(animation=>animation.key===source.tags[0].name));
  }
  if(engineFormat==='godot'){
   const text=await readFile(path.join(folder,files.find(file=>file.endsWith('.tres'))),'utf8');
   check('Godot SpriteFrames引用图像与动画',text.includes(metadata.image)&&text.includes(source.tags[0].name)&&text.includes('SpriteFrames')&&text.includes('AtlasTexture'));
  }
 }
 check('所有格式导出不修改源项目与保存状态',same(await audit(),initial));
 await command('import-gif');await dialog(gif);await wait(()=>session.evaluate("document.getElementById('modal').open"),'GIF预览');await cancel();await idle();
 check('取消GIF导入预览保留源文档',same(await audit(),initial));
 checkDocument('GIF导入另存',await importAndSave('import-gif',gif,'GIF导入'),source,expected,false);
 checkDocument('序列清单导入另存',await importAndSave('import-sequence-manifest',manifestPath,'序列导入'),source,expected);
 checkDocument('精灵表JSON导入另存',await importAndSave('import-sheet-json',nativeManifest,'图集导入'),source,expected);
 check('格式流程没有错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable,executableSha256},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable,executableSha256},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){
  await session.evaluate(`(()=>{for(const [key,value]of Object.entries(${JSON.stringify(baseline)})){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}})()`);
  for(const file of [project,...created]){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}
 }
 session?.close();
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

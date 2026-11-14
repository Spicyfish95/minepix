import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,validateDocument} from '../src/model.js';
import {PREVIEW_SETTINGS_KEY} from '../src/preview-settings.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),root=path.resolve('artifacts/preview-capacity-desktop');
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const directory=path.resolve('../minepix-tauri-validation','preview-capacity-'+Date.now()),project=path.join(directory,'预览输出边界.pix');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const input=createDocument(1,1,'预览输出边界');input.width=input.height=1024;
input.layers[0].type='tileset';input.layers[0].tileset={w:1024,h:1024,mode:'corners-and-sides',terrains:[{id:0,name:'草地',color:'#66c266'}],tiles:[{terrain:0,peering:Array(8).fill(0),weight:1}]};
input.frames[0].cels[0][0]=0x448844ff;input.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};
input.requiredFeatures=['tileset','cel-properties'];input.previewTerrain={layerId:1,w:64,h:64,cells:Array(64*64).fill(-1)};
const source=validateDocument(input);
await writeFile(project+'.json',JSON.stringify(source)+'\n');
await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});
const original=await readFile(project),results=[],observed={};let app,main,child,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const v=await test();if(v)return v;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()'),command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const view=()=>main.evaluate(`(()=>{const c=document.querySelector('.terrain-preview-canvas'),e=document.querySelector('.terrain-preview-limit');return{width:c.width,height:c.height,cols:+document.querySelector('.terrain-preview-cols').value,rows:+document.querySelector('.terrain-preview-rows').value,limit:e&&!e.hidden?e.textContent:'',background:e?getComputedStyle(e).backgroundColor:'',error:document.getElementById('error-dialog').open};})()`);
const defaults=()=>main.evaluate(`localStorage.getItem(${JSON.stringify(PREVIEW_SETTINGS_KEY)})`);
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const s=await audit();return !s.dirty&&!s.busy;},'保存'+label);const doc=await readDocument();await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
async function launch(args=[]){
 app=spawn(executable,args,{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'启动');
 main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
 await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'就绪');
 if(args.length)await wait(()=>main.evaluate(`window.documentWindowAudit().path===${JSON.stringify(project)}`),'重开');
}
async function stop(){child?.close();child=null;main?.close();main=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}app=null;await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP释放');}
async function resize(cols,rows){await main.evaluate(`(()=>{const c=document.querySelector('.terrain-preview-cols'),r=document.querySelector('.terrain-preview-rows');c.value=${cols};r.value=${rows};c.dispatchEvent(new Event('change',{bubbles:true}));c.blur();r.blur();})()`);}
async function click(selector){const p=await main.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');
 await launch();baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh')");
 const job=exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/native-file-dialog.ps1'),'-ProcessId',String(app.pid),'-FilePath',project],{windowsHide:true});
 await command('open');await job;
 await wait(()=>main.evaluate(`document.getElementById('error-dialog').open||window.documentWindowAudit().path===${JSON.stringify(project)}`),'源作品打开');
 await main.evaluate("window.workspaceLayout.reveal('terrain-preview')");observed.loaded={audit:await audit(),view:await view()};
 check('合法超大预览作品实际打开而不出现分配错误',!observed.loaded.view.error&&observed.loaded.audit.path===project);
 check('超限预览显示文字且不分配大画布',observed.loaded.view.limit.includes('8M')&&observed.loaded.view.width===0&&observed.loaded.view.height===0&&observed.loaded.view.background!=='rgba(0, 0, 0, 0)');
 check('读取超限预览不改原格子历史与磁盘',observed.loaded.view.cols===64&&observed.loaded.view.rows===64&&!observed.loaded.audit.dirty&&observed.loaded.audit.undo===0&&(await readFile(project)).equals(original));
 check('暂停渲染仍能保存完整原作品',same(validateDocument(await saved('oversize-preserved')),source));await main.screenshot(path.join(root,'limited.png'));
 const detachSelector=await main.evaluate("(()=>{const slot=Object.keys(window.workspaceLayout.state().slots).find(key=>window.workspaceLayout.state().slots[key].includes('terrain-preview'));return '[data-slot=\"'+slot+'\"] .dock-detach';})()");await click(detachSelector);
 await wait(async()=>{for(const target of(await targets()).filter(t=>t.url.endsWith('panel.html'))){const candidate=await connect(target);if(await candidate.evaluate("!!document.getElementById('terrain-preview-panel')")){child=candidate;return true;}candidate.close();}return false;},'原生预览浮窗');
 check('超限说明在真实浮窗可见且画布保持零分配',await child.evaluate("(()=>{const e=document.querySelector('.terrain-preview-limit'),c=document.querySelector('.terrain-preview-canvas');return !e.hidden&&e.textContent.includes('8M')&&e.getBoundingClientRect().width>0&&getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'&&c.width===0&&c.height===0;})()"));
 await child.screenshot(path.join(root,'floating-limited.png'));await child.evaluate("void window.desktop.windowControl('close');true");await wait(()=>main.evaluate("!window.workspaceLayout.floats.has('terrain-preview')"),'浮窗回停靠');child.close();child=null;
 check('回停靠后原作品和预览保持',same(validateDocument(await readDocument()),source)&&!(await audit()).dirty);
 await resize(1,1);let v=await view();
 check('缩小网格恢复正常渲染和置脏',v.width===1024&&v.height===1024&&!v.limit&&(await audit()).dirty&&(await audit()).undo===0);
 let doc=await saved('resized');
 check('只重采样预览且保持原像素与图集',same(doc.previewTerrain,{layerId:1,w:1,h:1,cells:[-1]})&&same(doc.frames,source.frames)&&same(doc.layers,source.layers));
 await main.evaluate("document.querySelector('.terrain-preview-fit').click()");await click('.terrain-preview-canvas');
 doc=await saved('painted');check('恢复后可信预览绘画可保存且历史隔离',same(doc.previewTerrain.cells,[0])&&(await audit()).undo===0&&same(doc.frames,source.frames));
 const before={audit:await audit(),defaults:await defaults(),bytes:await readFile(project),preview:doc.previewTerrain};
 await resize(64,64);v=await view();check('新超限设置在修改作品和偏好前拒绝',v.error&&v.cols===1&&v.rows===1&&v.width===1024&&v.height===1024&&same(await audit(),before.audit)&&await defaults()===before.defaults&&(await readFile(project)).equals(before.bytes));
 await click('#error-dialog button');check('拒绝后保存保持已画预览',same((await saved('rejected-preserved')).previewTerrain,before.preview));
 await stop();await launch([project]);await main.evaluate("window.workspaceLayout.reveal('terrain-preview')");v=await view();
 check('真实重启保持已保存小预览可渲染',!v.error&&!v.limit&&v.width===1024&&v.height===1024&&v.cols===1&&v.rows===1&&!(await audit()).dirty);
 check('重启保存保持完整作品及二进制',same(validateDocument(await saved('reopened')),validateDocument(doc))&&(await readFile(project)).equals(before.bytes));
 await main.screenshot(path.join(root,'complete.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,observed,directory,executable,executableSha256},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,error:error.stack,directory,executable,executableSha256},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 await stop();
}

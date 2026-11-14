import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,validateDocument} from '../src/model.js';
import {addReference} from '../src/reference-board.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),root=path.resolve('artifacts/project-capacity-desktop');
const directory=path.resolve('../minepix-tauri-validation','project-capacity-'+Date.now()),project=path.join(directory,'容量边界.pix');
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(1,1,'容量边界');source.width=4096;source.height=4096;source.frames[0].cels[0][0]=0x448844ff;source.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};source.requiredFeatures=['cel-properties'];
addReference(source,{id:'ref',name:'1像素参考',width:1,height:1,data:'/wAA/w==',x:48,y:80,scale:16});validateDocument(source);
await writeFile(project+'.json',JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',project+'.json',project],{windowsHide:true});const original=await readFile(project);
const results=[],observed={};let app,main,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<400;i++){const v=await test();if(v)return v;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>main.evaluate('window.documentWindowAudit()'),command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
async function readDocument(){return main.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const s=await audit();return !s.dirty&&!s.busy;},'保存'+label);const doc=await readDocument();await writeFile(path.join(root,label+'.json'),JSON.stringify(doc)+'\n');return doc;}
async function launch(){app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(t=>t.url.startsWith('http://tauri.localhost'));}catch{return false;}},'启动');main=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));await wait(()=>main.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');}
async function stop(){main?.close();main=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'自身进程退出');}app=null;await wait(async()=>{try{await targets();return false;}catch{return true;}},'CDP释放');}
async function click(selector){const p=await main.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}
async function reject(id){
 const before=await audit();await command(id);const error=await main.evaluate("({open:document.getElementById('error-dialog').open,text:document.getElementById('error-dialog').textContent})");
 if(!error.open){const doc=await saved('accepted-'+id);observed.invalidSaved=doc;try{validateDocument(doc);}catch(e){observed.reopenError=e.message;}}
 check(id+'在超出参考组合预算前报错',error.open&&error.text.includes('32M'));await click('#error-dialog button');
 check(id+'拒绝后作品历史和磁盘保持',same(await audit(),before)&&(await readFile(project)).equals(original)&&same((await readDocument()).frames,source.frames));
}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');await launch();baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');await main.evaluate("window.workspaceLayout.reset();window.minepixLocale.set('zh');window.workspaceLayout.reveal('reference')");
 check('有效稀疏大画布带参考正常打开',!(await audit()).dirty&&(await audit()).undo===0&&await main.evaluate("document.getElementById('canvas').width===4096&&document.querySelectorAll('.reference-image').length===1"));
 for(const id of['duplicate-frame','duplicate-layer','group-layer','add-frame','add-layer'])await reject(id);
 await click('.reference-image[data-reference-id="ref"]');await main.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete'});await main.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete'});
 check('删除实际参考释放预算且不进绘画历史',await main.evaluate("document.querySelectorAll('.reference-image').length===0")&&(await audit()).dirty&&(await audit()).undo===0);
 await command('duplicate-frame');await wait(async()=>(await audit()).undo===1,'复制帧');let doc=await saved('exact-limit');validateDocument(doc);
 check('无参考精确32M逻辑画布允许复制保存',doc.frames.length===2&&doc.width*doc.height*doc.frames.length===32*1024*1024&&!doc.references?.length&&doc.frames.every(f=>f.cels[0].length===1&&f.cels[0][0]===0x448844ff));
 observed.exactDocument=validateDocument(doc);observed.exactFrames=structuredClone(doc.frames);observed.exactLayers=structuredClone(doc.layers);observed.exactReferences=doc.references;const bytes=await readFile(project);await stop();await launch();check('精确边界保存后真实重启仍可打开',!(await audit()).dirty&&(await audit()).undo===0&&await main.evaluate("document.querySelectorAll('.frame-head').length===2"));
 doc=await saved('reopened');validateDocument(doc);observed.emptyReferencesNormalized=!same(doc.references,observed.exactReferences);observed.firstReopenBytesChanged=!(await readFile(project)).equals(bytes);check('重启再保存完整规范化作品保持',same(validateDocument(doc),observed.exactDocument)&&same(doc.frames,observed.exactFrames)&&same(doc.layers,observed.exactLayers));const normalizedBytes=await readFile(project);await saved('normalized-resave');check('规范化后重复保存二进制保持',(await readFile(project)).equals(normalizedBytes));check('结束没有错误对话框',!await main.evaluate("document.getElementById('error-dialog').open"));await main.screenshot(path.join(root,'complete.png'));
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,results,observed,directory,executable,logicalPixels:32*1024*1024,actualCelPixels:2},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(main)await main.screenshot(path.join(root,'failure.png'));await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,observed,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(main&&baseline){await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await main.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 await stop();
}

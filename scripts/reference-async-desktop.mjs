import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,writeFile,readFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {encodeReference} from '../src/layer-types.js';
import {addReference} from '../src/reference-board.js';
import {unpackProjectRead} from '../src/project-transfer.js';
import {targets,connect} from './cdp.mjs';

await mkdir('artifacts',{recursive:true});
const exec=promisify(execFile),root=await mkdtemp(path.resolve('artifacts/reference-async-'));
const projectTool=path.resolve('src-tauri/target/debug/examples/project-tool.exe');
const executable=path.resolve(process.env.MINEPIX_TEST_EXE||'src-tauri/target/release/minepix-tauri.exe');
const paths={a:path.join(root,'A.pix'),b:path.join(root,'B.pix')},results=[];
await mkdir(path.join(root,'webview'));
for(const [id,file]of Object.entries(paths)){
 const doc=createDocument(4,4,id.toUpperCase());
 addReference(doc,{...encodeReference(24,16,new Uint8Array(24*16*4).fill(255)),id:'ref-'+id,name:'original',x:64,y:64});
 await writeFile(file+'.json',JSON.stringify(doc));
 await exec(projectTool,['encode',file+'.json',file],{windowsHide:true});
}
const app=spawn(executable,Object.values(paths),{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
 WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
let session,logs='',moved=false;
app.stdout.on('data',bytes=>logs+=bytes);app.stderr.on('data',bytes=>logs+=bytes);
const wait=async(test,label)=>{for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);};
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const audit=()=>session.evaluate('window.documentWindowAudit()');
const tab=async id=>session.evaluate(`document.querySelector('.document-tab[data-document-id="${id}"] [role=tab]').click()`);
const disk=async file=>{const out=file+'.read.bin';await exec(projectTool,['read-transfer',file,out],{windowsHide:true});return unpackProjectRead(await readFile(out));};
try{
 const target=await wait(async()=>{try{return(await targets()).find(t=>t.type==='page'&&/^(http:\/\/tauri\.localhost|tauri:)/.test(t.url)&&!t.url.includes('capture.html')&&!t.url.includes('panel.html'));}catch{return false;}},'主窗口');
 session=await connect(target);
 await wait(async()=>session.evaluate('!!window.documentWindowAudit&&window.documentWindowAudit().documents.length===2'),'两份项目');
 const initial=await audit(),a=initial.documents.find(item=>item.name==='A').id,b=initial.documents.find(item=>item.name==='B').id;
 await tab(a);
 await session.evaluate(`window.__originalSave=window.desktop.saveProject;window.desktop.saveProject=async(...args)=>{const result=await window.__originalSave(...args);await new Promise(resolve=>window.__releaseSave=resolve);return result;};void window.documentWindowSave();true`);
 await wait(()=>session.evaluate("typeof window.__releaseSave==='function'"),'保存延迟');
 const point=await session.evaluate("(()=>{const r=document.querySelector('.reference-image').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,zoom:r.width/24};})()");
 check('拖动起点命中参考图而非浮动工具栏',await session.evaluate(`document.elementFromPoint(${point.x},${point.y})?.classList.contains('reference-image')`));
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+40*point.zoom,y:point.y+20*point.zoom,button:'left',buttons:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+40*point.zoom,y:point.y+20*point.zoom,button:'left',buttons:0,clickCount:1});
 await session.evaluate('window.__releaseSave();true');await wait(async()=>!(await audit()).busy,'保存完成');
 check('真实保存期间拖动后仍有未保存更改',(await audit()).dirty);
 check('首次文件保留保存开始时的参考图位置',(await disk(paths.a)).references[0].x===64);
 await session.evaluate('window.desktop.saveProject=window.__originalSave;window.documentWindowSave()');
 check('再次保存后清除标记且移动位置写入文件',!(await audit()).dirty&&(await disk(paths.a)).references[0].x===104);
 const png=(await readFile('src/assets/app-icon.png')).toString('base64');
 await session.evaluate(`window.__originalClipboard=window.desktop.clipboardImages;window.desktop.clipboardImages=()=>new Promise(resolve=>window.__releaseClipboard=()=>resolve([{name:'delayed.png',mime:'image/png',data:${JSON.stringify(png)}}]));`);
 const hover=await session.evaluate("(()=>{const r=document.querySelector('.reference-viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});
 await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV',modifiers:2});
 await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV',modifiers:2});
 await wait(()=>session.evaluate("typeof window.__releaseClipboard==='function'"),'异步剪贴板读取');
 await tab(b);await session.evaluate('window.__releaseClipboard();true');
 await wait(()=>session.evaluate(`document.querySelector('.document-tab[data-document-id="${a}"] [role=tab]').textContent.includes('●')`),'后台标签标记');
 check('读取剪贴板期间切换标签不会把参考图放入新标签',await session.evaluate("document.querySelectorAll('.reference-image').length===1&&!window.documentWindowAudit().dirty"));
 const copy=await wait(()=>session.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(paths.a)})`),'后台恢复副本');
 check('后台标签恢复副本包含新增参考图',await session.evaluate(`window.desktop.loadRecovery(${JSON.stringify(copy.id)}).then(copy=>JSON.parse(copy.data).references.length===2)`));
 await tab(a);
 check('返回原标签可见新增图片且保持未保存',await session.evaluate("document.querySelectorAll('.reference-image').length===2&&window.documentWindowAudit().dirty"));
 await session.evaluate('window.desktop.clipboardImages=window.__originalClipboard;window.documentWindowSave()');
 check('新增参考图正常保存入原项目',(await disk(paths.a)).references.length===2);
 for(const id of [a,b]){
  await tab(id);await session.evaluate(`document.querySelector('.document-tab[data-document-id="${id}"] button:last-child').click()`);
  await wait(async()=>!(await audit()).documents.some(item=>item.id===id),'关闭测试标签');
 }
 await wait(()=>session.evaluate(`[...document.querySelectorAll('.welcome-recent-item')].some(button=>button.title===${JSON.stringify(paths.a)})`),'首页最近记录');
 await rename(paths.a,paths.a+'.held');moved=true;
 await session.evaluate(`[...document.querySelectorAll('.welcome-recent-item')].find(button=>button.title===${JSON.stringify(paths.a)}).click()`);
 await wait(()=>session.evaluate("document.querySelector('#error-dialog').open"),'已删除文件错误');
 check('首页点击已删除记录只报错，不打开其他文件',(await audit()).documents.length===0);
 await session.evaluate("document.querySelector('#error-dialog button').click()");
 await session.evaluate(`[...document.querySelectorAll('.welcome-recent-item')].find(button=>button.title===${JSON.stringify(paths.b)}).click()`);
 await wait(async()=>(await audit()).documents.length===1,'其余最近文件打开');
 check('记录过滤后仍打开所点的正确项目',(await audit()).name==='B');
 await session.screenshot(path.join(root,'complete.png'));
 await session.evaluate("setTimeout(()=>window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'closeConfirmed',args:[]}),0);true");
 await wait(()=>app.exitCode!==null,'应用退出');check('应用正常退出',app.exitCode===0);
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,executable,results},null,2));
 console.log(JSON.stringify({ok:true,checks:results.length,root}));
}catch(error){
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:false,results,error:error.stack},null,2));
 if(session)await session.screenshot(path.join(root,'failure.png')).catch(()=>{});
 throw error;
}finally{
 if(session){
  if(app.exitCode===null)for(const file of Object.values(paths))await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`).catch(()=>{});
  session.close();
 }
 if(app.exitCode===null){app.kill();await new Promise(resolve=>app.once('exit',resolve));}
 if(moved)await rename(paths.a+'.held',paths.a);
 await writeFile(path.join(root,'native.log'),logs);
}

import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const root=path.resolve('artifacts/single-instance');
await mkdir(root,{recursive:true});
const project=path.join(root,'第二个 中文项目.pix');
await copyFile('examples/mushroom.pix',project);
const executable=path.resolve('src-tauri/target/debug/minepix-tauri.exe');
const session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
const results=[],check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
const audit=()=>session.evaluate('window.documentWindowAudit()');
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(expression){
 for(let i=0;i<150;i++){const value=await session.evaluate(expression);if(value)return value;await pause();}
 throw new Error('等待主窗口状态超时：'+expression);
}
function launch(args=[],cwd=process.cwd()){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd,windowsHide:true,stdio:'ignore'});
  const timer=setTimeout(()=>{child.kill();reject(new Error('第二实例没有及时退出'));},15000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('第二实例退出码 '+code));});
 });
}
try{
 const before=await audit();
 await launch([path.basename(project)],root);
 await wait(`window.documentWindowAudit().path===${JSON.stringify(project)}`);
 const opened=await audit();
 check('第二进程退出并将中文空格相对路径交给已有窗口',opened.documents.length===before.documents.length+1);
 check('主窗口继续存在且原项目标签保留',opened.documents.some(item=>item.id===before.id));
 const point=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+window.documentWindowAudit().zoom/2,y:r.y+window.documentWindowAudit().zoom/2}})()");
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait('window.documentWindowAudit().dirty');
 const edited=await audit();
 check('已有窗口可继续真实指针绘画',edited.undo>opened.undo);
 await launch([project]);
 await pause();
 const repeated=await audit();
 check('重复打开同一 PIX 不增加标签',repeated.documents.length===edited.documents.length);
 check('重复打开保留未保存像素及撤销历史',repeated.id===edited.id&&repeated.dirty&&repeated.pixel===edited.pixel&&repeated.undo===edited.undo);
 await launch(['rgba-linked.aseprite'],path.resolve('tests/fixtures'));
 await wait("document.getElementById('modal').open");
 check('从其他工作目录传入 ASE 进入导入预览',await session.evaluate("document.getElementById('modal-title').textContent==='导入 Aseprite · RGBA'"));
 await session.evaluate("document.getElementById('modal').close('cancel')");
 await pause();
 const cancelled=await audit();
 check('取消外部文件导入保留未保存文档',cancelled.id===edited.id&&cancelled.undo===edited.undo&&cancelled.dirty);
 await launch(['grayscale-linked.aseprite','indexed-linked.aseprite'],path.resolve('tests/fixtures'));
 await wait("document.getElementById('modal').open&&document.getElementById('modal-title').textContent==='导入 Aseprite · GRAYSCALE'");
 await session.evaluate("document.getElementById('modal').close('cancel')");
 await wait("document.getElementById('modal').open&&document.getElementById('modal-title').textContent==='导入 Aseprite · INDEXED'");
 await session.evaluate("document.getElementById('modal').close('cancel')");
 await pause();
 check('一次打开多个 ASE 按顺序预览，取消后逐个继续',(await audit()).id===edited.id);
 await launch();
 await pause();
 check('无文件的重复启动仅激活现有窗口',(await audit()).documents.length===edited.documents.length);
 check('单实例交接无错误弹窗',!await session.evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(path.join(root,'verified.png'));
}catch(error){results.push({name:'single instance failure',pass:false,error:error.stack});process.exitCode=1;}
finally{
 session.close();
 const report={ok:!process.exitCode,results};
 await writeFile(path.join(root,'validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}

import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createDocument,addFrame,validateDocument} from '../src/model.js';
import {convertColorMode} from '../src/color-modes.js';
import {linkCels} from '../src/cel-links.js';
import {addReference} from '../src/reference-board.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),root=path.resolve(process.env.MINEPIX_TRANSFER_ROOT||'artifacts/project-transfer/desktop'),directory=path.resolve('../minepix-tauri-validation','transfer-'+Date.now());
const executable=path.resolve('src-tauri/target/release/minepix-tauri.exe'),tool=path.resolve('src-tauri/target/debug/examples/project-tool.exe');
await mkdir(root,{recursive:true});await mkdir(directory,{recursive:true});
const indexed=createDocument(4,3,'索引 链接参考');indexed.frames[0].cels[0][0]=0xff6633ff;indexed.frames[0].cels[0][2]=0x336699ff;addFrame(indexed,0,true);linkCels(indexed,0,[0,1]);
convertColorMode(indexed,'indexed',{palette:'adaptive',colors:4});
addReference(indexed,{id:'ref',name:'透明参考',width:2,height:1,data:'AQIDBAUGBwg=',x:32,y:48,scale:1});
indexed.tags=[{id:'walk',name:'行走',from:0,to:1,color:'#336699',direction:'reverse'}];
const sparse=createDocument(1,1,'稀疏 位置参考');sparse.width=64;sparse.height=48;sparse.frames[0].cels[0]=[0x12345678,0xffffffff];
sparse.frames[0].celProperties={1:{x:3,y:4,width:2,height:1,opacity:50}};sparse.requiredFeatures=['cel-properties'];
addReference(sparse,{id:'sparse-ref',name:'参考',width:1,height:1,data:'/wAA/w==',x:32,y:48,scale:2});
const docs=[indexed,sparse].map(doc=>validateDocument(doc)),paths=[],results=[];let app,session,baseline;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
async function stop(){session?.close();session=null;if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次退出');}await wait(async()=>{try{await targets();return false;}catch{return true;}},'端口释放');}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'已有CDP会话');
 for(const doc of docs){
  const file=path.join(directory,doc.name+'.pix');paths.push(file);await writeFile(file+'.json',JSON.stringify(doc)+'\n');await exec(tool,['encode',file+'.json',file],{windowsHide:true});
  const original=await readFile(file);
  app=spawn(executable,[file],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
  await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.type==='page');}catch{return false;}},'正式启动');
  session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
  await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(file)}`),'项目载入');
  if(!baseline)baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh')");
  const before=await session.evaluate('window.documentWindowAudit()');
  await session.evaluate("document.querySelector('[data-menu-command=save]').click()");
  await wait(()=>session.evaluate("!window.documentWindowAudit().busy"),'菜单保存结束');
  const restored=await session.evaluate(`(async()=>{const list=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(list.findIndex(item=>item.path===${JSON.stringify(file)}))).data);})()`);
  check(doc.name+'正常菜单保存完整元数据与源图',same(restored,JSON.parse(JSON.stringify(doc))));
  check(doc.name+'保存二进制与原编码器逐字节相同',(await readFile(file)).equals(original));
  check(doc.name+'不新增历史不改路径且无错误框',same(await session.evaluate('window.documentWindowAudit()'),before)&&!await session.evaluate("document.getElementById('error-dialog').open"));
  await session.screenshot(path.join(root,doc.colorMode==='indexed'?'indexed.png':'sparse.png'));
  await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);
  await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
  await stop();
 }
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,executable,executableSha256:createHash('sha256').update(await readFile(executable)).digest('hex'),directory},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);for(const file of paths){await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(file)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(file)})`);}}
 await stop();
}

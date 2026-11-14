import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const root=path.resolve(process.env.MINEPIX_UPDATER_ROOT||'artifacts/updater');
const executable=path.resolve(process.env.MINEPIX_UPDATER_EXE||'src-tauri/target/release/minepix-tauri.exe');
const executableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
await mkdir(root,{recursive:true});
const sessions=[],results=[],check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
const main=await connect((await targets()).find(t=>t.type==='page'));sessions.push(main);
let baseline;
const ownPaths=[process.env.MINEPIX_UPDATER_PROJECT,path.join(root,'second.pix')].filter(Boolean);
const cleanup={preferencesRestored:false,ownRecoveryRemoved:false};
const snapshot=()=>main.evaluate('window.desktop.updateState()');
async function wait(session,expression){
 for(let i=0;i<200;i++){const value=await session.evaluate(expression);if(value)return value;await pause();}
 throw new Error('更新状态超时：'+expression);
}
async function status(name){return wait(main,`window.desktop.updateState().then(state=>state.status===${JSON.stringify(name)}?state:null)`);}
async function control(mode){
 const current=(await main.evaluate('window.desktop.appInfo()')).version;
 const response=await fetch('http://127.0.0.1:19412/control',{method:'POST',body:JSON.stringify({mode,current})});
 assert.equal(response.status,200);
}
async function click(session,selector){
 const p=await wait(session,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
async function startDownload(){await click(main,'#update-primary');}
async function draw(session,pixel=0){
 const before=await session.evaluate('window.documentWindowAudit().undo');
 const point=await session.evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;return{x:r.x+z*(${pixel}+.5),y:r.y+z*.5}})()`);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(session,`window.documentWindowAudit().dirty&&window.documentWindowAudit().undo===${before+1}`);
}
async function launch(file){
 await new Promise((resolve,reject)=>{
  const child=spawn(executable,[file],{windowsHide:true,stdio:'ignore'});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Second app '+code)));
 });
}
try{
 await wait(main,'!!window.documentWindowAudit');
 baseline=await main.evaluate('Object.fromEntries(Object.entries(localStorage))');
 await main.evaluate("window.minepixLocale.set('zh')");
 const info=await main.evaluate('window.desktop.appInfo()');
 check('协议测试显式关闭自动检查且状态可读取',!info.autoUpdate&&(await snapshot()).status==='idle');
 await main.evaluate("window.desktop.menuCommand({id:'about'})");
 await wait(main,"document.getElementById('modal').open");
 await click(main,'input[name="auto-update"]');
 await wait(main,'window.desktop.appInfo().then(info=>info.autoUpdate)');
 check('关于页自动检查开关写入 Rust 偏好',true);
 await click(main,'input[name="auto-update"]');
 await wait(main,'window.desktop.appInfo().then(info=>!info.autoUpdate)');
 await main.evaluate("document.getElementById('modal').close('cancel')");
 await control('current');
 await main.evaluate("window.desktop.menuCommand({id:'check-updates'})");
 await status('current');
 check('当前版本状态展示在非模态更新面板',await main.evaluate("!document.getElementById('update-panel').hidden&&document.getElementById('update-status-text').textContent.includes('最新版本')"));
 await control('check-error');await click(main,'#update-primary');
 const failedCheck=await status('error');
 check('检查 HTTP 失败提供可重试原因',failedCheck.error.operation==='check'&&!!failedCheck.error.message);
 await control('available');await click(main,'#update-primary');await status('available');
 check('重试检查恢复可用版本且更新说明剔除脚本',await main.evaluate("document.getElementById('update-status-text').textContent.includes('新版本')&&!document.querySelector('#update-panel .update-notes').textContent.includes('fixture must not execute')"));
 await click(main,'#update-hide');
 check('收起更新面板保留状态和重开入口',await main.evaluate("document.getElementById('update-panel').hidden&&!document.getElementById('update-status').hidden"));
 await click(main,'#update-status');
 check('更新状态入口重新显示原面板',await main.evaluate("!document.getElementById('update-panel').hidden"));
 for(const mode of ['download-error','interrupted','bad-signature','version-mismatch']){
  await control(mode);
  await main.evaluate('window.desktop.checkUpdates()');
  await status('available');await startDownload();
  const error=await status('error');
  check(mode==='bad-signature'?'签名不匹配不能进入安装状态':mode==='version-mismatch'?'签名绑定版本不符不能进入安装状态':mode==='interrupted'?'中途断流可见错误并可重试':'下载 HTTP 失败可见错误并可重试',error.error.operation==='download'&&!!error.error.message);
 }
 await control('slow');await main.evaluate('window.desktop.checkUpdates()');await status('available');
 await startDownload();
 await wait(main,'window.desktop.updateState().then(state=>state.status==="downloading"&&state.progress.transferred>0&&state.progress.total>0&&state.progress.bytesPerSecond>0)');
 check('真实下载报告字节总量、速度和百分比',await main.evaluate("!document.getElementById('update-progress').hidden&&document.getElementById('update-transfer').textContent.includes('/s')"));
 await draw(main);check('下载中编辑器仍可真实绘画',true);
 await click(main,'#update-cancel');await status('cancelled');
 check('取消终止下载并保留重试按钮',await main.evaluate("!document.getElementById('update-primary').hidden"));
 await control('available');await startDownload();await status('downloaded');
 check('重试后仅在签名验证完成后显示就绪',await main.evaluate("document.getElementById('update-primary').textContent.includes('重启')"));
 const second=path.join(root,'second.pix');await copyFile('examples/mushroom.pix',second);
 await launch(second);
 await wait(main,`window.documentWindowAudit().path===${JSON.stringify(second)}`);
 await draw(main);
 const id=await main.evaluate('window.documentWindowAudit().id');
 const label=await main.evaluate(`window.desktop.detachDocument(${JSON.stringify(id)})`);
 let childTarget;
 for(let i=0;i<100;i++){
  for(const target of (await targets()).filter(t=>t.type==='page')){
   const session=await connect(target);sessions.push(session);
   if(await session.evaluate('window.editorHost?.id')===label){childTarget=session;break;}
  }
  if(childTarget)break;await pause();
 }
 assert.ok(childTarget,'Detached editor exists');
 await main.evaluate('void window.desktop.installUpdate();true');
 await wait(main,"document.getElementById('modal').open");
 await main.evaluate("document.getElementById('modal').close('cancel')");
 const cancelled=await status('downloaded');
 check('取消主窗口未保存提示保留已下载包',cancelled.notice==='install-cancelled'&&await childTarget.evaluate('window.documentWindowAudit().dirty'));
 await main.evaluate('void window.desktop.installUpdate();true');
 await wait(main,"document.getElementById('modal').open");
 await click(main,'#modal-submit'); // save the already selected PIX; no file picker is substituted
 await wait(childTarget,"document.getElementById('modal').open");
 await childTarget.evaluate("document.getElementById('modal').close('cancel')");
 await status('downloaded');
 check('安装预检覆盖独立窗口，取消后仍可编辑',await childTarget.evaluate('window.documentWindowAudit().dirty')&&!await main.evaluate('window.documentWindowAudit().dirty'));
 await draw(childTarget,16);
 check('取消子窗预检后实际绘画产生新的撤销记录',await childTarget.evaluate('window.documentWindowAudit().undo===2'));
 await main.evaluate('void window.desktop.installUpdate();true');
 await wait(childTarget,"document.getElementById('modal').open");await click(childTarget,'#modal-submit');
 const invalid=await status('error');
 check('已签名但非安装器的协议样本明确安装失败且进程保留',invalid.error.operation==='install'&&!await main.evaluate("document.getElementById('error-dialog').open"));
 const retry=await main.evaluate('window.desktop.installUpdate()');
 check('安装失败可显式重试而不丢失已下载数据',retry.status==='error'&&retry.error.operation==='install');
 await main.screenshot(path.join(root,'protocol-desktop.png'));
}catch(error){results.push({name:'updater protocol failure',pass:false,error:error.stack});process.exitCode=1;}
finally{
 try{
  if(baseline){
   for(const ownPath of ownPaths)await main.evaluate(`window.desktop.discardRecovery(${JSON.stringify(ownPath)})`);
   cleanup.ownRecoveryRemoved=(await Promise.all(ownPaths.map(ownPath=>main.evaluate(`window.desktop.recoveryForPath(${JSON.stringify(ownPath)})`)))).every(value=>!value);
   await main.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);
   cleanup.preferencesRestored=same(await main.evaluate('Object.fromEntries(Object.entries(localStorage))'),baseline);
  }
 }catch(error){results.push({name:'protocol cleanup failure',pass:false,error:error.stack});process.exitCode=1;}
 if(!Object.values(cleanup).every(Boolean))process.exitCode=1;
 for(const session of sessions)session.close();
 const report={ok:!process.exitCode,executable,executableSha256,usesRealNetworkAndSignatureVerification:true,installsRealPackage:false,results,cleanup};
 await writeFile(path.join(root,'protocol-validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}

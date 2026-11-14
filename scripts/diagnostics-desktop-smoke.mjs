import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const auditMode=process.argv[2]==='audit',root=path.resolve('artifacts/diagnostics');
await mkdir(root,{recursive:true});
const session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
const results=[],check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(expression){
 for(let i=0;i<150;i++){const value=await session.evaluate(expression);if(value)return value;await pause();}
 throw new Error('诊断桌面状态超时：'+expression);
}
try{
 await wait('!!window.documentWindowAudit');
 const info=await session.evaluate('window.desktop.appInfo()');
 check('应用返回正确的显式诊断模式',info.inputAudit===auditMode);
 if(!auditMode){
  const rejected=await session.evaluate("window.desktop.recordInputAudit({samples:[]}).then(()=>false,error=>error.message.includes('--input-audit'))");
  check('正常模式拒绝写诊断记录',rejected);
  await session.evaluate("window.desktop.menuCommand({id:'about'})");
  await wait("document.getElementById('modal').open");
  check('关于页展示固定仓库链接',await session.evaluate("document.getElementById('about-repository').getAttribute('href')==='https://github.com/Spicyfish95/minepix'"));
  await session.evaluate("window.__repositoryResult=null;const original=window.desktop.openRepository;window.desktop.openRepository=async(...args)=>{const result=await original(...args);window.__repositoryResult=result;return result;};document.getElementById('about-repository').click();true");
  await wait('window.__repositoryResult===true');
  check('点击关于链接实际调用系统浏览器入口成功',true);
  await session.evaluate("document.getElementById('modal').close('cancel')");
 }else{
  await wait("!!document.querySelector('.device-audit')");
  check('诊断启动自动显示采样界面',await session.evaluate("document.querySelector('.device-audit').textContent.includes('保存验收记录')"));
  await session.evaluate("window.__lastAudit=null;const original=window.desktop.recordInputAudit;window.desktop.recordInputAudit=async(...args)=>{const result=await original(...args);window.__lastAudit=result;return result;};true");
  const canvas=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()");
  const point={x:canvas.x+canvas.w*.2,y:canvas.y+canvas.h*.5};
  await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.1});
  for(let i=0;i<14;i++)await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+i*5,y:point.y,button:'left',buttons:1,pointerType:'pen',force:.1+i*.05});
  await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+65,y:point.y,button:'left',buttons:0,clickCount:1,pointerType:'pen',force:0});
  await session.evaluate("document.querySelector('.device-audit button').click()");
  await wait("document.querySelector('.device-audit output').textContent.includes('记录已保存')&&window.__lastAudit");
  const saved=await session.evaluate('window.__lastAudit'),record=JSON.parse(await readFile(saved.filePath,'utf8'));
  check('模拟压力笔事件经真实监听器收集并通过门槛',record.ok&&record.trustedPenSamples>=10&&record.pressureVaries&&record.strokes>=1&&!record.gestureActive);
  check('原子落盘保留采样与当前显示器信息',record.samples.length>=10&&record.displays.length>=1&&record.displays[0].scaleFactor>0&&typeof record.recordedAt==='string');
  await writeFile(path.join(root,'emulated-device-record.json'),JSON.stringify({verificationSource:'CDP pen emulation; not physical hardware',record},null,2)+'\n');
 }
 check('诊断操作无错误弹窗',!await session.evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(path.join(root,auditMode?'audit.png':'about.png'));
}catch(error){results.push({name:'diagnostics failure',pass:false,error:error.stack});process.exitCode=1;}
finally{
 session.close();
 const report={ok:!process.exitCode,physicalHardwareVerified:false,results};
 await writeFile(path.join(root,auditMode?'audit-validation.json':'about-validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}

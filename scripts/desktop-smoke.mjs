import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {targets,connect} from './cdp.mjs';

const results=[],sessions=[];
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function wait(test){for(let i=0;i<150;i++){const result=await test();if(result)return result;await pause();}throw new Error('Desktop condition timed out');}
async function editors(){const list=[];for(const target of (await targets()).filter(t=>t.type==='page'&&!t.url.endsWith('panel.html'))){const session=await connect(target);sessions.push(session);list.push({session,host:await session.evaluate('window.editorHost')});}return list;}
const root=process.env.MINEPIX_SMOKE_ROOT||'artifacts/desktop-core';await mkdir(root,{recursive:true});
try{
 const main=(await editors()).find(e=>!e.host.detached).session;
 const audit=()=>main.evaluate('window.documentWindowAudit()');
 check('打开新版二进制动画项目',(await audit()).documents.length===1&&!(await main.evaluate("document.getElementById('error-dialog').open")));
 if(process.env.MINEPIX_REQUIRE_EMBEDDED)check('使用内嵌页面而非开发服务器',await main.evaluate("location.hostname==='tauri.localhost'||location.protocol==='tauri:'"));
 const initial=await audit(),before=await readFile(initial.path);
 const point=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+8,y:r.y+8}})()");
 await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(async()=>(await audit()).dirty);
 check('真实指针绘画建立撤销记录',(await audit()).undo===initial.undo+1);
 const command=id=>main.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
 await command('undo');await wait(async()=>(await audit()).redo===1);check('菜单撤销恢复保存状态',!(await audit()).dirty);
 await command('redo');await wait(async()=>(await audit()).dirty);check('菜单重做恢复画笔修改',(await audit()).undo===1);
 await command('save');await wait(async()=>!(await audit()).dirty&&!(await audit()).busy);
 const saved=await readFile(initial.path);check('保存为二进制且实际内容改变',saved.subarray(0,8).equals(Buffer.from('MINEPIX\0'))&&!saved.equals(before));
 await main.evaluate("document.querySelector('.dock-right-top .dock-detach').click()");
 await wait(()=>main.evaluate('window.workspaceLayout.floats.size===1'));
 await wait(async()=>(await targets()).some(t=>t.url.endsWith('panel.html')));
 check('点击面板分离按钮创建真实子窗口',true);
 const panel=await connect((await targets()).find(t=>t.url.endsWith('panel.html')));sessions.push(panel);
 await panel.evaluate("void window.desktop.windowControl('close');true");
 await wait(()=>main.evaluate('window.workspaceLayout.floats.size===0'));
 check('关闭面板回到父窗口',await main.evaluate('window.workspaceLayout.panels.preview.ownerDocument===document'));
 const id=(await audit()).id;
 await main.evaluate(`window.desktop.detachDocument(${JSON.stringify(id)})`);
 const child=(await editors()).find(e=>e.host.detached).session;
 const detached=await child.evaluate('window.documentWindowAudit()');
 check('文档拆窗保留内容路径和历史',detached.id===id&&detached.path===initial.path&&detached.undo===1&&(await audit()).documents.length===0);
 await child.evaluate("void window.desktop.windowControl('close');true");
 await wait(async()=>(await audit()).documents.length===1);
 check('关闭独立文档回收到主窗口',(await audit()).id===id&&(await audit()).undo===1);
 await main.screenshot(root+'/verified.png');
 check('桌面流程结束无错误弹窗',!await main.evaluate("document.getElementById('error-dialog').open"));
}catch(error){results.push({name:'desktop failure',pass:false,error:error.stack});process.exitCode=1;}
finally{for(const session of sessions)session.close();await writeFile(root+'/smoke.json',JSON.stringify({ok:!process.exitCode,results},null,2)+'\n');console.log(JSON.stringify({ok:!process.exitCode,results},null,2));}

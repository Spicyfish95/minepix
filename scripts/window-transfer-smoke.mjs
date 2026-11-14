import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connect,targets} from './cdp.mjs';
const results=[],sessions=[];
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function wait(test){for(let i=0;i<150;i++){if(await test())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Window condition timed out');}
try{
 let main;
 for(const target of (await targets()).filter(t=>t.type==='page')){const session=await connect(target);sessions.push(session);if(await session.evaluate('window.editorHost?.id==="main"'))main=session;}
 assert.ok(main,'Main editor must be running');
 const before=await main.evaluate('window.documentWindowAudit()');assert.equal(before.documents.length,1);
 const label=await main.evaluate(`window.desktop.detachDocument(${JSON.stringify(before.id)})`);
 check('拆窗后主窗口不再持有文档',(await main.evaluate('window.documentWindowAudit().documents.length'))===0);
 await main.evaluate(`window.desktop.moveDocument(${JSON.stringify({owner:label,id:before.id,after:false})})`);
 await wait(async()=>(await targets()).filter(t=>t.type==='page').length===1);
 const after=await main.evaluate('window.documentWindowAudit()');
 check('跨窗口移动保留文档标识路径和历史',after.id===before.id&&after.path===before.path&&after.undo===before.undo);
 check('移走最后文档后空子窗口关闭',(await targets()).filter(t=>t.type==='page').length===1);
 const point=await main.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+40,y:r.y+8}})()");
 await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await wait(()=>main.evaluate('window.documentWindowAudit().dirty'));
 await main.evaluate("window.quitResult=null;void window.desktop.menuCommand({role:'quit'}).then(()=>window.quitResult=true);true");
 await wait(()=>main.evaluate("document.getElementById('modal').open"));
 check('未保存退出显示保存提示',await main.evaluate("document.getElementById('modal-title').textContent.includes('保存')"));
 await main.evaluate("document.getElementById('modal').close('cancel')");
 await wait(()=>main.evaluate('window.quitResult===true'));
 check('取消退出保留窗口文档和未保存修改',await main.evaluate(`window.documentWindowAudit().id===${JSON.stringify(before.id)}&&window.documentWindowAudit().dirty`));
 await main.evaluate("document.querySelector('[data-menu-command=undo]').click()");
 await wait(()=>main.evaluate('!window.documentWindowAudit().dirty'));
 check('取消退出后编辑操作继续可用',await main.evaluate(`window.documentWindowAudit().undo===${before.undo}`));
 check('结束无错误弹窗',!await main.evaluate("document.getElementById('error-dialog').open"));
}catch(error){results.push({name:'failure',pass:false,error:error.stack});process.exitCode=1;}
finally{for(const session of sessions)session.close();const report={ok:!process.exitCode,results};await writeFile('artifacts/desktop-core/window-transfer.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}

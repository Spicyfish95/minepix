import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
import {validateDocument,composite} from '../src/model.js';

const run=promisify(execFile),root=path.resolve('artifacts/aseprite/desktop');
const processId=Number(process.argv[2]);
assert.ok(Number.isInteger(processId)&&processId>0,'传入本次验证程序的 PID');
await mkdir(root,{recursive:true});
const results=[],check=(name,pass)=>{assert.ok(pass,name);results.push({name,pass:true});};
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
const session=await connect((await targets()).find(t=>t.type==='page'&&!t.url.endsWith('panel.html')));
const audit=()=>session.evaluate('window.documentWindowAudit()');
async function wait(expression){
 for(let i=0;i<150;i++){const value=await session.evaluate(expression);if(value)return value;await pause();}
 throw new Error('等待桌面状态超时：'+expression);
}
async function point(expression){
 return wait(`(()=>{const el=${expression};if(!el||!el.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
}
async function click(expression){
 const p=await point(expression);
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
async function menu(group,command){
 await click(`document.querySelector('[data-top-menu="文件"]')`);
 await pause();
 const p=await point(`[...document.querySelectorAll('.app-menu:popover-open > button')].find(el=>el.textContent===${JSON.stringify(group)})`);
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
 await pause();
 await click(`document.querySelector('[data-menu-command="${command}"]')`);
}
async function dialog(file,cancel=false){
 await run('powershell.exe',['-NoProfile','-File','scripts/native-file-dialog.ps1','-ProcessId',String(processId),...(cancel?['-Cancel']:['-FilePath',file])],{timeout:20000});
}
const modal="document.getElementById('modal')",fixture=path.resolve('tests/fixtures/rgba-linked.aseprite');
const output=path.join(root,'native-export.aseprite');
try{
 // A prior manual preview may be open; cancel it before measuring baseline state.
 if(await session.evaluate(`${modal}.open`))await session.evaluate(`${modal}.close('cancel')`);
 await pause();
 const before=await audit();
 await menu('导入','import-aseprite');await dialog(null,true);
 await pause();
 check('取消原生打开对话框保留项目',JSON.stringify(await audit())===JSON.stringify(before));
 await menu('导入','import-aseprite');await dialog(fixture);
 await wait(`${modal}.open`);
 check('原生文件选择进入 ASE 导入预览',await session.evaluate("document.getElementById('modal-title').textContent==='导入 Aseprite · RGBA'"));
 await click(`document.querySelector('#modal [value="cancel"]')`);
 await wait(`!${modal}.open`);
 check('取消导入预览保留文档内容与保存状态',JSON.stringify(await audit())===JSON.stringify(before));
 await menu('导入','import-aseprite');await dialog(fixture);
 await wait(`${modal}.open`);
 await click("document.getElementById('modal-submit')");
 await wait(`window.documentWindowAudit().dirty&&window.documentWindowAudit().id!==${JSON.stringify(before.id)}&&!${modal}.open`);
 const imported=await audit();
 check('确认后成为未保存项目且恢复链接图像',imported.dirty&&!imported.path&&imported.linked&&imported.pixel===0xff0000ff);
 await rm(output,{force:true});
 await menu('导出','export-aseprite');
 await wait(`${modal}.open`);
 await click("document.getElementById('modal-submit')");
 await dialog(output);
 await wait("document.getElementById('status').textContent==='已导出 Aseprite RGBA'");
 const bytes=await readFile(output);
 check('实际菜单与原生保存框写出 ASE',bytes.readUInt16LE(4)===0xa5e0);
 check('导出不改变文档保存状态或历史',JSON.stringify(await audit())===JSON.stringify(imported));
 const decoded=path.join(root,'native-export.json');
 execFileSync(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['ase-import',output,decoded]);
 const next=validateDocument(JSON.parse(await readFile(decoded,'utf8')).doc);
 const reference=validateDocument(JSON.parse(await readFile(path.resolve('artifacts/aseprite/rgba-linked.aseprite.json'),'utf8')).doc);
 for(let f=0;f<reference.frames.length;f++){
  assert.equal(next.frames[f].duration,reference.frames[f].duration);
  assert.deepEqual(Array.from(composite(next,f)),Array.from(composite(reference,f)));
 }
 assert.deepEqual(next.tags,reference.tags);assert.deepEqual(next.slices,reference.slices);
 check('原生导出逐帧合成像素、时长和元数据一致',true);
 await menu('导出','export-aseprite');await wait(`${modal}.open`);
 await click("document.getElementById('modal-submit')");await dialog(null,true);
 await wait("document.getElementById('status').textContent==='已取消导出'");
 check('取消原生导出不修改文档',JSON.stringify(await audit())===JSON.stringify(imported));
 check('菜单导入导出无错误弹窗',!await session.evaluate("document.getElementById('error-dialog').open"));
 await session.screenshot(path.join(root,'verified.png'));
}catch(error){results.push({name:'ASE desktop failure',pass:false,error:error.stack});process.exitCode=1;}
finally{
 session.close();
 const report={ok:!process.exitCode,results};
 await writeFile(path.join(root,'validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}

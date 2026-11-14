import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','cel-range-'+Date.now()),project=path.join(directory,'矩形范围.pix'),root='artifacts/cel-range-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(4,4,'矩形范围');source.layers=Array.from({length:3},(_,i)=>({id:i+1,name:'层'+(i+1),visible:true,locked:false,opacity:100}));
source.frames=Array.from({length:5},(_,f)=>({duration:120+f*20,cels:source.layers.map((_,l)=>{const pixels=Array(16).fill(0);pixels[0]=((40+f*35)<<24|(30+l*70)<<16|0x1480)>>>0;pixels[5]=((70+f*30)<<24|(50+l*65)<<16|0x40ff)>>>0;return pixels;})}));
source.frames[2].cels[2][15]=0xffffffff;
source.tags=[{id:'range',name:'范围标签',from:0,to:3,color:'#668fb7',direction:'forward'}];
const model=path.join(directory,'source.json');await writeFile(model,JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',model,project],{windowsHide:true});
const originalBytes=await readFile(project),results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,session,baseline;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"], [data-action="${id}"]').click()`);
const selection=()=>session.evaluate("[...document.querySelectorAll('.cel.selected')].map(el=>[+el.dataset.frame,+el.dataset.layer])");
async function readDocument(){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},label+'保存完成');const doc=await readDocument();await writeFile(root+'/'+label+'.json',JSON.stringify(doc)+'\n');return doc;}
async function point(selector){return wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;el.scrollIntoView({block:'nearest',inline:'nearest'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);}
async function releaseModifiers(modifiers){if(modifiers&2)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',modifiers:0});if(modifiers&8)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',modifiers:0});}
async function click(selector,modifiers=0){const p=await point(selector);await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1,modifiers});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1,modifiers});await releaseModifiers(modifiers);}
const cellSelector=(f,l)=>`.cel[data-frame="${f}"][data-layer="${l}"]`;
const cell=(f,l,modifiers=0)=>click(cellSelector(f,l),modifiers);
async function rectangle(){await cell(0,1);await cell(1,0,8);}
async function key(key,modifiers=0){await session.evaluate("document.getElementById('timeline-grid').focus({preventScroll:true})");const code=key.length===1?'Key'+key.toUpperCase():key;await session.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await session.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});await releaseModifiers(modifiers);}
async function formValues(values,preview=false){await session.evaluate(`(()=>{const f=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify(values)})){f.elements[name].value=value;${preview?"f.elements[name].dispatchEvent(new Event('input',{bubbles:true}));":''}}})()`);}
async function submit(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'));}).then(()=>true)");}
async function cancel(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.querySelector('#modal .modal-actions [value=cancel]').click();}).then(()=>true)");}
async function modal(id){await command(id);await wait(()=>session.evaluate("document.getElementById('modal').open"),id+'弹窗');}
async function rejected(id,label){const before=await audit(),cells=await selection(),doc=await readDocument();await command(id);await wait(()=>session.evaluate("document.getElementById('error-dialog').open"),label+'错误');check(label+'显示错误且历史范围不变',(await audit()).undo===before.undo&&same(await selection(),cells));await session.evaluate("document.querySelector('#error-dialog .primary').click()");check(label+'整组保持磁盘内容',same((await saved(label)).frames,doc.frames));}
const selectedTargets=[{f:0,l:0},{f:0,l:1},{f:1,l:0},{f:1,l:1}];
const canvas=()=>session.evaluate("document.getElementById('canvas').toDataURL()");
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh');window.workspaceLayout.reveal('timeline')");
 check('正式包三层五帧且无开发入口',await session.evaluate("document.querySelectorAll('.layer').length===3&&document.querySelectorAll('.frame-head').length===5&&typeof window.runEditingSmoke==='undefined'"));
 await click('.visual-segments [data-mode="cels"]');
 const start=await point(cellSelector(0,2)),end=await point(cellSelector(1,1));
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+(end.x-start.x)*i/5,y:start.y+(end.y-start.y)*i/5,button:'left',buttons:1});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',buttons:0,clickCount:1});
 check('可信指针捕获拖动形成跨帧跨层四cel',same(await selection(),[[0,2],[1,2],[0,1],[1,1]]));
 await cell(0,2);await cell(2,0,8);check('Shift点击形成三帧三层矩形',(await selection()).length===9);
 await key('ArrowLeft',8);check('Shift方向键扩展到两帧三层',(await selection()).length===6);await key('ArrowUp');check('普通方向键收回单cel',same(await selection(),[[1,1]]));
 await rectangle();await key('c',2);await cell(2,2);const beforePaste=await audit();await key('v',2);let doc=await saved('pasted');
 check('Ctrl粘贴保持源层序和帧序',[0,1].every(f=>same(doc.frames[2+f].cels[2],source.frames[f].cels[1])&&same(doc.frames[2+f].cels[1],source.frames[f].cels[0])));
 check('粘贴透明像素覆盖旧目标且单步历史',doc.frames[2].cels[2][15]===0&&(await audit()).undo===beforePaste.undo+1&&(await selection()).length===4);
 await command('undo');check('粘贴撤销恢复全部帧且收回选择',same((await saved('paste-undone')).frames,source.frames)&&(await selection()).length===1);
 await rectangle();await click('.layer[data-index="0"] .layer-lock');await saved('locked');await rejected('clear-cels','locked-clear');
 await click('.layer[data-index="0"] .layer-lock');await click('.layer[data-index="1"] .layer-visibility');await saved('hidden');await rejected('cut-cels','hidden-cut');
 await click('.layer[data-index="1"] .layer-visibility');await cell(2,2);await key('v',2);doc=await saved('clipboard-preserved');
 check('失败剪切保留此前完整剪贴板',[0,1].every(f=>same(doc.frames[2+f].cels[2],source.frames[f].cels[1])&&same(doc.frames[2+f].cels[1],source.frames[f].cels[0])));await command('undo');await saved('clipboard-undone');
 await rectangle();const beforeCut=await audit();await key('x',2);doc=await saved('cut');check('Ctrl剪切清空整组但保留帧层和标签',selectedTargets.every(({f,l})=>doc.frames[f].cels[l].every(p=>p===0))&&doc.frames.length===5&&doc.layers.length===3&&same(doc.tags,source.tags)&&(await audit()).undo===beforeCut.undo+1);
 await command('undo');check('剪切单步撤销恢复全部像素',same((await saved('cut-undone')).frames,source.frames));
 await rectangle();await modal('move-cels');await formValues({frames:1,layers:1});await submit();doc=await saved('moved');const moved=structuredClone(source.frames);for(const {f,l}of selectedTargets)moved[f].cels[l].fill(0);for(const {f,l}of selectedTargets)moved[f+1].cels[l+1]=source.frames[f].cels[l];
 check('跨帧跨层重叠移动使用源快照',same(doc.frames,moved));check('移动保持标签时长和层属性',same(doc.tags,source.tags)&&same(doc.layers,source.layers));await command('undo');check('移动单步撤销还原全部帧',same((await saved('move-undone')).frames,source.frames));
 await rectangle();const beforeCancel=await audit(),rangeBefore=await selection();await modal('move-cels');await formValues({frames:1,layers:1});await cancel();check('取消移动保持内容范围历史',(await audit()).undo===beforeCancel.undo&&same(await selection(),rangeBefore)&&same((await saved('move-cancelled')).frames,source.frames));
 await cell(4,0);await rejected('paste-cels','out-of-bounds');
 await rectangle();await command('flip-cels-x');doc=await saved('flipped');const flipped=structuredClone(source.frames);for(const {f,l}of selectedTargets){const p=flipped[f].cels[l];[p[0],p[1]]=[p[1],p[0]];[p[4],p[5]]=[p[5],p[4]];}
 check('共同内容边界翻转所有选中cel且未选不变',same(doc.frames,flipped));await command('undo');await saved('flip-undone');await rectangle();
 const beforeTransform=await audit(),transformRange=await selection(),beforeCanvas=await canvas();await modal('transform-cels');
 check('批量变换显示四cel共同边界面板',await session.evaluate("document.getElementById('modal-title').textContent.includes('4 个 cel')&&document.getElementById('modal-form').elements.width.value==='2'&&document.getElementById('modal-form').elements.height.value==='2'"));
 await formValues({x:1},true);check('批量预览改变实际画布且不写历史',(await canvas())!==beforeCanvas&&(await audit()).undo===beforeTransform.undo);await session.screenshot(root+'/preview.png');await cancel();
 check('取消变换还原画布范围历史',same(await selection(),transformRange)&&(await canvas())===beforeCanvas&&(await audit()).undo===beforeTransform.undo);check('取消变换Rust重读像素完全还原',same((await saved('transform-cancelled')).frames,source.frames));
 await modal('transform-cels');await formValues({angle:90},true);await submit();doc=await saved('rotated');const rotated=structuredClone(source.frames);for(const {f,l}of selectedTargets){const p=rotated[f].cels[l];const a=p[0],b=p[5];p[0]=0;p[5]=0;p[1]=a;p[4]=b;}
 check('90度变换所有cel且保持未选帧像素',same(doc.frames,rotated)&&doc.frames[2].cels[2][15]===0xffffffff);check('确认批量变换仅一条历史',(await audit()).undo===beforeTransform.undo+1);await command('undo');check('变换单步撤销恢复全部像素',same((await saved('rotation-undone')).frames,source.frames));
 await rectangle();await click('.layer[data-index="1"] .layer-lock');await saved('transform-locked');await rejected('transform-cels','locked-transform');check('锁定范围没有开启预览',await session.evaluate("!document.getElementById('modal').open&&!document.getElementById('modal').classList.contains('transform-dialog')"));await click('.layer[data-index="1"] .layer-lock');await saved('unlocked');
 await rectangle();const beforePlay=await audit();await click('#play');await wait(()=>session.evaluate("document.querySelector('#play [data-icon]').dataset.icon==='pause'"),'播放');await command('clear-cels');check('播放期间菜单禁用且历史不变',(await audit()).undo===beforePlay.undo&&await session.evaluate("document.querySelector('[data-menu-command=clear-cels]').disabled"));await session.evaluate("document.querySelector('#cel-actions [data-action=clear-cels]').click()");check('播放期间工具栏同样禁止修改',(await audit()).undo===beforePlay.undo);await click('#play');check('播放后保存内容不变',same((await saved('play-blocked')).frames,source.frames));
 await rectangle();await command('add-layer');check('新增图层后cel选择收回活动项',(await selection()).length===1);await command('undo');doc=await saved('final');check('最终二进制保持原全部帧层标签',same(doc.frames,source.frames)&&same(doc.layers,source.layers)&&same(doc.tags,source.tags));
 check('最终无错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));await session.screenshot(root+'/complete.png');await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable,sourceBytes:originalBytes.length},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

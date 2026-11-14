import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual as same} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument} from '../src/model.js';
import {targets,connect} from './cdp.mjs';

const exec=promisify(execFile),executable=path.resolve(process.argv[2]||'src-tauri/target/release/minepix-tauri.exe');
const directory=path.resolve('../minepix-tauri-validation','timeline-'+Date.now()),project=path.join(directory,'动画时间轴.pix'),root='artifacts/timeline-desktop';
await mkdir(directory,{recursive:true});await mkdir(root,{recursive:true});
const source=createDocument(6,6,'动画时间轴');source.layers=Array.from({length:3},(_,i)=>({id:i+1,name:'层'+(i+1),visible:true,locked:false,opacity:100}));
source.frames=Array.from({length:5},(_,f)=>({duration:120+f*20,cels:source.layers.map((_,l)=>{const pixels=Array(36).fill(0);pixels[l*6+f]=((40+f*35)<<24|(30+l*70)<<16|(20+f*10)<<8|255)>>>0;return pixels;})}));
const model=path.join(directory,'source.json');await writeFile(model,JSON.stringify(source)+'\n');await exec(path.resolve('src-tauri/target/debug/examples/project-tool.exe'),['encode',model,project],{windowsHide:true});
const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
let app,session,baseline;
async function wait(test,label){for(let i=0;i<200;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('等待超时：'+label);}
const audit=()=>session.evaluate('window.documentWindowAudit()');
const command=id=>session.evaluate(`document.querySelector('[data-menu-command="${id}"]').click()`);
const selection=()=>session.evaluate("[...document.querySelectorAll('.frame-head.selected')].map(button=>+button.dataset.frame)");
async function readDocument(){return session.evaluate(`(async()=>{const recent=await window.desktop.recentFiles();return JSON.parse((await window.desktop.openRecent(recent.findIndex(entry=>entry.path===${JSON.stringify(project)}))).data);})()`);}
async function saved(label){await command('save');await wait(async()=>{const state=await audit();return !state.dirty&&!state.busy;},label+'保存完成');const doc=await readDocument();await writeFile(root+'/'+label+'.json',JSON.stringify(doc)+'\n');return doc;}
async function click(selector,modifiers=0){
 const point=await wait(()=>session.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el?.checkVisibility())return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),selector);
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1,modifiers});
 await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1,modifiers});
 if(modifiers&2)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',modifiers:0});
 if(modifiers&8)await session.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',modifiers:0});
}
const frame=(index,modifiers=0)=>click(`.frame-head[data-frame="${index}"]`,modifiers);
async function change(id,value){await session.evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function formValues(values){await session.evaluate(`(()=>{const f=document.getElementById('modal-form');for(const [name,value]of Object.entries(${JSON.stringify(values)}))f.elements[name].value=value;})()`);}
async function submit(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'));}).then(()=>true)");}
async function cancel(){await session.evaluate("new Promise(resolve=>{document.getElementById('modal').addEventListener('close',resolve,{once:true});document.querySelector('#modal .modal-actions [value=cancel]').click();}).then(()=>true)");}
async function cycle(id,value){for(let i=0;i<8;i++){if(await session.evaluate(`document.getElementById(${JSON.stringify(id)}).value===${JSON.stringify(value)}`))return;await click(`[data-select="${id}"]`);}throw new Error('未切换到 '+id+'='+value);}
async function startRecording(){await session.evaluate("window.timelinePlaybackSamples=[];window.timelinePlaybackTimer=setInterval(()=>{const current=+document.querySelector('.frame-head.current').dataset.frame,samples=window.timelinePlaybackSamples;if(samples.at(-1)?.frame!==current)samples.push({frame:current,time:performance.now()});},5)");}
async function stopRecording(name){const samples=await session.evaluate("clearInterval(window.timelinePlaybackTimer);window.timelinePlaybackSamples");await writeFile(root+'/'+name+'.json',JSON.stringify(samples,null,2)+'\n');return samples.map(sample=>sample.frame);}
try{
 let occupied=false;try{await targets();occupied=true;}catch{}assert.ok(!occupied,'CDP端口已有会话');
 app=spawn(executable,[project],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
 app.on('error',error=>{app.launchError=error;});
 await wait(async()=>{if(app.launchError)throw app.launchError;try{return(await targets()).some(target=>target.url.startsWith('http://tauri.localhost'));}catch{return false;}},'正式应用启动');
 session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
 await wait(()=>session.evaluate(`window.documentWindowAudit?.().path===${JSON.stringify(project)}`),'项目载入');
 baseline=await session.evaluate('Object.fromEntries(Object.entries(localStorage))');await session.evaluate("window.minepixLocale.set('zh');window.workspaceLayout.reveal('timeline')");
 check('正式包具备三层五帧且无开发入口',await session.evaluate("document.querySelectorAll('.frame-head').length===5&&document.querySelectorAll('.layer').length===3&&typeof window.runEditingSmoke==='undefined'"));
 await frame(0);await frame(3,8);check('真实Shift点击建立连续四帧多选',same(await selection(),[0,1,2,3]));
 await frame(1,2);check('真实Ctrl点击保留离散帧选择',same(await selection(),[0,2,3]));
 await command('duplicate-frame');const copied=await saved('copied');
 check('离散多帧复制保留全部层像素和时长',copied.frames.length===8&&same(copied.frames.slice(4,7),[source.frames[0],source.frames[2],source.frames[3]]));
 await frame(4);await click('.layer[data-index="2"]');await change('brush',1);await change('brush-shape','square');await change('paint-opacity',100);await change('hex','#abcdef');
 const point=await session.evaluate("(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return{x:r.x+r.width*5.5/6,y:r.y+r.height*5.5/6};})()");
 await session.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
 const painted=await saved('duplicate-painted');check('真实绘画修改副本而原帧保持独立',painted.frames[4].cels[2][35]===0xabcdefff&&painted.frames[0].cels[2][35]===0);
 await command('undo');await command('undo');check('两次撤销恢复复制前所有帧',same((await saved('copy-undone')).frames,source.frames));
 await frame(1);await frame(3,8);await change('duration',200);let doc=await saved('duration');
 check('批量帧时长仅修改选中三帧',same(doc.frames.map(f=>f.duration),[120,200,200,200,200]));
 await click('[data-action="frame-fps"]');await session.evaluate("(()=>{const f=document.querySelector('#frame-fps-popover form');f.elements.fps.value=0;f.requestSubmit();})()");
 check('无效FPS保持气泡并阻止历史修改',await session.evaluate("document.getElementById('frame-fps-popover').matches(':popover-open')&&!document.querySelector('#frame-fps-popover form').checkValidity()"));
 await session.evaluate("(()=>{const f=document.querySelector('#frame-fps-popover form');f.elements.fps.value=12.5;f.requestSubmit();})()");doc=await saved('fps');
 check('12.5FPS实际转换三帧为80ms',same(doc.frames.map(f=>f.duration),[120,80,80,80,200]));
 const timed=structuredClone(doc.frames);
 await click('[data-action="frame-fps"]');const beforeCancel=await audit();await session.evaluate("document.querySelector('#frame-fps-popover form').elements.fps.value=20");await click('#frame-fps-popover [data-close]');
 check('取消FPS不修改时长和历史',(await audit()).undo===beforeCancel.undo&&same((await readDocument()).frames,timed));
 await command('frame-left');doc=await saved('moved');check('三帧左移保持跨层像素和时长',same(doc.frames,[timed[1],timed[2],timed[3],timed[0],timed[4]]));
 await command('reverse-frames');doc=await saved('reversed');check('离散组倒序保留完整帧',same(doc.frames,[timed[3],timed[2],timed[1],timed[0],timed[4]]));
 await command('undo');await command('undo');check('撤销倒序与重排恢复原顺序',same((await saved('order-restored')).frames,timed));
 await frame(1);await frame(3,8);await command('add-tag');await wait(()=>session.evaluate("document.getElementById('modal').open"),'新标签');
 await formValues({name:'行走',from:2,to:4,color:'#668fb7',direction:'reverse'});await submit();doc=await saved('tag-created');
 check('标签创建保留范围方向并激活完整帧选择',doc.tags.length===1&&doc.tags[0].name==='行走'&&doc.tags[0].from===1&&doc.tags[0].to===3&&doc.tags[0].direction==='reverse'&&same(await selection(),[1,2,3]));
 const tagId=doc.tags[0].id;await command('edit-tag');await wait(()=>session.evaluate("document.getElementById('modal').open"),'编辑标签');await formValues({name:'行走循环'});await submit();doc=await saved('tag-renamed');
 check('标签编辑同步名称与播放范围',doc.tags[0].name==='行走循环'&&await session.evaluate("document.getElementById('play-range').selectedOptions[0].textContent==='行走循环'"));
 const beforeDelete=await audit();await command('delete-tag');await wait(()=>session.evaluate("document.getElementById('modal').open"),'删除标签确认');await cancel();check('取消删除标签保持作品与历史',(await audit()).undo===beforeDelete.undo&&same((await readDocument()).tags,doc.tags));
 await click(`.timeline-tag-tab[data-tag="${tagId}"]`);await cycle('play-direction','tag');
 if(!await session.evaluate("document.getElementById('play-once').checked"))await click('[data-toggle="play-once"]');
 const beforePlay=await audit();await startRecording();await click('#play');await wait(()=>session.evaluate("document.getElementById('status').textContent==='单次播放结束'&&document.querySelector('#play [data-icon]').dataset.icon==='play'"),'反向单次播放结束');
 const once=await stopRecording('once-playback');
 check('标签反向单次实际播放3到2到1',same(once.filter((value,i)=>i>0||value!==1),[3,2,1]));
 check('单次结束停在末显示帧且不改历史',await session.evaluate("document.querySelector('.frame-head.current').dataset.frame==='1'")&&(await audit()).undo===beforePlay.undo);
 await click('[data-toggle="play-once"]');await startRecording();await click('#play');await wait(()=>session.evaluate('window.timelinePlaybackSamples.length>=7'),'反向循环跨边界');await click('#play');
 const loop=await stopRecording('loop-playback');check('实际循环按标签反向跨边界且可暂停',loop.length>=7&&loop.slice(1).every((value,i)=>value===({3:2,2:1,1:3})[loop[i]])&&await session.evaluate("document.querySelector('#play [data-icon]').dataset.icon==='play'"));
 check('播放与暂停保持磁盘作品和历史',same((await readDocument()).frames,timed)&&(await audit()).undo===beforePlay.undo);
 await click(`.timeline-tag-tab[data-tag="${tagId}"]`);await command('delete-frame');doc=await saved('range-deleted');
 check('删除标签全部帧同步移除标签',doc.frames.length===2&&doc.tags.length===0&&same(doc.frames,[timed[0],timed[4]]));
 await command('undo');doc=await saved('range-restored');check('撤销同时恢复五帧和原标签',same(doc.frames,timed)&&doc.tags.length===1&&doc.tags[0].id===tagId);
 await frame(0);await cycle('frame-insert','before');await command('add-frame');doc=await saved('blank-inserted');
 check('前插空白帧三个层均空且标签范围平移',doc.frames.length===6&&doc.frames[0].cels.every(cel=>cel.every(pixel=>pixel===0))&&doc.tags[0].from===2&&doc.tags[0].to===4&&same(doc.frames.slice(1),timed));
 await command('undo');await saved('insert-undone');await click(`.timeline-tag-tab[data-tag="${tagId}"]`);await command('delete-tag');await wait(()=>session.evaluate("document.getElementById('modal').open"),'删除标签确认');await submit();doc=await saved('tag-only-deleted');
 check('只删除标签保留全部帧',doc.tags.length===0&&same(doc.frames,timed));await command('undo');doc=await saved('final');
 check('最终Rust重读保留标签与三层五帧',doc.layers.length===3&&same(doc.frames,timed)&&doc.tags.length===1&&doc.tags[0].name==='行走循环'&&doc.tags[0].id===tagId);
 check('正式动画编辑全程无错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
 await session.screenshot(root+'/complete.png');await writeFile(root+'/report.json',JSON.stringify({ok:true,results,directory,executable},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length}));
}catch(error){if(session)await session.screenshot(root+'/failure.png');await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack,directory,executable},null,2)+'\n');throw error;}
finally{
 if(session&&baseline){await session.evaluate(`(()=>{clearInterval(window.timelinePlaybackTimer);const before=${JSON.stringify(baseline)};for(const key of Object.keys(localStorage))if(!Object.hasOwn(before,key))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);})()`);await session.evaluate(`window.desktop.discardRecovery(${JSON.stringify(project)})`);await session.evaluate(`window.desktop.removeRecent(${JSON.stringify(project)})`);}
 session?.close();if(app&&app.exitCode===null&&app.signalCode===null){app.kill();await wait(()=>app.exitCode!==null||app.signalCode!==null,'本次应用退出');}
}

import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
const exec=promisify(execFile),root=path.resolve('artifacts/screen-color-desktop'),port=9223,results=[];await mkdir(root,{recursive:true});
const profile=await mkdtemp(path.join(root,'webview-'));
const wait=async(test,label)=>{for(let i=0;i<150;i++){const value=await test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);};
const fixture=(mode,...args)=>exec('powershell.exe',['-NoProfile','-STA','-File','scripts/screen-color-fixture.ps1','-Mode',mode,...args],{windowsHide:true});
const check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
const app=spawn(path.resolve('src-tauri/target/debug/minepix-tauri.exe'),[],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
let main,overlay,colorWindow,logs='';app.stdout.on('data',data=>logs+=data);app.stderr.on('data',data=>logs+=data);
try{
 await wait(async()=>{try{const target=(await targets(port)).find(t=>t.type==='page'&&!t.url.includes('capture.html')&&!t.url.includes('panel.html'));if(target){main=await connect(target);return true;}}catch{return false;}},'editor');
 await wait(()=>main.evaluate('!!window.documentWindowAudit&&!!window.desktop'),'ready');
 await main.evaluate("window.desktop.menuCommand({id:'new'})");await wait(()=>main.evaluate("document.getElementById('modal').open"),'new dialog');
 await main.evaluate("document.getElementById('modal-form').requestSubmit(document.getElementById('modal-submit'))");await wait(()=>main.evaluate('window.documentWindowAudit().documents.length===1'),'document');
 await main.evaluate("window.desktop.menuCommand({id:'color-mode'})");await wait(()=>main.evaluate("document.getElementById('modal').open"),'color dialog');
 await main.evaluate("(()=>{const form=document.getElementById('modal-form');form.elements.mode.value='indexed';form.elements.mode.dispatchEvent(new Event('change'));form.elements.palette.value='current';form.requestSubmit(document.getElementById('modal-submit'));})()");await wait(()=>main.evaluate("window.documentWindowAudit().mode==='indexed'"),'indexed');
 await main.evaluate("document.querySelector('[data-action=palette-editor]').click()");
 const point=await main.evaluate("(()=>{const r=document.querySelector('#palette .swatch:nth-child(2)').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
 await main.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});

 const before=await main.evaluate("({color:document.querySelector('#palette .swatch:nth-child(2)').getAttribute('aria-label'),undo:window.documentWindowAudit().undo})");
 const clipboardBefore=await main.evaluate('window.desktop.clipboardImages()');
 const ready=path.join(root,'fixture-'+Date.now()+'.json');colorWindow=spawn('powershell.exe',['-NoProfile','-STA','-File','scripts/screen-color-fixture.ps1','-Mode','show','-Output',ready],{windowsHide:true,stdio:'ignore'});
 const source=await wait(async()=>{try{return JSON.parse(await readFile(ready,'utf8'));}catch{return false;}},'external color fixture');
 const begin=async(destination=source)=>{
  await fixture('alt-start','-ProcessId',String(colorWindow.pid),'-X',String(destination.x),'-Y',String(destination.y));
  const target=await wait(async()=>{const target=(await targets(port)).find(t=>t.url.includes('capture.html'));return target;},'overlay target');overlay?.close();overlay=await connect(target);
  await wait(()=>overlay.evaluate("document.body.classList.contains('screen-color-picker')"),'Alt native outside picker');
  const native=JSON.parse((await exec('powershell.exe',['-NoProfile','-File','scripts/capture-window-fixture.ps1','-ProcessId',String(app.pid)],{windowsHide:true})).stdout);assert.ok(native.visible,'native picker is visible');
 };
 await begin();check('Alt pressed while already outside and editor in background starts picker',true);
 check('screen cursor uses eyedropper icon',await overlay.evaluate("getComputedStyle(document.body).cursor.includes('data:image/svg+xml')"));
 await fixture('click','-X',String(source.x),'-Y',String(source.y));await fixture('release');
 await wait(()=>main.evaluate("document.querySelector('#palette .swatch:nth-child(2)').getAttribute('aria-label')==='#2468ac'"),'sampled color');
 check('outside window pixel reaches selected indexed swatch',await main.evaluate("document.getElementById('hex').value.toLowerCase()==='#2468ac'"));
 check('screen pick creates one document undo entry',await main.evaluate(`window.documentWindowAudit().undo===${before.undo+1}`));
 check('screen sampling does not change clipboard',JSON.stringify(await main.evaluate('window.desktop.clipboardImages()'))===JSON.stringify(clipboardBefore));
 await begin({...source,x:source.x2});await fixture('click','-X',String(source.x2),'-Y',String(source.y));await fixture('release');
 await wait(()=>main.evaluate("document.querySelector('#palette .swatch:nth-child(2)').getAttribute('aria-label')==='#9b460f'"),'second sampled color');
 check('two real screen picks create separate history entries',await main.evaluate(`window.documentWindowAudit().undo===${before.undo+2}`));
 await main.evaluate("document.querySelector('[data-action=palette-editor]').click();window.documentWindowUndo()");
 check('first undo after leaving editing restores first sampled color',await main.evaluate("document.querySelector('#palette .swatch:nth-child(2)').getAttribute('aria-label')==='#2468ac'"));
 await main.evaluate('window.documentWindowUndo()');check('second undo restores original indexed swatch',await main.evaluate(`document.querySelector('#palette .swatch:nth-child(2)').getAttribute('aria-label')===${JSON.stringify(before.color)}`));
 const unchanged=await main.evaluate("({color:document.getElementById('hex').value,undo:window.documentWindowAudit().undo})");
 await begin();await fixture('release');await wait(()=>overlay.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureActive',args:[]}).then(active=>!active)"),'Alt release cancellation');
 check('releasing Alt cancels without color or undo change',JSON.stringify(await main.evaluate("({color:document.getElementById('hex').value,undo:window.documentWindowAudit().undo})"))===JSON.stringify(unchanged));
 check('cancelling restores the external foreground window',JSON.parse((await fixture('focus')).stdout).process===colorWindow.pid);
 await fixture('modified-alt');await new Promise(resolve=>setTimeout(resolve,200));check('Ctrl Alt does not start standalone color sampling',await overlay.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureActive',args:[]}).then(active=>!active)"));await fixture('release');
 await main.evaluate('window.desktop.captureScreen()');await wait(()=>overlay.evaluate("!!document.querySelector('.capture-selection')&&!document.body.classList.contains('screen-color-picker')"),'normal screenshot after picking');
 check('normal screenshot still enters selection mode',true);
 await overlay.evaluate("window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'finishCapture',args:[[0,0,2,2]]})");
 const image=await main.evaluate("window.desktop.clipboardImages().then(files=>files[0])"),png=Buffer.from(image.data,'base64');check('normal screenshot still writes cropped PNG to clipboard',png.readUInt32BE(16)===2&&png.readUInt32BE(20)===2);
 await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results,logs},null,2)+'\n');console.log(JSON.stringify({ok:true,results},null,2));
}catch(error){
 const diagnostic={error:error.stack,results,main:main?await main.evaluate("({audit:window.documentWindowAudit(),status:document.getElementById('status').textContent,error:document.getElementById('error-dialog').textContent,hidden:document.hidden})").catch(String):null,overlay:overlay?await overlay.evaluate("({body:document.body.className,active:window.__TAURI_INTERNALS__.invoke('desktop_call',{method:'captureActive',args:[]})})").catch(String):null};
 await writeFile(path.join(root,'failure.json'),JSON.stringify(diagnostic,null,2)+'\n');throw error;
}finally{
 await fixture('release').catch(()=>{});colorWindow?.kill();
 main?.close();overlay?.close();
 if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}
 await writeFile(path.join(root,'native.log'),logs);
}

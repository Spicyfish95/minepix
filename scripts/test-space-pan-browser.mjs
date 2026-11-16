import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

function runChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const key=(type,value,code,extra={},target=document)=>target.dispatchEvent(new KeyboardEvent(type,{key:value,code,bubbles:true,cancelable:true,...extra}));
 const press=(value,code,extra={},target=document)=>{key('keydown',value,code,extra,target);key('keyup',value,code,extra,target);};
 const pointEvent=(type,x,y,extra={})=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:3,button:0,...extra}));};
 const capture=viewport.setPointerCapture,originalKeymap=keymap;viewport.setPointerCapture=()=>{};
 try{
  for(const preset of [defaultKeymap(),asepriteKeymap()]){
   keymap=preset;replaceDocument(createDocument(16,16,'Space regression'),false);li=0;fit();setTool('pencil');
   for(const repeated of [false,true]){
    key('keydown',' ','Space');if(repeated)key('keydown',' ','Space',{repeat:true});key('keyup',' ','Space');
    check(preset.profile+' tap/repeat Space restores pencil without playback '+repeated,!space&&!playing&&viewport.dataset.cursor==='pencil');
   }
   for(const releaseSpaceFirst of [false,true]){
    const before={...pan};key('keydown',' ','Space');pointEvent('pointerdown',2,2);pointEvent('pointermove',3,3);
    check(preset.profile+' drag uses hand '+releaseSpaceFirst,viewport.dataset.cursor==='grabbing');
    if(releaseSpaceFirst){key('keyup',' ','Space');pointEvent('pointerup',3,3);}else{pointEvent('pointerup',3,3);key('keyup',' ','Space');}
    check(preset.profile+' pan restores pencil '+releaseSpaceFirst,!space&&!gesture&&!playing&&pan.x!==before.x&&viewport.dataset.cursor==='pencil');
   }
   const revision=history.revision;setColor('#ff0000');pointEvent('pointerdown',4,4);pointEvent('pointerup',4,4);
   check(preset.profile+' pencil draws after Space',history.revision!==revision&&pixels()[4*16+4]===colorValue('#ff0000'));
   key('keydown',' ','Space');window.dispatchEvent(new Event('blur'));key('keyup',' ','Space');
   check(preset.profile+' blur clears temporary pan',!space&&!playing&&viewport.dataset.cursor==='pencil');
   $('play').click();check(preset.profile+' button starts playback',playing);
   press(' ','Space');check(preset.profile+' Space leaves playback running',playing&&viewport.dataset.cursor==='not-allowed');
   $('play').click();check(preset.profile+' button pauses and restores pencil',!playing&&viewport.dataset.cursor==='pencil');
  }
  for(const preset of [defaultKeymap(),asepriteKeymap()]){
   keymap=preset;setTool('pencil');selection={x:4,y:4,w:2,h:2};
   const separator=document.querySelector('.resize-left'),beforeSize=window.workspaceLayout.state().sizes.left;
   separator.focus();press('ArrowRight','ArrowRight',{},separator);
   check(preset.profile+' separator resizes without moving selection',window.workspaceLayout.state().sizes.left>beforeSize&&selection.x===4&&selection.y===4);
   for(const direction of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){
    press(direction,direction,{shiftKey:true},separator);
    check(preset.profile+' separator consumes Shift+'+direction,selection.x===4&&selection.y===4);
   }
   window.workspaceLayout.dock('colors','left-top');window.workspaceLayout.dock('tools','left-top');
   const tabs=[...document.querySelectorAll('.dock-left-top [role=tab]')];tabs[0].click();tabs[0].focus();
   press('ArrowRight','ArrowRight',{},tabs[0]);
   check(preset.profile+' dock tabs navigate without moving selection',document.activeElement===tabs[1]&&selection.x===4);
   selection=null;doc.frames.push(structuredClone(doc.frames[0]));fi=0;render();
   press('ArrowRight','ArrowRight',{},separator);
   check(preset.profile+' separator does not change animation frame',fi===0);
   tabs[0].focus();press('ArrowRight','ArrowRight',{},tabs[0]);
   check(preset.profile+' tabs do not change animation frame',fi===0);
   viewport.focus();press('ArrowRight','ArrowRight');check(preset.profile+' canvas arrows still change frames',fi===1);
   selection={x:4,y:4,w:2,h:2};press('ArrowRight','ArrowRight');
   check(preset.profile+' canvas arrows still nudge selection',selection.x===5);
   const custom=structuredClone(preset);custom.bindings['grid-select']=['Shift+J'];custom.bindings['swap-colors']=['J'];
   keymap=loadKeymap({getItem:()=>JSON.stringify(custom)});setTool('select');const beforeColor=color;press('j','KeyJ');
   check(preset.profile+' plain J executes custom action instead of Shift+J hold',color!==beforeColor&&!modifiers.grid);
   key('keydown','J','KeyJ',{shiftKey:true});check(preset.profile+' Shift+J activates grid mode',modifiers.grid);
   key('keyup','Shift','ShiftLeft');key('keyup','j','KeyJ');check(preset.profile+' Shift-first release clears grid mode',!modifiers.grid);
   for(const modifier of ['Alt','Ctrl','Shift'])for(const modifierFirst of [true,false]){
    custom.bindings['grid-select']=[modifier+'+J'];keymap=loadKeymap({getItem:()=>JSON.stringify(custom)});
    const flag={Alt:'altKey',Ctrl:'ctrlKey',Shift:'shiftKey'}[modifier],name=modifier==='Ctrl'?'Control':modifier;
    key('keydown',name,name+'Left',{[flag]:true});key('keydown','j','KeyJ',{[flag]:true});
    check(preset.profile+' custom '+modifier+' hold activates '+modifierFirst,modifiers.grid);
    if(modifierFirst){key('keyup',name,name+'Left');key('keyup','j','KeyJ');}
    else{key('keyup','j','KeyJ',{[flag]:true});key('keyup',name,name+'Left');}
    check(preset.profile+' custom '+modifier+' hold releases '+modifierFirst,!modifiers.grid&&activeSelectionKind()===$('selection-kind').value);
   }
  }
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{keymap=originalKeymap;viewport.setPointerCapture=capture;resetInteraction();stop();}
}

const server=await createServer({server:{port:14212,strictPort:true},plugins:[{
 name:'space-pan-browser-harness',
 transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runSpacePanBrowserChecks='+runChecks.toString()+';';},
 transformIndexHtml(html){
  return html.replace(/<script type="module" src="(?:\.\/|\/)?bootstrap\.js"><\/script>/,`<script type="module">
   import {applicationMenu} from '/application-menu.js';
   window.desktop=new Proxy({
    testing:true,secondary:false,inputAudit:false,editorInfo:async()=>({id:0,detached:false}),
    windowMenu:async()=>applicationMenu(()=>{}),windowState:async()=>({maximized:false}),
    updateState:async()=>({status:'idle'}),appInfo:async()=>({packaged:false,autoUpdate:false}),
    recentFiles:async()=>[],recentThumbs:async()=>[],listRecovery:async()=>[],
    onWindowMenu:()=>{},recoveryForPath:async()=>null
   },{get:(target,key)=>key in target?target[key]:(()=>{})});
   await import('/app.js');await window.chromeReady;window.spacePanTestReady=true;
  </script>`);
 }
}]});
await server.listen();await mkdir('artifacts',{recursive:true});
const profile=await mkdtemp(path.resolve('artifacts/space-pan-browser-'));
let browser,session;
try{
 const url=server.resolvedUrls.local[0]+'index.html';
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',url],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){
  if(!session)try{
   const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
   const target=(await targets(port)).find(target=>target.type==='page');if(target)session=await connect(target);
  }catch{}
  if(session&&await session.evaluate('window.spacePanTestReady===true'))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!session||!await session.evaluate('window.spacePanTestReady===true'))throw new Error('Editor did not initialize: '+JSON.stringify(session?.events.filter(event=>event.method==='Runtime.exceptionThrown')));
 const result=await session.evaluate('window.runSpacePanBrowserChecks()');
 await session.screenshot(path.resolve('artifacts/space-pan-browser.png'));
 await writeFile('artifacts/space-pan-browser.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 session?.close();
 if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}
 await server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

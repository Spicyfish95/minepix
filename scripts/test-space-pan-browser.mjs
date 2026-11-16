import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

function runChecks(){
 const results=[],conflicts=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const key=(type,value,code,extra={},target=document)=>target.dispatchEvent(new KeyboardEvent(type,{key:value,code,bubbles:true,cancelable:true,...extra}));
 const press=(value,code,extra={})=>{key('keydown',value,code,extra);key('keyup',value,code,extra);};
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
  keymap=defaultKeymap();selection={x:1,y:1,w:2,h:2};
  const separator=document.querySelector('.resize-left'),beforeX=selection.x;
  separator.focus();key('keydown','ArrowRight','ArrowRight',{},separator);
  conflicts.push({name:'dock separator arrows also move canvas selection',reproduced:selection.x!==beforeX});
  const custom=defaultKeymap();custom.bindings['grid-select']=['Shift+J'];custom.bindings.save=['J'];
  keymap=loadKeymap({getItem:()=>JSON.stringify(custom)});setTool('select');viewport.focus();press('j','KeyJ');
  conflicts.push({name:'Shift-only hold also matches plain J and shadows Save',reproduced:keymap.bindings.save[0]==='J'&&modifiers.grid===false&&holdActionFor({key:'j',code:'KeyJ'},keymap)==='grid-select'});
  custom.bindings['grid-select']=['Alt+J'];custom.bindings.save=['Ctrl+S'];keymap=loadKeymap({getItem:()=>JSON.stringify(custom)});
  key('keydown','Alt','AltLeft',{altKey:true});key('keydown','j','KeyJ',{altKey:true});key('keyup','Alt','AltLeft');key('keyup','j','KeyJ');
  conflicts.push({name:'releasing Alt before custom hold leaves grid mode active',reproduced:modifiers.grid});
  return{ok:true,results,conflicts};
 }catch(error){return{ok:false,results,conflicts,error:error.stack};}
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

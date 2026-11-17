import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
async function runChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);};
 try{
  const indexed=createDocument(2,1,'metadata cancel');indexed.palette=['#00000000','#ff0000ff','#00ff00ff'];indexed.colorMode='indexed';indexed.transparentIndex=0;indexed.frames[0].cels[0]=Uint32Array.of(0xff0000ff,0xff0000ff);indexed.frames[0].indices=[Uint8Array.of(1,1)];replaceDocument(indexed,true);const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  symmetryHandles[0].onpointerdown({preventDefault(){},stopPropagation(){},pointerId:92});doc.symmetryAxes={x:1,y:0};finishGesture(true);viewport.setPointerCapture=capture;check('cancelled symmetry restores metadata',!doc.symmetryAxes);
  setPaletteColor(1,'#0000ffff');releaseIndexedCaches(doc);const {validateColorMode}=await import('/color-modes.js');validateColorMode(doc);check('palette edit after metadata cancellation keeps RGBA consistent',doc.frames[0].cels[0][0]===0x0000ffff);check('canvas matches rebound RGBA cache',composite(doc,0).slice(0,4).join(',')==='0,0,255,255');actions.undo();releaseIndexedCaches(doc);validateColorMode(doc);check('undo after cancelled metadata gesture restores red',doc.frames[0].cels[0][0]===0xff0000ff);actions.redo();releaseIndexedCaches(doc);validateColorMode(doc);check('redo restores blue and correct index',doc.frames[0].cels[0][0]===0x0000ffff&&doc.frames[0].indices[0][0]===1);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}finally{clearTimeout(recoveryTimer);}
}
const server=await createServer({server:{port:14216,strictPort:true},plugins:[{name:'state-integrity-browser',transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runStateIntegrityChecks='+runChecks.toString()+';';},transformIndexHtml(html){return html.replace(/<script type="module" src="(?:\.\/|\/)?bootstrap\.js"><\/script>/,`<script type="module">import {applicationMenu} from '/application-menu.js';window.desktop=new Proxy({testing:true,secondary:false,inputAudit:false,editorInfo:async()=>({id:0,detached:false}),windowMenu:async()=>applicationMenu(()=>{}),windowState:async()=>({maximized:false}),updateState:async()=>({status:'idle'}),appInfo:async()=>({packaged:false,autoUpdate:false}),recentFiles:async()=>[],recentThumbs:async()=>[],listRecovery:async()=>[],onWindowMenu:()=>{},recoveryForPath:async()=>null},{get:(target,key)=>key in target?target[key]:(()=>{})});await import('/app.js');await window.chromeReady;window.optimizationReady=true;</script>`);}}]});
await server.listen();await mkdir('artifacts',{recursive:true});const profile=await mkdtemp(path.resolve('artifacts/state-integrity-browser-'));let browser,session;
try{
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',server.resolvedUrls.local[0]+'index.html'],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){if(!session)try{const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const target=(await targets(port)).find(t=>t.type==='page');if(target)session=await connect(target);}catch{}if(session&&await session.evaluate('window.optimizationReady===true'))break;await new Promise(resolve=>setTimeout(resolve,100));}
 if(!session||!await session.evaluate('window.optimizationReady===true'))throw Error('Editor failed to initialize');
 const result=await session.evaluate('window.runStateIntegrityChecks()');await writeFile('artifacts/state-integrity-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}finally{session?.close();if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}await server.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

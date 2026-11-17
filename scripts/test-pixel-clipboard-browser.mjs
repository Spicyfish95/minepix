import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
async function runChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);},form=$('modal-form'),preferences=localStorage.getItem(APP_SETTINGS_KEY);
 const values=()=>({width:+form.elements.width.value,height:+form.elements.height.value});
 try{
  localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify({width:64,height:48,duration:80}));clipboard=null;clipboardDocument=null;
  let pending=newDocument();check('without copied pixels the dialog uses configured dimensions',values().width===64&&values().height===48);$('modal').close('cancel');await pending;
  const source=createDocument(10,8,'clipboard-source');source.frames[0].cels[0][6*10+8]=0xff0000ff;replaceDocument(source,true,null,crypto.randomUUID(),true);const sourceId=documentId;
  selection={x:7,y:5,w:3,h:2};actions.copy();const copied=clipboard;
  check('copy records full region dimensions and source project',copied.w===3&&copied.h===2&&clipboardDocument===sourceId);
  pending=newDocument();check('new dialog uses copied region width and height rather than source offsets',values().width===3&&values().height===2);form.elements.name.value='clipboard-sized';form.requestSubmit($('modal-submit'));await pending;
  check('new project uses clipboard dimensions without automatically pasting',doc.width===3&&doc.height===2&&pixels().every(pixel=>pixel===0)&&doc.frames[0].duration===80);
  check('creating a project preserves the source pixel clipboard',clipboard===copied&&clipboardDocument===sourceId&&documentId!==sourceId);
  pending=newDocument();form.elements.width.value=5;form.elements.height.value=4;form.requestSubmit($('modal-submit'));await pending;check('clipboard-provided dimensions remain manually editable',doc.width===5&&doc.height===4);
  const beforeCancel=documentId,beforeCount=documentTabs.items.length;pending=newDocument();$('modal').close('cancel');await pending;check('cancelling new leaves documents and copied pixels unchanged',documentId===beforeCancel&&documentTabs.items.length===beforeCount&&clipboard===copied);
  clipboard=null;pending=newDocument();check('clipboard size does not overwrite application defaults',values().width===64&&values().height===48);$('modal').close('cancel');await pending;
  switchDocument(sourceId);selection=null;actions.copy();pending=newDocument();check('copying without selection uses the whole copied canvas dimensions',values().width===10&&values().height===8);$('modal').close('cancel');await pending;
  selection={x:7,y:5,w:3,h:2,mask:new Uint8Array([0,0,0,0,1,0])};actions.copy();pending=newDocument();check('masked selection and transparent edges keep full copied bounds',values().width===3&&values().height===2);$('modal').close('cancel');await pending;
  void newDocument();
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{if(preferences===null)localStorage.removeItem(APP_SETTINGS_KEY);else localStorage.setItem(APP_SETTINGS_KEY,preferences);clearTimeout(recoveryTimer);}
}
const server=await createServer({server:{port:14216,strictPort:true},plugins:[{
 name:'pixel-clipboard-browser-harness',
 transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runPixelClipboardChecks='+runChecks.toString()+';';},
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
   await import('/app.js');await window.chromeReady;window.pixelClipboardReady=true;
  </script>`);
 }
}]});
await server.listen();await mkdir('artifacts',{recursive:true});
const profile=await mkdtemp(path.resolve('artifacts/pixel-clipboard-browser-'));
let browser,session;
try{
 const url=server.resolvedUrls.local[0]+'index.html';
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',url],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){
  if(!session)try{
   const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
   const target=(await targets(port)).find(target=>target.type==='page');if(target)session=await connect(target);
  }catch{}
  if(session&&await session.evaluate('window.pixelClipboardReady===true'))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!session||!await session.evaluate('window.pixelClipboardReady===true'))throw new Error('Editor did not initialize: '+JSON.stringify(session?.events.filter(event=>event.method==='Runtime.exceptionThrown')));
 const result=await session.evaluate('window.runPixelClipboardChecks()');
 await session.screenshot(path.resolve('artifacts/pixel-clipboard-browser.png'));
 await writeFile('artifacts/pixel-clipboard-browser.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 session?.close();
 if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}
 await server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

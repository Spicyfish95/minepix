import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
async function runChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);},form=$('modal-form'),preferences=localStorage.getItem(APP_SETTINGS_KEY);
 try{
  clipboard=null;let pending=newDocument();form.elements.width.value=8192;form.elements.height.value=4097;
  check('new accepts dimensions over the former 32M budget without the warning',form.checkValidity()&&!form.textContent.includes('32M')&&!form.elements.width.hasAttribute('max')&&!form.elements.height.hasAttribute('max'));
  form.elements.width.value=0;check('new still rejects zero dimensions',!form.checkValidity());$('modal').close('cancel');await pending;
  pending=settingsDialog();const width=form.elements['appearance.width'],height=form.elements['appearance.height'];width.value=33554433;height.value=1;
  check('default dimensions have no old single-axis cap',width.checkValidity()&&height.checkValidity()&&!width.hasAttribute('max')&&!height.hasAttribute('max'));$('modal').close('cancel');await pending;
  check('cancelled settings preserve preferences',localStorage.getItem(APP_SETTINGS_KEY)===preferences);
  const source=createDocument(1,1,'超过旧总像素预算');source.width=1024;source.height=1024;source.frames[0].cels[0][0]=0x448844ff;source.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};source.requiredFeatures=['cel-properties'];
  source.frames=Array.from({length:33},()=>structuredClone(source.frames[0]));replaceDocument(validateDocument(source),true,null,crypto.randomUUID(),true);
  check('real editor renders a valid project over the former total pixel budget',doc.width*doc.height*doc.frames.length>32*1024*1024&&canvas.width===1024&&doc.frames.length===33);
  actions['duplicate-frame']();check('duplicate frame succeeds beyond old budget',doc.frames.length===34&&history.undoStack.length===1&&doc.frames.every(frame=>frame.cels[0][0]===0x448844ff));
  actions.undo();check('undo restores large project frame structure',doc.frames.length===33);actions.redo();check('redo restores duplication',doc.frames.length===34);
  actions['duplicate-layer']();check('duplicate layer succeeds beyond old budget',doc.layers.length===2&&doc.frames.every(frame=>frame.cels.length===2&&frame.cels[1][0]===0x448844ff));
  actions.undo();check('undo layer duplication preserves original pixels',doc.layers.length===1&&pixels()[0]===0x448844ff);actions.redo();
  actions['add-frame']();check('blank frame creation succeeds beyond old budget',doc.frames.length===35&&pixels().every(pixel=>pixel===0));validateDocument(doc);
  actions.undo();check('undo blank frame restores sparse pixel content',doc.frames.length===34&&doc.frames[0].cels[0][0]===0x448844ff);
  check('editor reports no capacity error',!$('error-dialog').open);
  return{ok:true,results,logicalPixels:doc.width*doc.height*doc.layers.length*doc.frames.length};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{clearTimeout(recoveryTimer);}
}
const server=await createServer({server:{port:14217,strictPort:true},plugins:[{
 name:'project-capacity-browser-harness',
 transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runProjectCapacityChecks='+runChecks.toString()+';';},
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
   await import('/app.js');await window.chromeReady;window.projectCapacityReady=true;
  </script>`);
 }
}]});
await server.listen();await mkdir('artifacts',{recursive:true});
const profile=await mkdtemp(path.resolve('artifacts/project-capacity-browser-'));
let browser,session;
try{
 const url=server.resolvedUrls.local[0]+'index.html';
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',url],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){
  if(!session)try{
   const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
   const target=(await targets(port)).find(target=>target.type==='page');if(target)session=await connect(target);
  }catch{}
  if(session&&await session.evaluate('window.projectCapacityReady===true'))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!session||!await session.evaluate('window.projectCapacityReady===true'))throw new Error('Editor did not initialize: '+JSON.stringify(session?.events.filter(event=>event.method==='Runtime.exceptionThrown')));
 const result=await session.evaluate('window.runProjectCapacityChecks()');
 await session.screenshot(path.resolve('artifacts/project-capacity-browser.png'));
 await writeFile('artifacts/project-capacity-browser.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 session?.close();
 if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}
 await server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

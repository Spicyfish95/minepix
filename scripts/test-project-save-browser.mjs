import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
async function runChecks(){
 const {createProjectSaveClient}=await import('/project-save-client.js'),client=createProjectSaveClient(),original=window.desktop,results=[];
 const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const header=bytes=>{const length=new DataView(bytes.buffer,bytes.byteOffset).getUint32(8,true);return{...JSON.parse(new TextDecoder().decode(bytes.subarray(12,12+length))),payload:12+length};};
 let complete,packed,calls=0,packReady,started,packMs;
 try{
  window.desktop=new Proxy({saveProject:async(snapshot,name,saveAs,filePath)=>{calls++;const start=performance.now();packed=await client.pack(snapshot,name,saveAs,{filePath});packMs=performance.now()-start;packReady?.();return new Promise(resolve=>{complete=resolve;});}},{get:(target,key)=>key in target?target[key]:original[key]});
  replaceDocument(createDocument(2,1,'snapshot-A'),false,'C:/projects/a.pix');
  let pending=saveProject();check('saving does not lock foreground editing',!busy);mutate(()=>{pixels()[0]=0x123456ff;},'edit during save');check('pixel edit works while save runs',pixels()[0]===0x123456ff&&history.undoStack.length===1);
  while(!complete)await wait(5);
  let metadata=header(packed);check('worker saves original pixels and path',metadata.target.filePath==='C:/projects/a.pix'&&new DataView(packed.buffer,packed.byteOffset+metadata.payload).getUint32(0,true)===0);
  complete({filePath:'C:/projects/a.pix',name:'snapshot-A'});check('first save completes',await pending);check('newer editing remains unsaved',dirty&&saved!==history.revision);
  complete=null;pending=saveProject();while(!complete)await wait(5);metadata=header(packed);check('next save captures newer pixels',new DataView(packed.buffer,packed.byteOffset+metadata.payload).getUint32(0,true)===0x123456ff);complete({filePath:'C:/projects/a.pix',name:'snapshot-A'});await pending;check('saving current revision clears dirty',!dirty);
  const first=documentId;complete=null;pending=saveProject(true);replaceDocument(createDocument(2,1,'snapshot-B'),true,'C:/projects/b.pix',crypto.randomUUID(),true);const second=documentId;
  while(!complete)await wait(5);complete({filePath:'C:/projects/a-copy.pix',name:'a-copy'});await pending;check('background save does not rename or repath foreground tab',documentId===second&&doc.name==='snapshot-B'&&filePath==='C:/projects/b.pix');check('background save updates only initiating tab',documentTabs.get(first).filePath==='C:/projects/a-copy.pix'&&documentTabs.get(first).doc.name==='a-copy');
  const size=2048,raw=new Uint8Array(size*size*4);raw.fill(171);const reference=encodeReference(size,size,raw),large=createDocument(2,1,'large-reference');large.references=[{...reference,id:'large',name:'large',x:0,y:0,scale:1}];large.requiredFeatures.push('reference-board');
  replaceDocument(large,false,'C:/projects/large.pix');
  let ticks=0,maxGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},5);
  complete=null;started=performance.now();let ready=new Promise(resolve=>{packReady=resolve;});pending=saveProject();await ready;
  const coldMs=packMs,coldTicks=ticks,packingGap=maxGap;mutate(()=>{pixels()[0]=0xabcdefFF;},'edit with large reference');check('large reference packs in real Worker while event loop runs ('+coldMs.toFixed(1)+' ms, '+coldTicks+' ticks, busy '+busy+')',coldTicks>0&&!busy);check('large reference save remains editable',pixels()[0]===0xabcdefFF);
  metadata=header(packed);check('large reference snapshot excludes subsequent pixel edit',new DataView(packed.buffer,packed.byteOffset+metadata.payload).getUint32(0,true)===0);complete({filePath:'C:/projects/large.pix',name:'large-reference'});await pending;check('large reference save preserves newer unsaved edit',dirty);
  const beforeCalls=calls;complete=null;ready=new Promise(resolve=>{packReady=resolve;});const again=saveProject(),duplicate=saveProject();await ready;const warmMs=packMs;complete({filePath:'C:/projects/large.pix',name:'large-reference'});await again;await duplicate;clearInterval(timer);check('duplicate save shares one request',calls===beforeCalls+1);check('cached reference bytes survive transferred output buffer',!dirty&&packed.length>raw.length);
  const info=header(packed),block=info.blocks.find(block=>block.kind==='base64');check('worker cache output keeps all reference bytes',block.count===raw.length&&packed.at(-1)===171);
  const invalid=client.pack({format:'invalid'},'invalid');let rejected=false;try{await invalid;}catch{rejected=true;}check('invalid worker payload rejects without hanging',rejected);check('worker recovers after validation error',(await client.pack(createDocument(1,1,'retry'),'retry')).byteLength>0);
  return{ok:true,results,performance:{size,coldMs,warmMs,coldTicks,maxPackingMainThreadGapMs:packingGap,maxMainThreadGapMs:maxGap,totalMs:performance.now()-started}};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{client.dispose();window.desktop=original;clearTimeout(recoveryTimer);}
}
const server=await createServer({server:{port:14215,strictPort:true},plugins:[{name:'project-save-browser',transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runProjectSaveChecks='+runChecks.toString()+';';},transformIndexHtml(html){return html.replace(/<script type="module" src="(?:\.\/|\/)?bootstrap\.js"><\/script>/,`<script type="module">import {applicationMenu} from '/application-menu.js';window.desktop=new Proxy({testing:true,secondary:false,inputAudit:false,editorInfo:async()=>({id:0,detached:false}),windowMenu:async()=>applicationMenu(()=>{}),windowState:async()=>({maximized:false}),updateState:async()=>({status:'idle'}),appInfo:async()=>({packaged:false,autoUpdate:false}),recentFiles:async()=>[],recentThumbs:async()=>[],listRecovery:async()=>[],onWindowMenu:()=>{},recoveryForPath:async()=>null},{get:(target,key)=>key in target?target[key]:(()=>{})});await import('/app.js');await window.chromeReady;window.saveTestReady=true;</script>`);}}]});
await server.listen();await mkdir('artifacts',{recursive:true});const profile=await mkdtemp(path.resolve('artifacts/project-save-browser-'));let browser,session;
try{
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',server.resolvedUrls.local[0]+'index.html'],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){if(!session)try{const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const target=(await targets(port)).find(t=>t.type==='page');if(target)session=await connect(target);}catch{}if(session&&await session.evaluate('window.saveTestReady===true'))break;await new Promise(resolve=>setTimeout(resolve,100));}
 if(!session||!await session.evaluate('window.saveTestReady===true'))throw Error('Editor failed to initialize');
 const result=await session.evaluate('window.runProjectSaveChecks()');await writeFile('artifacts/project-save-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}finally{session?.close();if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}await server.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

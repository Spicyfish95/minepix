import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
async function runChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);};
 const wait=()=>new Promise(resolve=>setTimeout(resolve,5));let client;
 try{
  const render=await window.runRenderSmoke();for(const result of render.results)results.push(result);if(!render.ok)throw Error(render.error);
  const next=createDocument(64,64,'cache commit');addFrame(next,0);replaceDocument(next,true);
  frameCanvas(1);const untouched=frameCache.entries.get(1);mutateCel(()=>pixels()[100]=0x123456ff);
  check('committing a cel edit retains another cached frame',frameCache.entries.get(1)===untouched);
  actions.undo();frameCanvas(1);check('undo retains another cached frame',frameCache.entries.get(1)===untouched&&pixels()[100]===0);
  actions.redo();frameCanvas(1);check('redo retains another cached frame',frameCache.entries.get(1)===untouched&&pixels()[100]===0x123456ff);
  const source=doc.frames[0].cels[0];mutateMetadata(()=>doc.layers[0].name='renamed');check('metadata editing keeps the original typed pixel buffer',doc.frames[0].cels[0]===source&&history.undoStack.at(-1).changes.length===0);
  const mini=layerThumbnail(0);check('layer UI stores display-sized canvases',mini.width===32&&mini.height===32);
  const {createRecoveryClient}=await import('/recovery-client.js'),{createProjectSaveClient}=await import('/project-save-client.js'),{unpackBinaryPacket}=await import('/binary-packet.js'),{unpackProjectReadPacket}=await import('/project-transfer.js');
  client=createProjectSaveClient();let release,writes=0,packed=0,last;
  const gate=new Promise(resolve=>release=resolve),recovery=createRecoveryClient({pack:(...args)=>{packed++;return client.pack(...args);},write:async bytes=>{writes++;last=unpackBinaryPacket(bytes);if(writes===1)await gate;}});
  const document=createDocument(2,1,'queued');document.palette=['#00000000','#123456ff','#123456ff'];document.colorMode='indexed';document.transparentIndex=0;document.frames[0].indices=[Uint8Array.of(1,1)];prepareDocumentPixels(document);
  const save=revision=>recovery.save({id:'worker-queue',filePath:'queue.pix',dirty:true,revision,boardRevision:0,document});
  const first=save(1);while(!writes)await wait();document.frames[0].indices[0][0]=2;const middle=save(2);document.frames[0].indices[0][1]=2;const latest=save(3);document.frames[0].indices[0][1]=0;release();await Promise.all([first,middle,latest]);
  check('real Worker packs only active and latest pending recovery revisions',packed===2&&writes===2&&last.metadata.revision===3);
  const bytes=last.payloads[0].slice();bytes.set(new TextEncoder().encode('MPXREAD1'));const restored=unpackProjectReadPacket(bytes,{typed:true}).document;
  check('queued Worker snapshot preserves duplicate index slots before later edits',restored.frames[0].indices[0][0]===2&&restored.frames[0].indices[0][1]===2&&document.frames[0].indices[0][1]===0);
  await save(3);check('completed recovery revision skips duplicate packing',packed===2);
  return{ok:true,results,renderMetrics:render.metrics};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{client?.dispose();clearTimeout(recoveryTimer);}
}
const server=await createServer({server:{port:14216,strictPort:true},plugins:[{name:'optimization-browser',transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runOptimizationChecks='+runChecks.toString()+';';},transformIndexHtml(html){return html.replace(/<script type="module" src="(?:\.\/|\/)?bootstrap\.js"><\/script>/,`<script type="module">import {applicationMenu} from '/application-menu.js';window.desktop=new Proxy({testing:true,secondary:false,inputAudit:false,editorInfo:async()=>({id:0,detached:false}),windowMenu:async()=>applicationMenu(()=>{}),windowState:async()=>({maximized:false}),updateState:async()=>({status:'idle'}),appInfo:async()=>({packaged:false,autoUpdate:false}),recentFiles:async()=>[],recentThumbs:async()=>[],listRecovery:async()=>[],onWindowMenu:()=>{},recoveryForPath:async()=>null},{get:(target,key)=>key in target?target[key]:(()=>{})});await import('/app.js');await window.chromeReady;window.optimizationReady=true;</script>`);}}]});
await server.listen();await mkdir('artifacts',{recursive:true});const profile=await mkdtemp(path.resolve('artifacts/optimization-browser-'));let browser,session;
try{
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',server.resolvedUrls.local[0]+'index.html'],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){if(!session)try{const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const target=(await targets(port)).find(t=>t.type==='page');if(target)session=await connect(target);}catch{}if(session&&await session.evaluate('window.optimizationReady===true'))break;await new Promise(resolve=>setTimeout(resolve,100));}
 if(!session||!await session.evaluate('window.optimizationReady===true'))throw Error('Editor failed to initialize');
 const result=await session.evaluate('window.runOptimizationChecks()');await writeFile('artifacts/optimization-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}finally{session?.close();if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}await server.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

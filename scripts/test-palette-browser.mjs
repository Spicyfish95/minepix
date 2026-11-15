import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const server=await createServer({server:{port:0,strictPort:false},plugins:[{
 name:'palette-browser-harness',
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
   await import('/app.js');await window.chromeReady;window.paletteTestReady=true;
  </script>`);
 }
}]});
await server.listen();await mkdir('artifacts',{recursive:true});
const profile=await mkdtemp(path.resolve('artifacts/palette-browser-'));
let browser,session;
try{
 const url=server.resolvedUrls.local[0]+'index.html';
 browser=spawn(process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,1000',url],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<150;i++){
  if(!session)try{
   const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
   const target=(await targets(port)).find(target=>target.type==='page');if(target)session=await connect(target);
  }catch{}
  if(session&&await session.evaluate('window.paletteTestReady===true'))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!session||!await session.evaluate('window.paletteTestReady===true'))throw new Error('Editor did not initialize: '+JSON.stringify(session?.events.filter(event=>event.method==='Runtime.exceptionThrown')));
 const samples={png:(await readFile('tests/fixtures/palettes/bright24.png')).toString('base64'),ase:(await readFile('tests/fixtures/palettes/lost-century.ase')).toString('base64')};
 const result=await session.evaluate(`window.runPaletteWorkflowSmoke(${JSON.stringify(samples)})`);
 if(!result.ok)result.dom=await session.evaluate("document.getElementById('color-adjustments')?.outerHTML");
 await session.screenshot(path.resolve('artifacts/palette-browser.png'));
 await writeFile('artifacts/palette-browser.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 session?.close();
 if(browser&&browser.exitCode===null){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}
 await server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const eyedropper=process.argv[2]==='eyedropper';
function runPaletteEyedropperChecks(){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const key=(type,extra={})=>document.dispatchEvent(new KeyboardEvent(type,{key:'Alt',code:'AltLeft',bubbles:true,cancelable:true,...extra}));
 const pick=x=>{const bounds=canvas.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:bounds.left+(x+.5)*zoom,clientY:bounds.top+.5*zoom,pointerId:10,button:0,altKey:true}));};
 try{
  for(const mode of ['rgba','indexed','grayscale']){
   const next=createDocument(2,1,'palette-eyedropper');next.palette=['#00000000','#ff0000','#00ff00'];next.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
   if(mode!=='rgba')convertColorMode(next,mode,{palette:'current'});
   replaceDocument(next,true);li=0;setTool('pencil');fit();setColor(doc.palette[1],1);setPaletteEditing(true);
   paletteActive=1;paletteSelection=new Set([1]);renderColors();const before=doc.palette[1],sample=pixels()[1];
   const expected=fromRgba({r:sample>>>24,g:sample>>>16&255,b:sample>>>8&255,a:sample&255});
   key('keydown',{altKey:true});pick(1);key('keyup');
   check(mode+' Alt pick updates foreground and active swatch',color===expected&&colorValue(doc.palette[1])===colorValue(expected)&&paletteActive===1);
   check(mode+' picked color updates swatch and HEX display',colorValue($('palette').children[1].getAttribute('aria-label'))===colorValue(expected)&&colorValue($('hex').value)===colorValue(expected));
   check(mode+' palette change creates one undo entry and marks dirty',history.undoStack.length===1&&dirty);
   if(mode==='indexed')check('indexed pick retains destination index and repaints its pixels',colorIndex===1&&doc.frames[0].indices[0][0]===1&&doc.frames[0].indices[0][1]===2&&pixels()[0]===sample);
   actions.undo();check(mode+' undo restores palette',doc.palette[1]===before);
   actions.redo();check(mode+' redo restores picked palette color',colorValue(doc.palette[1])===colorValue(expected));
   const count=history.undoStack.length;key('keydown',{altKey:true});pick(1);key('keyup');
   check(mode+' repeat pick does not create extra history',history.undoStack.length===count);
   setPaletteEditing(false);const paletteBefore=JSON.stringify(doc.palette);key('keydown',{altKey:true});pick(0);key('keyup');
   check(mode+' non-edit pick preserves palette',JSON.stringify(doc.palette)===paletteBefore);
  }
  replaceDocument(createDocument(2,1,'transparent-pick'),true);setTool('pencil');fit();setPaletteEditing(true);
  const before=JSON.stringify(doc.palette),foreground=color;key('keydown',{altKey:true});pick(0);key('keyup');
  check('transparent canvas pick leaves foreground palette and history unchanged',color===foreground&&JSON.stringify(doc.palette)===before&&history.undoStack.length===0);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{resetModifiers();setPaletteEditing(false);syncInteraction();}
}

const server=await createServer({server:{port:eyedropper?14213:0,strictPort:eyedropper},plugins:[{
 name:'palette-browser-harness',
 transform(source,id){if(eyedropper&&id.replaceAll('\\','/').endsWith('/src/app.js'))return source+'\nwindow.runPaletteEyedropperChecks='+runPaletteEyedropperChecks.toString()+';';},
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
 const samples={inspectPattern:true,png:(await readFile('tests/fixtures/palettes/bright24.png')).toString('base64'),ase:(await readFile('tests/fixtures/palettes/lost-century.ase')).toString('base64')};
 const result=await session.evaluate(eyedropper?'window.runPaletteEyedropperChecks()':`window.runPaletteWorkflowSmoke(${JSON.stringify(samples)})`);
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

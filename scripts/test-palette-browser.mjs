import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';

const eyedropper=process.argv[2]==='eyedropper';
async function runPaletteEyedropperChecks(){
 const originalCapture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const key=(type,extra={})=>document.dispatchEvent(new KeyboardEvent(type,{key:'Alt',code:'AltLeft',bubbles:true,cancelable:true,...extra}));
 const pick=x=>{const bounds=canvas.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:bounds.left+(x+.5)*zoom,clientY:bounds.top+.5*zoom,pointerId:10,button:0,altKey:true}));};
 try{
  for(const mode of ['rgba','indexed','grayscale']){
   const next=createDocument(2,1,'palette-eyedropper');next.palette=['#00000000','#ff0000','#00ff00'];next.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
   if(mode!=='rgba')convertColorMode(next,mode,{palette:'current'});
   replaceDocument(next,true);li=0;setTool('pencil');fit();setColor(doc.palette[1],1);setPaletteEditing(true);
   check(mode+' edit entry has no selection highlight or actions',paletteActive===null&&paletteSelection.size===0&&!$('palette').querySelector('.selected,.edit-selected,.edit-active')&&$('palette').querySelector('.palette-edit-actions').hidden);
   paletteActive=1;paletteSelection=new Set([1]);renderColors();syncPaletteSelection();check(mode+' explicit selection displays edit actions',!$('palette').querySelector('.palette-edit-actions').hidden);const before=doc.palette[1],sample=pixels()[1];
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
  const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
   for(const baseTool of ['eyedropper','pencil','zoom'])for(const editing of [false,true]){
    const next=createDocument(4,1,'drag-pick');next.palette=['#00000000','#ffff00','#ff0000','#00ff00','#0000ff'];next.frames[0].cels[0]=[0xff0000ff,0x00ff00ff,0x0000ffff,0];
    convertColorMode(next,'indexed',{palette:'current'});replaceDocument(next,true);li=0;setPaletteEditing(editing);paletteSelection=new Set([1]);paletteActive=1;setColor('#ffff00',1);setTool(baseTool);fit();
    const startZoom=zoom,before=JSON.stringify(doc.palette),at=(type,x,extra={})=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:21,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+(x+.5)*zoom,clientY:r.top+.5*zoom,altKey:baseTool!=='eyedropper',...extra}));};
    if(baseTool!=='eyedropper')key('keydown',{altKey:true});
    at('pointerdown',0);check(baseTool+' first sample '+editing,color==='#ff0000');
    at('pointermove',1);check(baseTool+' live sample '+editing,color==='#00ff00'&&(!editing||doc.palette[1]==='#00ff00'));
    at('pointermove',3);at('pointermove',6);check(baseTool+' transparent and outside preserve sample '+editing,color==='#00ff00');
    at('pointermove',2);check(baseTool+' final live sample '+editing,color==='#0000ff'&&history.undoStack.length===0);
    if(baseTool!=='eyedropper')key('keyup');at('pointerup',2,{altKey:false});
    check(baseTool+' release restores tool and zoom '+editing,!gesture&&tool===baseTool&&zoom===startZoom);
    if(editing){check(baseTool+' drag is single palette history step',history.undoStack.length===1&&colorIndex===1);actions.undo();check(baseTool+' undo restores all drag changes',JSON.stringify(doc.palette)===before);actions.redo();check(baseTool+' redo restores final swatch',doc.palette[1]==='#0000ff');}
    else check(baseTool+' foreground drag does not edit document',history.undoStack.length===0&&JSON.stringify(doc.palette)===before);
    if(editing){const original=doc.palette[1],foreground=color;at('pointerdown',0);at('pointermove',1);at('pointercancel',1);check(baseTool+' cancellation restores palette and foreground',doc.palette[1]===original&&color===foreground&&!gesture);}
   }
   setPaletteEditing(true);paletteActive=1;paletteSelection=new Set([1]);setTool('eyedropper');
   const item=addReference(doc,{...encodeReference(2,1,new Uint8Array([255,0,0,255,0,255,0,255])),id:'drag-reference',name:'drag reference',x:0,y:0});
   window.workspaceLayout.reveal('reference');boardKey='';renderReferenceBoard(true);
   const node=boardPanel().querySelector('[data-reference-id="drag-reference"]');node.setPointerCapture=()=>{};node.hasPointerCapture=()=>false;
   const at=(type,x)=>{const r=node.getBoundingClientRect(),scale=item.scale*boardView().zoom;node.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:22,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+(x+.5)*scale,clientY:r.top+.5*scale}));};
   const count=history.undoStack.length;at('pointerdown',0);at('pointermove',1);check('reference dragging samples live',color==='#00ff00'&&doc.palette[1]==='#00ff00');at('pointerup',1);check('reference drag commits one history entry',!gesture&&history.undoStack.length===count+1);
  }finally{viewport.setPointerCapture=capture;}
  setPaletteEditing(false);
  const indexed=createDocument(3,1,'replace-indices');indexed.palette=['#00000000','#ff0000','#ff0000','#00ff00'];indexed.frames[0].cels[0]=[0xff0000ff,0xff0000ff,0x00ff00ff];convertColorMode(indexed,'indexed',{palette:'current'});indexed.frames[0].indices[0]=[1,2,3];replaceDocument(indexed,true);
  setTool('zoom');const zoomBefore=zoom,r=canvas.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:25,button:2,clientX:r.left+.5*zoom,clientY:r.top+.5*zoom}));check('zoom right-click still zooms out',Math.abs(zoom-zoomBefore*.8)<.001);
  setTool('eyedropper');setPaletteEditing(true);paletteActive=1;paletteSelection=new Set([1]);const beforeBlur=JSON.stringify(doc.palette),colorBeforeBlur=color,box=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:26,button:0,clientX:box.left+2.5*zoom,clientY:box.top+.5*zoom}));window.dispatchEvent(new Event('blur'));check('blur cancels live palette sampling',!gesture&&JSON.stringify(doc.palette)===beforeBlur&&color===colorBeforeBlur);setPaletteEditing(false);
  const paletteBefore=JSON.stringify(doc.palette),replacing=replaceColorDialog(),form=$('modal-form');
  check('indexed dialog exposes palette source and destination slots',!!form.elements.fromIndex&&!!form.elements.toIndex&&!form.elements.tolerance);
  form.elements.fromIndex.value='1';form.elements.toIndex.value='2';form.requestSubmit($('modal-submit'));await replacing;
  check('indexed dialog replaces exact slot despite duplicate colors',doc.frames[0].indices[0].join(',')==='2,2,3'&&JSON.stringify(doc.palette)===paletteBefore&&history.undoStack.length===1);
  actions.undo();check('index-only replacement is undoable',doc.frames[0].indices[0].join(',')==='1,2,3');actions.redo();check('index-only replacement is redoable',doc.frames[0].indices[0].join(',')==='2,2,3');
  const rgbaDoc=createDocument(1,1,'replace-palette');rgbaDoc.palette=['#ff000080','#00ff0040'];rgbaDoc.frames[0].cels[0]=[0xff000080];replaceDocument(rgbaDoc,true);
  const replacingRgba=replaceColorDialog(),rgbaForm=$('modal-form');
  for(const [name,index] of [['fromPalette','0'],['toPalette','1']]){rgbaForm.elements[name].value=index;rgbaForm.elements[name].dispatchEvent(new Event('change'));}
  rgbaForm.requestSubmit($('modal-submit'));await replacingRgba;
  check('RGBA dialog palette choices preserve alpha',pixels()[0]===0x00ff0040);
  const beforeCancel=JSON.stringify(doc),cancelled=replaceColorDialog();$('modal').close('cancel');await cancelled;check('cancelling replacement preserves document',JSON.stringify(doc)===beforeCancel);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{finishGesture(true);viewport.setPointerCapture=originalCapture;resetModifiers();setPaletteEditing(false);syncInteraction();}
}

const server=await createServer({server:{port:14213,strictPort:true},plugins:[{
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

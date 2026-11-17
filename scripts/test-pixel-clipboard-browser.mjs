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
  switchDocument(sourceId);selection={x:7,y:5,w:3,h:2};actions.copy();const originalClipboard=clipboard,sourcePixels=[...pixels()];
  pending=newDocument();form.requestSubmit($('modal-submit'));await pending;const smallId=documentId;actions.paste();
  check('paste into a clipboard-sized new project is visible despite source offsets',doc.width===3&&doc.height===2&&pixels()[4]===0xff0000ff);
  actions.undo();check('destination paste can be undone',pixels().every(pixel=>pixel===0));actions.redo();check('destination paste can be redone',pixels()[4]===0xff0000ff);
  switchDocument(sourceId);check('switching back preserves source pixels and global clipboard',JSON.stringify([...pixels()])===JSON.stringify(sourcePixels)&&clipboard===originalClipboard);
  switchDocument(smallId);check('switching back to destination preserves its paste and history',pixels()[4]===0xff0000ff&&history.undoStack.length===1);
  replaceDocument(createDocument(12,10,'large-target'),true,null,crypto.randomUUID(),true);actions.paste();check('a larger target preserves fitting source coordinates',pixels()[6*12+8]===0xff0000ff);
  replaceDocument(createDocument(6,5,'selected-target'),true,null,crypto.randomUUID(),true);selection={x:1,y:1,w:1,h:1};actions.paste();check('explicit target selection anchors the pasted region',pixels()[2*6+2]===0xff0000ff);
  for(const mode of ['indexed','grayscale']){
   const target=createDocument(3,2,mode);target.palette=['#00000000','#ff0000ff','#ffffffff'];convertColorMode(target,mode,{palette:'current'});replaceDocument(target,true,null,crypto.randomUUID(),true);actions.paste();
   check(mode+' target retains its mode and shows pasted pixels',doc.colorMode===mode&&pixels()[4]!==0);actions.undo();check(mode+' paste supports undo',pixels().every(pixel=>pixel===0));actions.redo();check(mode+' paste supports redo',pixels()[4]!==0);
  }
  for(const [name,contains]of[['L shape',(x,y)=>x===0||y===2],['hole',(x,y)=>x!==1||y!==1],['disconnected',(x,y)=>x===y]]){
   const irregular=createDocument(10,8,name);irregular.frames[0].cels[0].fill(0xff0000ff);irregular.frames[0].cels[0][5*10+7]=0;replaceDocument(irregular,true,null,crypto.randomUUID(),true);const irregularId=documentId;
   selection=selectionFrom(doc,(x,y)=>x>=7&&x<=9&&y>=5&&y<=7&&contains(x-7,y-5));actions.copy();const clip=clipboard,mask=[...clip.mask],data=[...clip.data];
   pending=newDocument();check(name+' new dimensions use the actual selection bounding rectangle',values().width===3&&values().height===3);form.requestSubmit($('modal-submit'));await pending;
   pixels().fill(0x00ff00ff);const expected=Array.from({length:9},(_,i)=>contains(i%3,Math.floor(i/3))&&i!==0?0xff0000ff:0x00ff00ff);actions.paste();
   check(name+' paste preserves mask holes and transparent pixels',JSON.stringify([...pixels()])===JSON.stringify(expected));check(name+' pasted selection retains its translated irregular mask',selection.x===0&&selection.y===0&&selection.w===3&&selection.h===3&&JSON.stringify([...selection.mask])===JSON.stringify(mask));
   actions.undo();check(name+' undo restores every destination pixel',pixels().every(pixel=>pixel===0x00ff00ff));actions.redo();check(name+' redo restores only selected opaque pixels',JSON.stringify([...pixels()])===JSON.stringify(expected));
   switchDocument(irregularId);check(name+' source pixels and clipboard remain unchanged',pixels()[5*10+7]===0&&pixels().filter(pixel=>pixel===0xff0000ff).length===79&&clipboard===clip&&JSON.stringify([...clipboard.mask])===JSON.stringify(mask)&&JSON.stringify(clipboard.data)===JSON.stringify(data));
  }
  const cropped=createDocument(5,1,'reordered cropped index');cropped.colorMode='indexed';cropped.palette=['#00000000','#ff0000ff','#ff0000ff'];cropped.transparentIndex=0;cropped.frames[0].cels[0]=Uint32Array.of(0xff0000ff);cropped.frames[0].indices=[Uint8Array.of(2)];setCelProperty(cropped,0,0,{x:1,y:0,width:1,height:1});replaceDocument(cropped,true);selection=null;
  const held=celIndexPixels(doc,0,0);mutate(()=>applyIndexedPalette(doc,['#ff0000ff','#00000000','#ff0000ff'],[1,0,2]),'reorder transparent slot',{colorsReady:true});
  check('cached cropped view uses current transparent slot after palette reorder',doc.transparentIndex===1&&held[0]===1&&held===celIndexPixels(doc,0,0));actions.copy();check('copy after transparent reorder keeps holes and duplicate index identity',clipboard.data.join(',')==='0,4278190335,0,0,0'&&clipboard.indexed.data.join(',')==='1,2,1,1,1');
  const {validateColorMode}=await import('/color-modes.js');actions['flip-x']();validateColorMode(doc);check('flip after transparent reorder keeps RGBA and indices consistent',celIndexPixels(doc,0,0).slice().join(',')==='1,1,1,2,1'&&!$('error-dialog').open);actions.undo();validateColorMode(doc);check('cropped flip undo restores source bounds and duplicate slot',celProperty(doc,0,0).width===1&&celIndexPixels(doc,0,0)[1]===2);actions.redo();validateColorMode(doc);check('cropped flip redo keeps transparent edges',celIndexPixels(doc,0,0).slice().join(',')==='1,1,1,2,1');
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

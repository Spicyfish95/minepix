import assert from 'node:assert/strict';
import {targets,connect} from './cdp.mjs';
const expected=process.argv[2];
let session;
try{
 for(let i=0;i<100;i++){
  try{
   const target=(await targets()).find(target=>target.type==='page');
   if(target){session=await connect(target);break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(session,'Installed WebView2 started');
 for(let i=0;i<100;i++){
  const state=await session.evaluate("window.documentWindowAudit?.()");
  if(state?.path===expected){
   assert.ok(await session.evaluate("location.hostname==='tauri.localhost'"),'Installed app uses embedded resources');
   assert.equal(state.dirty,false);
   assert.equal(state.documents.length,1);
   console.log(JSON.stringify({ok:true,path:state.path,name:state.name}));
   process.exitCode=0;break;
  }
  if(i===99)throw new Error('Installed app did not open expected project: '+JSON.stringify(state));
  await new Promise(resolve=>setTimeout(resolve,100));
 }
}finally{session?.close();}

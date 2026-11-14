import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export async function targets(port=9223){
 const response=await fetch(`http://127.0.0.1:${port}/json/list`);
 if(!response.ok)throw new Error(`WebView2 debugger returned ${response.status}`);
 return response.json();
}

export async function connect(target){
 const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),events=[];
 let serial=0;
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',({data})=>{
  const message=JSON.parse(data);
  if(message.id){const task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}
  else events.push(message);
 });
 function send(method,params={}){
  const id=++serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method} timed out`));},45000);
   pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
 }
 await send('Runtime.enable');
 await send('Page.enable');
 await send('Log.enable');
 return{
  target,send,events,
  async evaluate(expression){
   const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
   if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
   return result.result.value;
  },
  async screenshot(file){
   const {data}=await send('Page.captureScreenshot',{format:'png'});
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file,Buffer.from(data,'base64'));
  },
  close(){socket.close();}
 };
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const available=await targets(Number(process.env.MINEPIX_CDP_PORT||9223));
 const target=available.find(target=>target.type==='page'&&target.url.includes('index.html'))||available.find(target=>target.type==='page');
 if(!target)throw new Error('No MinePix page found');
 const session=await connect(target);
 try{
  console.log(JSON.stringify(await session.evaluate(`({title:document.title,url:location.href,ready:!!window.documentWindowAudit,audit:window.documentWindowAudit?.(),text:document.body.innerText.slice(0,1600)})`),null,2));
  if(process.argv[2])await session.screenshot(path.resolve(process.argv[2]));
 }finally{session.close();}
}

import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {targets,connect} from './cdp.mjs';
const root=process.cwd();
const suite=process.argv[2]||'panels';
if(!['panels','updates','pin','screenshot','reference-paste','switch','form-labels'].includes(suite))throw new Error('Unknown browser test suite');
const server=createServer(async(request,response)=>{
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'};
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  response.end(await readFile(file));
 }catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await mkdir('artifacts',{recursive:true});
const profile=await mkdtemp(path.join(root,`artifacts/${suite}-browser-`));
let liveBrowser,session;
try{
 const browser=process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const url=`http://127.0.0.1:${server.address().port}/tests/${suite}.browser.html`;
 let text;
 if(suite==='screenshot'){
  liveBrowser=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--remote-debugging-port=0',url],{windowsHide:true,stdio:'ignore'});
  for(let attempt=0;attempt<150;attempt++){
   try{
    if(!session){const port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const target=(await targets(port)).find(target=>target.url===url);if(target)session=await connect(target);}
    if(session){text=await session.evaluate("document.getElementById('result')?.textContent");if(text&&text!=='pending')break;}
   }catch(error){if(session)throw error;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }else{
  const {stdout}=await promisify(execFile)(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--dump-dom','--virtual-time-budget=10000',url],{timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
  text=stdout.match(/<pre id="result">(.*?)<\/pre>/s)?.[1];
 }
 if(!text||text==='pending')throw new Error('Browser checks did not finish');
 const result=JSON.parse(suite==='screenshot'?text:text.replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 session?.close();
 if(liveBrowser&&liveBrowser.exitCode===null){const exited=new Promise(resolve=>liveBrowser.once('exit',resolve));liveBrowser.kill();await exited;}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

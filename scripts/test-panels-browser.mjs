import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const root=process.cwd();
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
const profile=await mkdtemp(path.join(root,'artifacts/panels-browser-'));
try{
 const browser=process.env.MINEPIX_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const {stdout}=await promisify(execFile)(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',`--user-data-dir=${profile}`,'--dump-dom','--virtual-time-budget=10000',`http://127.0.0.1:${server.address().port}/tests/panels.browser.html`],{timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
 const text=stdout.match(/<pre id="result">(.*?)<\/pre>/s)?.[1];
 if(!text||text==='pending')throw new Error('Browser checks did not finish');
 const result=JSON.parse(text.replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}finally{
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
let payloadPath=path.resolve('artifacts/updater/protocol.bin'),version='2.0.0-alpha.2';
let bytes=await readFile(payloadPath),signature=(await readFile(payloadPath+'.sig','utf8')).trim();
let mode='available',current='2.0.0-alpha.1',checks=0,downloads=0;
const base='http://127.0.0.1:19412';
const server=http.createServer(async(request,response)=>{
 try{
  if(request.method==='POST'&&request.url==='/control'){
   let body='';for await(const part of request)body+=part;
   const options=JSON.parse(body);
   mode=options.mode;current=options.current||current;
   if(options.payload){
    payloadPath=path.resolve(options.payload);version=options.version;
    bytes=await readFile(payloadPath);signature=(await readFile(payloadPath+'.sig','utf8')).trim();
   }
   response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({mode,current,version,checks,downloads}));return;
  }
  if(request.url==='/stats'){response.end(JSON.stringify({mode,checks,downloads}));return;}
  if(request.url==='/latest.json'){
   checks++;
   if(mode==='check-error'){response.writeHead(503);response.end('fixture check error');return;}
   const target={url:base+'/installer.exe',signature};
   const manifest={version:mode==='current'?current:mode==='version-mismatch'?'3.0.0':version,
    notes:'Local signed update verification. <script>fixture must not execute</script>',pub_date:'2026-11-14T00:00:00Z',
    platforms:{'windows-x86_64-nsis':target,'windows-x86_64':target}};
   response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(manifest));return;
  }
  if(request.url==='/installer.exe'){
   downloads++;
   if(mode==='download-error'){response.writeHead(503);response.end('fixture download error');return;}
   const body=mode==='bad-signature'?Buffer.from(bytes):bytes;
   if(mode==='bad-signature')body[body.length-1]^=255;
   response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':body.length});
   if(mode==='interrupted'){response.write(body.subarray(0,8192));setTimeout(()=>response.destroy(),100);return;}
   let offset=0;
   const timer=setInterval(()=>{
    if(offset>=body.length){clearInterval(timer);response.end();return;}
    const end=Math.min(body.length,offset+32768);
    response.write(body.subarray(offset,end));offset=end;
   },mode==='slow'?40:1);
   response.once('close',()=>clearInterval(timer));return;
  }
  response.writeHead(404);response.end();
 }catch(error){response.writeHead(500);response.end(error.message);}
});
server.listen(19412,'127.0.0.1',()=>console.log('Local updater verification: '+base+'/latest.json'));

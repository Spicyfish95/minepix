import assert from 'node:assert/strict';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {blockmap,sha256} from './update-blockmap.mjs';

const exec=promisify(execFile),root=path.resolve('artifacts/differential-release');
const base=path.join(root,'before/setup.exe'),target=path.resolve('src-tauri/target/release/bundle/nsis/MinePix Tauri_2.0.0-alpha.2_x64-setup.exe');
const bytes=await readFile(target),signature=(await readFile(target+'.sig','utf8')).trim(),baseBytes=await readFile(base);
for(const [file,version]of [[base,'2.0.0-alpha.1'],[target,'2.0.0-alpha.2']]){
 const trusted=Buffer.from((await readFile(file+'.sig','utf8')).trim(),'base64').toString('utf8').split('\n').find(line=>line.startsWith('trusted comment:'));
 assert.ok(trusted?.split('\t').includes('version:'+version),'真实安装包签名绑定不同版本');
 assert.equal((await readFile(file)).readUInt16LE(0),0x5a4d,'实际Windows PE安装器');
}
assert.notEqual(sha256(baseBytes),sha256(bytes));await mkdir(root,{recursive:true});
const results=[];let mode='normal',traffic,manifest;
const server=http.createServer((request,response)=>{
 if(request.url==='/manifest'){
  const data=Buffer.from(JSON.stringify(manifest));traffic.manifestBytes+=data.length;
  response.writeHead(200,{'Content-Type':'application/json','Content-Length':data.length});response.end(data);return;
 }
 if(request.url!=='/setup.exe'){response.writeHead(404);response.end();return;}
 const ranged=request.headers.range,headers={'Content-Type':'application/octet-stream'};
 let body=bytes,status=200;
 if(ranged){
  traffic.rangeRequests++;assert.match(ranged,/^bytes=\d+-\d+$/);
  const [start,end]=ranged.slice(6).split('-').map(Number);assert.ok(start>=0&&end>=start&&end<bytes.length);
  if(mode!=='ignore-range'){
   body=bytes.subarray(start,end+1);status=206;
   headers['Content-Range']=`bytes ${mode==='wrong-range'?start+1:start}-${end}/${bytes.length}`;
  }
 }else traffic.fullRequests++;
 if(mode==='corrupt-range'&&ranged||mode==='bad-signature'){
  body=Buffer.from(body);body[0]^=1;
 }
 headers['Content-Length']=body.length;response.writeHead(status,headers);
 // Count complete response bodies accepted by Node's socket, including abandoned range replies.
 traffic.payloadBytes+=body.length;response.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/setup.exe`,endpoint=url.replace('/setup.exe','/manifest');
try{
 for(mode of ['normal','no-cache','ignore-range','wrong-range','corrupt-range','bad-signature','version-mismatch']){
  traffic={manifestBytes:0,payloadBytes:0,rangeRequests:0,fullRequests:0};
  const version=mode==='version-mismatch'?'3.0.0':'2.0.0-alpha.2';
  manifest={version,platforms:{'windows-x86_64':{url,signature}},minepixBlockmap:blockmap(bytes,version,url)};
  const downloaded=await (await fetch(endpoint)).text(),file=path.join(root,mode+'-manifest.json'),output=path.join(root,mode+'-rebuilt.exe');
  await writeFile(file,downloaded+'\n');
  const mapBytes=Buffer.byteLength(JSON.stringify({minepixBlockmap:manifest.minepixBlockmap}));
  let report,error;
  try{report=JSON.parse((await exec(path.resolve('src-tauri/target/debug/examples/differential-tool.exe'),[file,mode==='no-cache'?'-':base,output,'2.0.0-alpha.1'],{windowsHide:true,timeout:120000,maxBuffer:1024*1024})).stdout);}
  catch(failure){error={code:failure.code,stderr:failure.stderr};}
  if(['bad-signature','version-mismatch'].includes(mode)){
   assert.ok(error,'篡改 / 版本不符必须拒绝');assert.equal(traffic.fullRequests,1,'差分失败后完整包也必须拒绝');
  }else{
   assert.ok(report?.ok,JSON.stringify(error));assert.equal(report.signatureValid,true);assert.equal(report.versionBinding,true);assert.equal(report.executedInstaller,false);
   assert.ok((await readFile(output)).equals(bytes),'重建输出必须与目标安装器逐字节相同');
   if(mode==='normal'){
    assert.equal(report.transfer.mode,'differential');assert.equal(traffic.fullRequests,0);assert.ok(traffic.rangeRequests>0);
    assert.equal(report.transfer.downloadedBytes,traffic.payloadBytes);
    assert.ok(traffic.payloadBytes+mapBytes<bytes.length,'包含额外块图后仍应少于完整包传输');
   }else if(mode==='no-cache'){assert.equal(report.transfer.mode,'full');assert.equal(traffic.rangeRequests,0);}
   else{assert.equal(report.transfer.mode,'full-fallback');assert.ok(report.transfer.fallbackReason);assert.equal(traffic.fullRequests,1);}
  }
  const result={mode,pass:true,traffic:{...traffic},blockmapJsonBytes:mapBytes,acceptedNetworkBodyUpperBoundBytes:traffic.manifestBytes+traffic.payloadBytes,report,error};
  results.push(result);console.log(JSON.stringify(result));
 }
 const normal=results[0],reduction=(1-(normal.traffic.payloadBytes+normal.blockmapJsonBytes)/bytes.length)*100;
 await writeFile(root+'/report.json',JSON.stringify({ok:true,base:{file:base,version:'2.0.0-alpha.1',bytes:baseBytes.length,sha256:sha256(baseBytes)},target:{file:target,version:'2.0.0-alpha.2',bytes:bytes.length,sha256:sha256(bytes)},results,transferReductionIncludingBlockmapPercent:reduction,executedInstaller:false,limitations:['Uses production Rust downloader / pinned signature verifier with MockRuntime; no native update UI or installer execution','Byte counts cover HTTP response bodies, exclude HTTP headers / TLS / TCP overhead','Server counts bodies handed to its socket, abandoned invalid range responses are an upper bound','Manifest includes inline chunk metadata; report separately includes its extra JSON bytes','Two actual signed NSIS versions, not synthetic binary payloads; local loopback only; no remote publication']},null,2)+'\n');
 console.log(JSON.stringify({ok:true,scenarios:results.length,transferReductionIncludingBlockmapPercent:reduction,executedInstaller:false}));
}catch(error){await writeFile(root+'/failure.json',JSON.stringify({error:error.stack,results},null,2)+'\n');throw error;}
finally{await new Promise(resolve=>server.close(resolve));}

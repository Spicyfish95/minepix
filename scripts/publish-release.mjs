import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {verifyRelease,repository,sha256,compareVersions} from './verify-release.mjs';
const exec=promisify(execFile);
const gh=async(...args)=>(await exec('gh',[...args,'--repo',repository],{windowsHide:true})).stdout;
async function release(tag){
 try{return JSON.parse(await gh('release','view',tag,'--json','isDraft,targetCommitish,url'));}
 catch(error){if(/release not found|HTTP 404/.test(error.stderr))return null;throw error;}
}
async function publicBytes(url){
 for(let attempt=0;attempt<5;attempt++){
  const response=await fetch(url,{headers:{'Cache-Control':'no-cache'}});
  if(response.ok)return Buffer.from(await response.arrayBuffer());
  if(response.status!==404||attempt===4)throw new Error(`Public asset ${response.status}: ${url}`);
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
}
const local=await verifyRelease(),tag=`tauri-v${local.version}`;
assert.equal(process.env.GITHUB_REF,`refs/tags/${tag}`,'Publication requires the matching version tag');
const manifestBytes=await readFile('artifacts/release/latest.json');
const metadata=JSON.parse(manifestBytes);
const installer=`src-tauri/target/release/bundle/nsis/${local.artifact.filename}`;
const channelUrl=`https://github.com/${repository}/releases/download/tauri-latest/latest.json`;
const current=await fetch(channelUrl,{headers:{'Cache-Control':'no-cache'}});
if(current.ok)assert.ok(compareVersions(local.version,(await current.json()).version)>=0,'Refuse to downgrade the public update channel');
else assert.equal(current.status,404,'Cannot read existing public update channel');
let version=await release(tag);
if(!version){
 await gh('release','create',tag,'--verify-tag','--draft','--title',`MinePix ${local.version}`,'--notes-file','CHANGELOG.md');
 version=await release(tag);
}
if(version.isDraft){
 await gh('release','upload',tag,installer,installer+'.sig','artifacts/release/validation.json','--clobber');
 const flags=local.version.includes('-')?['--prerelease']:[];
 await gh('release','edit',tag,'--draft=false','--latest=false',...flags);
}
// A published version is never overwritten. Its public bytes must match this build.
const downloaded=await publicBytes(local.artifact.url);
assert.equal(sha256(downloaded),local.artifact.sha256);
assert.equal(downloaded.length,local.artifact.bytes);
const publicSignature=await publicBytes(local.artifact.url+'.sig');
assert.equal(publicSignature.toString('utf8').trim(),metadata.platforms['windows-x86_64-nsis'].signature);
const channel='tauri-latest';
if(!await release(channel))await gh('release','create',channel,'--target',process.env.GITHUB_SHA,'--prerelease','--latest=false','--title','MinePix update channel','--notes','Signed Windows x64 update manifest.');
// Promote only after immutable version assets have been downloaded and checked.
await gh('release','upload',channel,'artifacts/release/latest.json','--clobber');
const url=`https://github.com/${repository}/releases/download/${channel}/latest.json`;
assert.deepEqual(JSON.parse(await publicBytes(url)),metadata);
console.log(JSON.stringify({ok:true,tag,version:local.version,installer:local.artifact.url,channel:url,sha256:local.artifact.sha256},null,2));

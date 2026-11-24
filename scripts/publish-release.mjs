import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,copyFile,writeFile} from 'node:fs/promises';
import {verifyRelease,repository,sha256,compareVersions,releasePolicy} from './verify-release.mjs';
import {publicBytes} from './public-release-download.mjs';
const exec=promisify(execFile);
const gh=async(...args)=>(await exec('gh',[...args,'--repo',repository],{windowsHide:true})).stdout;
async function release(tag){
 try{return JSON.parse(await gh('release','view',tag,'--json','isDraft,isPrerelease,targetCommitish,url'));}
 catch(error){if(/release not found|HTTP 404/.test(error.stderr))return null;throw error;}
}
const local=await verifyRelease({requireRaw:false,requireLinux:true,writeReport:false}),tag=`minepix-v${local.version}`;
const policy=releasePolicy(local.version);
assert.equal(process.env.GITHUB_REF,`refs/tags/${tag}`,'Publication requires the matching version tag');
const manifestBytes=await readFile('artifacts/release/latest.json');
const metadata=JSON.parse(manifestBytes);
const notesFile='artifacts/release/notes.md';
assert.ok(metadata.notes?.trim(),'Publication requires version release notes');
await writeFile(notesFile,metadata.notes+'\n');
const installer=`src-tauri/target/release/bundle/nsis/${local.artifact.filename}`;
const channelUrl=`https://github.com/${repository}/releases/download/tauri-latest/latest.json`;
const current=await fetch(channelUrl,{headers:{'Cache-Control':'no-cache'}});
if(current.ok)assert.ok(compareVersions(local.version,(await current.json()).version)>=0,'Refuse to downgrade the public update channel');
else assert.equal(current.status,404,'Cannot read existing public update channel');
let version=await release(tag);
if(!version){
 await gh('release','create',tag,'--verify-tag','--draft','--title',`MinePix ${local.version}`,'--notes-file',notesFile);
 version=await release(tag);
}
if(version.isDraft){
 const publicInstaller=`artifacts/release/${local.artifact.assetName}`;
 const publicAppImage=`artifacts/release/${local.linux.appimage.assetName}`;
 const publicDeb=`artifacts/release/${local.linux.deb.assetName}`;
 await copyFile(installer,publicInstaller);
 await copyFile(installer+'.sig',publicInstaller+'.sig');
 await copyFile(local.linux.appimage.filePath,publicAppImage);
 await copyFile(local.linux.appimage.filePath+'.sig',publicAppImage+'.sig');
 await copyFile(local.linux.deb.filePath,publicDeb);
 await gh(
  'release','upload',tag,
  publicInstaller,publicInstaller+'.sig','artifacts/release/validation.json',
  publicAppImage,publicAppImage+'.sig',publicDeb,'artifacts/release/validation-linux.json',
  '--clobber'
 );
 await gh('release','edit',tag,'--notes-file',notesFile,'--draft=false','--latest=false',`--prerelease=${policy.prerelease}`);
}
// A published version is never overwritten. Its public bytes must match this build.
const downloaded=await publicBytes(local.artifact.url);
assert.equal(sha256(downloaded),local.artifact.sha256);
assert.equal(downloaded.length,local.artifact.bytes);
const publicSignature=await publicBytes(local.artifact.url+'.sig');
assert.equal(publicSignature.toString('utf8').trim(),metadata.platforms['windows-x86_64-nsis'].signature);

const downloadedAppImage=await publicBytes(local.linux.appimage.url);
assert.equal(sha256(downloadedAppImage),local.linux.appimage.sha256);
assert.equal(downloadedAppImage.length,local.linux.appimage.bytes);
const publicAppImageSignature=await publicBytes(local.linux.appimage.url+'.sig');
assert.equal(publicAppImageSignature.toString('utf8').trim(),metadata.platforms['linux-x86_64-appimage'].signature);

const downloadedDeb=await publicBytes(local.linux.deb.url);
assert.equal(sha256(downloadedDeb),local.linux.deb.sha256);
assert.equal(downloadedDeb.length,local.linux.deb.bytes);

const channel='tauri-latest';
if(!await release(channel))await gh('release','create',channel,'--target',process.env.GITHUB_SHA,'--prerelease','--latest=false','--title','MinePix update channel','--notes','Signed Windows x64 and Linux x64 update manifest.');
// Promote only after immutable version assets have been downloaded and checked.
await gh('release','upload',channel,'artifacts/release/latest.json','--clobber');
const url=`https://github.com/${repository}/releases/download/${channel}/latest.json`;
assert.deepEqual(JSON.parse(await publicBytes(url)),metadata);
// Stable releases become Latest only after the public installers and channel pass verification.
await gh('release','edit',tag,`--prerelease=${policy.prerelease}`,`--latest=${policy.latest}`);
const published=await release(tag);
assert.equal(published.isDraft,false);
assert.equal(published.isPrerelease,policy.prerelease);
if(policy.latest){
 const latest=JSON.parse(await publicBytes(`https://api.github.com/repos/${repository}/releases/latest`));
 assert.equal(latest.tag_name,tag);
}
console.log(JSON.stringify({
 ok:true,tag,version:local.version,prerelease:policy.prerelease,latest:policy.latest,
 installer:local.artifact.url,sha256:local.artifact.sha256,
 linux:{appimage:local.linux.appimage.url,appimageSha256:local.linux.appimage.sha256,deb:local.linux.deb.url,debSha256:local.linux.deb.sha256},
 channel:url
},null,2));

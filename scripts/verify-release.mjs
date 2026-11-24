import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {blockmap} from './update-blockmap.mjs';
import {linuxAppImageAssetName,linuxDebAssetName,verifyLinuxRelease} from './verify-linux-release.mjs';

export const repository='Spicyfish95/minepix';
export const releaseAssetName=version=>`MinePix_${version}_x64-setup.exe`;
export {linuxAppImageAssetName,linuxDebAssetName};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const releasePolicy=version=>({prerelease:version.includes('-'),latest:!version.includes('-')});
export function compareVersions(a,b){
 const parse=value=>{const [core,...suffix]=value.split('-');return {core:core.split('.').map(Number),pre:suffix.join('-').split('.').filter(Boolean)};};
 const left=parse(a),right=parse(b);
 for(let i=0;i<3;i++)if(left.core[i]!==right.core[i])return Math.sign(left.core[i]-right.core[i]);
 if(!left.pre.length||!right.pre.length)return Math.sign(right.pre.length-left.pre.length);
 for(let i=0;i<Math.max(left.pre.length,right.pre.length);i++){
  const x=left.pre[i],y=right.pre[i];
  if(x===undefined)return -1;
  if(y===undefined)return 1;
  if(x===y)continue;
  const xn=/^\d+$/.test(x),yn=/^\d+$/.test(y);
  if(xn&&yn)return Math.sign(Number(x)-Number(y));
  if(xn!==yn)return xn?-1:1;
  return x<y?-1:1;
 }
 return 0;
}
export function verifyManifest(manifest,version,bytes,signature,linux=null){
 const filename=`MinePix_${version}_x64-setup.exe`;
 const assetName=releaseAssetName(version);
 const url=`https://github.com/${repository}/releases/download/minepix-v${version}/${assetName}`;
 assert.equal(manifest.version,version);
 assert.ok(Number.isFinite(Date.parse(manifest.pub_date)));
 assert.equal(typeof manifest.notes,'string');
 for(const platform of ['windows-x86_64-nsis','windows-x86_64']){
  assert.deepEqual(manifest.platforms[platform],{signature:signature.trim(),url});
 }
 assert.deepEqual(manifest.minepixBlockmap,blockmap(bytes,version,url));
 let linuxInfo=null;
 if(linux){
  const linuxAsset=linuxAppImageAssetName(version);
  const linuxUrl=`https://github.com/${repository}/releases/download/minepix-v${version}/${linuxAsset}`;
  for(const platform of ['linux-x86_64-appimage','linux-x86_64']){
   assert.deepEqual(manifest.platforms[platform],{signature:linux.signature.trim(),url:linuxUrl});
  }
  linuxInfo={assetName:linuxAsset,url:linuxUrl};
 }
 return {filename,assetName,bytes:bytes.length,sha256:sha256(bytes),url,...(linuxInfo?{linux:linuxInfo}:{})};
}
export async function verifyRelease({requireRaw=true,requireLinux=false,writeReport=requireRaw}={}){
 const read=async name=>JSON.parse(await readFile(name,'utf8'));
 const config=await read('src-tauri/tauri.conf.json'),pkg=await read('package.json'),lock=await read('package-lock.json');
 assert.equal(config.version,pkg.version);
 assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
 const cargo=await readFile('src-tauri/Cargo.toml','utf8');
 assert.ok(cargo.includes('version = '+String.fromCharCode(34)+pkg.version+String.fromCharCode(34)));
 if(process.env.GITHUB_REF?.startsWith('refs/tags/'))assert.equal(process.env.GITHUB_REF,`refs/tags/minepix-v${pkg.version}`);
 assert.equal(config.plugins.updater.requireSignedVersion,true);
 assert.equal(config.plugins.updater.dangerousInsecureTransportProtocol,undefined);
 assert.deepEqual(config.plugins.updater.endpoints,[`https://github.com/${repository}/releases/download/tauri-latest/latest.json`]);
 const installer=path.resolve('src-tauri/target/release/bundle/nsis',`MinePix_${pkg.version}_x64-setup.exe`);
 const bytes=await readFile(installer),signature=await readFile(installer+'.sig','utf8');
 assert.equal(bytes.toString('ascii',0,2),'MZ');
 const pe=bytes.readUInt32LE(0x3c);
 assert.equal(bytes.toString('hex',pe,pe+4),'50450000');
 let raw=null;
 if(requireRaw){
  const rawBytes=await readFile('src-tauri/target/release/minepix-tauri.exe');
  const rawPe=rawBytes.readUInt32LE(0x3c);
  assert.equal(rawBytes.readUInt16LE(rawPe+4),0x8664);
  raw={bytes:rawBytes.length,sha256:sha256(rawBytes)};
 }
 const linux=requireLinux?await verifyLinuxRelease({requireRaw:false,writeReport:false}):null;
 const manifest=await read('artifacts/release/latest.json');
 const artifact=verifyManifest(manifest,pkg.version,bytes,signature,linux?{signature:linux.appimage.signature}:null);
 const result={ok:true,version:pkg.version,artifact,...(linux?{linux}:{}),...(raw?{raw}:{}),signatureVerification:'Run the fixed-key Rust update-tool separately'};
 if(writeReport){
  await mkdir('artifacts/release',{recursive:true});
  await writeFile('artifacts/release/validation.json',JSON.stringify(result,null,2)+'\n');
 }
 return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const requireRaw=!process.argv.includes('--skip-raw');
 const requireLinux=process.argv.includes('--require-linux');
 console.log(JSON.stringify(await verifyRelease({requireRaw,requireLinux}),null,2));
}

import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {blockmap} from './update-blockmap.mjs';
import {repository,releaseAssetName} from './verify-release.mjs';
import {findBundleFile,linuxAppImageAssetName,verifySignedVersion} from './verify-linux-release.mjs';
import {readReleaseNotes} from './release-notes.mjs';

const args=process.argv.slice(2);
const requireLinux=args.includes('--require-linux');
const versionArg=args.find(arg=>!arg.startsWith('--'));
const config=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));
const version=versionArg||config.version;
assert.match(version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const filename=`MinePix_${version}_x64-setup.exe`;
const installer=path.resolve('src-tauri/target/release/bundle/nsis',filename);
const signature=(await readFile(installer+'.sig','utf8')).trim();
verifySignedVersion(signature,version);
assert.ok(config.plugins.updater.requireSignedVersion,'运行时必须校验签名版本');
assert.ok(!config.plugins.updater.dangerousInsecureTransportProtocol,'普通发行配置必须使用 HTTPS');
const url=`https://github.com/${repository}/releases/download/minepix-v${version}/${releaseAssetName(version)}`;
const target={signature,url};
const notes=await readReleaseNotes(version,process.env.MINEPIX_RELEASE_NOTES);
const bytes=await readFile(installer);
const platforms={'windows-x86_64-nsis':target,'windows-x86_64':target};

let linuxReport=null;
let linuxBlockmap=null;
const appimageDir=path.resolve('src-tauri/target/release/bundle/appimage');
let hasLinuxDir=false;
try{await access(appimageDir);hasLinuxDir=true;}catch{}
if(requireLinux||hasLinuxDir){
 const appimageFile=await findBundleFile(appimageDir,'.AppImage',version);
 const linuxBytes=await readFile(appimageFile.filePath);
 const linuxSignature=(await readFile(appimageFile.filePath+'.sig','utf8')).trim();
 verifySignedVersion(linuxSignature,version);
 const linuxUrl=`https://github.com/${repository}/releases/download/minepix-v${version}/${linuxAppImageAssetName(version)}`;
 const linuxTarget={signature:linuxSignature,url:linuxUrl};
 platforms['linux-x86_64-appimage']=linuxTarget;
 linuxBlockmap=blockmap(linuxBytes,version,linuxUrl);
 linuxReport={installer:appimageFile.filePath,bytes:linuxBytes.length,sha256:createHash('sha256').update(linuxBytes).digest('hex'),signatureBindsVersion:true};
}

const manifest={
 version,
 pub_date:new Date().toISOString(),
 notes,
 platforms,
 minepixBlockmap:blockmap(bytes,version,url),
 ...(linuxBlockmap?{minepixBlockmaps:{'linux-x86_64-appimage':linuxBlockmap}}:{}),
};
await mkdir('artifacts/release',{recursive:true});
await writeFile('artifacts/release/latest.json',JSON.stringify(manifest,null,2)+'\n');
const report={version,installer,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signatureBindsVersion:true,...(linuxReport?{linux:linuxReport}:{}),published:false};
await writeFile('artifacts/release/update-artifacts.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

import assert from 'node:assert/strict';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export const repository='Spicyfish95/minepix';
export const linuxAppImageAssetName=version=>`MinePix_${version}_amd64.AppImage`;
export const linuxDebAssetName=version=>`MinePix_${version}_amd64.deb`;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function verifySignedVersion(signature,version){
 const trusted=Buffer.from(signature.trim(),'base64').toString('utf8').split('\n').find(line=>line.startsWith('trusted comment:'));
 assert.ok(trusted?.split('\t').includes('version:'+version),'签名必须绑定对应应用版本');
}

export async function findBundleFile(directory,extension,version){
 const entries=await readdir(directory);
 const matches=entries.filter(name=>name.endsWith(extension)&&!name.endsWith('.sig'));
 assert.equal(matches.length,1,`${directory} 必须包含唯一的 ${extension} 安装包`);
 const filename=matches[0];
 assert.ok(filename.includes(version),`安装包文件名必须包含版本 ${version}: ${filename}`);
 assert.ok(/amd64|x86_64/i.test(filename),`安装包文件名必须标明 x86_64/amd64 架构: ${filename}`);
 return {filename,filePath:path.join(directory,filename)};
}

function assertElf64X86(bytes,label){
 assert.ok(bytes.length>=20,`${label} 长度不足`);
 assert.equal(bytes.subarray(0,4).toString('hex'),'7f454c46',`${label} 必须是 ELF 文件`);
 assert.equal(bytes[4],2,`${label} 必须是 64 位 ELF`);
 assert.equal(bytes.readUInt16LE(18),0x3e,`${label} 必须是 x86_64 架构`);
}

export async function verifyLinuxRelease({requireRaw=true,writeReport=requireRaw,cwd=process.cwd()}={}){
 const read=async name=>JSON.parse(await readFile(path.join(cwd,name),'utf8'));
 const config=await read('src-tauri/tauri.conf.json');
 const linuxConfig=await read('src-tauri/tauri.linux.conf.json');
 const pkg=await read('package.json');
 const lock=await read('package-lock.json');
 assert.equal(config.version,pkg.version);
 assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
 const cargo=await readFile(path.join(cwd,'src-tauri/Cargo.toml'),'utf8');
 assert.ok(cargo.includes('version = '+String.fromCharCode(34)+pkg.version+String.fromCharCode(34)));
 if(process.env.GITHUB_REF?.startsWith('refs/tags/'))assert.equal(process.env.GITHUB_REF,`refs/tags/minepix-v${pkg.version}`);
 assert.ok(linuxConfig.bundle?.targets?.includes('appimage'),'Linux 构建配置必须包含 appimage 目标');
 assert.ok(linuxConfig.bundle?.targets?.includes('deb'),'Linux 构建配置必须包含 deb 目标');
 assert.equal(config.plugins.updater.requireSignedVersion,true);
 assert.equal(config.plugins.updater.dangerousInsecureTransportProtocol,undefined);
 assert.deepEqual(config.plugins.updater.endpoints,[`https://github.com/${repository}/releases/download/tauri-latest/latest.json`]);

 const appimageDir=path.resolve(cwd,'src-tauri/target/release/bundle/appimage');
 const appimageFile=await findBundleFile(appimageDir,'.AppImage',pkg.version);
 const appimageBytes=await readFile(appimageFile.filePath);
 const appimageSignature=(await readFile(appimageFile.filePath+'.sig','utf8')).trim();
 assertElf64X86(appimageBytes,appimageFile.filename);
 verifySignedVersion(appimageSignature,pkg.version);

 const debDir=path.resolve(cwd,'src-tauri/target/release/bundle/deb');
 const debFile=await findBundleFile(debDir,'.deb',pkg.version);
 const debBytes=await readFile(debFile.filePath);
 assert.equal(debBytes.subarray(0,8).toString('ascii'),'!<arch>\n',`${debFile.filename} 必须是合法的 deb(ar) 安装包`);

 let raw=null;
 if(requireRaw){
  const rawBytes=await readFile(path.resolve(cwd,'src-tauri/target/release/minepix-tauri'));
  assertElf64X86(rawBytes,'minepix-tauri');
  raw={bytes:rawBytes.length,sha256:sha256(rawBytes)};
 }

 const appimageAsset=linuxAppImageAssetName(pkg.version);
 const debAsset=linuxDebAssetName(pkg.version);
 const appimageUrl=`https://github.com/${repository}/releases/download/minepix-v${pkg.version}/${appimageAsset}`;
 const debUrl=`https://github.com/${repository}/releases/download/minepix-v${pkg.version}/${debAsset}`;
 const result={
  ok:true,
  version:pkg.version,
  appimage:{
   filename:appimageFile.filename,
   filePath:appimageFile.filePath,
   assetName:appimageAsset,
   bytes:appimageBytes.length,
   sha256:sha256(appimageBytes),
   url:appimageUrl,
   signature:appimageSignature,
  },
  deb:{
   filename:debFile.filename,
   filePath:debFile.filePath,
   assetName:debAsset,
   bytes:debBytes.length,
   sha256:sha256(debBytes),
   url:debUrl,
  },
  ...(raw?{raw}:{}),
  signatureVerification:'Run the fixed-key Rust update-tool separately',
 };
 if(writeReport){
  const report={
   ok:true,
   version:pkg.version,
   appimage:{filename:result.appimage.filename,assetName:appimageAsset,bytes:result.appimage.bytes,sha256:result.appimage.sha256,url:appimageUrl},
   deb:{filename:result.deb.filename,assetName:debAsset,bytes:result.deb.bytes,sha256:result.deb.sha256,url:debUrl},
   ...(raw?{raw}:{}),
   signatureVerification:result.signatureVerification,
  };
  await mkdir(path.join(cwd,'artifacts/release'),{recursive:true});
  await writeFile(path.join(cwd,'artifacts/release/validation-linux.json'),JSON.stringify(report,null,2)+'\n');
 }
 return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const requireRaw=!process.argv.includes('--skip-raw');
 const result=await verifyLinuxRelease({requireRaw});
 console.log(JSON.stringify({...result,appimage:{...result.appimage,signature:'<redacted>'}},null,2));
}

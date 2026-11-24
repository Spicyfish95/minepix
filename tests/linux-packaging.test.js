import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyLinuxRelease,linuxAppImageAssetName,linuxDebAssetName} from '../scripts/verify-linux-release.mjs';

const exec=promisify(execFile);
const readJson=async rel=>JSON.parse(await readFile(new URL('../'+rel,import.meta.url),'utf8'));

function elf64X86Fixture(){
 const bytes=Buffer.alloc(64);
 bytes[0]=0x7f;bytes[1]=0x45;bytes[2]=0x4c;bytes[3]=0x46;
 bytes[4]=2;
 bytes.writeUInt16LE(0x3e,18);
 return bytes;
}

test('Linux Tauri 配置构建 AppImage 与 deb 并复用跨平台前端构建',async()=>{
 const config=await readJson('src-tauri/tauri.linux.conf.json');
 const pkg=await readJson('package.json');
 assert.equal(config.build.beforeBuildCommand,'npm run build');
 assert.deepEqual(config.bundle.targets,['appimage','deb']);
 assert.deepEqual(config.bundle.icon,['../src/assets/app-icon.png']);
 assert.equal(config.bundle.linux.deb.section,'graphics');
 assert.equal(pkg.scripts['package:linux'],'tauri build --config src-tauri/tauri.linux.conf.json');
});

test('GitHub release 与 rust-cache 工作流覆盖 Windows 与 Linux 并行构建及统一发布',async()=>{
 const release=await readFile(new URL('../.github/workflows/release.yml',import.meta.url),'utf8');
 const cache=await readFile(new URL('../.github/workflows/rust-cache.yml',import.meta.url),'utf8');
 assert.ok(release.includes('runs-on: ubuntu-22.04'));
 assert.ok(release.includes('tauri build --config src-tauri/tauri.linux.conf.json -- --locked'));
 assert.ok(release.includes('node scripts/verify-linux-release.mjs'));
 assert.ok(release.includes('needs: [windows, linux]'));
 assert.ok(release.includes('node scripts/create-update-manifest.mjs --require-linux'));
 assert.ok(cache.includes('shared-key: ubuntu-22.04-linux-v1'));
 assert.ok(release.includes('shared-key: ubuntu-22.04-linux-v1'));
});

test('verifyLinuxRelease 校验 ELF、deb 与版本绑定签名，并拒绝损坏载荷',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'minepix-linux-verify-'));
 const version='2.0.11';
 try{
  await mkdir(path.join(dir,'src-tauri/target/release/bundle/appimage'),{recursive:true});
  await mkdir(path.join(dir,'src-tauri/target/release/bundle/deb'),{recursive:true});
  await writeFile(path.join(dir,'package.json'),JSON.stringify({version}));
  await writeFile(path.join(dir,'package-lock.json'),JSON.stringify({version,packages:{'':{version}}}));
  await writeFile(path.join(dir,'src-tauri/Cargo.toml'),`[package]\nname = "minepix-tauri"\nversion = "${version}"\n`);
  await writeFile(path.join(dir,'src-tauri/tauri.conf.json'),JSON.stringify({
   version,
   plugins:{updater:{requireSignedVersion:true,endpoints:['https://github.com/Spicyfish95/minepix/releases/download/tauri-latest/latest.json']}},
  }));
  await writeFile(path.join(dir,'src-tauri/tauri.linux.conf.json'),JSON.stringify({bundle:{targets:['appimage','deb']}}));
  const appimage=path.join(dir,'src-tauri/target/release/bundle/appimage',linuxAppImageAssetName(version));
  const deb=path.join(dir,'src-tauri/target/release/bundle/deb',linuxDebAssetName(version));
  const raw=path.join(dir,'src-tauri/target/release/minepix-tauri');
  await writeFile(appimage,elf64X86Fixture());
  await writeFile(appimage+'.sig',Buffer.from(`trusted comment: fixture\tversion:${version}\n`).toString('base64'));
  await writeFile(deb,Buffer.from('!<arch>\ndebian-binary'));
  await writeFile(raw,elf64X86Fixture());

  const result=await verifyLinuxRelease({cwd:dir});
  assert.equal(result.ok,true);
  assert.equal(result.appimage.assetName,linuxAppImageAssetName(version));
  assert.equal(result.deb.assetName,linuxDebAssetName(version));
  assert.ok(result.raw.bytes===64);
  const report=JSON.parse(await readFile(path.join(dir,'artifacts/release/validation-linux.json'),'utf8'));
  assert.equal(report.version,version);

  await writeFile(deb,Buffer.from('not-a-deb'));
  await assert.rejects(()=>verifyLinuxRelease({cwd:dir}),/deb/);
  await writeFile(deb,Buffer.from('!<arch>\ndebian-binary'));

  await writeFile(appimage+'.sig',Buffer.from('trusted comment: fixture\tversion:9.9.9\n').toString('base64'));
  await assert.rejects(()=>verifyLinuxRelease({cwd:dir}),/版本/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('create-update-manifest 在存在 Linux AppImage 时生成多平台清单，--require-linux 缺失时报错',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'minepix-multi-manifest-'));
 const script=fileURLToPath(new URL('../scripts/create-update-manifest.mjs',import.meta.url));
 const version='2.0.11';
 try{
  const nsisDir=path.join(dir,'src-tauri/target/release/bundle/nsis');
  await mkdir(nsisDir,{recursive:true});
  await writeFile(path.join(dir,'src-tauri/tauri.conf.json'),JSON.stringify({version,plugins:{updater:{requireSignedVersion:true}}}));
  await writeFile(path.join(dir,'CHANGELOG.md'),`# 变更记录\n\n## ${version}\n\n- 多平台发布\n`);
  const exe=path.join(nsisDir,`MinePix_${version}_x64-setup.exe`);
  await writeFile(exe,'windows payload');
  await writeFile(exe+'.sig',Buffer.from(`trusted comment: win\tversion:${version}\n`).toString('base64'));

  await assert.rejects(exec(process.execPath,[script,'--require-linux'],{cwd:dir,windowsHide:true}));

  const appimageDir=path.join(dir,'src-tauri/target/release/bundle/appimage');
  await mkdir(appimageDir,{recursive:true});
  const appimage=path.join(appimageDir,linuxAppImageAssetName(version));
  await writeFile(appimage,elf64X86Fixture());
  const linuxSig=Buffer.from(`trusted comment: linux\tversion:${version}\n`).toString('base64');
  await writeFile(appimage+'.sig',linuxSig);

  await exec(process.execPath,[script,'--require-linux'],{cwd:dir,windowsHide:true});
  const manifest=JSON.parse(await readFile(path.join(dir,'artifacts/release/latest.json'),'utf8'));
  const expectedLinuxUrl=`https://github.com/Spicyfish95/minepix/releases/download/minepix-v${version}/${linuxAppImageAssetName(version)}`;
  assert.equal(manifest.version,version);
  assert.equal(manifest.platforms['linux-x86_64'],undefined);
  assert.equal(manifest.platforms['linux-x86_64-appimage'].signature,linuxSig);
  assert.equal(manifest.platforms['linux-x86_64-appimage'].url,expectedLinuxUrl);
  assert.ok(manifest.platforms['windows-x86_64-nsis'].url.endsWith(`MinePix_${version}_x64-setup.exe`));
  assert.equal(manifest.minepixBlockmaps['linux-x86_64-appimage'].format,'minepix-blockmap-v1');
  assert.equal(manifest.minepixBlockmaps['linux-x86_64-appimage'].url,expectedLinuxUrl);
  assert.equal(manifest.minepixBlockmaps['linux-x86_64-appimage'].size,64);
  assert.ok(manifest.minepixBlockmap.url.endsWith(`MinePix_${version}_x64-setup.exe`));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('desktop.js 在非 WebView2 平台（Linux WebKitGTK）拖放与剪贴板粘贴均有回退实现',async()=>{
 const desktop=await readFile(new URL('../src/desktop.js',import.meta.url),'utf8');
 assert.ok(desktop.includes('open_dropped_bytes'));
 assert.ok(!desktop.includes('当前 WebView2 不支持本地文件路径'));
 assert.ok(desktop.includes('navigator.clipboard?.read'));
});

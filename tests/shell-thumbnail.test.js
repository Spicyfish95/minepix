import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const config=JSON.parse(read('src-tauri/tauri.conf.json')),hooks=read('src-tauri/windows/thumbnail-hooks.nsh'),installer=read('src-tauri/windows/installer-hooks.nsh');
test('desktop packaging builds and embeds the standalone thumbnail DLL',()=>{
 assert.equal(config.build.beforeBuildCommand,'powershell -NoProfile -File scripts/build-desktop.ps1');
 assert.ok(read('scripts/build-desktop.ps1').includes('cargo build --locked --release --target x86_64-pc-windows-msvc --manifest-path src-tauri/thumbnailer/Cargo.toml --target-dir src-tauri/target'));
 assert.ok(read('scripts/build-desktop.ps1').includes('target-feature=+crt-static'));
 assert.ok(hooks.includes('File /oname=minepix-thumbnailer.dll "${MINEPIX_THUMB_SOURCE}"'));
 assert.ok(installer.includes('!insertmacro MinePixInstallThumbnails'));assert.ok(installer.includes('!insertmacro MinePixUninstallThumbnails'));
});
test('thumbnail registration is user-scoped and preserves third-party associations and providers',()=>{
 for(const ext of ['pix','ase','aseprite'])assert.ok(hooks.includes(`!insertmacro MinePixRegisterThumbnail "${ext}"`));
 assert.ok(hooks.includes('ReadRegStr $0 HKCR ".${EXT}\\ShellEx\\${MINEPIX_THUMB_IID}"'));
 assert.ok(hooks.includes('ReadRegStr $5 HKCR "$4\\ShellEx\\${MINEPIX_THUMB_IID}"'));
 assert.doesNotMatch(hooks,/WriteRegStr[^\n]*(?:UserChoice|"Software\\Classes\\\.\$\{EXT\}"\s)/);
 assert.doesNotMatch(hooks,/WriteRegStr HKLM|DisableProcessIsolation/);
 assert.ok(hooks.includes('ThreadingModel" "Apartment"'));
});
test('updates use versioned DLLs and uninstall only removes owned handlers',()=>{
 assert.ok(hooks.includes('$INSTDIR\\thumbnails\\${VERSION}\\minepix-thumbnailer.dll'));
 assert.ok(hooks.includes('${If} $0 == "${MINEPIX_THUMB_CLSID}"'));
 assert.ok(hooks.includes('Delete /REBOOTOK "$INSTDIR\\thumbnails\\${VERSION}\\minepix-thumbnailer.dll"'));
 assert.ok(hooks.includes('${If} $0 == "$INSTDIR\\thumbnails\\${VERSION}\\minepix-thumbnailer.dll"'));
});
test('shell extension uses streams and native thumbnail interfaces without launching the editor',()=>{
 const source=read('src-tauri/thumbnailer/src/shell.rs'),manifest=read('src-tauri/thumbnailer/Cargo.toml');
 assert.match(source,/#\[implement\(IInitializeWithStream,\s*IThumbnailProvider\)\]/);
 assert.ok(source.includes('WTSAT_ARGB'));assert.ok(source.includes('catch_unwind'));
 assert.doesNotMatch(source,/Command::new|ShellExecute|CreateProcess|fs::write/);assert.doesNotMatch(manifest,/tauri|webview|reqwest/);
});

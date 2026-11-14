import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
const script=readFileSync(new URL('../src-tauri/windows/installer-hooks.nsh',import.meta.url),'utf8');
const nsis=config.bundle.windows.nsis;

test('Tauri NSIS配置包含英语简繁中文并显示语言选择器',()=>{
 assert.deepEqual(nsis.languages,['English','SimpChinese','TradChinese']);
 assert.equal(nsis.displayLanguageSelector,true);assert.deepEqual(config.bundle.targets,['nsis']);
});
test('使用当前用户安装身份与明确安装钩子',()=>{
 assert.equal(nsis.installMode,'currentUser');assert.equal(config.identifier,'com.minepix.tauri');
 assert.equal(config.productName,'MinePix Tauri');assert.equal(nsis.installerHooks,'windows/installer-hooks.nsh');
});
test('PIX和Applications注册使用随包分发的专用文档图标',()=>{
 assert.equal(config.bundle.resources['../src/assets/project-icon.ico'],'project-icon.ico');
 assert.equal(config.bundle.resources['../src/assets/app-icon.png'],'notification-icon.png');
 for(const key of ['MinePixTauri.Project','Applications\\${MAINBINARYNAME}.exe'])assert.ok(script.includes('"Software\\Classes\\'+key+'\\DefaultIcon" "" "$\\"$INSTDIR\\project-icon.ico$\\""'));
});
test('三种格式只注册独立打开方式不覆盖扩展名默认值',()=>{
 for(const [extension,prog]of [['pix','Project'],['ase','Aseprite'],['aseprite','Aseprite']]){
  assert.ok(script.includes(`!insertmacro MinePixRegisterType "${extension}" "MinePixTauri.${prog}"`));
  assert.ok(script.includes(`!insertmacro MinePixRemoveType "${extension}" "MinePixTauri.${prog}"`));
 }
 assert.ok(script.includes('Software\\Classes\\.${EXT}\\OpenWithProgids'));
 assert.doesNotMatch(script,/WriteRegStr[^\n]*"Software\\Classes\\\.\$\{EXT\}"/);
 assert.doesNotMatch(script,/UserChoice|assoc |ftype /i);
});
test('安装器基准只缓存并删除自身文件且卸载不递归删除用户数据',()=>{
 assert.ok(script.includes('CopyFiles /SILENT "$EXEPATH" "$APPDATA\\${BUNDLEID}\\update-cache\\base.exe"'));
 assert.ok(script.includes('Delete "$APPDATA\\${BUNDLEID}\\update-cache\\base.exe"'));
 assert.ok(script.includes('RMDir "$APPDATA\\${BUNDLEID}\\update-cache"'));
 assert.doesNotMatch(script,/RMDir\s+\/r|Delete\s+"[^"\n]*\*|MinePix_is1/);
});
test('新频道使用HTTPS固定公钥和签名版本而安装保持明确静默模式',()=>{
 assert.equal(config.bundle.createUpdaterArtifacts,true);assert.equal(config.plugins.updater.requireSignedVersion,true);
 assert.ok(config.plugins.updater.pubkey.length>40);assert.equal(config.plugins.updater.windows.installMode,'quiet');
 assert.ok(config.plugins.updater.endpoints.every(url=>url.startsWith('https://')&&url.includes('/tauri-latest/')));
 assert.notEqual(config.plugins.updater.dangerousInsecureTransportProtocol,true);
});

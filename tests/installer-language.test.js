import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const config=JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
const script=readFileSync(new URL('../src-tauri/windows/installer-hooks.nsh',import.meta.url),'utf8');
const nsis=config.bundle.windows.nsis;

test('Tauri NSIS配置包含英语简繁中文并显示语言选择器',()=>{
 assert.deepEqual(nsis.languages,['English','SimpChinese','TradChinese']);
 assert.equal(nsis.displayLanguageSelector,true);assert.deepEqual(config.bundle.targets,['nsis']);
});
test('使用当前用户安装身份与明确安装钩子',()=>{
 assert.equal(nsis.installMode,'currentUser');assert.equal(config.identifier,'com.minepix.tauri');
 assert.equal(config.productName,'MinePix');assert.equal(nsis.installerHooks,'windows/installer-hooks.nsh');
});
test('安装包文件显式使用软件图标而非默认安装器或PIX文档图标',()=>{
 assert.equal(nsis.installerIcon,'../src/assets/app-icon.ico');
 assert.ok(config.bundle.icon.includes(nsis.installerIcon));
 const icon=readFileSync(new URL('../src-tauri/'+nsis.installerIcon,import.meta.url));
 assert.equal(icon.readUInt16LE(0),0);assert.equal(icon.readUInt16LE(2),1);
 assert.ok(icon.readUInt16LE(4)>0);
 assert.notEqual(nsis.installerIcon,'../src/assets/project-icon.ico');
});
test('PIX和Applications注册使用随包分发的专用文档图标',()=>{
 assert.equal(config.bundle.resources['../src/assets/project-icon.ico'],'project-icon.ico');
 assert.equal(config.bundle.resources['../src/assets/app-icon.png'],'notification-icon.png');
 for(const key of ['MinePixTauri.Project','Applications\\${MAINBINARYNAME}.exe'])assert.ok(script.includes('"Software\\Classes\\'+key+'\\DefaultIcon" "" "$\\"$INSTDIR\\project-icon.ico$\\""'));
});
test('三种格式提供打开方式且不批量覆盖扩展名默认值',()=>{
 for(const [extension,prog]of [['pix','Project'],['ase','Aseprite'],['aseprite','Aseprite']]){
  assert.ok(script.includes(`!insertmacro MinePixRegisterType "${extension}" "MinePixTauri.${prog}"`));
  assert.ok(script.includes(`!insertmacro MinePixRemoveType "${extension}" "MinePixTauri.${prog}"`));
 }
 assert.ok(script.includes('Software\\Classes\\.${EXT}\\OpenWithProgids'));
 assert.doesNotMatch(script,/WriteRegStr[^\n]*"Software\\Classes\\\.\$\{EXT\}"/);
 assert.doesNotMatch(script,/UserChoice|assoc |ftype /i);
});
test('安装器不再留存安装器副本且仅清理自身更新缓存',()=>{
 assert.doesNotMatch(script,/CopyFiles[^\n]*update-cache/);
 assert.ok(script.includes('${If} $UpdateMode <> 1\n    Delete "$APPDATA\\${BUNDLEID}\\update-cache\\pending.json"'));
 assert.ok(script.includes('Delete "$APPDATA\\${BUNDLEID}\\update-cache\\pending.exe"'));
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


test('对外名称为MinePix并保留现有安装升级身份',()=>{
 assert.equal(nsis.template,'windows/installer.nsi');
 const template=readFileSync(new URL('../src-tauri/windows/installer.nsi',import.meta.url),'utf8');
 assert.ok(template.includes('!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MinePix Tauri"'));
 assert.ok(template.includes('!define MANUPRODUCTKEY "${MANUKEY}\\MinePix Tauri"'));
 assert.ok(template.includes('WriteRegStr SHCTX "${UNINSTKEY}" "DisplayName" "${PRODUCTNAME}"'));
 assert.match(readFileSync(new URL('../src-tauri/src/windows.rs',import.meta.url),'utf8'),/\.title\("MinePix"\)/);
});
test('PIX已有默认应用名使用文档图标且命令指向本次安装',()=>{
 for(const prog of ['MinePix.Project','Applications\\MinePix.exe']){
  assert.ok(script.includes('"Software\\Classes\\'+prog+'\\DefaultIcon" "" "$\\"$INSTDIR\\project-icon.ico$\\""'));
  assert.ok(script.includes('"Software\\Classes\\'+prog+'\\shell\\open\\command"')||script.includes('"pix" "'+prog+'"'));
  assert.ok(script.includes('DeleteRegKey SHCTX "Software\\Classes\\'+prog+'"'));
 }
});


test('首次安装仅为空的PIX默认值赋值，卸载仅清除自身默认值',()=>{
 assert.ok(script.includes('ReadRegStr $0 SHCTX "Software\\Classes\\.pix" ""\n  ${If} $0 == ""\n    WriteRegStr SHCTX "Software\\Classes\\.pix" "" "MinePix.Project"\n  ${EndIf}'));
 assert.ok(script.includes('ReadRegStr $0 SHCTX "Software\\Classes\\.pix" ""\n  ${If} $0 == "MinePix.Project"\n    DeleteRegValue SHCTX "Software\\Classes\\.pix" ""\n  ${EndIf}'));
 assert.doesNotMatch(script,/UserChoice/);
});


test('自定义模板与固定CLI的官方模板仅有两个安装注册键差异',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.devDependencies['@tauri-apps/cli'],'2.12.4');
 const template=readFileSync(new URL('../src-tauri/windows/installer.nsi',import.meta.url),'utf8');
 const original=template.split('\n').slice(2).join('\n')
  .replace('!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MinePix Tauri"','!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCTNAME}"')
  .replace('!define MANUPRODUCTKEY "${MANUKEY}\\MinePix Tauri"','!define MANUPRODUCTKEY "${MANUKEY}\\${PRODUCTNAME}"');
 assert.equal(createHash('sha256').update(original).digest('hex'),'d00089d3b1a2c4a30d7b6e098079100cb8f25e980f84d4515aca4597b95e967d');
});

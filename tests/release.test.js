import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyManifest,repository,compareVersions,releasePolicy} from '../scripts/verify-release.mjs';
import {blockmap} from '../scripts/update-blockmap.mjs';
const version='2.0.0-alpha.1',bytes=Buffer.from('release payload'),signature='test signature';
test('stable releases are Latest while prereleases remain outside the stable entry',()=>{
 assert.deepEqual(releasePolicy('2.0.0'),{prerelease:false,latest:true});
 assert.deepEqual(releasePolicy('2.0.1'),{prerelease:false,latest:true});
 assert.deepEqual(releasePolicy('2.1.0-rc.1'),{prerelease:true,latest:false});
 assert.deepEqual(releasePolicy('2.0.0-alpha.4'),{prerelease:true,latest:false});
});
test('update channel ordering compares numeric prereleases and stable versions',()=>{
 for(const [a,b]of [['2.0.0-alpha.10','2.0.0-alpha.2'],['2.0.0','2.0.0-alpha.10'],['2.1.0','2.0.9'],['2.0.0-beta','2.0.0-alpha'],['2.0.0-alpha.1','2.0.0-alpha']]){
  assert.equal(compareVersions(a,b),1);assert.equal(compareVersions(b,a),-1);
 }
 assert.equal(compareVersions(version,version),0);
 assert.equal(compareVersions('2.0.0','2.0.0'),0);
});
function fixture(releaseVersion=version){
 const url=`https://github.com/${repository}/releases/download/minepix-v${releaseVersion}/MinePix.Tauri_${releaseVersion}_x64-setup.exe`;
 return {version:releaseVersion,pub_date:new Date(0).toISOString(),notes:'test',platforms:Object.fromEntries(['windows-x86_64-nsis','windows-x86_64'].map(p=>[p,{url,signature}])),minepixBlockmap:blockmap(bytes,releaseVersion,url)};
}
test('stable manifests bind minepix version tags and reject the superseded tag prefix',()=>{
 const stable=fixture('2.0.0');
 assert.equal(verifyManifest(stable,'2.0.0',bytes,signature).url,`https://github.com/${repository}/releases/download/minepix-v2.0.0/MinePix.Tauri_2.0.0_x64-setup.exe`);
 stable.platforms['windows-x86_64-nsis'].url=stable.platforms['windows-x86_64-nsis'].url.replace('minepix-v','tauri-v');
 assert.throws(()=>verifyManifest(stable,'2.0.0',bytes,signature));
});
test('both updater target identifiers bind the version asset and exact blockmap',()=>assert.equal(verifyManifest(fixture(),version,bytes,signature).bytes,bytes.length));
test('public installer names match GitHub assets without space normalization',()=>{
 const result=verifyManifest(fixture(),version,bytes,signature);
 assert.equal(result.assetName,'MinePix.Tauri_2.0.0-alpha.1_x64-setup.exe');
 assert.ok(result.url.endsWith('/MinePix.Tauri_2.0.0-alpha.1_x64-setup.exe'));
 const wrong=fixture();
 wrong.platforms['windows-x86_64-nsis'].url=wrong.platforms['windows-x86_64-nsis'].url.replace('MinePix.Tauri','MinePix%20Tauri');
 assert.throws(()=>verifyManifest(wrong,version,bytes,signature));
});
test('modified bytes and mismatched signatures are rejected',()=>{
 assert.throws(()=>verifyManifest(fixture(),version,Buffer.from('changed payload'),signature));
 assert.throws(()=>verifyManifest(fixture(),version,bytes,'other signature'));
});
test('wrong versions and mutable channel asset URLs cannot be promoted',()=>{
 const wrong=fixture();wrong.version='2.0.0-alpha.2';assert.throws(()=>verifyManifest(wrong,version,bytes,signature));
 const mutable=fixture();mutable.platforms['windows-x86_64'].url='https://example.com/latest.exe';assert.throws(()=>verifyManifest(mutable,version,bytes,signature));
});

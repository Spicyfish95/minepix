import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyManifest,repository,compareVersions} from '../scripts/verify-release.mjs';
import {blockmap} from '../scripts/update-blockmap.mjs';
const version='2.0.0-alpha.1',bytes=Buffer.from('release payload'),signature='test signature';
test('update channel ordering compares numeric prereleases and stable versions',()=>{
 for(const [a,b]of [['2.0.0-alpha.10','2.0.0-alpha.2'],['2.0.0','2.0.0-alpha.10'],['2.1.0','2.0.9'],['2.0.0-beta','2.0.0-alpha'],['2.0.0-alpha.1','2.0.0-alpha']]){
  assert.equal(compareVersions(a,b),1);assert.equal(compareVersions(b,a),-1);
 }
 assert.equal(compareVersions(version,version),0);
 assert.equal(compareVersions('2.0.0','2.0.0'),0);
});
function fixture(){
 const url=`https://github.com/${repository}/releases/download/tauri-v${version}/${encodeURIComponent(`MinePix Tauri_${version}_x64-setup.exe`)}`;
 return {version,pub_date:new Date(0).toISOString(),notes:'test',platforms:Object.fromEntries(['windows-x86_64-nsis','windows-x86_64'].map(p=>[p,{url,signature}])),minepixBlockmap:blockmap(bytes,version,url)};
}
test('both updater target identifiers bind the version asset and exact blockmap',()=>assert.equal(verifyManifest(fixture(),version,bytes,signature).bytes,bytes.length));
test('modified bytes and mismatched signatures are rejected',()=>{
 assert.throws(()=>verifyManifest(fixture(),version,Buffer.from('changed payload'),signature));
 assert.throws(()=>verifyManifest(fixture(),version,bytes,'other signature'));
});
test('wrong versions and mutable channel asset URLs cannot be promoted',()=>{
 const wrong=fixture();wrong.version='2.0.0-alpha.2';assert.throws(()=>verifyManifest(wrong,version,bytes,signature));
 const mutable=fixture();mutable.platforms['windows-x86_64'].url='https://example.com/latest.exe';assert.throws(()=>verifyManifest(mutable,version,bytes,signature));
});

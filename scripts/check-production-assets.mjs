import {readdir,readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
async function inventory(directory){
 const entries=await readdir(directory,{withFileTypes:true});
 const all=await Promise.all(entries.map(async entry=>{
  const name=path.join(directory,entry.name);
  return entry.isDirectory()?inventory(name):[{name,bytes:(await stat(name)).size}];
 }));
 return all.flat();
}
const files=await inventory('dist');
assert.ok(!files.some(file=>file.name.includes('-smoke-')),'发行资源不含历史 smoke chunk');
const app=files.find(file=>/^app-.*\.js$/.test(path.basename(file.name)));
const source=await readFile(app.name,'utf8');
for(const name of ['runTilemapSmoke','runSettingsSmoke','runParitySmoke','prepareUpdateSmoke']){
 assert.ok(!source.includes(name),'发行主包不含 '+name);
}
for(const name of ['startInputAudit','documentWindowAudit','documentWindowSave']){
 assert.ok(source.includes(name),'保留必要入口 '+name);
}
console.log(JSON.stringify({ok:true,appBytes:app.bytes,distBytes:files.reduce((sum,file)=>sum+file.bytes,0)}));

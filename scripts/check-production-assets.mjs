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
const saveWorker=files.find(file=>/^project-save-worker-.*\.js$/.test(path.basename(file.name)));
const saveClient=files.find(file=>/^project-save-client-.*\.js$/.test(path.basename(file.name)));
assert.ok(saveWorker&&saveClient,'发行资源包含项目保存 Worker 和客户端');
assert.ok((await readFile(saveClient.name,'utf8')).includes(path.basename(saveWorker.name)),'保存客户端引用构建后的 Worker 路径');
for(const name of ['runTilemapSmoke','runSettingsSmoke','runParitySmoke','prepareUpdateSmoke','runPaletteWorkflowSmoke']){
 assert.ok(!source.includes(name),'发行主包不含 '+name);
}
for(const name of ['startInputAudit','documentWindowAudit','documentWindowSave']){
 assert.ok(source.includes(name),'保留必要入口 '+name);
}
const appIcon=files.find(file=>/^app-icon-.*\.png$/.test(path.basename(file.name)));
const inlineIcon='data:image/png;base64,'+(await readFile('src/assets/app-icon.png')).toString('base64');
assert.ok(appIcon&&(source.includes(path.basename(appIcon.name))||source.includes(inlineIcon)),'关于图标引用构建资源或内联的原始图标');
assert.ok(!source.includes('src=\"./assets/app-icon.png\"'),'关于窗口不引用构建前资源路径');
console.log(JSON.stringify({ok:true,appBytes:app.bytes,distBytes:files.reduce((sum,file)=>sum+file.bytes,0)}));

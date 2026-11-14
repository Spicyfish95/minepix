import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {constants} from 'node:fs';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const exec=promisify(execFile),root=path.resolve('artifacts/project-encoder');
const current=path.resolve('src-tauri/target/release/examples/project-tool.exe'),before=path.join(root,'before.exe');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baselineMode=process.argv[2]==='baseline';
await mkdir(root,{recursive:true});
if(baselineMode)await copyFile(current,before,constants.COPYFILE_EXCL);
const io=JSON.parse(await readFile('artifacts/performance-io-baseline/report.json','utf8'));
const complex={format:'pixel-studio',version:2,width:3,height:2,layers:[{id:1,name:'中文层',visible:true},{id:2,name:'分组',type:'group'}],frames:[{duration:80,cels:[[0,1,0x7fffffff,0x80000000,0xffffffff,0x11223344],null],indices:[[0,255,1,2,3,4],null],links:{'1':'cel-image'},extra:{label:'保留\n"特殊字符"'}},{duration:120,cels:[[],null],indices:null}],references:[{id:'ref',data:Buffer.from([0,255,127,128,1,2,3,4]).toString('base64'),x:1,scale:1.5},{id:'empty',data:'',x:-1}],tags:[{name:'跑步',from:0,to:1}],custom:{frames:[1,2,3],cels:'未知元数据不应误删'},previewTerrain:{layerId:1,w:2,h:1,cells:[0,-1]}};
const models={complex,optional:{format:'pixel-studio',frames:[{cels:null,indices:[]}],references:null},empty:{format:'pixel-studio',frames:[]}};
for(const[name,document]of Object.entries(models))await writeFile(path.join(root,name+'.json'),JSON.stringify(document)+'\n');
const files={...Object.fromEntries(Object.keys(models).map(name=>[name,path.join(root,name+'.json')])),large:path.join(io.directory,'source.json')};
const beforeHash=hash(await readFile(before)),afterHash=hash(await readFile(current)),fixtures=[];
for(const[name,model]of Object.entries(files)){
 const oldOutput=path.join(root,name+'-before.pix');
 if(baselineMode)await exec(before,['encode',model,oldOutput],{windowsHide:true});
 const original=await readFile(oldOutput);
 if(!baselineMode){const output=path.join(root,name+'-after.pix');await exec(current,['encode',model,output],{windowsHide:true});assert.deepEqual(await readFile(output),original,name+'输出逐字节等同旧编码器');}
 fixtures.push({name,source:model,bytes:original.length,sha256:hash(original)});
}
if(baselineMode){
 await writeFile(path.join(root,'baseline.json'),JSON.stringify({beforeHash,fixtures},null,2)+'\n');
 console.log(JSON.stringify({prepared:true,beforeHash,fixtures:fixtures.length}));
}else{
 assert.equal(beforeHash,JSON.parse(await readFile(path.join(root,'baseline.json'),'utf8')).beforeHash,'旧分析工具保持');
 const runs=[];
 async function measure(kind,round){
  const executable=kind==='before'?before:current,output=path.join(root,kind+'-process.pix');
  const result=await exec('powershell.exe',['-NoProfile','-File',path.resolve('scripts/measure-encoder-process.ps1'),'-Executable',executable,'-Model',files.large,'-Output',output],{windowsHide:true,maxBuffer:2*1024*1024});
  const measured=JSON.parse(result.stdout);
  assert.equal(hash(await readFile(output)),fixtures.find(f=>f.name==='large').sha256,'测量输出逐字节一致');
  if(round>=0){runs.push({kind,round,...measured});console.log(JSON.stringify({kind,round,wallMs:measured.wallMs,peakPrivateMiB:measured.sampledPeakPrivateBytes/1048576,peakWorkingSetMiB:measured.observedOsPeakWorkingSetBytes/1048576}));}
 }
 await measure('before',-1);await measure('after',-1);
 for(let round=0;round<3;round++)for(const kind of round%2?['after','before']:['before','after'])await measure(kind,round);
 await writeFile(path.join(root,'report.json'),JSON.stringify({ok:true,measuredAt:new Date().toISOString(),beforeHash,afterHash,fixtures,runs,limitations:['Independent native encoder processes, not complete desktop app','Wall time includes process start, disk read, JSON parse, encode, write and polling','Private commit peak sampled at nominal 10ms; can miss shorter peaks','OS peak working set is observed while the process is live','One warmup per binary then three alternating measured launches']},null,2)+'\n');
 console.log(JSON.stringify({ok:true,identicalFixtures:fixtures.length,runs:runs.length}));
}

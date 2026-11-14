import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {generateNormalMap} from '../src/normal-map.js';
import {repairPixels} from '../src/pixel-repair.js';
import {initSync} from '../node_modules/@xprite/pixelate/wasm/pixelfixer_detect.js';
import {preloadWasm} from '../node_modules/@xprite/pixelate/dist/index.js';
import {targets,connect} from './cdp.mjs';

const root='artifacts/packaged-workers',results=[];
await mkdir(root,{recursive:true});
const assets=await readdir('dist/assets');
const workerFile=name=>{
 const matches=assets.filter(file=>file.startsWith(name+'-')&&file.endsWith('.js'));
 assert.equal(matches.length,1,name+' production asset');
 return '/assets/'+matches[0];
};
const image={width:64,height:64,data:new Uint8ClampedArray(64*64*4)};
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 const u=x>>3,v=y>>3;
 const color=(u+v)%3===0?[220,60,40,255]:(u+v)%3===1?[30,180,90,255]:[40,70,210,255];
 image.data.set(color,(y*64+x)*4);
}
const wire={width:image.width,height:image.height,data:[...image.data]};
const source=image.data.slice();
const wasm=await readFile('node_modules/@xprite/pixelate/wasm/pixelfixer_detect_bg.wasm');
// Keep the independent Node oracle synchronous; the package's Node worker join
// has no timeout and stalled during this Windows validation.
process.env.XPRITE_AC_RL_WORKER='0';
initSync({module:wasm});
await preloadWasm();
const session=await connect((await targets()).find(target=>target.type==='page'&&!target.url.endsWith('panel.html')));
const check=(name,pass)=>{results.push({name,pass:!!pass});assert.ok(pass,name);};
async function run(name,settings,repair=false){
 return session.evaluate(`(async()=>{
  const image=${JSON.stringify(wire)};
  image.data=new Uint8ClampedArray(image.data);
  const before=image.data.slice();
  const wasm=${repair?'await window.desktop.pixelRepairWasm()':'null'};
  const magic=wasm?[...new Uint8Array(wasm).slice(0,4)]:null;
  const worker=new Worker(${JSON.stringify(workerFile(name))},{type:'module'});
  const statuses=[];
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{worker.terminate();reject(new Error('Production worker timed out'));},20000);
   const finish=()=>{clearTimeout(timer);worker.terminate();};
   worker.onerror=event=>{finish();reject(new Error(event.message));};
   worker.onmessage=({data})=>{
    if(data.status){statuses.push(data.status);return;}
    finish();
    if(data.error){reject(new Error(data.error));return;}
    resolve({width:data.result.width,height:data.result.height,data:[...data.result.data],grid:data.result.grid,magic,statuses,sourceUnchanged:image.data.every((value,i)=>value===before[i])});
   };
   worker.postMessage({image,settings:${JSON.stringify(settings)},wasm});
  });
 })()`);
}
try{
 check('实际内嵌页面',await session.evaluate("location.hostname==='tauri.localhost'||location.protocol==='tauri:'"));
 const normalSettings={invertY:true,paintedLightInfluence:0};
 const normal=await run('normal-map-worker',normalSettings);
 const expectedNormal=generateNormalMap(image,normalSettings);
 check('生产法线 Worker 与直接算法逐字节一致',normal.width===64&&normal.height===64&&JSON.stringify(normal.data)===JSON.stringify([...expectedNormal.data]));
 check('法线 Worker 处理中状态与源图保留',normal.statuses.includes('processing')&&normal.sourceUnchanged);
 const manual=await run('pixel-repair-worker',{manual:true,cellWidth:8,cellHeight:8},true);
 const expectedManual=[];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)expectedManual.push(...image.data.slice((y*8*64+x*8)*4,(y*8*64+x*8)*4+4));
 check('desktop 桥接读取内嵌 WASM',JSON.stringify(manual.magic)==='[0,97,115,109]');
 check('生产修复 Worker 手动网格恢复已知颜色块',manual.width===8&&manual.height===8&&JSON.stringify(manual.data)===JSON.stringify(expectedManual));
 check('修复 Worker 处理中状态与源图保留',manual.statuses.includes('processing')&&manual.sourceUnchanged);
 const autoSettings={algorithm:'auto'};
 const expectedAuto=repairPixels(image,autoSettings);
 const auto=await run('pixel-repair-worker',autoSettings,true);
 check('自动检测与独立 Node WASM 逐字节一致',auto.width===expectedAuto.width&&auto.height===expectedAuto.height&&JSON.stringify(auto.data)===JSON.stringify([...expectedAuto.data])&&JSON.stringify(auto.grid)===JSON.stringify(expectedAuto.grid));
 check('自动检测输出有效网格且原始输入不变',auto.width>0&&auto.height>0&&auto.sourceUnchanged&&image.data.every((value,i)=>value===source[i]));
 check('桌面没有错误弹窗',await session.evaluate("!document.getElementById('error-dialog').open"));
 await writeFile(root+'/report.json',JSON.stringify({ok:true,results,autoGrid:auto.grid,autoSize:[auto.width,auto.height]},null,2)+'\n');
 console.log(JSON.stringify({ok:true,passed:results.length,autoSize:[auto.width,auto.height]}));
}catch(error){
 await writeFile(root+'/report.json',JSON.stringify({ok:false,results,error:error.stack},null,2)+'\n');
 throw error;
}finally{session.close();}

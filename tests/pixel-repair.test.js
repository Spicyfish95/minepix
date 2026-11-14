import test from 'node:test';
import assert from 'node:assert/strict';
import {canRepairImage,imageMime,repairPixels,repairPalette} from '../src/pixel-repair.js';
import {createRepairClient} from '../src/pixel-repair-client.js';

const image=()=>({width:4,height:4,data:new Uint8ClampedArray([
 255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255,
 255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255,
 0,0,255,255,0,0,255,255,0,0,0,0,0,0,0,0,
 0,0,255,255,0,0,255,255,0,0,0,0,0,0,0,0])});

test('仅静态可解码图片类型提供修复选项，GIF与项目不提供',()=>{
 for(const name of ['a.PNG','a.jpg','a.jpeg','a.webp','a.bmp'])assert.ok(canRepairImage({type:'image',name}));
 for(const file of [{type:'gif',name:'a.gif'},{type:'project',name:'a.pix'},{type:'aseprite',name:'a.ase'},{type:'image',mime:'image/svg+xml',name:'a.svg'}])assert.equal(canRepairImage(file),false);
 assert.equal(imageMime('name.JPEG'),'image/jpeg');
});

test('手动网格修复逐像素还原，保持透明且不改变输入',()=>{
 const input=image(),before=input.data.slice(),result=repairPixels(input,{manual:true,cellWidth:2,cellHeight:2});
 assert.deepEqual([result.width,result.height],[2,2]);assert.deepEqual([...result.data],[255,0,0,255,0,255,0,255,0,0,255,255,0,0,0,0]);assert.deepEqual(input.data,before);
});

test('高级设置可选择目标尺寸、保持原尺寸与限色抖动',()=>{
 const input=image(),result=repairPixels(input,{mode:'convert',method:'nearest',targetWidth:2,targetHeight:2});assert.equal(result.width,2);assert.equal(result.height,2);
 const kept=repairPixels(input,{manual:true,cellWidth:2,cellHeight:2,preserveDimensions:true,reduceColors:true,maxColors:2,dither:'ordered'});assert.deepEqual([kept.width,kept.height],[4,4]);assert.equal(kept.data[63],0);
});

test('新参数请求终止旧 Worker，忽略过期结果，取消不返回结果',async()=>{
 const workers=[],states=[],results=[],errors=[];
 const client=createRepairClient({delay:0,loadWasm:async()=>new Uint8Array(),createWorker(){const w={postMessage(){},terminate(){this.terminated=true;}};workers.push(w);return w;},onState:s=>states.push(s),onResult:r=>results.push(r),onError:e=>errors.push(e.message)});
 const tick=()=>new Promise(r=>setTimeout(r,15));
 client.request(image(),{});await tick();const stale=workers[0].onmessage;
 client.request(image(),{});assert.ok(workers[0].terminated);await tick();stale({data:{result:'old'}});assert.deepEqual(results,[]);
 workers[1].onmessage({data:{result:'new'}});assert.deepEqual(results,['new']);assert.equal(states.at(-1),false);
 client.request(image(),{});await tick();workers[2].onmessage({data:{error:'计算失败'}});assert.deepEqual(errors,['计算失败']);assert.equal(states.at(-1),false);
 client.request(image(),{});await tick();const late=workers[3].onmessage;client.cancel();late({data:{result:'cancelled'}});assert.deepEqual(results,['new']);assert.ok(workers[3].terminated);client.dispose();
});

test('WASM/Worker 启动失败解除加载并返回明确错误',async()=>{
 const states=[],errors=[];const client=createRepairClient({delay:0,loadWasm:async()=>{throw new Error('WASM 读取失败');},onState:s=>states.push(s),onResult(){},onError:e=>errors.push(e.message)});
 client.request(image(),{});await new Promise(r=>setTimeout(r,15));assert.deepEqual(states,[true,false]);assert.deepEqual(errors,['WASM 读取失败']);client.dispose();
});


test('限色结果色板保留半透明，忽略全透明，全透明提供透明槽',()=>{
 assert.deepEqual(repairPalette(new Uint8ClampedArray([255,0,0,255,0,255,0,128,255,0,0,255,3,4,5,0])),['#ff0000','#00ff0080']);
 assert.deepEqual(repairPalette(new Uint8ClampedArray([3,4,5,0])),['#00000000']);
 const plain=repairPixels(image(),{manual:true,cellWidth:2,cellHeight:2});assert.equal(plain.palette,null);
 const limited=repairPixels(image(),{manual:true,cellWidth:2,cellHeight:2,reduceColors:true,maxColors:2});
 assert.deepEqual(limited.palette,repairPalette(limited.data));assert.ok(limited.palette.length<=2);
});


test('相似色按亮度降序及同亮度饱和度降序排列，中性色独立成阶',()=>{
 const colors=['#408040','#800000','#808080','#ff8080','#008000','#ff0000','#ffffff','#400000','#00ff00','#000000'];
 const data=new Uint8ClampedArray(colors.flatMap(color=>[...color.slice(1).match(/../g).map(v=>parseInt(v,16)),255]));
 assert.deepEqual(repairPalette(data),['#ff0000','#ff8080','#800000','#400000','#00ff00','#008000','#408040','#ffffff','#808080','#000000']);
});

test('红色色相环首尾同组，色阶不随像素频率或输入顺序变化',()=>{
 const colors=['#ff002b','#00ff00','#ff2b00','#800015','#ffff00'];
 const bytes=color=>[...color.slice(1).match(/../g).map(v=>parseInt(v,16)),255];
 const expected=['#ff2b00','#ff002b','#800015','#ffff00','#00ff00'];
 assert.deepEqual(repairPalette(new Uint8ClampedArray(colors.flatMap(bytes))),expected);
 assert.deepEqual(repairPalette(new Uint8ClampedArray([...colors.toReversed(),...Array(10).fill('#800015')].flatMap(bytes))),expected);
});


test('每项禁用参数都有可操作的解锁条件',async()=>{
 const {repairControlReasons}=await import('../src/image-import.js');
 const base={mode:'recover-grid',manual:false,blockPicker:false,reduceColors:false,prepass:'pixeloe'};
 const locked=repairControlReasons(base);for(const key of ['method','blockPicker','lineGuide','cellWidth','cellHeight','dither'])assert.ok(locked[key]);
 const convert=repairControlReasons({...base,mode:'convert'});assert.equal(convert.method,'');assert.equal(convert.blockPicker,'');assert.ok(convert.colorPicker);
 assert.equal(repairControlReasons({...base,mode:'convert',blockPicker:true}).colorPicker,'');
 const enabled=repairControlReasons({...base,manual:true,reduceColors:true,prepass:'pixeloe-lines'});
 for(const key of ['cellWidth','cellHeight','lineGuide','maxColors','adaptive','dither'])assert.equal(enabled[key],'');
});


test('默认600ms尾沿防抖只处理最后参数，阶段消息不结束任务且取消丢弃旧状态',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const workers=[],statuses=[],results=[];
 const client=createRepairClient({onState(){},onStatus:s=>statuses.push(s),onResult:r=>results.push(r),onError:e=>{throw e;},loadWasm:async()=>new Uint8Array(),createWorker(){const worker={postMessage(value){this.value=value;},terminate(){this.stopped=true;}};workers.push(worker);return worker;}});
 client.request(image(),{maxColors:4});t.mock.timers.tick(500);client.request(image(),{maxColors:8});t.mock.timers.tick(599);assert.equal(workers.length,0);
 t.mock.timers.tick(1);await Promise.resolve();assert.equal(workers.length,1);assert.equal(workers[0].value.settings.maxColors,8);
 const stale=workers[0].onmessage;stale({data:{status:'processing'}});assert.equal(statuses.at(-1),'processing');assert.ok(!workers[0].stopped);assert.deepEqual(results,[]);
 client.cancel();const before=statuses.length;stale({data:{status:'processing'}});assert.equal(statuses.length,before);assert.ok(workers[0].stopped);client.dispose();
});

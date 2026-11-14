import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateNormalMap,defaultNormalMapOptions} from '../src/normal-map.js';
import {createNormalMapClient} from '../src/normal-map-client.js';

function sprite(){const width=16,height=16,data=new Uint8ClampedArray(width*height*4);for(let y=2;y<14;y++)for(let x=2;x<14;x++)data.set([x<8?220:110,90,40,x===2?128:255],(y*width+x)*4);return{width,height,data};}
test('生成尺寸与 Alpha：使用上游算法且不改源图',()=>{
 const image=sprite(),before=image.data.slice(),normal=generateNormalMap(image,{preset:'object'});
 assert.equal(normal.width,image.width);assert.equal(normal.height,image.height);assert.deepEqual(image.data,before);
 for(let i=3;i<image.data.length;i+=4)assert.equal(normal.data[i],image.data[i]);
 assert.notDeepEqual(normal.data,image.data);
});
test('参数效果与 Y 通道翻转',()=>{
 const image=sprite(),normal=generateNormalMap(image,{paintedLightInfluence:0}),flipped=generateNormalMap(image,{paintedLightInfluence:0,invertY:true});
 for(let i=0;i<normal.data.length;i+=4)if(normal.data[i+3]){assert.equal(flipped.data[i],normal.data[i]);assert.ok(Math.abs(flipped.data[i+1]-(255-normal.data[i+1]))<=1);assert.equal(flipped.data[i+2],normal.data[i+2]);}
 assert.notDeepEqual(generateNormalMap(image,{normalStrength:0}).data,normal.data);
 assert.notDeepEqual(defaultNormalMapOptions('character'),defaultNormalMapOptions('terrain'));
});
test('参数更新终止旧 Worker，取消与关闭丢弃旧结果，错误可重试',async()=>{
 const workers=[],results=[],errors=[],client=createNormalMapClient({delay:0,onResult:r=>results.push(r),onError:e=>errors.push(e.message),createWorker:()=>{const worker={postMessage(){},terminate(){this.stopped=true;}};workers.push(worker);return worker;}});
 const tick=()=>new Promise(r=>setTimeout(r,10));
 client.request(sprite(),{});await tick();const first=workers[0];client.request(sprite(),{invertY:true});await tick();assert.equal(first.stopped,true);first.onmessage({data:{result:'old'}});assert.deepEqual(results,[]);
 workers[1].onmessage({data:{error:'failed'}});assert.deepEqual(errors,['failed']);client.request(sprite(),{});await tick();workers[2].onmessage({data:{result:'new'}});assert.deepEqual(results,['new']);
 client.request(sprite(),{});await tick();client.cancel();workers[3].onmessage({data:{result:'cancelled'}});assert.deepEqual(results,['new']);
 client.request(sprite(),{});await tick();client.dispose();workers[4].onmessage({data:{result:'closed'}});assert.deepEqual(results,['new']);
});

test('超过旧尺寸限制仍提供完整分辨率实时光照',async()=>{
 const {lightingPreviewMarkup,prepareNormalMapLighting,renderPreparedNormalMapLighting,defaultNormalMapLightOptions}=await import('../src/normal-map-light-preview.js');
 assert.ok(lightingPreviewMarkup().includes('id="normal-light-canvas"'));assert.ok(!lightingPreviewMarkup().includes('unavailable'));
 const width=257,height=256,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4)data.set([180,90,40,255],i);
 const image={width,height,data},normal=generateNormalMap(image),lit=renderPreparedNormalMapLighting(prepareNormalMapLighting(image,normal),defaultNormalMapLightOptions(width,height));
 assert.equal(lit.width,width);assert.equal(lit.height,height);assert.equal(lit.data.length,width*height*4);assert.equal(lit.data[3],255);
});
test('光源移动改变光照且保留 Alpha，Y 翻转匹配法线约定',async()=>{
 const {prepareNormalMapLighting,renderPreparedNormalMapLighting,defaultNormalMapLightOptions}=await import('../src/normal-map-light-preview.js');
 const image=sprite(),normals=generateNormalMap(image),prepared=prepareNormalMapLighting(image,normals),options=defaultNormalMapLightOptions(16,16);
 const left=renderPreparedNormalMapLighting(prepared,{...options,position:{x:0,y:0}}),right=renderPreparedNormalMapLighting(prepared,{...options,position:{x:16,y:16}});
 assert.notDeepEqual(left.data,right.data);for(let i=3;i<image.data.length;i+=4)assert.equal(left.data[i],image.data[i]);
 const pixel={width:1,height:1,data:new Uint8ClampedArray([180,90,40,128])},normal={width:1,height:1,data:new Uint8ClampedArray([128,64,240,255])},flipped={...normal,data:new Uint8ClampedArray([128,191,240,255])};
 assert.deepEqual(renderPreparedNormalMapLighting(prepareNormalMapLighting(pixel,normal),options).data,renderPreparedNormalMapLighting(prepareNormalMapLighting(pixel,flipped),{...options,invertY:true}).data);
});

test('原绘光照角度参考按图像坐标给出四方向，不生成图像数据',async()=>{
 const {lightAngleEndpoint,normalAngleGuideMarkup}=await import('../src/normal-map-angle-guide.js');
 for(const [angle,x,y]of [[0,96,60],[90,60,96],[180,24,60],[270,60,24]])assert.deepEqual(lightAngleEndpoint(angle),{x,y});
 assert.ok(!normalAngleGuideMarkup().includes('仅作参考'));
 assert.ok(!normalAngleGuideMarkup().includes('<canvas'));
});


test('自动角度复用同一上游生成器的实际估计，手动与不可估计状态不伪造',async()=>{
 const {generateNormalMapWithEstimate}=await import('../src/normal-map.js'),{createNormalMapGenerator}=await import('../node_modules/@xprite/lighter/dist/index.js');
 const width=64,height=64,data=new Uint8ClampedArray(width*height*4),angle=135*Math.PI/180;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=(x-31.5)/27,dy=(y-31.5)/27;if(dx*dx+dy*dy<1){const v=Math.round(140+90*(dx*Math.cos(angle)-dy*Math.sin(angle)));data.set([v,v,v,255],(y*width+x)*4);}}
 const image={width,height,data},generator=createNormalMapGenerator(image),expected=generator.generate(),actual=generateNormalMapWithEstimate(image);
 assert.equal(actual.estimatedAngle,generator.suggestPaintedLightAngle());assert.equal(actual.estimatedAngle,135);assert.deepEqual(actual.data,expected.data);
 assert.equal(generateNormalMapWithEstimate(image,{paintedLightAngle:90}).estimatedAngle,null);
 assert.equal(generateNormalMapWithEstimate({width:1,height:1,data:new Uint8ClampedArray(4)}).estimatedAngle,null);
});

test('角度盘点击坐标按顺时针映射并处理跨零度',async()=>{
 const {angleFromPoint}=await import('../src/normal-map-angle-guide.js');
 for(const [x,y,angle]of [[100,60,0],[60,100,90],[20,60,180],[60,20,270],[100,59,359]])assert.equal(angleFromPoint(x,y),angle);
});


test('法线默认600ms防抖合并连续调整，处理状态不结束任务或转成结果',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const workers=[],statuses=[],results=[];
 const client=createNormalMapClient({onStatus:s=>statuses.push(s),onResult:r=>results.push(r),onError:e=>{throw e;},createWorker(){const worker={postMessage(value){this.value=value;},terminate(){this.stopped=true;}};workers.push(worker);return worker;}});
 client.request(sprite(),{normalStrength:100});t.mock.timers.tick(500);client.request(sprite(),{normalStrength:200});t.mock.timers.tick(599);assert.equal(workers.length,0);
 t.mock.timers.tick(1);assert.equal(workers.length,1);assert.equal(workers[0].value.settings.normalStrength,200);
 const stale=workers[0].onmessage;stale({data:{status:'processing'}});assert.equal(statuses.at(-1),'processing');assert.ok(!workers[0].stopped);assert.deepEqual(results,[]);
 client.request(sprite(),{normalStrength:300});const before=statuses.length;stale({data:{status:'processing'}});assert.equal(statuses.length,before);
 client.cancel();t.mock.timers.tick(600);assert.equal(workers.length,1);client.dispose();
});


test('手动原绘光照角度确实作为生成参数改变法线像素',()=>{
 const image=sprite(),left=generateNormalMap(image,{paintedLightAngle:0,paintedLightInfluence:100}),right=generateNormalMap(image,{paintedLightAngle:180,paintedLightInfluence:100});
 assert.notDeepEqual(left.data,right.data);
 for(let i=3;i<image.data.length;i+=4)assert.equal(left.data[i],right.data[i]);
});

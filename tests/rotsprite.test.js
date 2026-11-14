import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scale2xImage,prepareRotSprite} from '../src/rotsprite.js';
import {transformSelectionRegion} from '../src/selection-mask.js';
import {transformState,relocatePivot} from '../src/transform-controls.js';

test('RotSprite 使用三次边缘感知 Scale2x 生成 8 倍原色图',()=>{
 const source=Uint32Array.from([0,1,0,1,0,0,0,0,0]),scaled=scale2xImage(source,3,3);assert.equal(scaled[2*6+2],1);assert.equal(scaled.length,36);
 const region={w:3,h:3,data:[...source]},prepared=prepareRotSprite(region);assert.equal(prepared.width,24);assert.equal(prepared.height,24);assert.equal(prepared.data.length,576);assert.ok(prepared.data.every(p=>p===0||p===1));assert.equal(prepareRotSprite(region),prepared);
});
test('整周及四分之一旋转无损，任意角度保持原色、透明度和中心',()=>{
 const region={x:2,y:3,w:3,h:3,data:[0,0xff000080,0,0xff000080,0xff000080,0,0,0,0]},base=transformState(region);
 for(const angle of [0,90,180,270,360])assert.deepEqual(transformSelectionRegion(region,{...base,angle,algorithm:'rotsprite'}),transformSelectionRegion(region,{...base,angle,algorithm:'fast'}));
 const rotated=transformSelectionRegion(region,{...base,angle:37,algorithm:'rotsprite'});assert.ok(rotated.data.every(p=>p===0||p===0xff000080));
 const pivot=relocatePivot({...base,angle:37,algorithm:'rotsprite'},{x:10,y:12});assert.deepEqual(transformSelectionRegion(region,pivot),rotated);
});
test('索引 RotSprite 保留重复颜色的索引身份和不规则遮罩',()=>{
 const region={x:0,y:0,w:3,h:3,data:[0,0xff0000ff,0,0xff0000ff,0xff0000ff,0,0,0,0],mask:Uint8Array.from([0,1,0,1,1,0,0,0,0]),indexed:{palette:['#00000000','#ff0000','#ff0000'],transparentIndex:0,data:[0,1,0,2,1,0,0,0,0]}};
 const rotated=transformSelectionRegion(region,{...transformState(region),angle:37,algorithm:'rotsprite'});assert.ok(rotated.indexed.data.every(i=>i>=0&&i<=2));assert.ok(rotated.indexed.data.includes(1)&&rotated.indexed.data.includes(2));
 for(let i=0;i<rotated.data.length;i++)if(rotated.mask[i])assert.equal(rotated.data[i],rotated.indexed.data[i]?0xff0000ff:0);
});

test('任意角度的边缘感知结果区别于快速最近邻旋转',()=>{
 const region={x:0,y:0,w:3,h:3,data:[0,0xff0000ff,0,0xff0000ff,0,0,0,0,0]},state={...transformState(region),angle:37};
 assert.notDeepEqual(transformSelectionRegion(region,{...state,algorithm:'rotsprite'}).data,transformSelectionRegion(region,{...state,algorithm:'fast'}).data);
});

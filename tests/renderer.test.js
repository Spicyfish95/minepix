import {compositePixel,BLEND_MODES} from '../src/compositor.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameCache,compositeRegion} from '../src/renderer.js';
import {createDocument,addLayer,addFrame,composite,colorValue} from '../src/model.js';
import {groupLayer,reparentLayer} from '../src/layer-tree.js';
import {setCelProperty} from '../src/cel-properties.js';
import {encodeReference,rasterReference} from '../src/layer-types.js';
test('局部合成与完整 Alpha 合成逐字节一致',()=>{const d=createDocument(8,8);addLayer(d,0);d.layers[1].opacity=43;for(let i=0;i<64;i++){d.frames[0].cels[0][i]=colorValue(i%2?'#11223380':'#ff0000');d.frames[0].cels[1][i]=colorValue(i%3?'#00ff0080':'#0000ff');}const cache=new FrameCache(),entry=cache.get(d,0);assert.deepEqual(entry.rgba,composite(d,0));d.frames[0].cels[1][27]=0;cache.invalidate(0,{x:3,y:3,w:1,h:1});assert.deepEqual(cache.get(d,0).rgba,composite(d,0));assert.equal(cache.stats.partial,1);});
test('帧缓存命中、层属性变化与 cel 替换正确失效',()=>{const d=createDocument(2,2),cache=new FrameCache();cache.get(d,0);cache.get(d,0);assert.equal(cache.stats.full,1);assert.equal(cache.stats.hits,1);d.layers[0].opacity=50;cache.get(d,0);assert.equal(cache.stats.full,2);d.frames[0].cels[0]=[0xffffffff,0,0,0];assert.deepEqual(cache.get(d,0).rgba,composite(d,0));});
test('LRU 缓存预算限制与文档切换隔离',()=>{const d=createDocument(4,4),cache=new FrameCache(128);addFrame(d,0);cache.get(d,0);cache.get(d,1);assert.equal(cache.entries.size,1);assert.ok(cache.memoryBytes<=128);const other=createDocument(4,4);other.frames[0].cels[0][0]=0xffffffff;assert.equal(cache.get(other,0).rgba[3],255);});

test('非原点脏区域的嵌套隔离组与独立裁剪参考一致，区域外不被覆盖',()=>{
 const doc=createDocument(9,7);
 doc.frames[0].cels[0]=Array.from({length:63},(_,i)=>i%3?0x4477aaff:0x22334480);
 addLayer(doc,0);
 doc.frames[0].cels[1]=Array.from({length:63},(_,i)=>i%2?0x00cc8880:0xff2244ff);
 const inner=groupLayer(doc,1);
 reparentLayer(doc,0,doc.layers[inner].id);
 const outer=groupLayer(doc,inner);
 doc.layers[inner].opacity=63;doc.layers[inner].blendMode='multiply';
 doc.layers[outer].opacity=71;
 setCelProperty(doc,0,0,{x:1,y:-1,opacity:55});
 const rect={x:3,y:2,w:4,h:3},target=new Uint8ClampedArray(9*7*4).fill(137);
 compositeRegion(doc,0,rect,target);
 // A small canvas contains exactly the same sources in local coordinates.
 const crop=structuredClone(doc);crop.width=4;crop.height=3;
 crop.frames[0].cels=crop.frames[0].cels.map(()=>Array(12).fill(0));
 delete crop.frames[0].celProperties;
 for(let l=0;l<2;l++){
  const p=doc.frames[0].celProperties?.[doc.layers[l].id]||{x:0,y:0,width:9,height:7,opacity:100};
  for(let y=0;y<3;y++)for(let x=0;x<4;x++){
   const sx=x+3-p.x,sy=y+2-p.y;
   if(sx>=0&&sy>=0&&sx<p.width&&sy<p.height)crop.frames[0].cels[l][y*4+x]=doc.frames[0].cels[l][sy*p.width+sx];
  }
  setCelProperty(crop,0,l,{opacity:p.opacity});
 }
 const expected=composite(crop,0);
 for(let y=0;y<7;y++)for(let x=0;x<9;x++){
  const actual=target.subarray((y*9+x)*4,(y*9+x+1)*4);
  assert.deepEqual(actual,x>=3&&x<7&&y>=2&&y<5?expected.subarray(((y-2)*4+x-3)*4,((y-2)*4+x-2)*4):new Uint8ClampedArray(4).fill(137));
 }
});
test('reference partial composition samples transformed source directly and matches baked pixels',()=>{
 const doc=createDocument(11,9);doc.frames[0].cels[0].fill(0x12345680);addLayer(doc,0);doc.layers[1].type='reference';doc.layers[1].opacity=53;doc.layers[1].blendMode='multiply';doc.layers[1].reference={...encodeReference(3,2,Uint8Array.from({length:24},(_,i)=>(i*37)%256)),x:2,y:-1,scale:2};
 const baked=structuredClone(doc);baked.frames[0].cels[1]=Array.from(rasterReference(doc,1));delete baked.layers[1].type;delete baked.layers[1].reference;
 const expected=composite(baked,0),actual=new Uint8ClampedArray(11*9*4).fill(147),rect={x:3,y:1,w:4,h:5};compositeRegion(doc,0,rect,actual,{includeReference:true});
 for(let y=0;y<9;y++)for(let x=0;x<11;x++){const i=(y*11+x)*4;assert.deepEqual(actual.slice(i,i+4),x>=3&&x<7&&y>=1&&y<6?expected.slice(i,i+4):new Uint8ClampedArray(4).fill(147));}
});
test('missing external reference samples transparent without allocating a placeholder source image',()=>{
 const doc=createDocument(4,4);doc.layers[0].type='reference';doc.layers[0].reference={path:'missing.png',width:100000,height:100000,x:0,y:0,scale:1};
 assert.ok(composite(doc,0,{includeReference:true}).every(value=>value===0));
});

test('single-pixel output equals full composition for all blend modes and nested isolated groups',()=>{
 const doc=createDocument(7,5);addLayer(doc,0);for(let i=0;i<35;i++){doc.frames[0].cels[0][i]=(i*4131127|127)>>>0;doc.frames[0].cels[1][i]=(i*18431127|219)>>>0;}setCelProperty(doc,0,1,{x:-1,y:1,opacity:63});const group=groupLayer(doc,1);doc.layers[group].opacity=73;
 for(const [mode]of BLEND_MODES){doc.layers[1].blendMode=mode;const full=composite(doc,0);for(let y=0;y<5;y++)for(let x=0;x<7;x++){const i=(y*7+x)*4;assert.deepEqual(compositePixel(doc,0,x,y),full.slice(i,i+4));}}
});
test('single-pixel indexed composition preserves transparency and reference inclusion settings',()=>{
 const doc=createDocument(2,1);doc.colorMode='indexed';doc.transparentIndex=0;doc.palette=['#00000000','#12345680'];doc.frames[0].indices=[Uint8Array.of(0,1)];doc.layers.push({id:2,type:'reference',reference:{...encodeReference(1,1,Uint8Array.of(255,0,0,255)),x:0,y:0,scale:1},visible:true,opacity:100});doc.frames[0].cels.push([0,0]);doc.frames[0].indices.push(null);
 for(const includeReference of [false,true]){const full=composite(doc,0,{includeReference});for(let x=0;x<2;x++)assert.deepEqual(compositePixel(doc,0,x,0,{includeReference}),full.slice(x*4,x*4+4));}
});

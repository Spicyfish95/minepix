import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addFrame,colorValue,clone,validateDocument} from '../src/model.js';
import {SUPPORTED_FEATURES} from '../src/project-format.js';
import {sliceTileset,packTileset,matchTiles,atlasGrid,validateTileset,toTileset,toPixels,DEFAULT_TILE,MAX_TERRAINS,DEFAULT_TERRAIN_COLORS,TERRAIN_MODES,clearInactiveBits,migrateTiles} from '../src/tilemap.js';

const red=colorValue('#ff0000'),blue=colorValue('#0000ff');
const fillBlock=(pixels,width,x,y,w,h,color)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)pixels[(y+j)*width+x+i]=color;};
const tileset=(over={})=>({w:2,h:2,mode:'corners-and-sides',terrains:[{id:0,name:'草地'}],tiles:[],...over});
const tile=(terrain=-1,peering=[],weight=1)=>({terrain,peering:[...Array(8)].map((_,i)=>peering[i]??-1),weight});
const tilesetDoc=(set)=>{const doc=createDocument(4,4);doc.layers[0]={...doc.layers[0],type:'tileset',tileset:set};return doc;};

test('图集切块保持原网格位置，全透明块记为空格而不挤动后续图块',()=>{
  const pixels=new Array(8*4).fill(0);
  fillBlock(pixels,8,0,0,2,2,red);
  fillBlock(pixels,8,4,0,2,2,red);
  fillBlock(pixels,8,0,2,2,2,blue);
  assert.deepEqual(atlasGrid({width:8,height:4},2,2),{cols:4,rows:2,count:8});
  assert.equal(sliceTileset(pixels,8,4,2,2).tiles.length,8);
  assert.deepEqual(sliceTileset(pixels,8,4,2,2).tiles[0],sliceTileset(pixels,8,4,2,2).tiles[2]);
  const packed=packTileset(pixels,8,4,2,2);
  assert.equal(packed.count,3);
  assert.deepEqual(packed.cells,[0,-1,2,-1,4,-1,-1,-1]);
  assert.deepEqual(packed.atlas,pixels);
  assert.equal(packed.tiles.length,8);
});

test('空白格不会让同一行的后续图块左移',()=>{
  const pixels=new Array(8*8).fill(0);
  fillBlock(pixels,8,0,6,2,2,blue);
  fillBlock(pixels,8,6,6,2,2,red);
  const packed=packTileset(pixels,8,8,2,2);
  assert.equal(packed.cells.length,16);
  assert.equal(packed.cells[12],12);
  assert.equal(packed.cells[15],15);
  assert.equal(packed.cells[13],-1);
  assert.equal(packed.atlas[6*8+0],blue);
  assert.equal(packed.atlas[7*8+7],red);
});

test('匹配算法按 mode 取有效邻居位并逐位比较期望地形',()=>{
  const sides=tileset({mode:'sides',tiles:[tile(0),tile(0,[-1,0,-1,0,0,-1,0,-1]),tile(-1)]});
  const actual=[9,0,9,0,0,9,0,9];
  assert.deepEqual(matchTiles(sides,0,actual),[1]);
  assert.deepEqual(matchTiles(sides,1,actual),[]);
  const corners=tileset({mode:'corners',tiles:[tile(0),tile(0,[0,-1,0,-1,-1,0,-1,0])]});
  assert.deepEqual(matchTiles(corners,0,[0,9,0,9,9,0,9,0]),[1]);
  assert.deepEqual(matchTiles(corners,0,[-1,9,-1,9,9,-1,9,-1]),[0]);
  assert.deepEqual(matchTiles(sides,0,[9,1,9,0,0,9,0,9]),[]);
  assert.deepEqual(TERRAIN_MODES.map(([id])=>id),['corners-and-sides','corners','sides']);
});

test('校验拒绝非法图块尺寸、地形与邻居位',()=>{
  assert.equal(validateTileset({}).w,DEFAULT_TILE);
  const colored=validateTileset({terrains:[{id:0,name:'草地',color:'#123456'},{id:1,name:'水'},{id:2,name:'沙',color:'not-a-color'}]});
  assert.equal(colored.terrains[0].color,'#123456');
  assert.equal(colored.terrains[1].color,DEFAULT_TERRAIN_COLORS[1]);
  assert.equal(colored.terrains[2].color,DEFAULT_TERRAIN_COLORS[2]);
  assert.deepEqual(validateTileset({terrains:[{id:0,name:'草地'}]}).terrains[0],{id:0,name:'草地',color:DEFAULT_TERRAIN_COLORS[0]});
  assert.throws(()=>validateTileset({w:0}),/图块尺寸需为 1-4096 的整数/);
  assert.throws(()=>validateTileset({mode:'diagonal'}),/未知的地形匹配方式/);
  assert.throws(()=>validateTileset({terrains:[{id:0,name:''}]}),/地形名称无效/);
  assert.throws(()=>validateTileset({terrains:[{id:0,name:'a'},{id:0,name:'b'}]}),/地形标识重复/);
  assert.throws(()=>validateTileset({terrains:Array.from({length:MAX_TERRAINS+1},(_,i)=>({id:i,name:'t'+i}))}),/地形最多 8 个/);
  assert.throws(()=>validateTileset({terrains:[{id:0,name:'a'}],tiles:[tile(3)]}),/图块地形无效/);
  assert.throws(()=>validateTileset({terrains:[{id:0,name:'a'}],tiles:[tile(0,[3])]}),/图块邻居位无效/);
  assert.throws(()=>validateTileset({tiles:[tile(),tile(),tile()]},{width:2,height:2}),/图块数量超过图集容量/);
});

test('普通层转 tileset 后图块位置不变并可转回像素层',()=>{
  const doc=createDocument(4,4);
  doc.frames[0].cels[0].fill(0);
  fillBlock(doc.frames[0].cels[0],4,0,0,2,2,red);
  fillBlock(doc.frames[0].cels[0],4,2,2,2,2,red);
  addFrame(doc,0,true);
  const packed=toTileset(doc,0,{w:2,h:2});
  assert.equal(packed.count,2);
  assert.equal(doc.layers[0].type,'tileset');
  assert.equal(doc.layers[0].tileset.w,2);
  assert.equal(doc.layers[0].tileset.tiles.length,4);
  assert.deepEqual(packed.cells,[0,-1,-1,3]);
  assert(doc.frames.every(frame=>frame.cels[0].length===16&&frame.cels[0][0]===red));
  assert(validateDocument(clone(doc)).requiredFeatures.includes('tileset'));
  toPixels(doc,0);
  assert.equal(doc.layers[0].type,undefined);
  assert.equal(doc.layers[0].tileset,undefined);
  assert.equal(doc.frames[0].cels[0][0],red);
});



test('validateDocument 保留 tileset 图层与地形预览并推导 tileset 特性标记',()=>{
  assert(SUPPORTED_FEATURES.has('tileset'));
  assert(!SUPPORTED_FEATURES.has('tilemap'));
  const doc=tilesetDoc(tileset({tiles:[tile(0,[],1)]}));
  doc.previewTerrain={layerId:1,w:4,h:4,cells:new Array(16).fill(-1)};
  const validated=validateDocument(clone(doc));
  assert.equal(validated.layers[0].type,'tileset');
  assert.equal(validated.layers[0].tileset.w,2);
  assert.equal(validated.previewTerrain.w,4);
  assert(validated.requiredFeatures.includes('tileset'));
  assert(!validated.requiredFeatures.includes('tilemap'));
});

test('切换匹配方式清掉这次用不到的邻居位',()=>{
  const tiles=[{terrain:0,peering:[0,0,0,0,0,0,0,0],weight:1}];
  clearInactiveBits(tiles,'corners');
  assert.equal(tiles[0].peering[0],0);
  assert.equal(tiles[0].peering[1],-1);
  assert.equal(tiles[0].peering[3],-1);
  clearInactiveBits(tiles,'sides');
  assert.equal(tiles[0].peering[0],-1);
  assert.deepEqual(tiles[0].peering,[-1,-1,-1,-1,-1,-1,-1,-1]);
});

test('重新切块按像素内容保住图块规则，尺寸变了的新图块用默认值',()=>{
  const pixels=new Array(8*4).fill(0);
  fillBlock(pixels,8,0,0,2,2,red);
  fillBlock(pixels,8,4,2,2,2,blue);
  const oldTiles=packTileset(pixels,8,4,2,2).tiles.map((_,id)=>id===0?tile(0,[0],3):tile(-1,[],1));
  const same=migrateTiles(oldTiles,pixels,8,4,2,2,2,2);
  assert.equal(same.length,oldTiles.length);
  assert.equal(same[0].terrain,0);
  assert.equal(same[0].peering[0],0);
  assert.equal(same[0].weight,3);
  assert.equal(same[1].terrain,-1);
  assert.deepEqual(same[1].peering,new Array(8).fill(-1));
  const resized=migrateTiles(oldTiles,pixels,8,4,2,2,4,4);
  assert.equal(resized.length,2);
  assert.ok(resized.every(item=>item.terrain===-1&&item.peering.every(bit=>bit===-1)));
});


test('同尺寸重新切块保留同像素各位置独立规则且不共享邻居数组',()=>{
 const source=[tile(0,[0,0,0,0,0,0,0,0],1),tile(1,[1,1,1,1,1,1,1,1],3)];
 const result=migrateTiles(source,[red,red],2,1,1,1,1,1);
 assert.deepEqual(result,source);
 result[1].peering[0]=-1;
 assert.equal(source[1].peering[0],1);
 assert.equal(result[0].peering[0],0);
});

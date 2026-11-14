import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addLayer,colorValue,validateDocument} from '../src/model.js';
import {createPreviewTerrain,validatePreviewTerrain,resizePreviewTerrain,setPreviewCell,resolvePreviewTiles,resolvePreviewCells,tintPaintedCells,rasterizePreviewTiles} from '../src/terrain-preview.js';

const red=colorValue('#ff0000'),blue=colorValue('#0000ff');
const tile=(terrain=-1,peering={},weight=1)=>({terrain,peering:[...Array(8)].map((_,i)=>peering[i]??-1),weight});
const tileset=(tiles,over={})=>({w:2,h:2,mode:'corners-and-sides',terrains:[{id:0,name:'草地'},{id:1,name:'水'}],tiles,...over});

test('新建预览按画布网格铺满空地',()=>{
  const preview=createPreviewTerrain(7,4,3);
  assert.deepEqual(preview,{layerId:7,w:4,h:3,cells:new Array(12).fill(-1)});
});

test('非法预览字段返回 null，null 空格归一为 -1',()=>{
  assert.equal(validatePreviewTerrain(null),null);
  assert.equal(validatePreviewTerrain({}),null);
  assert.equal(validatePreviewTerrain({layerId:'x',w:2,h:2,cells:[-1,-1,-1,-1]}),null);
  assert.equal(validatePreviewTerrain({layerId:1,w:0,h:2,cells:[]}),null);
  assert.equal(validatePreviewTerrain({layerId:1,w:2,h:2,cells:[-1,-1,-1]}),null);
  assert.equal(validatePreviewTerrain({layerId:1,w:2,h:2,cells:[-1,-1,-1,-2]}),null);
  assert.equal(validatePreviewTerrain({layerId:1,w:2,h:2,cells:[-1,-1,-1,1.5]}),null);
  assert.deepEqual(validatePreviewTerrain({layerId:1,w:2,h:2,cells:[null,0,-1,1]}),{layerId:1,w:2,h:2,cells:[-1,0,-1,1]});
});

test('网格尺寸变化后按比例保留已画地形',()=>{
  const preview=createPreviewTerrain(1,4,2);
  preview.cells=[0,1,2,-1,3,4,5,6];
  assert.equal(resizePreviewTerrain(preview,4,2),preview);
  const resized=resizePreviewTerrain(preview,2,1);
  assert.deepEqual(resized,{layerId:1,w:2,h:1,cells:[0,2]});
});

test('写格子拒绝越界与重复值，擦除写回 -1',()=>{
  const preview=createPreviewTerrain(1,2,1);
  assert.equal(setPreviewCell(preview,-1,0,0),false);
  assert.equal(setPreviewCell(preview,2,0,0),false);
  assert.equal(setPreviewCell(preview,0,1,0),false);
  assert.equal(setPreviewCell(preview,0,0,0),true);
  assert.equal(preview.cells[0],0);
  assert.equal(setPreviewCell(preview,0,0,0),false);
  assert.equal(setPreviewCell(preview,0,0,-1),true);
  assert.equal(preview.cells[0],-1);
});

// 约束解不干净时按冲突优先级最低的模式退回：单击一格画地形也要看到图块，而不是一片空白。
test('预览按 Godot 的地形约束解析图块，解不干净的格子标为不精确',()=>{
  const set=tileset([tile(0),tile(0,{4:0})]);
  const grid=[0,0];
  assert.deepEqual(resolvePreviewTiles(set,2,1,grid),[1,0]);
  assert.deepEqual(resolvePreviewTiles(set,2,1,grid),[1,0],'同一预览重复解析结果稳定');
});

test('切换匹配方式后预览立即按新规则重算',()=>{
  const set=tileset([tile(0),tile(0,{4:0})]);
  assert.deepEqual(resolvePreviewTiles({...set,mode:'sides'},2,1,[0,0]),[1,0]);
  assert.ok(resolvePreviewTiles({...set,mode:'corners'},2,1,[0,0]).every(id=>id>=0));
  assert.deepEqual(resolvePreviewTiles({...set,mode:'sides',tiles:[tile(0)]},2,1,[0,0]),[0,0]);
});

test('图集像素变化后按图块 id 重新铺像素',()=>{
  const atlas=new Array(16).fill(0);
  for(let y=0;y<2;y++)for(let x=0;x<2;x++)atlas[y*4+x]=red;
  for(let y=0;y<2;y++)for(let x=2;x<4;x++)atlas[y*4+x]=blue;
  const output=rasterizePreviewTiles({width:4,height:4,atlas,tileW:2,tileH:2,cols:2,tiles:[0,1]});
  assert.deepEqual(output,[red,red,blue,blue,red,red,blue,blue,0,0,0,0,0,0,0,0]);
  atlas[0]=0x00ff0000;
  assert.equal(rasterizePreviewTiles({width:4,height:4,atlas,tileW:2,tileH:2,cols:2,tiles:[0,1]})[0],0);
});

test('预览画布比图集画布大时按图集行宽取像素',()=>{
  const atlas=new Array(8*4).fill(0);
  // 图集画布 8 × 4，图块 2 × 2 → 4 列 2 行；图块 1 在 (2,0)，图块 4 在 (0,2)
  for(let y=0;y<2;y++)for(let x=2;x<4;x++)atlas[y*8+x]=red;
  for(let y=2;y<4;y++)for(let x=0;x<2;x++)atlas[y*8+x]=blue;
  const output=rasterizePreviewTiles({width:4,height:4,atlas,atlasWidth:8,atlasCols:4,tileW:2,tileH:2,cols:2,tiles:[1,4]});
  assert.deepEqual(output,[red,red,blue,blue,red,red,blue,blue,0,0,0,0,0,0,0,0]);
});

test('项目存读保留预览，非法字段不影响项目打开',()=>{
  const doc=createDocument(4,4,'preview');
  const preview={layerId:doc.layers[0].id,w:2,h:2,cells:[0,-1,1,-1]};
  const saved=validateDocument({...doc,previewTerrain:preview});
  assert.deepEqual(saved.previewTerrain,preview);
  assert.ok(!saved.requiredFeatures.includes('preview'));
  const broken=validateDocument({...doc,previewTerrain:{layerId:'bad',w:0,h:-1,cells:'nope'}});
  assert.equal(broken.previewTerrain,undefined);
  assert.equal(broken.width,4);
});

test('解出的格子标记 exact，约束有妥协的格子标记不精确，空格不算精确',()=>{
  const set=tileset([tile(0),tile(0,{4:0})]);
  const resolved=resolvePreviewCells(set,2,1,[0,0]);
  assert.deepEqual(resolved.map(cell=>cell.exact),[true,false]);
  assert.deepEqual(resolved.map(cell=>cell.id),[1,0]);
  assert.deepEqual(resolvePreviewCells(set,2,1,[-1,-1]),[{id:-1,exact:false},{id:-1,exact:false}]);
});

test('已刷地形但图块透明的像素补一层地形色',()=>{
  const pixels=new Array(16).fill(0);
  pixels[0]=red;
  const output=tintPaintedCells(pixels,{width:4,height:4,tileW:2,tileH:2,cols:2,cells:[0,-1],terrains:[{id:0,name:'草地',color:'#00ff00'}]});
  assert.equal(output[0],red,'图块自己的像素不被覆盖');
  assert.equal(output[1],0x00ff0040,'透明像素填 25% 的地形色');
  assert.equal(output[8],0,'没刷地形的格子保持透明');
  assert.equal(pixels[1],0,'不改输入数组');
  const solid=tintPaintedCells(pixels,{width:4,height:4,tileW:2,tileH:2,cols:2,cells:[0,-1],terrains:[{id:0,color:'#00ff00'}],alpha:1});
  assert.equal(solid[1],0x00ff00ff,'alpha 可调');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atlasRgba,boxSelection,toggleTile,tileSelectionValue,setTileProperty,visibleBitTiles} from '../src/tileset-panel.js';
import {terrainModeBits,terrainZones,zoneAt,derivePeeringBits} from '../src/tilemap.js';

// 项目像素是 R<<24 | G<<16 | B<<8 | A；图集预览曾把 A 当 R、B/G 互换，画出来偏粉。
test('图集预览按项目像素通道转成 RGBA',()=>{
  const data=atlasRgba([0xff0000ff,0xe8c9a6ff]);
  assert.deepEqual([...data.slice(0,4)],[255,0,0,255]);
  assert.deepEqual([...data.slice(4,8)],[232,201,166,255]);
});

test('图集预览保留 Alpha 与透明像素',()=>{
  const data=atlasRgba([0x11223344,0]);
  assert.deepEqual([...data.slice(0,4)],[17,34,51,68]);
  assert.deepEqual([...data.slice(4,8)],[0,0,0,0]);
});

// 框选按图集网格裁剪成矩形内的图块序号，行列顺序为从左上到右下。
test('拖动框选返回矩形内全部图块序号',()=>{
  assert.deepEqual(boxSelection({col:1,row:1},{col:2,row:2},4,4),[5,6,9,10]);
  assert.deepEqual(boxSelection({col:2,row:2},{col:1,row:1},4,4),[5,6,9,10]);
  assert.deepEqual(boxSelection({col:0,row:0},{col:9,row:9},4,4),[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
});

// Shift 单击是加选 / 取消，选中集合始终按序号排列。
test('Shift 单击在选中集合里加选与取消',()=>{
  assert.deepEqual(toggleTile([],3),[3]);
  assert.deepEqual(toggleTile([3],1),[1,3]);
  assert.deepEqual(toggleTile([1,3],3),[1]);
});

// 检视器多选时只报告共同值，值不一致标记为 mixed 以便下拉留空。
test('检视器读取多选图块的共同属性值',()=>{
  const tiles=[
    {terrain:0,peering:[-1,0,-1,-1,-1,-1,-1,-1]},
    {terrain:0,peering:[-1,1,-1,-1,-1,-1,-1,-1]}
  ];
  assert.deepEqual(tileSelectionValue(tiles,[0,1],'terrain'),{value:0,mixed:false});
  assert.deepEqual(tileSelectionValue(tiles,[0,1],1),{value:0,mixed:true});
  assert.deepEqual(tileSelectionValue(tiles,[0,1],0),{value:-1,mixed:false});
  assert.deepEqual(tileSelectionValue(tiles,[],'terrain'),{value:-1,mixed:false});
});

// 改检视器只动这一项：地形不影响邻居位，未改变的图块不计入改动数。
test('检视器写入只改一项属性并返回改动图块数',()=>{
  const tiles=[
    {terrain:-1,peering:new Array(8).fill(-1)},
    {terrain:-1,peering:new Array(8).fill(-1)}
  ];
  assert.equal(setTileProperty(tiles,[0,1],'terrain',2),2);
  assert.deepEqual(tiles.map(tile=>tile.terrain),[2,2]);
  assert.deepEqual(tiles[0].peering,new Array(8).fill(-1));
  assert.equal(setTileProperty(tiles,[0,1],'terrain',2),0);
  assert.equal(setTileProperty(tiles,[1],4,3),1);
  assert.equal(tiles[1].peering[4],3);
  assert.equal(tiles[0].peering[4],-1);
});

// 无效位按匹配方式禁用：匹配角只留 4 个角位，匹配边只留 4 个边位。
test('匹配方式决定哪些 peering bit 可用',()=>{
  assert.deepEqual(terrainModeBits('corners-and-sides'),[0,1,2,3,4,5,6,7]);
  assert.deepEqual(terrainModeBits('corners'),[0,2,5,7]);
  assert.deepEqual(terrainModeBits('sides'),[1,3,4,6]);
  assert.deepEqual(terrainModeBits('unknown'),[0,1,2,3,4,5,6,7]);
});

// 九宫格可标注位按匹配方式开放：匹配角只有四角、匹配边只有四边，都没有中心格（图块地形在地形模式下刷）。
test('匹配方式决定九宫格开放哪些格且没有中心格',()=>{
  const flat=zones=>zones.map(zone=>zone.col+','+zone.row+':'+zone.bit).sort();
  assert.deepEqual(flat(terrainZones('corners')),['0,0:0','0,2:5','2,0:2','2,2:7']);
  assert.deepEqual(flat(terrainZones('sides')),['0,1:3','1,0:1','1,2:6','2,1:4']);
  assert.equal(terrainZones('corners-and-sides').length,8);
  assert.equal(terrainZones('corners-and-sides').some(zone=>zone.col===1&&zone.row===1),false);
});

// 重开项目时没有选中任何图块，已配置的位仍然要画出来：只按匹配方式下的有效位判断。
test('已配置位的图块与选中状态无关',()=>{
  const tileset={mode:'corners',tiles:[
    {terrain:0,peering:[-1,-1,-1,-1,-1,0,-1,-1]},
    {terrain:0,peering:new Array(8).fill(-1)},
    {terrain:1,peering:[-1,0,-1,-1,-1,-1,-1,-1]}
  ]};
  assert.deepEqual(visibleBitTiles(tileset),[0]);
  assert.deepEqual(visibleBitTiles({...tileset,mode:'sides'}),[2]);
});

// 九宫格命中：图块内相对坐标落在哪个三分之一。
test('九宫格按相对坐标命中对应格',()=>{
  assert.deepEqual(zoneAt(0.1,0.1),{col:0,row:0});
  assert.deepEqual(zoneAt(0.5,0.5),{col:1,row:1});
  assert.deepEqual(zoneAt(0.99,0.02),{col:2,row:0});
  assert.deepEqual(zoneAt(-1,2),{col:0,row:2});
});

// 按像素推断邻居位：dirt.pix 的 15 个图块角位模式（用户给的验收基准，顺序为从左到右、从上到下）。
test('按图块四角像素推断出 dirt.pix 的 15 个角位模式',()=>{
  const patterns=[['sw'],['ne','se'],['nw','sw','se'],['sw','se'],['nw','se'],['ne','sw','se'],['nw','ne','sw','se'],['nw','ne','sw'],['ne'],['nw','ne'],['nw','ne','se'],['nw','sw'],null,['se'],['ne','sw'],['nw']];
  const filled={nw:[-1,-1],ne:[1,-1],sw:[-1,1],se:[1,1]},tileW=32,index={nw:0,ne:2,sw:5,se:7},seen=[];
  for(const pattern of patterns){
    const block=new Array(tileW*tileW).fill(0);
    for(const corner of pattern??[]){
      const [dx,dy]=filled[corner],size=4;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const px=dx<0?x:tileW-1-x,py=dy<0?y:tileW-1-y;
        block[py*tileW+px]=0xffffffff;
      }
    }
    const bits=derivePeeringBits(block,tileW,tileW,'corners',pattern?2:-1);
    const got=Object.keys(index).filter(corner=>bits[index[corner]]===2);
    assert.deepEqual(got.slice().sort(),(pattern??[]).slice().sort(),'pattern '+String(pattern));
    if(pattern)seen.push(bits.map((bit,bitIndex)=>bit>=0?bitIndex:null).filter(v=>v!==null).join(','));
  }
  assert.equal(new Set(seen).size,15);
});

// 匹配边只看四边中点：上下左右各一条窄带。
test('匹配边按四边中点像素推断，不看四角',()=>{
  const tileW=16,block=new Array(tileW*tileW).fill(0);
  for(let x=6;x<10;x++)block[x]=0xffffffff;
  assert.deepEqual(derivePeeringBits(block,tileW,tileW,'sides',1),[ -1,1,-1,-1,-1,-1,-1,-1]);
  for(let y=6;y<10;y++)block[y*tileW+15]=0xffffffff;
  assert.equal(derivePeeringBits(block,tileW,tileW,'sides',1)[4],1);
  assert.equal(derivePeeringBits(block,tileW,tileW,'corners',1).filter(bit=>bit>=0).length,0);
});

// 未设地形时不做任何标注。
test('图块没有地形时不推断邻居位',()=>{
  const block=new Array(64).fill(0xffffffff);
  assert.deepEqual(derivePeeringBits(block,8,8,'corners-and-sides',-1),new Array(8).fill(-1));
});

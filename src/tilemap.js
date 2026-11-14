// Godot 风格图集 / 地形数据层：图集切块与打包、地形匹配、图层转换与校验。
// 纯函数、无 DOM。图集始终存放在 tileset 图层自己的 cel 中（尺寸与画布一致）。
export const DEFAULT_TILE = 16;
export const DEFAULT_TERRAIN_MODE = 'corners-and-sides';
export const MAX_TERRAINS = 8;
// 地形颜色保存在 tileset 内，旧存档没有该字段时按顺序取这里的默认色。
export const DEFAULT_TERRAIN_COLORS = ['#e05a5a', '#5aa9e0', '#66c266', '#e0b34e', '#a970d0', '#4fc3b8', '#d97aae', '#8a9bd6'];
export const TERRAIN_MODES = [['corners-and-sides', '匹配角和边'], ['corners', '匹配角'], ['sides', '匹配边']];
// Godot 的 8 个 peering bits 顺序：左上、上、右上、左、右、左下、下、右下。
export const NEIGHBOR_BITS = [['nw', '左上角'], ['n', '上边'], ['ne', '右上角'], ['w', '左边'], ['e', '右边'], ['sw', '左下角'], ['s', '下边'], ['se', '右下角']];
const MODE_BITS = {'corners-and-sides': [0, 1, 2, 3, 4, 5, 6, 7], corners: [0, 2, 5, 7], sides: [1, 3, 4, 6]};
// 当前匹配方式实际使用的 peering bit 序号，图集栏位用它禁用无效位。
export const terrainModeBits = mode => MODE_BITS[mode] ?? MODE_BITS[DEFAULT_TERRAIN_MODE];
// 地形标注热区：图块按九宫格切分，四周格设置相邻位的期望地形。
// 匹配方式决定开放哪些格（匹配角只开四角、匹配边只开四边），没有中心格：图块自身的地形在地形模式下刷。
const ZONE_DIRS = {'-1,-1': 0, '0,-1': 1, '1,-1': 2, '-1,0': 3, '1,0': 4, '-1,1': 5, '0,1': 6, '1,1': 7};
const ZONE_DIRECTIONS = {
  corners: ['-1,-1', '1,-1', '-1,1', '1,1'],
  sides: ['0,-1', '-1,0', '1,0', '0,1'],
  'corners-and-sides': ['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1']
};
// 返回 [{col,row,bit}]：col/row 是九宫格里的 0-2 行列，bit 是该格对应的 peering bit。
export function terrainZones(mode) {
  const dirs = ZONE_DIRECTIONS[mode] ?? ZONE_DIRECTIONS[DEFAULT_TERRAIN_MODE];
  const zones = dirs.map(dir => {
    const [col, row] = dir.split(',').map(Number);
    return {col: col + 1, row: row + 1, bit: ZONE_DIRS[dir]};
  });
  return zones;
}
// 命中九宫格：给定图块内的 0-1 相对坐标，返回它落在哪一格。
export function zoneAt(relativeX, relativeY) {
  const pick = value => Math.min(2, Math.max(0, Math.floor(value * 3)));
  return {col: pick(relativeX), row: pick(relativeY)};
}
// 按图块像素推断 peering bits：某方位的采样块里有不透明像素，就认为地形在该方位延续。
// 只填当前匹配方式使用的位，其余保持 -1；terrain 为 -1 时全部不标注。
export function derivePeeringBits(tilePixels, tileW, tileH, mode, terrain) {
  const bits = new Array(8).fill(-1);
  if (!(terrain >= 0)) return bits;
  const size = Math.max(1, Math.round(Math.min(tileW, tileH) / 8));
  const filled = (dx, dy) => {
    const x0 = dx === 0 ? Math.floor((tileW - size) / 2) : dx < 0 ? 0 : tileW - size;
    const y0 = dy === 0 ? Math.floor((tileH - size) / 2) : dy < 0 ? 0 : tileH - size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (tilePixels[(y0 + y) * tileW + x0 + x] & 255) return true;
    }
    return false;
  };
  for (const bit of terrainModeBits(mode)) {
    const name = NEIGHBOR_BITS[bit][0];
    const dx = name.includes('w') ? -1 : name.includes('e') ? 1 : 0;
    const dy = name.includes('n') ? -1 : name.includes('s') ? 1 : 0;
    if (filled(dx, dy)) bits[bit] = terrain;
  }
  return bits;
}
export const isTileset = layer => layer?.type === 'tileset';

// 图集网格按整块切分（不足一块的边角不进入图集）。
export function atlasGrid(doc, tileW, tileH) {
  const cols = Math.floor(doc.width / tileW), rows = Math.floor(doc.height / tileH);
  return {cols, rows, count: cols * rows};
}

export function sliceTileset(pixels, width, height, tileW, tileH) {
  const {cols, rows, count} = atlasGrid({width, height}, tileW, tileH), tiles = [];
  for (let k = 0; k < count; k++) {
    const ox = k % cols * tileW, oy = Math.floor(k / cols) * tileH, block = new Array(tileW * tileH);
    for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) block[y * tileW + x] = pixels[(oy + y) * width + ox + x];
    tiles.push(block);
  }
  return {cols, rows, tiles};
}

// 切换匹配方式时把该方式用不到的位置清成 -1：否则从「角和边」切到「角」再切回来，旧设置会复活。
export function clearInactiveBits(tiles, mode) {
  const usable = new Set(terrainModeBits(mode));
  for (const tile of tiles) {
    if (!tile?.peering) continue;
    for (let bit = 0; bit < 8; bit++) if (!usable.has(bit)) tile.peering[bit] = -1;
  }
}

// 重新切块时按像素内容把旧图块的规则搬到新图块上：内容完全相同的块保留地形、期望位与权重，
// 新出现的块（切块尺寸变了）用默认值。不看序号——尺寸一改序号就对不上了。
export function migrateTiles(oldTiles, atlas, width, height, oldW, oldH, newW, newH) {
  const key = block => block.join(',');
  const byKey = new Map();
  sliceTileset(atlas, width, height, oldW, oldH).tiles.forEach((block, id) => {
    const tile = oldTiles[id];
    if (tile && !byKey.has(key(block))) byKey.set(key(block), tile);
  });
  return sliceTileset(atlas, width, height, newW, newH).tiles.map(block => {
    const tile = byKey.get(key(block));
    return tile
      ? {terrain: tile.terrain, peering: [...tile.peering], weight: tile.weight ?? 1}
      : {terrain: -1, peering: new Array(8).fill(-1), weight: 1};
  });
}

// 切块后保持原网格位置：图块 id 就是它在图集里的格子序号，全透明块记为 -1 且不进入图块列表。
// 不做紧凑重排——把唯一块按顺序重排会让空块之后的图块整体左移，转换前后的位置对不上。
export function packTileset(pixels, width, height, tileW, tileH) {
  const source = sliceTileset(pixels, width, height, tileW, tileH), cells = [], tiles = [];
  for (const block of source.tiles) {
    cells.push(block.every(pixel => !(pixel & 255)) ? -1 : tiles.length);
    tiles.push(block);
  }
  return {cols: source.cols, rows: source.rows, tiles, cells, atlas: pixels.slice(), count: cells.filter(id => id >= 0).length};
}

export function findTileset(doc, layer) {
  const index = doc.layers.findIndex(item => item.id === layer?.tilesetId && isTileset(item));
  return index < 0 ? null : {index, layer: doc.layers[index], tileset: doc.layers[index].tileset};
}
export function tileTerrain(tileset, id) {
  return id >= 0 ? tileset.tiles[id]?.terrain ?? -1 : -1;
}
export function terrainName(tileset, id) {
  return tileset.terrains.find(terrain => terrain.id === id)?.name ?? '空地';
}

// Godot 机制：按当前匹配方式取有效邻居位，逐位与图块声明的期望地形比较，全部相等才命中。
export function matchTiles(tileset, terrain, actual) {
  const bits = terrainModeBits(tileset.mode);
  return tileset.tiles.flatMap((tile, id) => tile.terrain === terrain && bits.every(bit => (tile.peering[bit] ?? -1) === actual[bit]) ? [id] : []);
}
export function validateTileset(value = {}, size = null) {
  const w = value.w ?? DEFAULT_TILE, h = value.h ?? DEFAULT_TILE;
  if (![w, h].every(Number.isInteger) || w < 1 || h < 1 || w > 4096 || h > 4096) throw new Error('图块尺寸需为 1-4096 的整数');
  const mode = value.mode ?? DEFAULT_TERRAIN_MODE;
  if (!TERRAIN_MODES.some(([id]) => id === mode)) throw new Error('未知的地形匹配方式');
  const terrains = (value.terrains ?? []).map((terrain, index) => {
    if (!terrain || typeof terrain.name !== 'string' || !terrain.name.trim()) throw new Error('地形名称无效');
    const color = typeof terrain.color === 'string' && /^#[0-9a-f]{6}$/i.test(terrain.color) ? terrain.color.toLowerCase() : DEFAULT_TERRAIN_COLORS[index % DEFAULT_TERRAIN_COLORS.length];
    return {id: Number.isInteger(terrain.id) ? terrain.id : index, name: terrain.name.slice(0, 40), color};
  });
  if (terrains.length > MAX_TERRAINS) throw new Error('地形最多 8 个');
  const ids = new Set(terrains.map(terrain => terrain.id));
  if (ids.size !== terrains.length) throw new Error('地形标识重复');
  const tiles = (value.tiles ?? []).map(tile => {
    const terrain = Number.isInteger(tile?.terrain) ? tile.terrain : -1;
    if (terrain !== -1 && !ids.has(terrain)) throw new Error('图块地形无效');
    const peering = Array.from({length: 8}, (_, bit) => Number.isInteger(tile?.peering?.[bit]) ? tile.peering[bit] : -1);
    if (peering.some(bit => bit !== -1 && !ids.has(bit))) throw new Error('图块邻居位无效');
    return {terrain, peering, weight: Number.isFinite(tile?.weight) && tile.weight > 0 ? tile.weight : 1};
  });
  if (size && tiles.length > Math.floor(size.width / w) * Math.floor(size.height / h)) throw new Error('图块数量超过图集容量');
  return {w, h, mode, terrains, tiles};
}

// 普通像素层 → tileset：按图块尺寸切块去重后把图集写回该图层所有帧的 cel。
export function toTileset(doc, index, {w = DEFAULT_TILE, h = DEFAULT_TILE, frame = 0} = {}) {
  const layer = doc.layers[index], packed = packTileset(doc.frames[frame].cels[index], doc.width, doc.height, w, h);
  if (!packed.count) throw new Error('图层没有可切分的非透明像素');
  layer.type = 'tileset';
  layer.tileset = {w, h, mode: DEFAULT_TERRAIN_MODE, terrains: [], tiles: packed.tiles.map(() => ({terrain: -1, peering: new Array(8).fill(-1), weight: 1}))};
  for (const item of doc.frames) item.cels[index] = packed.atlas.slice();
  return packed;
}

// 图集图层 → 普通像素层：删除图集元数据，像素本身保留。
export function toPixels(doc, index) {
  const layer = doc.layers[index];
  if (!isTileset(layer)) return;
  delete layer.tileset;
  delete layer.type;
}

// Godot 4.5 「地形绘制（Connect）」的等价实现，算法逐条对齐 scene/2d/tile_map_layer.cpp：
// terrain_fill_connect / terrain_fill_constraints / _get_best_terrain_pattern_for_constraints。
//
// 为什么不能逐格独立匹配：每一格单独挑一个「邻居位全对上」的图块，相邻格之间没有共同约束，
// 边缘会挑到互相切开的碎片。Godot 的做法是把「本次刷的格 + 它们的八邻格」放进一个约束集一起解，
// 每解出一格就把该图块声明的地形位以更高优先级写回约束集，后面的格必须跟着它走，
// 所以再刷几次时先前不太对的图块会被邻居的约束纠正过来。
import {terrainModeBits} from './tilemap.js';

// peering bit 顺序与 tilemap.js 一致：0 左上、1 上、2 右上、3 左、4 右、5 左下、6 下、7 右下。
const SIDES = [1, 3, 4, 6];
const CORNERS = [0, 2, 5, 7];
const NEIGHBOR = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const SIDE_NEIGHBOR = {1: [0, -1], 3: [-1, 0], 4: [1, 0], 6: [0, 1]};
// 角位的三条约束来自共用该角的三个格（Godot 注释：all tiles on the constraint has the same center bit）。
const CORNER_CELLS = {0: [[-1, 0], [-1, -1], [0, -1]], 2: [[1, 0], [1, -1], [0, -1]], 5: [[-1, 0], [-1, 1], [0, 1]], 7: [[1, 0], [1, 1], [0, 1]]};
const CENTER = 'c';

const inside = (cols, rows, x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
const key = (index, bit) => index + ':' + bit;

// 图块 → 地形模式（terrain + 当前匹配方式下的各邻居位期望地形）。
export function tilePattern(tileset, id) {
  const tile = tileset.tiles[id], bits = new Array(8).fill(-1);
  if (!tile) return {terrain: -1, bits};
  for (const bit of terrainModeBits(tileset.mode)) bits[bit] = tile.peering?.[bit] ?? -1;
  return {terrain: tile.terrain ?? -1, bits};
}

// 同一份 (地形, 邻居位) 组合的所有图块归成一个模式，便于按权重随机挑与打分。
export function patternTable(tileset) {
  const bits = terrainModeBits(tileset.mode), table = [], signatures = new Map();
  for (let id = 0; id < tileset.tiles.length; id++) {
    const tile = tileset.tiles[id], pattern = tilePattern(tileset, id);
    const signature = pattern.terrain + '|' + bits.map(bit => pattern.bits[bit]).join(',');
    const found = signatures.get(signature);
    if (found) found.ids.push(id);
    else {
      const entry = {signature, terrain: pattern.terrain, bits: pattern.bits, ids: [id]};
      signatures.set(signature, entry);
      table.push(entry);
    }
  }
  return table;
}

function patternScore(pattern, bits, center, peers, current) {
  let score = 0;
  if (center) {
    if (center.terrain !== pattern.terrain) score += center.priority;
  } else if (current.terrain !== pattern.terrain) {
    return null; // 没有中心约束时不能改地形（Godot: cannot keep bits without constraints unmodified）。
  }
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i], constraint = peers[i];
    if (constraint) {
      if (constraint.terrain !== pattern.bits[bit]) score += constraint.priority;
    } else if (current.bits[bit] !== pattern.bits[bit]) {
      return null; // 没有约束的位必须保持原值。
    }
  }
  return score;
}

// 对比所有模式，取分数最小（冲突优先级之和最小）的一个；同分时按模式出现顺序稳定。
function bestPattern(bits, table, index, constraints, current) {
  // Constraints are identical for every candidate at this cell.
  const center = constraints.get(key(index, CENTER));
  const peers = bits.map(bit => constraints.get(key(index, bit)));
  let best = null, bestScore = Infinity;
  for (const pattern of table) {
    const score = patternScore(pattern, bits, center, peers, current);
    if (score === null || score >= bestScore) continue;
    best = pattern;
    bestScore = score;
    if (score === 0) break; // The first exact match also wins every later tie.
  }
  return best ? {pattern: best, score: bestScore} : null;
}

function weightedTile(tileset, ids, random) {
  const weights = ids.map(id => Math.max(0, tileset.tiles[id]?.weight ?? 1)), total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) return ids[0];
  let roll = random() * total;
  for (let i = 0; i < ids.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

// 每格一个稳定的伪随机源：同一份预览每次重绘取到同一块图块，不会闪。
function cellRandom(x, y) {
  let seed = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0 || 1;
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 4294967296;
}

// Godot terrain_fill_connect：painted 是本次刷到的格子下标，按刷到的顺序传入。
// 返回 {ids, exact}：ids 每格解析到的图块 id（-1 表示没解出），exact 表示该格没有被任何约束妥协。
export function solveConnect({tileset, cols, rows, cells, painted, previous, random = null}) {
  const bits = terrainModeBits(tileset.mode), table = patternTable(tileset);
  const ids = previous ? previous.slice() : new Array(cols * rows).fill(-1);
  const exact = new Array(cols * rows).fill(true);
  const terrainAt = (x, y) => (inside(cols, rows, x, y) ? cells[y * cols + x] : -1);
  const groups = new Map();
  for (const index of painted) {
    const terrain = cells[index];
    if (!(terrain >= 0)) continue;
    if (!groups.has(terrain)) groups.set(terrain, []);
    groups.get(terrain).push(index);
  }

  for (const [terrain, group] of groups) {
    // 1. 可修改集合：本次刷的格 + 它们的八邻格（Godot: can_modify_list）。
    const order = [], seen = new Set();
    for (const index of group) {
      order.push(index);
      seen.add(index);
    }
    for (const index of group) {
      const x = index % cols, y = Math.floor(index / cols);
      for (const [dx, dy] of NEIGHBOR) {
        const nx = x + dx, ny = y + dy;
        if (!inside(cols, rows, nx, ny)) continue;
        const neighbor = ny * cols + nx;
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        order.push(neighbor);
      }
    }
    // 2. 中心位是这块地形的格（Godot: cells_with_terrain_center_bit）：刷到的格，加上原本就是该地形的邻格。
    const centerCells = new Set(group);
    for (const index of order) {
      if (terrainAt(index % cols, Math.floor(index / cols)) === terrain) centerCells.add(index);
    }
    // 3. 本次刷出来的约束：中心位与各邻居位都按地形写死，优先级 10。
    //    边位只在与该地形相邻时才有约束；角位要共用该角的三个格都属于该地形才算（否则保持 -1）。
    const constraints = new Map();
    const push = (index, bit, wanted, priority) => {
      const existing = constraints.get(key(index, bit));
      if (existing && existing.priority > priority) return;
      constraints.set(key(index, bit), {terrain: wanted, priority});
    };
    for (const index of group) {
      push(index, CENTER, terrain, 10);
      const x = index % cols, y = Math.floor(index / cols);
      for (const bit of bits) {
        if (SIDES.includes(bit)) {
          const [dx, dy] = SIDE_NEIGHBOR[bit];
          if (inside(cols, rows, x + dx, y + dy) && centerCells.has((y + dy) * cols + x + dx)) push(index, bit, terrain, 10);
        } else if (CORNERS.includes(bit)) {
          const cells3 = CORNER_CELLS[bit];
          if (cells3.every(([dx, dy]) => inside(cols, rows, x + dx, y + dy) && centerCells.has((y + dy) * cols + x + dx))) push(index, bit, terrain, 10);
        }
      }
    }
    // 4. 已放好的图块也参与约束（Godot: _get_terrain_constraints_from_painted_cells_list）：
    //    对每个刷到的格、每个有效位，取共用该位的邻格图块声明的期望地形做多数票。
    for (const index of group) {
      const x = index % cols, y = Math.floor(index / cols);
      for (const bit of bits) {
        const [dx, dy] = NEIGHBOR[bit];
        const nx = x + dx, ny = y + dy;
        if (!inside(cols, rows, nx, ny)) continue;
        const neighborId = ids[ny * cols + nx];
        if (!(neighborId >= 0)) continue;
        const declared = tilePattern(tileset, neighborId).bits[opposite(bit)];
        if (declared >= 0) push(index, bit, declared, 1);
      }
    }
    // 5. 逐格求解：每解出一块就把它的声明以优先级 5 写回，后面的格必须跟着走。
    for (const index of order) {
      if (!centerCells.has(index)) continue;
      const current = ids[index] >= 0 ? tilePattern(tileset, ids[index]) : {terrain: -1, bits: new Array(8).fill(-1)};
      const solved = bestPattern(bits, table, index, constraints, current);
      if (!solved || solved.pattern.terrain < 0) {
        ids[index] = -1;
        exact[index] = false;
        continue;
      }
      const cx = index % cols, cy = Math.floor(index / cols);
      if (solved.pattern.ids.length === 1) ids[index] = solved.pattern.ids[0];
      else ids[index] = weightedTile(tileset, solved.pattern.ids, random ?? (() => cellRandom(cx, cy)));
      exact[index] = solved.score === 0;
      push(index, CENTER, solved.pattern.terrain, 5);
      for (const bit of bits) push(index, bit, solved.pattern.bits[bit], 5);
    }
  }
  return {ids, exact};
}

// 位 i 的对位：左上↔右下、上↔下……判邻居图块在共用位上的声明时用。
function opposite(bit) {
  return [7, 6, 5, 4, 3, 2, 1, 0][bit];
}

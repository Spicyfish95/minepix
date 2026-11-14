export const GRID_KEY = 'pixpix-grid-settings-v1';
export const DEFAULT_GRID = {x: 0, y: 0, w: 16, h: 16, visible: false};

export function validateGrid(value = {}) {
  const merged = {...DEFAULT_GRID, ...value};
  const {x, y, w, h} = merged;
  if (![x, y, w, h].every(Number.isInteger)) throw new Error('网格偏移与宽高需为整数');
  if (w < 1 || h < 1) throw new Error('网格宽高需大于 0');
  if (Math.abs(x) > 4096 || Math.abs(y) > 4096) throw new Error('网格偏移需在 ±4096 以内');
  return {x, y, w, h, visible: !!merged.visible};
}

export function loadGrid(storage) {
  try {
    const raw = storage?.getItem(GRID_KEY);
    return raw ? validateGrid(JSON.parse(raw)) : {...DEFAULT_GRID};
  } catch {
    return {...DEFAULT_GRID};
  }
}

export function saveGrid(storage, grid) {
  storage?.setItem(GRID_KEY, JSON.stringify(validateGrid(grid)));
}

// 与 Aseprite 一致：网格从 (x, y) 起每 w × h 像素画一条线，偏移不会回绕到 0。
export function gridLines(grid, width, height) {
  const value = validateGrid(grid), xs = [], ys = [];
  for (let x = value.x; x < width; x += value.w) xs.push(x);
  for (let y = value.y; y < height; y += value.h) ys.push(y);
  return {xs, ys};
}

export function snapToGrid(grid, x, y) {
  const value = validateGrid(grid);
  return {x: value.x + Math.round((x - value.x) / value.w) * value.w, y: value.y + Math.round((y - value.y) / value.h) * value.h};
}

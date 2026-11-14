import {colorValue} from './model.js';
import {modeOf} from './color-modes.js';
import {isReference} from './layer-types.js';
import {isGroup} from './layer-tree.js';

export const DEFAULT_TOLERANCE = 0;

// Aseprite 的替换颜色容差是 0-255 的单值滑杆；这里按四通道最大差值判定，
// 0 表示必须完全相等，255 表示任意颜色都命中。
export function colorMatches(pixel, target, tolerance = DEFAULT_TOLERANCE) {
  if (!tolerance) return (pixel >>> 0) === (target >>> 0);
  return Math.max(
    Math.abs((pixel >>> 24) - (target >>> 24)),
    Math.abs(((pixel >>> 16) & 255) - ((target >>> 16) & 255)),
    Math.abs(((pixel >>> 8) & 255) - ((target >>> 8) & 255)),
    Math.abs((pixel & 255) - (target & 255))
  ) <= tolerance;
}

export function replaceColorPixels(pixels, {from, to, tolerance = DEFAULT_TOLERANCE, selection = null, width}) {
  const target = colorValue(from), value = colorValue(to);
  let count = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (selection) {
      const x = i % width, y = (i - x) / width;
      if (x < selection.x || y < selection.y || x >= selection.x + selection.w || y >= selection.y + selection.h) continue;
      if (selection.mask && !selection.mask[(y - selection.y) * selection.w + (x - selection.x)]) continue;
    }
    if (!colorMatches(pixels[i], target, tolerance)) continue;
    pixels[i] = value;
    count++;
  }
  return count;
}

const pixelLayer = layer => !isGroup(layer) && !isReference(layer);

export function replaceColorInDocument(doc, {from, to, tolerance = DEFAULT_TOLERANCE, scope = 'cel', frame = 0, layer = 0, selection = null}) {
  const targets = [];
  if (scope === 'cel') {
    if (pixelLayer(doc.layers[layer])) targets.push([frame, layer]);
  } else if (scope === 'layer') {
    if (pixelLayer(doc.layers[layer])) for (let f = 0; f < doc.frames.length; f++) targets.push([f, layer]);
  } else if (scope === 'sprite') {
    for (let f = 0; f < doc.frames.length; f++) for (let l = 0; l < doc.layers.length; l++) if (pixelLayer(doc.layers[l])) targets.push([f, l]);
  } else throw new Error('替换范围无效');

  const visited = new Set();
  let count = 0;
  for (const [f, l] of targets) {
    const cel = doc.frames[f].cels[l];
    if (visited.has(cel)) continue;
    visited.add(cel);
    count += replaceColorPixels(cel, {from, to, tolerance, selection, width: doc.width});
  }
  // 索引色需要目标色在色板里才能精确落地；缺失时补进色板（最多 256 色）。
  if (count && modeOf(doc) === 'indexed' && !doc.palette.some(entry => colorValue(entry) === colorValue(to))) {
    if (doc.palette.length >= 256) throw new Error('索引色板已满 256 色，无法加入新颜色');
    doc.palette.push(to);
  }
  return count;
}

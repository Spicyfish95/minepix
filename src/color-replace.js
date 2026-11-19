import {colorValue, selectionContains} from './model.js';
import {modeOf, indexColor} from './color-modes.js';
import {celProperty} from './cel-properties.js';
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

export function replaceColorPixels(pixels, {from, to, tolerance = DEFAULT_TOLERANCE, selection = null, width, x = 0, y = 0}) {
  const target = colorValue(from), value = colorValue(to);
  let count = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (!selectionContains(selection, x + i % width, y + Math.floor(i / width))) continue;
    if (!colorMatches(pixels[i], target, tolerance)) continue;
    pixels[i] = value;
    count++;
  }
  return count;
}

const pixelLayer = layer => !isGroup(layer) && !isReference(layer);

export function replaceColorInDocument(doc, {from, to, fromIndex, toIndex, tolerance = DEFAULT_TOLERANCE, scope = 'cel', frame = 0, layer = 0, selection = null}) {
  const indexed = modeOf(doc) === 'indexed';
  if (indexed && [fromIndex, toIndex].some(index => !Number.isInteger(index) || index < 0 || index >= Math.min(65536,doc.palette.length))) throw new Error('替换颜色索引无效');
  const targets = [];
  if (scope === 'cel') {
    if (pixelLayer(doc.layers[layer])) targets.push([frame, layer]);
  } else if (scope === 'layer') {
    if (pixelLayer(doc.layers[layer])) for (let f = 0; f < doc.frames.length; f++) targets.push([f, layer]);
  } else if (scope === 'sprite') {
    for (let f = 0; f < doc.frames.length; f++) for (let l = 0; l < doc.layers.length; l++) if (pixelLayer(doc.layers[l])) targets.push([f, l]);
  } else throw new Error('替换范围无效');

  if (indexed && fromIndex === toIndex) return 0;
  const visited = new Set();
  let count = 0;
  for (const [f, l] of targets) {
    const cel = doc.frames[f].cels[l];
    if (visited.has(cel)) continue;
    visited.add(cel);
    const property = celProperty(doc, f, l);
    if (indexed) {
      const indices = doc.frames[f].indices[l], value = indexColor(doc, toIndex, doc.layers[l]);
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] !== fromIndex || !selectionContains(selection, property.x + i % property.width, property.y + Math.floor(i / property.width))) continue;
        indices[i] = toIndex;
        cel[i] = value;
        count++;
      }
    } else count += replaceColorPixels(cel, {from, to, tolerance, selection, ...property});
  }
  return count;
}

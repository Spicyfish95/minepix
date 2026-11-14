import {materializeCels,celPixels} from './cel-properties.js';
import {isReference,isBackground} from './layer-types.js';
import {isGroup} from './layer-tree.js';
import {reframeSlices,flipSlices,mapSliceGeometry} from './slices.js';
import { flipRegion } from './model.js';
import {assertProjectCapacity} from './project-capacity.js';

export function reframe(doc, { x, y, w, h }, fill = 0) {
  assertProjectCapacity(doc,{width:w,height:h,pixels:w*h*doc.layers.length*doc.frames.length});
  materializeCels(doc);
  const oldWidth = doc.width, oldHeight = doc.height;
  const remap=(source,value)=>{const target=new Array(w*h).fill(value);for(let sy=Math.max(0,y);sy<Math.min(oldHeight,y+h);sy++)for(let sx=Math.max(0,x);sx<Math.min(oldWidth,x+w);sx++)target[(sy-y)*w+sx-x]=source[sy*oldWidth+sx];return target;};
  for(const frame of doc.frames){frame.cels=frame.cels.map((source,l)=>remap(source,isBackground(doc.layers[l])?doc.layers[l].clearColor:isGroup(doc.layers[l])?0:fill));if(frame.indices)frame.indices=frame.indices.map((source,l)=>source?remap(source,isBackground(doc.layers[l])?doc.layers[l].clearIndex:doc.transparentIndex):null);}
  for(const layer of doc.layers)if(isReference(layer)){const ref=layer.reference;layer.reference={...ref,x:ref.x+(ref.data?-x:(ref.scale-1)*x),y:ref.y+(ref.data?-y:(ref.scale-1)*y)};}
  if(doc.symmetryAxes)doc.symmetryAxes={x:Math.max(0,Math.min(w,doc.symmetryAxes.x-x)),y:Math.max(0,Math.min(h,doc.symmetryAxes.y-y))};
  for(const frame of doc.frames)for(const p of Object.values(frame.celProperties||{})){p.width=w;p.height=h;}
  doc.slices=reframeSlices(doc.slices,{x,y,w,h});doc.width = w; doc.height = h;
}

export function resizeCanvas(doc, width, height, anchor = 'center') {
  const positions = { 'top-left': [0,0], top: [.5,0], 'top-right': [1,0], left: [0,.5], center: [.5,.5], right: [1,.5], 'bottom-left': [0,1], bottom: [.5,1], 'bottom-right': [1,1] };
  const [ax, ay] = positions[anchor];
  reframe(doc, { x: -Math.floor((width - doc.width) * ax), y: -Math.floor((height - doc.height) * ay), w: width, h: height });
}

export const SPRITE_SIZE_METHODS = ['nearest', 'bilinear'];

// 精灵尺寸：缩放全部图层与帧的像素，画布尺寸随内容一起变化（与只改画布的 resizeCanvas 不同）。
export function spriteSize(doc, width, height, method = 'nearest') {
  assertProjectCapacity(doc,{width,height,pixels:width*height*doc.layers.length*doc.frames.length});
  if (!SPRITE_SIZE_METHODS.includes(method)) throw new Error('缩放插值方式无效');
  const oldWidth = doc.width, oldHeight = doc.height;
  if (width === oldWidth && height === oldHeight) return false;
  materializeCels(doc);
  const scaleX = width / oldWidth, scaleY = height / oldHeight;
  if(doc.symmetryAxes)doc.symmetryAxes={x:doc.symmetryAxes.x*scaleX,y:doc.symmetryAxes.y*scaleY};
  // 最近邻按目标像素左上角映射回源图，缩小 4→2 时保留第 0、2 列/行（Aseprite 的整数缩放语义）。
  const nearest = (source, x, y) => source[Math.min(oldHeight - 1, Math.floor(y / scaleY)) * oldWidth + Math.min(oldWidth - 1, Math.floor(x / scaleX))];
  const bilinear = (source, x, y) => {
    const fx = Math.max(0, Math.min(oldWidth - 1, (x + .5) / scaleX - .5)), fy = Math.max(0, Math.min(oldHeight - 1, (y + .5) / scaleY - .5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(oldWidth - 1, x0 + 1), y1 = Math.min(oldHeight - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const weight = (dx, dy) => (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
    const corners = [[x0, y0, weight(0, 0)], [x1, y0, weight(1, 0)], [x0, y1, weight(0, 1)], [x1, y1, weight(1, 1)]];
    let a = 0, r = 0, g = 0, b = 0;
    for (const [cx, cy, w] of corners) {
      const pixel = source[cy * oldWidth + cx];
      a += (pixel >>> 24) * w; r += ((pixel >>> 16) & 255) * w; g += ((pixel >>> 8) & 255) * w; b += (pixel & 255) * w;
    }
    return ((Math.round(a) << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)) >>> 0;
  };
  const resample = (source, pick) => { const target = new Array(width * height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) target[y * width + x] = pick(source, x, y); return target; };
  const pick = method === 'bilinear' ? bilinear : nearest;
  for (const frame of doc.frames) {
    frame.cels = frame.cels.map((cel, l) => isGroup(doc.layers[l]) ? new Array(width * height).fill(0) : resample(cel, pick));
    // 索引像素只做最近邻采样，双线性插值在调色板索引上没有意义。
    if (frame.indices) frame.indices = frame.indices.map((cel, l) => cel ? resample(cel, nearest) : null);
  }
  for (const layer of doc.layers) {
    if (!isReference(layer)) continue;
    const ref = layer.reference;
    layer.reference = {...ref, x: Math.round(ref.x * scaleX), y: Math.round(ref.y * scaleY), scale: Math.max(.125, Math.min(16, ref.scale * (scaleX + scaleY) / 2))};
  }
  doc.slices = scaleSlicesXY(doc.slices || [], scaleX, scaleY);
  for(const frame of doc.frames)for(const p of Object.values(frame.celProperties||{})){p.width=width;p.height=height;}
  doc.width = width;
  doc.height = height;
  return true;
}

function scaleSlicesXY(slices, scaleX, scaleY) {
  const span = (start, size, scale) => { const from = Math.round(start * scale); return [from, Math.max(1, Math.round((start + size) * scale) - from)]; };
  return mapSliceGeometry(slices, slice => {
    const b = slice.bounds;
    const [x, w] = span(b.x, b.w, scaleX), [y, h] = span(b.y, b.h, scaleY);
    const next = {...slice, bounds: {x, y, w, h}};
    if (slice.pivot) next.pivot = {x: Math.round(slice.pivot.x * w / b.w), y: Math.round(slice.pivot.y * h / b.h)};
    if (slice.center) {
      const [cx, cw] = span(slice.center.x, slice.center.w, w / b.w), [cy, ch] = span(slice.center.y, slice.center.h, h / b.h);
      next.center = {x: cx, y: cy, w: cw, h: ch};
    }
    return next;
  });
}

export function contentBounds(doc) {
  let left = doc.width, top = doc.height, right = -1, bottom = -1;
  for (const [f,frame] of doc.frames.entries()) for (const [l] of frame.cels.entries()) {if(isReference(doc.layers[l]))continue;celPixels(doc,f,l).forEach((pixel, i) => {
    if (!(pixel & 255)) return;
    const x = i % doc.width, y = Math.floor(i / doc.width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  });}
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function flipSprite(doc, axis) {
  materializeCels(doc);
  if(doc.symmetryAxes)doc.symmetryAxes={...doc.symmetryAxes,[axis]:(axis==='x'?doc.width:doc.height)-doc.symmetryAxes[axis]};
  doc.slices=flipSlices(doc.slices,doc.width,doc.height,axis);
  for (const frame of doc.frames) for (const cel of frame.cels) flipRegion(doc, cel, null, axis);
}

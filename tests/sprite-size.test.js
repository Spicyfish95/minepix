import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, addLayer, addFrame, colorValue, clone, History} from '../src/model.js';
import {spriteSize, SPRITE_SIZE_METHODS, resizeCanvas, reframe} from '../src/canvas-commands.js';

const red = colorValue('#ff0000'), blue = colorValue('#0000ff');

test('精灵缩放同时改变画布尺寸与全部图层帧的像素', () => {
  const doc = createDocument(2, 2, 'size');
  addLayer(doc, 0);
  addFrame(doc, 0, true);
  doc.frames[0].cels[0] = [red, 0, 0, 0];
  doc.frames[0].cels[1] = [0, 0, 0, blue];
  doc.frames[1].cels[0] = [0, red, 0, 0];
  assert.equal(spriteSize(doc, 4, 4, 'nearest'), true);
  assert.equal(doc.width, 4);
  assert.equal(doc.height, 4);
  assert.equal(doc.layers.length, 2);
  assert.equal(doc.frames.length, 2);
  // 2×2 的每个源像素放大成 4×4 的 2×2 块
  assert.deepEqual(doc.frames[0].cels[0], [red, red, 0, 0, red, red, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(doc.frames[0].cels[1][15], blue);
  assert.equal(doc.frames[1].cels[0][6], red);
});

test('缩小精灵后像素落点与帧数保持正确', () => {
  const doc = createDocument(4, 4, 'shrink');
  doc.frames[0].cels[0][0] = red;
  doc.frames[0].cels[0][10] = blue;
  addFrame(doc, 0, true);
  assert.equal(spriteSize(doc, 2, 2, 'nearest'), true);
  assert.equal(doc.width, 2);
  assert.equal(doc.height, 2);
  assert.equal(doc.frames.length, 2);
  assert.equal(doc.frames[0].cels[0][0], red);
  assert.equal(doc.frames[0].cels[0][3], blue);
});

test('尺寸不变时不做任何修改并返回 false', () => {
  const doc = createDocument(3, 3, 'same');
  const before = clone(doc);
  assert.equal(spriteSize(doc, 3, 3), false);
  assert.deepEqual(doc, before);
});

test('精灵缩放保留帧时长、标签、图层属性与组结构', () => {
  const doc = createDocument(2, 2, 'meta');
  addLayer(doc, 0);
  addLayer(doc, 1);
  doc.layers[2].type = 'group';
  doc.frames[0].duration = 60;
  doc.tags = [{id: 'walk', name: 'Walk', color: '#112233', from: 0, to: 0, direction: 'forward'}];
  spriteSize(doc, 6, 6);
  assert.equal(doc.frames[0].duration, 60);
  assert.equal(doc.tags[0].name, 'Walk');
  assert.equal(doc.layers[2].type, 'group');
  assert.equal(doc.frames[0].cels[2].length, 36);
  assert.equal(doc.frames[0].cels[2].every(pixel => pixel === 0), true);
});

test('精灵缩放会缩放切片与参考图位置', () => {
  const doc = createDocument(4, 4, 'slices');
  doc.slices = [{id: 'a', name: 'A', bounds: {x: 1, y: 1, w: 2, h: 2}, pivot: {x: 1, y: 1}}];
  addLayer(doc, 0);
  doc.layers[1].type = 'reference';
  doc.layers[1].reference = {x: 1, y: 1, scale: 1};
  spriteSize(doc, 8, 8);
  assert.deepEqual(doc.slices[0].bounds, {x: 2, y: 2, w: 4, h: 4});
  assert.deepEqual(doc.slices[0].pivot, {x: 2, y: 2});
  assert.equal(doc.layers[1].reference.x, 2);
  assert.equal(doc.layers[1].reference.scale, 2);
});

test('索引色像素缩放后索引与 RGBA 保持一致', () => {
  const doc = createDocument(2, 1, 'indexed');
  doc.colorMode = 'indexed';
  doc.palette = ['#00000000', '#ff0000ff'];
  doc.transparentIndex = 0;
  doc.frames[0].cels[0] = [red, 0];
  doc.frames[0].indices = [[1, 0]];
  spriteSize(doc, 4, 2);
  assert.deepEqual(doc.frames[0].indices[0], [1, 1, 0, 0, 1, 1, 0, 0]);
  assert.deepEqual(doc.frames[0].cels[0], [red, red, 0, 0, red, red, 0, 0]);
});

test('精灵缩放可单步撤销且恢复原尺寸与像素', () => {
  const doc = createDocument(2, 2, 'undo');
  doc.frames[0].cels[0] = [red, 0, 0, blue];
  const history = new History();
  const before = clone(doc);
  history.push(before);
  spriteSize(doc, 8, 8);
  history.push(before, doc);
  assert.equal(doc.width, 8);
  const undone = history.undo(doc);
  assert.equal(undone.width, 2);
  assert.equal(undone.height, 2);
  assert.deepEqual(undone.frames[0].cels[0], [red, 0, 0, blue]);
  const redone = history.redo(undone);
  assert.equal(redone.width, 8);
});

test('超出容量的精灵尺寸被拒绝且不修改文档', () => {
  const doc = createDocument(2, 2, 'limit');
  const before = clone(doc);
  assert.throws(() => spriteSize(doc, 33554433, 2), /总像素不超过 32M/);
  assert.deepEqual(doc, before);
  assert.throws(() => spriteSize(doc, 4, 4, 'rotSprite'), /缩放插值方式无效/);
  assert.deepEqual(doc, before);
});

test('插值方式列表与画布尺寸语义保持独立', () => {
  assert.deepEqual(SPRITE_SIZE_METHODS, ['nearest', 'bilinear']);
  const doc = createDocument(2, 2, 'semantics');
  doc.frames[0].cels[0] = [red, 0, 0, 0];
  // 画布尺寸只扩展画布，不缩放内容
  resizeCanvas(doc, 4, 4, 'top-left');
  assert.equal(doc.frames[0].cels[0][0], red);
  assert.equal(doc.frames[0].cels[0][1], 0);
  assert.equal(doc.width, 4);
  // 精灵尺寸会放大内容
  const sprite = createDocument(2, 2, 'sprite');
  sprite.frames[0].cels[0] = [red, 0, 0, 0];
  spriteSize(sprite, 4, 4);
  assert.equal(sprite.frames[0].cels[0][1], red);
  // reframe 也不缩放内容
  const cropped = createDocument(4, 4, 'reframe');
  cropped.frames[0].cels[0][0] = red;
  reframe(cropped, {x: 0, y: 0, w: 2, h: 2});
  assert.equal(cropped.frames[0].cels[0][0], red);
});

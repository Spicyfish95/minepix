import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, addLayer, addFrame, colorValue, clone, History} from '../src/model.js';
import {colorMatches, replaceColorPixels, replaceColorInDocument, DEFAULT_TOLERANCE} from '../src/color-replace.js';

const red = colorValue('#ff0000'), blue = colorValue('#0000ff'), green = colorValue('#00ff00');

test('容差按四通道最大差值判定，0 表示完全相等', () => {
  assert.equal(DEFAULT_TOLERANCE, 0);
  assert.equal(colorMatches(red, red, 0), true);
  assert.equal(colorMatches(red, blue, 0), false);
  assert.equal(colorMatches(0xff0000ff, 0xfe0101ff, 1), true);
  assert.equal(colorMatches(0xff0000ff, 0xfe0101ff, 0), false);
  assert.equal(colorMatches(0x000000ff, 0xffffffff, 255), true);
});

test('像素替换只改命中的颜色并返回数量', () => {
  const pixels = [red, blue, red, 0];
  assert.equal(replaceColorPixels(pixels, {from: '#ff0000', to: '#00ff00', width: 2}), 2);
  assert.deepEqual(pixels, [green, blue, green, 0]);
});

test('像素替换遵循矩形选区与蒙版', () => {
  const pixels = [red, red, red, red];
  const selection = {x: 1, y: 0, w: 1, h: 2};
  assert.equal(replaceColorPixels(pixels, {from: '#ff0000', to: '#00ff00', selection, width: 2}), 2);
  assert.deepEqual(pixels, [red, green, red, green]);
  const masked = [red, red];
  replaceColorPixels(masked, {from: '#ff0000', to: '#0000ff', selection: {x: 0, y: 0, w: 2, h: 1, mask: [0, 1]}, width: 2});
  assert.deepEqual(masked, [red, blue]);
});

test('文档替换支持当前 cel / 当前层全部帧 / 整个精灵三种范围', () => {
  const doc = createDocument(2, 2, 'replace');
  addLayer(doc, 0);
  addFrame(doc, 0, true);
  doc.frames[0].cels[0][0] = red;
  doc.frames[0].cels[1][1] = red;
  doc.frames[1].cels[0][2] = red;
  doc.frames[1].cels[1][3] = red;

  const celOnly = clone(doc);
  assert.equal(replaceColorInDocument(celOnly, {from: '#ff0000', to: '#00ff00', scope: 'cel', frame: 0, layer: 0}), 1);
  assert.deepEqual([celOnly.frames[0].cels[0][0], celOnly.frames[0].cels[1][1], celOnly.frames[1].cels[0][2]], [green, red, red]);

  const layerOnly = clone(doc);
  assert.equal(replaceColorInDocument(layerOnly, {from: '#ff0000', to: '#00ff00', scope: 'layer', layer: 0}), 2);
  assert.deepEqual([layerOnly.frames[0].cels[0][0], layerOnly.frames[1].cels[0][2], layerOnly.frames[1].cels[1][3]], [green, green, red]);

  const sprite = clone(doc);
  assert.equal(replaceColorInDocument(sprite, {from: '#ff0000', to: '#00ff00', scope: 'sprite'}), 4);
  assert.equal(replaceColorInDocument(sprite, {from: '#ff0000', to: '#00ff00', scope: 'sprite'}), 0);

  assert.throws(() => replaceColorInDocument(clone(doc), {from: '#ff0000', to: '#00ff00', scope: 'nope'}), /替换范围无效/);
});

test('链接 cel 只替换一次，不重复计数', () => {
  const doc = createDocument(2, 1, 'linked');
  addFrame(doc, 0, true);
  doc.frames[0].cels[0][0] = red;
  doc.frames[1].cels[0] = doc.frames[0].cels[0];
  assert.equal(replaceColorInDocument(doc, {from: '#ff0000', to: '#00ff00', scope: 'sprite'}), 1);
  assert.equal(doc.frames[0].cels[0][0], green);
  assert.equal(doc.frames[1].cels[0][0], green);
});

test('索引色文档替换时把缺失的目标色补进色板', () => {
  const doc = createDocument(2, 1, 'indexed');
  doc.colorMode = 'indexed';
  doc.palette = ['#00000000', '#ff0000ff'];
  doc.transparentIndex = 0;
  doc.frames[0].cels[0] = [red, 0];
  doc.frames[0].indices = [[1, 0]];
  replaceColorInDocument(doc, {from: '#ff0000', to: '#00ff00', scope: 'cel'});
  assert.equal(doc.palette.at(-1), '#00ff00');
  assert.equal(doc.frames[0].cels[0][0], green);
});

test('替换颜色可作为单步历史撤销', () => {
  const doc = createDocument(2, 2, 'undo');
  doc.frames[0].cels[0] = [red, red, 0, 0];
  const history = new History();
  const before = clone(doc);
  history.push(before);
  replaceColorInDocument(doc, {from: '#ff0000', to: '#00ff00', scope: 'sprite'});
  history.push(before, doc);
  assert.equal(doc.frames[0].cels[0][0], green);
  const undone = history.undo(doc);
  assert.deepEqual(undone.frames[0].cels[0], [red, red, 0, 0]);
});

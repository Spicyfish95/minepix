import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, addLayer, addFrame, colorValue, clone, History} from '../src/model.js';
import {colorMatches, replaceColorPixels, replaceColorInDocument, DEFAULT_TOLERANCE} from '../src/color-replace.js';
import {indexColor, validateColorMode} from '../src/color-modes.js';
import {linkCels} from '../src/cel-links.js';
import {setCelProperty} from '../src/cel-properties.js';
import {replacementColorDialog} from '../src/color-replace-dialog.js';

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

function indexedDocument() {
  const doc = createDocument(4, 1, 'indexed');
  addLayer(doc, 0);
  addFrame(doc, 0, true);
  doc.colorMode = 'indexed';
  doc.palette = ['#00000000', '#ff0000ff', '#ff0000ff', '#0000ffff', '#0000ffff'];
  doc.transparentIndex = 0;
  for (const frame of doc.frames) {
    frame.indices = [[1, 2, 1, 0], [1, 2, 1, 0]];
    frame.cels = frame.indices.map((indices, l) => indices.map(index => indexColor(doc, index, doc.layers[l])));
  }
  return doc;
}

test('索引替换精确区分重复原色与目标色，并保持色板和透明索引', () => {
  const doc = indexedDocument(), palette = [...doc.palette];
  assert.equal(replaceColorInDocument(doc, {fromIndex: 1, toIndex: 4, tolerance: 255}), 2);
  assert.deepEqual(doc.frames[0].indices[0], [4, 2, 4, 0]);
  assert.deepEqual(doc.frames[0].cels[0], [blue, red, blue, 0]);
  assert.deepEqual(doc.palette, palette);
  assert.equal(doc.transparentIndex, 0);
  validateColorMode(doc);
  assert.equal(replaceColorInDocument(doc, {fromIndex: 2, toIndex: 1}), 1);
  assert.equal(doc.frames[0].indices[0][1], 1);
  assert.equal(replaceColorInDocument(doc, {fromIndex: 1, toIndex: 1}), 0);
  assert.throws(() => replaceColorInDocument(doc, {from: '#ff0000', to: '#00ff00'}), /索引无效/);
  assert.throws(() => replaceColorInDocument(doc, {fromIndex: 1, toIndex: 5}), /索引无效/);
});

test('索引替换支持 cel、层、精灵范围以及选区蒙版', () => {
  for (const [scope, count, expected] of [
    ['cel', 1, [1, 4, 1, 1]],
    ['layer', 2, [1, 4, 1, 4]],
    ['sprite', 4, [4, 4, 4, 4]]
  ]) {
    const doc = indexedDocument();
    const selection = {x: 0, y: 0, w: 3, h: 1, mask: [1, 0, 0]};
    assert.equal(replaceColorInDocument(doc, {fromIndex: 1, toIndex: 4, scope, frame: 0, layer: 1, selection}), count);
    assert.deepEqual(doc.frames.flatMap(frame => frame.indices.map(indices => indices[0])), expected);
    assert.equal(doc.frames[0].indices[1][2], 1);
    validateColorMode(doc);
  }
});

test('索引替换缓存遵循背景层与普通层的透明索引语义', () => {
  const doc = indexedDocument();
  doc.palette[0] = '#12345600';
  doc.layers[0] = {...doc.layers[0], type: 'background', clearIndex: 3, clearColor: blue};
  for (const frame of doc.frames) frame.cels[0] = frame.indices[0].map(index => indexColor(doc, index, doc.layers[0]));
  assert.equal(replaceColorInDocument(doc, {fromIndex: 1, toIndex: 0, scope: 'sprite'}), 8);
  assert.equal(doc.frames[0].cels[0][0], 0x123456ff);
  assert.equal(doc.frames[0].cels[1][0], 0);
  assert.equal(doc.layers[0].clearIndex, 3);
  validateColorMode(doc);
});

test('链接索引 cel 只计数一次且重复目标索引支持单步撤销重做', () => {
  for (const scope of ['cel', 'layer', 'sprite']) {
    const doc = indexedDocument();
    linkCels(doc, 0, [0, 1]);
    const history = new History(), before = clone(doc);
    assert.equal(replaceColorInDocument(doc, {fromIndex: 1, toIndex: 2, scope}), scope === 'sprite' ? 6 : 2);
    assert.equal(history.push(before, doc, {colorsReady: true}), true);
    assert.equal(history.undoStack.length, 1);
    const undone = history.undo(doc);
    assert.deepEqual([...undone.frames[0].indices[0]], [1, 2, 1, 0]);
    assert.equal(undone.frames[0].indices[0], undone.frames[1].indices[0]);
    const redone = history.redo(undone);
    assert.deepEqual([...redone.frames[0].indices[0]], [2, 2, 2, 0]);
    assert.equal(redone.frames[0].indices[0], redone.frames[1].indices[0]);
    assert.equal(redone.frames[0].cels[0], redone.frames[1].cels[0]);
    assert.deepEqual(redone.palette, before.palette);
    validateColorMode(redone);
  }
});

test('移动且裁小的 cel 按画布坐标应用选区', () => {
  for (const indexed of [false, true]) {
    const doc = indexedDocument();
    if (!indexed) { delete doc.colorMode; for (const frame of doc.frames) delete frame.indices; }
    doc.frames[0].cels[0] = [red, red];
    if (indexed) doc.frames[0].indices[0] = [1, 1];
    setCelProperty(doc, 0, 0, {x: 2, y: 0, width: 2, height: 1});
    assert.equal(replaceColorInDocument(doc, {from: '#ff0000', to: '#0000ff', fromIndex: 1, toIndex: 4, selection: {x: 3, y: 0, w: 1, h: 1}}), 1);
    assert.deepEqual(doc.frames[0].cels[0], [red, blue]);
    if (indexed) assert.deepEqual(doc.frames[0].indices[0], [1, 4]);
  }
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

function dialogForm(indexed) {
  const names = indexed ? ['fromIndex', 'toIndex'] : ['from', 'to', 'fromPalette', 'toPalette'];
  return {elements: Object.fromEntries(names.map(name => [name, {value: '', style: {}}]))};
}

test('RGBA 弹窗双向色板选择保留透明度，手动输入可退出色板选择', async () => {
  const doc = createDocument(1, 1), form = dialogForm(false);
  doc.palette = ['#ff000080', '#00ff0040'];
  const selection = {x: 0, y: 0, w: 1, h: 1};
  const options = await replacementColorDialog({doc, from: '#ff000080', to: '#ffffff', frame: 2, layer: 3, selection,
    modal: async (title, html, setup, validate) => {
      assert.equal(title, '替换颜色');
      assert.match(html, /name="fromPalette"/);
      assert.match(html, /name="toPalette"/);
      assert.match(html, /name="tolerance"/);
      setup(form);
      assert.equal(form.elements.fromPalette.value, '0');
      assert.equal(form.elements.toPalette.value, '');
      form.elements.toPalette.value = '1';
      form.elements.toPalette.onchange();
      assert.equal(form.elements.to.value, '#00ff00');
      form.elements.to.value = '#0000ff';
      form.elements.to.oninput();
      assert.equal(form.elements.toPalette.value, '');
      form.elements.toPalette.value = '1';
      form.elements.toPalette.onchange();
      assert.throws(() => validate({tolerance: '256'}), /容差/);
      return {from: '#ff0000', fromPalette: '0', to: '#00ff00', toPalette: '1', tolerance: '7', scope: 'sprite'};
    }});
  assert.deepEqual(options, {from: '#ff000080', to: '#00ff0040', tolerance: 7, scope: 'sprite', frame: 2, layer: 3, selection});
  const pixels = [0xff000080, red];
  assert.equal(replaceColorPixels(pixels, {...options, selection: null, width: 2}), 1);
  assert.deepEqual(pixels, [0x00ff0040, red]);
});

test('RGBA 弹窗保留手动颜色与容差、取消不返回替换选项', async () => {
  const doc = createDocument(1, 1);
  const options = await replacementColorDialog({doc, from: '#ff0000', to: '#00ff00', modal: async () => ({from: '#123456', to: '#654321', fromPalette: '', toPalette: '', tolerance: '12', scope: 'layer'})});
  assert.deepEqual(options, {from: '#123456', to: '#654321', tolerance: 12, scope: 'layer', frame: 0, layer: 0, selection: null});
  assert.equal(await replacementColorDialog({doc, modal: async () => null}), null);
});

test('索引弹窗按槽号呈现重复色，返回精确索引且不提供颜色容差', async () => {
  const doc = indexedDocument(), form = dialogForm(true);
  const options = await replacementColorDialog({doc, fromIndex: 2, toIndex: 4, modal: async (title, html, setup, validate) => {
    assert.match(html, /2: #ff0000ff/);
    assert.match(html, /4: #0000ffff/);
    assert.match(html, /透明索引/);
    assert.doesNotMatch(html, /type="color"|name="tolerance"/);
    setup(form);
    assert.equal(form.elements.fromIndex.value, 2);
    assert.equal(form.elements.toIndex.value, 4);
    assert.throws(() => validate({fromIndex: '1', toIndex: '5'}), /索引无效/);
    return {fromIndex: '2', toIndex: '4', scope: 'cel'};
  }});
  assert.deepEqual(options, {fromIndex: 2, toIndex: 4, scope: 'cel', frame: 0, layer: 0, selection: null});
  assert.equal(replaceColorInDocument(doc, options), 1);
  assert.deepEqual(doc.frames[0].indices[0], [1, 4, 1, 0]);
});

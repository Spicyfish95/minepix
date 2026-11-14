import test from 'node:test';
import assert from 'node:assert/strict';
import { paletteOutline, outlinePathData, outlineArea } from '../src/palette-outline.js';

const cells = (...pairs) => pairs.map(([col, row]) => ({ col, row }));
const geometry = { cellWidth: 27, cellHeight: 26, gapX: 5, gapY: 5 };
const trace = list => paletteOutline(list, geometry);
const W = 27 + 5, H = 26 + 5;
const area = loops => Math.abs(outlineArea(loops));
const xs = loop => [...new Set(loop.map(([x]) => x))].sort((a, b) => a - b);
const ys = loop => [...new Set(loop.map(([, y]) => y))].sort((a, b) => a - b);

test('single cell outlines its own four corners, half a gap outside', () => {
  const loops = trace(cells([0, 0]));
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 4);
  assert.deepEqual(loops[0], [[29.5, -2.5], [-2.5, -2.5], [-2.5, 28.5], [29.5, 28.5]]);
  assert.equal(area(loops), W * H);
});

test('a row of three cells is one loop, not three rectangles', () => {
  const loops = trace(cells([0, 0], [1, 0], [2, 0]));
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 4);
  assert.equal(area(loops), W * 3 * H);
  assert.deepEqual(xs(loops[0]), [-2.5, 93.5]);
});

test('2x2 block collapses to one rectangle with no interior lines', () => {
  const loops = trace(cells([0, 0], [1, 0], [0, 1], [1, 1]));
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 4);
  assert.equal(area(loops), W * 2 * H * 2);
});

test('L shape follows the step instead of two stacked rectangles', () => {
  const loops = trace(cells([0, 0], [1, 0], [0, 1]));
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 6);
  assert.equal(area(loops), W * H * 3);
  assert.deepEqual(xs(loops[0]), [-2.5, 29.5, 61.5]);
  assert.deepEqual(ys(loops[0]), [-2.5, 28.5, 59.5]);
});

test('disconnected groups produce one closed loop each', () => {
  const loops = trace(cells([0, 0], [3, 2], [4, 2]));
  assert.equal(loops.length, 2);
  assert.deepEqual(loops.map(loop => loop.length).sort(), [4, 4]);
  assert.equal(area(loops), W * H * 3);
});

test('a surrounded hole is traced as its own loop with opposite winding', () => {
  const ring = cells([0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]);
  const loops = trace(ring);
  assert.equal(loops.length, 2);
  const areas = loops.map(loop => outlineArea([loop])).sort((a, b) => Math.abs(b) - Math.abs(a));
  assert.equal(Math.abs(areas[0]), W * 3 * H * 3);
  assert.equal(Math.abs(areas[1]), W * H);
  assert.ok(areas[0] * areas[1] < 0, 'hole winds the opposite way');
  assert.equal(area(loops), W * H * 8);
});

test('a full row and a full column both stay a single rectangle', () => {
  const row = Array.from({ length: 6 }, (_, col) => ({ col, row: 0 }));
  const column = Array.from({ length: 5 }, (_, row) => ({ col: 2, row }));
  for (const [list, width, height] of [[row, W * 6, H], [column, W, H * 5]]) {
    const loops = trace(list);
    assert.equal(loops.length, 1);
    assert.equal(loops[0].length, 4);
    assert.equal(area(loops), width * height);
  }
});

test('path data closes every loop and rounds corners when asked', () => {
  const loops = trace(cells([0, 0], [1, 0], [0, 1]));
  const sharp = outlinePathData(loops);
  assert.equal((sharp.match(/M/g) || []).length, 1);
  assert.equal((sharp.match(/Z/g) || []).length, 1);
  assert.equal((sharp.match(/Q/g) || []).length, 0);
  const rounded = outlinePathData(loops, 4);
  assert.equal((rounded.match(/Q/g) || []).length, 6);
  assert.ok(rounded.endsWith('Z'));
  assert.ok(rounded.startsWith('M'));
});

test('empty selection produces no outline', () => {
  assert.deepEqual(trace([]), []);
  assert.equal(outlinePathData([]), '');
});

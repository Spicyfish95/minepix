import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GRID_KEY, DEFAULT_GRID, validateGrid, loadGrid, saveGrid, gridLines, snapToGrid} from '../src/grid-settings.js';

const store = (value = null) => {
  const data = new Map(value === null ? [] : [[GRID_KEY, value]]);
  return {getItem: key => data.get(key) ?? null, setItem: (key, entry) => {data.set(key, entry);}};
};

test('默认网格与 Aseprite 一致：16×16、无偏移、默认不显示', () => {
  assert.deepEqual(DEFAULT_GRID, {x: 0, y: 0, w: 16, h: 16, visible: false});
  assert.deepEqual(validateGrid(), {...DEFAULT_GRID});
  assert.deepEqual(validateGrid({w: 8}), {...DEFAULT_GRID, w: 8});
});

test('网格参数校验拒绝非整数与非法范围', () => {
  assert.throws(() => validateGrid({w: 0}), /网格宽高需大于 0/);
  assert.throws(() => validateGrid({h: 0}), /网格宽高需大于 0/);
  assert.throws(() => validateGrid({x: 1.5}), /网格偏移与宽高需为整数/);
  assert.throws(() => validateGrid({y: 4097}), /网格偏移需在 ±4096 以内/);
  assert.deepEqual(validateGrid({x: -4, y: 3, w: 2, h: 5, visible: true}), {x: -4, y: 3, w: 2, h: 5, visible: true});
});

test('网格线从偏移处开始按宽高铺满画布，偏移不回绕', () => {
  assert.deepEqual(gridLines({x: 0, y: 0, w: 4, h: 4}, 8, 8), {xs: [0, 4], ys: [0, 4]});
  assert.deepEqual(gridLines({x: 2, y: 1, w: 4, h: 3}, 10, 10), {xs: [2, 6], ys: [1, 4, 7]});
  assert.deepEqual(gridLines({x: -3, y: 0, w: 4, h: 4}, 6, 6), {xs: [-3, 1, 5], ys: [0, 4]});
  assert.deepEqual(gridLines({x: 0, y: 0, w: 100, h: 100}, 8, 8), {xs: [0], ys: [0]});
});

test('吸附到最近网格线', () => {
  assert.deepEqual(snapToGrid({x: 0, y: 0, w: 4, h: 4}, 5, 6), {x: 4, y: 8});
  assert.deepEqual(snapToGrid({x: 2, y: 2, w: 4, h: 4}, 5, 3), {x: 6, y: 2});
  assert.deepEqual(snapToGrid({x: 0, y: 0, w: 3, h: 3}, 1, 1), {x: 0, y: 0});
});

test('网格设置按本机存储往返，损坏数据回落到默认值', () => {
  const storage = store();
  saveGrid(storage, {x: 3, y: 4, w: 7, h: 9, visible: true});
  assert.deepEqual(loadGrid(storage), {x: 3, y: 4, w: 7, h: 9, visible: true});
  assert.deepEqual(loadGrid(store('{bad')), {...DEFAULT_GRID});
  assert.deepEqual(loadGrid(store('{"w":0}')), {...DEFAULT_GRID});
  assert.deepEqual(loadGrid(store(null)), {...DEFAULT_GRID});
});

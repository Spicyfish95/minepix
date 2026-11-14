import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PREVIEW_SIZE, PREVIEW_SETTINGS_KEY, loadPreviewSize, savePreviewSize, validatePreviewSize} from '../src/preview-settings.js';

const storage = () => {
  const map = new Map();
  return {getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
};

test('地形预览格子数默认 10 × 10，缺省与损坏数据都回落到默认值', () => {
  assert.deepEqual(DEFAULT_PREVIEW_SIZE, {cols: 10, rows: 10});
  const store = storage();
  assert.deepEqual(loadPreviewSize(store), {cols: 10, rows: 10});
  store.setItem(PREVIEW_SETTINGS_KEY, 'not json');
  assert.deepEqual(loadPreviewSize(store), {cols: 10, rows: 10});
  store.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify({cols: 0, rows: 10}));
  assert.deepEqual(loadPreviewSize(store), {cols: 10, rows: 10});
});

test('格子数按整数校验，越界与非数字报错', () => {
  assert.deepEqual(validatePreviewSize({cols: '12.4', rows: 8}), {cols: 12, rows: 8});
  assert.throws(() => validatePreviewSize({cols: 0, rows: 10}), /1 到 64/);
  assert.throws(() => validatePreviewSize({cols: 65, rows: 10}), /1 到 64/);
  assert.throws(() => validatePreviewSize({cols: 'x', rows: 10}), /必须是数字/);
});

test('保存后能读回同一份格子数', () => {
  const store = storage();
  savePreviewSize(store, {cols: 20, rows: 6});
  assert.deepEqual(JSON.parse(store.getItem(PREVIEW_SETTINGS_KEY)), {cols: 20, rows: 6});
  assert.deepEqual(loadPreviewSize(store), {cols: 20, rows: 6});
});

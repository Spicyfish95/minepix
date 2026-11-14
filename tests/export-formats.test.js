import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPORT_FORMATS,exportFormatsFor,encodeBmp,encodeIco,encodeCss,encodeSvg} from '../src/export-formats.js';

test('导出类别严格区分静态与多帧格式',()=>{
  assert.deepEqual(EXPORT_FORMATS.animation,['gif','webp']);
  assert.deepEqual(exportFormatsFor('png'),EXPORT_FORMATS.image);
  assert.deepEqual(exportFormatsFor('gif'),EXPORT_FORMATS.animation);
  assert.deepEqual(exportFormatsFor('sheet'),EXPORT_FORMATS.sheet);
  assert.ok(EXPORT_FORMATS.image.includes('ico'));
  assert.ok(!EXPORT_FORMATS.animation.includes('ico'));
});

test('静态编码器输出对应文件结构',()=>{
  const image={width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,0,0])};
  assert.equal(Buffer.from(encodeBmp(image),'base64').subarray(0,2).toString(),'BM');
  assert.equal(Buffer.from(encodeIco(Buffer.from('png').toString('base64'),2,1),'base64').readUInt16LE(2),1);
  assert.match(encodeCss(image),/box-shadow|background/);
  assert.match(encodeSvg(image),/<rect[^>]+#ff0000/);
});

test('CSS导出透明原点时所有可见像素保留坐标和放大倍数',()=>{
  const image={width:3,height:2,data:new Uint8ClampedArray([
    0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 255,0,0,255, 0,255,0,128
  ])};
  const css=encodeCss(image,2);
  assert.match(css,/background: transparent;/);
  assert.match(css,/box-shadow: 2px 2px rgba\(255,0,0,1\.000\),\n\s+4px 2px rgba\(0,255,0,0\.502\);/);
  assert.match(css,/width: 2px;/);
  assert.match(css,/height: 2px;/);
});

test('CSS导出原点有色与全透明图像',()=>{
  assert.match(encodeCss({width:1,height:1,data:new Uint8ClampedArray([10,20,30,255])}),/background: rgba\(10,20,30,1\.000\);/);
  const empty=encodeCss({width:2,height:1,data:new Uint8ClampedArray(8)});
  assert.match(empty,/background: transparent;/);
  assert.ok(!empty.includes('box-shadow'));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPaletteClipboard,parsePaletteClipboard,insertPaletteColors} from '../src/palette-clipboard.js';

const palette=['#ff0000','#00ff00','#0000ff','#ffffff'];

test('多选复制保留全部颜色且单色仍是单行 HEX',()=>{
  assert.equal(formatPaletteClipboard([palette[0]]),'#FF0000','单色输出保持与旧版一致的单行格式');
  assert.equal(formatPaletteClipboard([palette[0],palette[1],palette[2]]),'#FF0000\n#00FF00\n#0000FF');
});

test('三色复制后粘贴得到三色且顺序正确',()=>{
  const text=formatPaletteClipboard([palette[0],palette[1],palette[2]]);
  const {colors,skipped}=parsePaletteClipboard(text);
  assert.equal(skipped,0);
  assert.deepEqual(colors,['#ff0000','#00ff00','#0000ff']);
  const {palette:next,inserted}=insertPaletteColors(palette,0,colors);
  assert.equal(inserted.length,3);
  assert.deepEqual(next.slice(0,4),['#ff0000','#ff0000','#00ff00','#0000ff'],'三色按顺序插到锚点右侧');
  assert.equal(next.length,7);
});

test('外部单行 HEX 粘贴行为不变',()=>{
  const {colors,skipped}=parsePaletteClipboard('  #abcdef  ');
  assert.deepEqual(colors,['#abcdef']);
  assert.equal(skipped,0);
  const {palette:next,inserted}=insertPaletteColors(palette,1,colors);
  assert.deepEqual(inserted,['#abcdef']);
  assert.equal(next[2],'#abcdef');
});

test('无法解析的行跳过并计入 skipped',()=>{
  const {colors,skipped}=parsePaletteClipboard('#ff0000\nnot-a-color\n#00ff00\n');
  assert.deepEqual(colors,['#ff0000','#00ff00']);
  assert.equal(skipped,1);
});

test('超出 256 色的部分被截断并报告',()=>{
  const full=Array.from({length:255},(_,i)=>'#'+i.toString(16).padStart(6,'0'));
  const {inserted,dropped,palette:next}=insertPaletteColors(full,0,['#ff0000','#00ff00']);
  assert.equal(inserted.length,1);
  assert.equal(dropped,1);
  assert.equal(next.length,256);
});

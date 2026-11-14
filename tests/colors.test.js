import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeColor,rgba,fromRgba,hsv,fromHsv,parsePalette,extractPalette} from '../src/colors.js';
import {colorValue,createDocument,validateDocument} from '../src/model.js';
test('HEX shorthand, alpha and pixel storage retain all RGBA channels',()=>{
  assert.equal(normalizeColor('#AbC8'),'#aabbcc88');assert.deepEqual(rgba('#12345680'),{r:18,g:52,b:86,a:128});assert.equal(colorValue('#12345680'),0x12345680);assert.equal(colorValue('#123456'),0x123456ff);assert.equal(fromRgba({r:18,g:52,b:86,a:128}),'#12345680');assert.throws(()=>normalizeColor('wrong'));
});
test('HSV conversion covers hue wrap, neutral colors and transparency',()=>{
  assert.deepEqual(hsv('#ff0000'),{h:0,s:100,v:100});assert.equal(fromHsv({h:360,s:100,v:100}),'#ff0000');assert.equal(fromHsv({h:120,s:100,v:100,a:128}),'#00ff0080');assert.equal(fromHsv({h:240,s:0,v:0}),'#000000');assert.deepEqual(hsv('#808080'),{h:0,s:0,v:50});
});
test('palette JSON and GPL imports validate content and preserve alpha',()=>{
  assert.deepEqual(parsePalette('{"colors":["#f00","#00ff0080"]}'),['#ff0000','#00ff0080']);assert.deepEqual(parsePalette('GIMP Palette\nName: Test\nColumns: 4\n255 0 0 Red\n0 0 255 Blue'),['#ff0000','#0000ff']);assert.throws(()=>parsePalette('[]'));assert.throws(()=>parsePalette('["invalid"]'));assert.throws(()=>parsePalette('GIMP Palette\n999 0 0'));
  const d=createDocument();d.palette=['#ff000080'];assert.deepEqual(validateDocument(d).palette,d.palette);
});
test('palette extraction ignores invisible pixels and orders by frequency',()=>{
  assert.deepEqual(extractPalette(Uint8ClampedArray.from([255,0,0,255,0,0,0,0,0,0,255,128,255,0,0,255])),['#ff0000','#0000ff80']);assert.deepEqual(extractPalette(new Uint8ClampedArray(8)),[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CANVAS_BACKGROUND,validateCanvasBackground,applyCanvasBackground} from '../src/canvas-background.js';
import {createDocument,validateDocument} from '../src/model.js';

test('背景设置校验尺寸和双颜色',()=>{
  assert.deepEqual(validateCanvasBackground(),DEFAULT_CANVAS_BACKGROUND);
  assert.deepEqual(validateCanvasBackground({size:4,color1:'#ABCDEF',color2:'#010203'}),{size:4,color1:'#abcdef',color2:'#010203'});
  assert.throws(()=>validateCanvasBackground({size:0,color1:'#000000',color2:'#ffffff'}),/1–64/);
});

test('当前项目背景随 pix 项目往返',()=>{
  const document=createDocument(2,2);document.canvasBackground={size:3,color1:'#112233',color2:'#abcdef'};
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(document))).canvasBackground,document.canvasBackground);
});

test('当前项目背景写入独立画布变量',()=>{
  const values=new Map(),element={style:{setProperty:(key,value)=>values.set(key,value)}};
  applyCanvasBackground(element,{size:6,color1:'#112233',color2:'#445566'});
  assert.equal(values.get('--document-checker-size'),'12px');
  assert.equal(values.get('--document-checker-a'),'#112233');
  applyCanvasBackground(element,{size:6,color1:'#112233',color2:'#445566'},3);
  assert.equal(values.get('--document-checker-size'),'36px');
  applyCanvasBackground(element,{size:6,color1:'#112233',color2:'#445566'},.5);
  assert.equal(values.get('--document-checker-size'),'6px');
});

import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addLayer,composite,validateDocument,clone} from '../src/model.js';
import {BLEND_MODES,blendColor} from '../src/compositor.js';
import {FrameCache} from '../src/renderer.js';
import {mergeVisible,flattenSprite,mergeDown} from '../src/layer-commands.js';
import {readAseprite,writeAseprite} from './helpers/aseprite.js';
function sample(){const d=createDocument(2,1);d.frames[0].cels[0]=[0x804020ff,0x2080c080];addLayer(d,0);d.frames[0].cels[1]=[0x4080c0ff,0xc0604080];return d;}
test('multiply、screen、addition、subtract、divide 的独立黄金值',()=>{assert.deepEqual(blendColor([.2,.5,.8],[.5,.4,.2],'multiply'),[.1,.2,.16000000000000003]);for(const [mode,value]of [['screen',[.6,.7,.84]],['addition',[.7,.9,1]],['subtract',[0,.1,.6]],['divide',[.4,1,1]]])blendColor([.2,.5,.8],[.5,.4,.2],mode).forEach((v,i)=>assert.ok(Math.abs(v-value[i])<1e-8));});
test('非分离模式保持目标亮度 / 饱和度且输出不越界',()=>{const b=[.2,.5,.8],s=[.8,.3,.1],lum=c=>.3*c[0]+.59*c[1]+.11*c[2];for(const mode of ['hue','saturation','color']){const c=blendColor(b,s,mode);assert.ok(Math.abs(lum(c)-lum(b))<1e-8);assert.ok(c.every(v=>v>=-1e-8&&v<=1+1e-8));}assert.ok(Math.abs(lum(blendColor(b,s,'luminosity'))-lum(s))<1e-8);});
test('全部 19 种模式的局部缓存、项目迁移与 ASE 字段往返',async()=>{for(const [mode]of BLEND_MODES){const d=sample();if(mode!=='normal')d.layers[1].blendMode=mode;const normalized=validateDocument(JSON.parse(JSON.stringify(d)));assert.equal(normalized.layers[1].blendMode||'normal',mode);if(mode!=='normal')assert.ok(normalized.requiredFeatures.includes('layer-blending'));const read=await readAseprite(await writeAseprite(normalized));assert.equal(read.doc.layers[1].blendMode||'normal',mode);assert.deepEqual(composite(read.doc,0),composite(normalized,0));const cache=new FrameCache();cache.get(d,0);d.frames[0].cels[1][0]=0xff112280;cache.invalidate(0,{x:0,y:0,w:1,h:1});assert.deepEqual(cache.get(d,0).rgba,composite(d,0));}});
test('合并可见和扁平化保留混合输出，未知模式不可静默丢失',()=>{for(const [mode]of BLEND_MODES){const d=sample();d.layers[1].blendMode=mode;const expected=composite(d,0),copy=clone(d);mergeVisible(d);flattenSprite(copy);assert.deepEqual(composite(d,0),expected);assert.deepEqual(composite(copy,0),expected);}const d=sample();d.layers[1].blendMode='unknown';assert.throws(()=>validateDocument(d),/混合/);d.layers[1].blendMode='multiply';assert.throws(()=>mergeDown(d,1),/合并可见/);});

test('半透明原版 Aseprite 1.3.18.6 黄金像素，全部模式误差至多1级',async()=>{const golden=JSON.parse(await fs.readFile(new URL('./fixtures/blend-golden.json',import.meta.url),'utf8'));for(const entry of golden.results){const d=sample();d.layers[1].blendMode=entry.mode;const actual=composite(d,0);assert.ok(actual.every((v,i)=>Math.abs(v-entry.actual[i])<=1),entry.mode);}});

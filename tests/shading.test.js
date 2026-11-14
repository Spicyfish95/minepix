import test from 'node:test';
import assert from 'node:assert/strict';
import {createShading} from '../src/shading.js';
import {createDocument} from '../src/model.js';
import {stampBrush,paintFill} from '../src/brush-engine.js';
const palette=['#112233ff','#445566ff','#778899ff','#445566ff'];
test('左右键按选择的色板顺序移动且端点不循环',()=>{const left=createShading(palette,[2,0,1]),right=createShading(palette,[0,1,2],1);assert.equal(left(0x445566ff).color,0x112233ff);assert.equal(right(0x445566ff).color,0x778899ff);assert.equal(left(0x112233ff).color,0x112233ff);assert.equal(right(0x778899ff).color,0x778899ff);assert.equal(left(0xabcdef80).color,0xabcdef80);assert.equal(left(0).color,0);assert.equal(left(0x44556680).color,0x11223380);});
test('索引按照槽位匹配重复色，未选中索引保持不变',()=>{const shade=createShading(palette,[0,1,2,3]);assert.deepEqual(shade(0x445566ff,3),{color:0x778899ff,index:2});assert.deepEqual(createShading(palette,[0,1,2])(0x445566ff,3),{color:0x445566ff,index:3});});
test('笔刷和填充基于原图一次移动，尊重选区、零透明度与擦除',()=>{const d=createDocument(3,1),p=[0x445566ff,0x445566ff,0x445566ff],base=p.slice(),shade=createShading(palette,[0,1,2]),options={size:1,ink:'shading',opacity:1,base,shade:v=>shade(v).color};stampBrush(d,p,0,0,0,options);stampBrush(d,p,0,0,0,options);assert.equal(p[0],0x112233ff);stampBrush(d,p,1,0,0,{...options,opacity:0});assert.equal(p[1],base[1]);paintFill(d,p,1,0,0,options,{x:1,y:0,w:1,h:1});assert.equal(p[1],0x112233ff);assert.equal(p[2],base[2]);stampBrush(d,p,2,0,0,{...options,erasing:true});assert.equal(p[2],0);});

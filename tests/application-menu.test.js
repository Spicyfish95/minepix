import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {applicationMenu} from '../src/application-menu.js';

test('文件菜单使用项目措辞且保留关闭与重开命令',()=>{
 const file=applicationMenu(()=>{})[0];
 const projects=file.submenu.find(item=>item.label==='项目');
 assert.deepEqual(projects.submenu.map(item=>[item.id,item.label]),[
  ['close-document','关闭当前项目'],['reopen-document','重开关闭的项目']
 ]);
});

test('导出菜单的静态图像项使用单一图像措辞',()=>{
 const file=applicationMenu(()=>{})[0];
 const exports=file.submenu.find(item=>item.label==='导出');
 assert.deepEqual(exports.submenu.map(item=>[item.id,item.label]),[
  ['png','单一图像…'],['normal-map','法线贴图…'],['sheet-pair','精灵表 / 引擎图集…'],['gif','GIF动画…'],['sequence','PNG序列…'],['export-aseprite','Aseprite文件…']
 ]);
});

test('选区菜单包含颜色范围和边界扩展收缩命令',()=>{
 const menu=applicationMenu(()=>{}).find(item=>item.label==='选区'),select=menu.submenu.find(item=>item.label==='选择'),modify=menu.submenu.find(item=>item.label==='修改').submenu.find(item=>item.label==='修改选区');
 assert.equal(select.submenu.find(item=>item.id==='select-color-range').label,'按颜色范围…');assert.deepEqual(modify.submenu.map(item=>item.id),['border-selection','expand-selection','contract-selection']);
});

test('help menu provides guide, updates and about',()=>{
 const help=applicationMenu(()=>{}).find(item=>item.label==='帮助');
 assert.deepEqual(help.submenu.map(item=>item.id),['help-guide','check-updates','about']);
});


test('正式菜单不包含开发工具且开发环境显式启用',()=>{
 const edit=options=>applicationMenu(()=>{},options).find(item=>item.label==='编辑').submenu;
 assert.equal(edit().some(item=>item.role==='toggleDevTools'),false);
 assert.equal(edit({development:false}).some(item=>item.label==='开发工具'),false);
 assert.equal(edit({development:true}).at(-1).role,'toggleDevTools');
 assert.notEqual(edit().at(-1).type,'separator');
});

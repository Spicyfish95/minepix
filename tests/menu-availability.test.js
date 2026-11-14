import {test} from 'node:test';
import assert from 'node:assert/strict';
import {menuAvailability} from '../src/menu-availability.js';

const state={hasDocument:false,canEdit:true,canEditPixels:true,hasSelection:false,hasPreviousSelection:false,hasCelRange:false,hasCelClipboard:false,hasClipboard:false,hasClosed:false,canUndo:false,canRedo:false,frameCount:1,frameIndex:0,layerCount:1,layerIndex:0,hasTags:false,hasSavedPath:false};

test('空白工作区禁用项目命令，保留新建与设置入口',()=>{
 const menu=menuAvailability(state);
 for(const id of ['save','png','normal-map','close-document','undo','add-layer','delete-frame','fit','onion'])assert.equal(menu[id],false,id);
 assert.equal(menu['reopen-document'],false);
 assert.equal(menu.settings,undefined);
});

test('随项目、选区、历史、帧和剪贴板更新菜单可用性',()=>{
 const base=menuAvailability({...state,hasDocument:true,canUndo:true,frameCount:2,hasSavedPath:true});
 assert.equal(base['normal-map'],true);assert.equal(base.save,true);assert.equal(base.undo,true);assert.equal(base.redo,false);
 for(const id of ['crop-selection','transform-selection','paste','delete-layer','frame-left','paste-cels'])assert.equal(base[id],false,id);
 const ready=menuAvailability({...state,hasDocument:true,canUndo:true,canRedo:true,hasSelection:true,hasPreviousSelection:true,hasCelRange:true,hasCelClipboard:true,hasClipboard:true,hasClosed:true,frameCount:3,frameIndex:1,layerCount:2,layerIndex:1,hasTags:true,hasSavedPath:true});
 for(const id of ['crop-selection','transform-selection','paste','delete-layer','frame-left','frame-right','paste-cels','reopen-document','recover','edit-tag'])assert.equal(ready[id],true,id);
 assert.equal(menuAvailability({...state,hasDocument:true,canEdit:false})['add-layer'],false);
});

test('颜色范围需像素上下文，修改选区需已有选区',()=>{
 const empty=menuAvailability(state),ready=menuAvailability({...state,hasDocument:true,hasSelection:true});
 for(const id of ['select-color-range','expand-selection','contract-selection','border-selection']){assert.equal(empty[id],false);assert.equal(ready[id],true);}
 assert.equal(menuAvailability({...state,hasDocument:true,canEditPixels:false})['select-color-range'],false);assert.equal(menuAvailability({...state,hasDocument:true})['expand-selection'],false);
});

test('capture brush requires an editable pixel selection',()=>{
 assert.equal(menuAvailability({...state,hasDocument:true})['capture-brush'],false);
 assert.equal(menuAvailability({...state,hasDocument:true,hasSelection:true})['capture-brush'],true);
 assert.equal(menuAvailability({...state,hasDocument:true,hasSelection:true,canEditPixels:false})['capture-brush'],false);
});


test('图集栏目只在当前项目含图集图层时可用',()=>{
 for(const value of [{hasDocument:false,hasTileset:false},{hasDocument:false,hasTileset:true},{hasDocument:true,hasTileset:false},{hasDocument:true,hasTileset:true}]){
  const result=menuAvailability({...state,...value});
  for(const id of ['panel-tileset','panel-terrain-preview'])assert.equal(result[id],value.hasDocument&&value.hasTileset);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultKeymap,validateKeymap,normalizeBinding,resolveShortcut,loadKeymap} from '../src/keymap-manager.js';
test('默认键位匹配及自定义替换，不回落到旧工具键',()=>{const k=defaultKeymap();k.bindings['tool:pencil']=['J'];assert.deepEqual(resolveShortcut({key:'j',code:'KeyJ'},k),{action:'tool',tool:'pencil'});assert.equal(resolveShortcut({key:'b',code:'KeyB'},k),null);assert.equal(resolveShortcut({key:' ',code:'Space'},k).action,'space');});
test('规范化、冲突和保留按键验证',()=>{assert.equal(normalizeBinding('shift+ctrl+j'),'Ctrl+Shift+J');assert.throws(()=>normalizeBinding('Space'));const k=defaultKeymap();k.bindings['tool:pencil']=['E'];assert.throws(()=>validateKeymap(k),/冲突/);});
test('导入导出、损坏存储和输入法隔离',()=>{const k=defaultKeymap();assert.deepEqual(validateKeymap(JSON.parse(JSON.stringify(k))),k);assert.deepEqual(loadKeymap({getItem:()=>'{bad'}),k);assert.equal(resolveShortcut({key:'b',code:'KeyB',isComposing:true},k),null);});
test('默认减号与等号调整笔刷，旧默认键位升级后保留自定义选择',()=>{
 const keymap=defaultKeymap();assert.deepEqual(resolveShortcut({key:'-',code:'Minus'},keymap),{action:'brush',delta:-1});assert.deepEqual(resolveShortcut({key:'=',code:'Equal'},keymap),{action:'brush',delta:1});
 assert.equal(resolveShortcut({key:'=',code:'Equal',ctrlKey:true},keymap).action,'zoom-in');
 const old=structuredClone(keymap);Object.assign(old.bindings,{'zoom-in':['Equal'],'zoom-out':['Minus'],'brush-smaller':['BracketLeft'],'brush-larger':['BracketRight']});
 assert.deepEqual(loadKeymap({getItem:()=>JSON.stringify(old)}).bindings['brush-smaller'],['Minus']);
 old.bindings['brush-smaller']=['J'];assert.deepEqual(loadKeymap({getItem:()=>JSON.stringify(old)}).bindings['brush-smaller'],['J']);
});
import {asepriteKeymap,selectionOperationFor} from '../src/keymap-manager.js';
test('Ctrl+T 打开选区缩放旋转且与文档快捷键不冲突',()=>{const k=defaultKeymap();assert.deepEqual(k.bindings['transform-selection'],['Ctrl+T']);assert.deepEqual(resolveShortcut({key:'t',code:'KeyT',ctrlKey:true},k),{action:'transform-selection'});assert.deepEqual(resolveShortcut({key:'t',code:'KeyT',ctrlKey:true,shiftKey:true},k),{action:'reopen-document'});assert.equal(resolveShortcut({key:'t',code:'KeyT'},k).tool,'text');assert.deepEqual(asepriteKeymap().bindings['transform-selection'],['Ctrl+T']);});
test('默认预设采用当前工作快捷键',()=>{
  const k=defaultKeymap();
  assert.deepEqual(k.bindings['replace-color'],['Shift+R']);
  assert.deepEqual(k.bindings['selection-lasso'],['Q']);
  assert.deepEqual(k.bindings['selection-wand'],['W']);
  assert.deepEqual(k.bindings['invert-selection'],['Ctrl+Shift+I']);
  assert.deepEqual(resolveShortcut({key:'R',code:'KeyR',shiftKey:true},k),{action:'replace-color'});
  assert.deepEqual(resolveShortcut({key:'q',code:'KeyQ'},k),{action:'selection-lasso'});
  assert.deepEqual(resolveShortcut({key:'w',code:'KeyW'},k),{action:'selection-wand'});
  assert.deepEqual(resolveShortcut({key:'I',code:'KeyI',ctrlKey:true,shiftKey:true},k),{action:'invert-selection'});
  assert.deepEqual(resolveShortcut({key:'r',code:'KeyR'},k),{action:'tool',tool:'blur'});
});
test('Aseprite 常用子集无冲突并保持精确选区修饰键',()=>{const keys=asepriteKeymap();assert.equal(resolveShortcut({key:'N',code:'KeyN',altKey:true},keys).action,'duplicate-frame');assert.equal(resolveShortcut({key:'U',code:'KeyU',shiftKey:true},keys).tool,'ellipse');assert.equal(selectionOperationFor('aseprite',{shiftKey:true}),'add');assert.equal(selectionOperationFor('aseprite',{shiftKey:true,altKey:true}),'subtract');assert.equal(selectionOperationFor('aseprite',{shiftKey:true,ctrlKey:true}),'intersect');assert.equal(selectionOperationFor('studio',{shiftKey:true},'replace'),'replace');});
import {holdActionFor,releasedHoldActionFor,HOLD_ACTIONS,DEFAULT_BINDINGS} from '../src/keymap-manager.js';
test('按住动作与同键全局工具键共存且不占用单击解析',()=>{
  const k=defaultKeymap();
  assert.deepEqual(HOLD_ACTIONS,['grid-select']);
  assert.deepEqual(DEFAULT_BINDINGS['grid-select'],['G']);
  assert.equal(resolveShortcut({key:'g',code:'KeyG'},k).tool,'fill');
  assert.equal(holdActionFor({key:'g',code:'KeyG'},k),'grid-select');
  assert.equal(holdActionFor({key:'G',code:'KeyG',shiftKey:true},k),'grid-select');
  assert.equal(holdActionFor({key:'g',code:'KeyG',ctrlKey:true},k),null);
  const custom=defaultKeymap();custom.bindings['grid-select']=['Alt+H'];
  assert.equal(holdActionFor({key:'h',code:'KeyH',altKey:true},custom),'grid-select');
  assert.equal(holdActionFor({key:'g',code:'KeyG'},custom),null);
});

test('显式 Shift 按住绑定只匹配 Shift，普通绑定允许叠加 Shift',()=>{
 const k=defaultKeymap();k.bindings['grid-select']=['Shift+J'];k.bindings.save=['J'];
 assert.doesNotThrow(()=>validateKeymap(k));
 assert.equal(holdActionFor({key:'j',code:'KeyJ'},k),null);
 assert.equal(resolveShortcut({key:'j',code:'KeyJ'},k).action,'save');
 assert.equal(holdActionFor({key:'J',code:'KeyJ',shiftKey:true},k),'grid-select');
 k.bindings['grid-select']=['Ctrl+Alt+Shift+J'];
 assert.equal(holdActionFor({key:'j',code:'KeyJ',ctrlKey:true,altKey:true},k),null);
 assert.equal(holdActionFor({key:'J',code:'KeyJ',ctrlKey:true,altKey:true,shiftKey:true},k),'grid-select');
});
test('按住动作按实际 Shift 匹配范围检测冲突，保留同键工具切换',()=>{
 for(const prefix of ['', 'Ctrl+', 'Alt+', 'Ctrl+Alt+']){
  const k=defaultKeymap();k.bindings['grid-select']=[prefix+'J'];k.bindings.save=[prefix+'Shift+J'];
  assert.throws(()=>validateKeymap(k),/冲突/);
  k.bindings.save=['Ctrl+S'];k.bindings['tool:pencil']=[prefix+'Shift+J'];
  assert.doesNotThrow(()=>validateKeymap(k));
 }
 const duplicate=defaultKeymap();duplicate.bindings['grid-select']=['J','Shift+J'];
 assert.throws(()=>validateKeymap(duplicate),/冲突/);
 assert.doesNotThrow(()=>validateKeymap(defaultKeymap()));assert.doesNotThrow(()=>validateKeymap(asepriteKeymap()));
});
test('按住主键释放不依赖当前修饰键，其他主键不触发释放',()=>{
 for(const binding of ['J','Alt+J','Ctrl+J','Shift+J','Ctrl+Alt+Shift+J']){
  const k=defaultKeymap();k.bindings['grid-select']=[binding];
  assert.equal(releasedHoldActionFor({key:'j',code:'KeyJ'},k),'grid-select');
  assert.equal(releasedHoldActionFor({key:'J',code:'KeyJ',ctrlKey:true,altKey:true,shiftKey:true},k),'grid-select');
  assert.equal(releasedHoldActionFor({key:'h',code:'KeyH'},k),null);
 }
});

test('新工具升级保留已有自定义冲突键，并迁移旧 Aseprite 切片键',()=>{
 const old=defaultKeymap();old.bindings['grid-select']=[];delete old.bindings['tool:gradient'];delete old.bindings['tool:slice'];old.bindings['replace-color']=['Shift+G'];const storage={getItem:()=>JSON.stringify(old)};const loaded=loadKeymap(storage);assert.deepEqual(loaded.bindings['replace-color'],['Shift+G']);assert.deepEqual(loaded.bindings['tool:gradient'],[]);
 const legacy=asepriteKeymap();delete legacy.bindings['tool:slice'];legacy.bindings.slices=['Shift+C'];const migrated=loadKeymap({getItem:()=>JSON.stringify(legacy)});assert.deepEqual(migrated.bindings['tool:slice'],['Shift+C']);assert.deepEqual(migrated.bindings.slices,[]);
});

test('capture brush defaults to Ctrl+B and preserves user conflicts on migration',()=>{
 assert.deepEqual(resolveShortcut({key:'b',code:'KeyB',ctrlKey:true},defaultKeymap()),{action:'capture-brush'});
 const old=defaultKeymap();delete old.bindings['capture-brush'];old.bindings.copy=['Ctrl+B'];
 const migrated=loadKeymap({getItem:()=>JSON.stringify(old)});
 assert.deepEqual(migrated.bindings.copy,['Ctrl+B']);assert.deepEqual(migrated.bindings['capture-brush'],[]);
});

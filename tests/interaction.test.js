import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcut, pointerMode, constrainPoint, cursorStyle, isTextTarget, selectionCursor, SELECTION_KINDS } from '../src/interaction.js';
const mode=(state={})=>pointerMode({tool:'pencil',...state});
test('temporary tools have deterministic priority and restore without changing base tool',()=>{
  assert.equal(mode({alt:true}).tool,'eyedropper');
  assert.equal(mode({alt:true,space:true}).tool,'hand');
  assert.equal(mode({alt:true,button:1}).tool,'hand');
  assert.equal(mode({alt:true,gesture:{kind:'rect',color:123}}).tool,'rect');
  assert.equal(mode({gesture:{kind:'pan'}}).cursor,'grabbing');
  assert.equal(mode().tool,'pencil');
});
test('lock, visibility, playback and busy state block edits while allowing navigation',()=>{
  for(const state of [{locked:true},{visible:false},{playing:true}])assert.equal(mode(state).cursor,'not-allowed');
  assert.equal(mode({locked:true,tool:'select'}).blocked,undefined);
  assert.equal(mode({locked:true,alt:true}).tool,'eyedropper');
  assert.equal(mode({playing:true,space:true}).cursor,'grab');
  assert.equal(mode({busy:true,space:true}).cursor,'wait');
});
test('zoom Alt shrinks, right drawing uses eraser cursor, active strokes retain erasing',()=>{
  assert.equal(mode({tool:'zoom',alt:true}).cursor,'zoom-out');
  assert.equal(mode({button:2}).cursor,'eraser');
  assert.equal(mode({gesture:{kind:'line',color:0}}).cursor,'eraser');
  assert.equal(mode({tool:'move',button:2}).cursor,'move');
  assert.equal(mode({tool:'eraser'}).brush,true);
});
test('physical key codes work with alternate keyboard layouts but composition is ignored',()=>{
  assert.deepEqual(shortcut({key:'β',code:'KeyB'}),{action:'tool',tool:'pencil'});
  assert.equal(shortcut({key:'b',code:'KeyB',isComposing:true}),null);
  assert.equal(shortcut({key:'b',code:'KeyB',keyCode:229}),null);
  assert.equal(shortcut({key:'b',code:'KeyB',altKey:true}),null);
  assert.equal(shortcut({key:'b',code:'KeyB',ctrlKey:true}),null);
});
test('modifier shortcuts do not fall through into tool switches or file commands',()=>{
  assert.deepEqual(shortcut({key:'n',ctrlKey:true,shiftKey:true}),{action:'add-layer'});
  assert.deepEqual(shortcut({key:'n',shiftKey:true}),{action:'add-frame'});
  assert.deepEqual(shortcut({key:'h',shiftKey:true}),{action:'flip-x'});
  assert.deepEqual(shortcut({key:'z',metaKey:true,shiftKey:true}),{action:'redo'});
  assert.deepEqual(shortcut({key:'s',ctrlKey:true,shiftKey:true}),{action:'save-as'});
  assert.equal(shortcut({key:'s',ctrlKey:true,altKey:true}),null);
});
test('shape constraints preserve diagonal angles and squares at canvas edges',()=>{
  assert.deepEqual(constrainPoint('rect',{x:2,y:2},{x:5,y:11},true,16,16),{x:11,y:11});
  assert.deepEqual(constrainPoint('ellipse',{x:13,y:2},{x:14,y:12},true,16,16),{x:15,y:4});
  assert.deepEqual(constrainPoint('line',{x:14,y:2},{x:15,y:4},true,16,16),{x:15,y:3});
  assert.deepEqual(constrainPoint('move',{x:3,y:3},{x:5,y:9},true,16,16),{x:3,y:9});
});
test('each drawing tool uses a grouped painting cursor with the drawing point centered',()=>{
  const kinds=['pencil','eraser','line','curve','rect','ellipse','contour','polygon','blur','select','select-rect','select-ellipse','select-lasso','select-polygon','select-wand','select-grid','move'];
  const cursors=kinds.map(cursorStyle);
  assert(cursors.every(c=>c.startsWith('url("data:image/svg+xml,')&&(c.endsWith('crosshair')||c.endsWith('move'))));
  assert.equal(cursorStyle('line'),cursorStyle('curve'));
  assert.equal(cursorStyle('rect'),cursorStyle('ellipse'));
  assert.equal(cursorStyle('contour'),cursorStyle('polygon'));
  assert.equal(new Set(['select','select-rect','select-ellipse','select-lasso','select-polygon','select-wand','select-grid'].map(cursorStyle)).size,1);
  const groups=['pencil','eraser','line','rect','contour','blur','text','move'].map(cursorStyle);
  assert.equal(new Set(groups).size,groups.length);
  const decoded=decodeURIComponent(cursorStyle('select-lasso'));
  assert(decoded.includes('cx="10" cy="10" r="1.2"'));
  assert.equal(cursorStyle('grabbing'),'grabbing');
});
test('text tool uses a plain I-beam cursor without crosshair',()=>{
  assert.equal(cursorStyle('text'),'text');
  assert.equal(pointerMode({tool:'text'}).cursor,'text');
});
test('fill and eyedropper keep the original tool icon cursors',()=>{
  const fill=cursorStyle('fill'),eyedropper=cursorStyle('eyedropper');
  assert(fill.endsWith('9 9, crosshair'),fill);
  assert(eyedropper.endsWith('3 17, crosshair'),eyedropper);
  for(const value of [fill,eyedropper]){
    const decoded=decodeURIComponent(value);
    assert(decoded.includes('viewBox="-1 -1 26 26"'));
    assert(decoded.includes('stroke-width="3"')&&decoded.includes('stroke-width="1.6"'));
    assert(!decoded.includes('cx="10" cy="10" r="2.3"'));
  }
  assert.notEqual(fill,eyedropper);
  assert.notEqual(fill,cursorStyle('pencil'));
});
test('each selection mode gets its own cursor and still yields to the temporary eyedropper',()=>{
  const cursors=SELECTION_KINDS.map(kind=>pointerMode({tool:'select',selectionKind:kind}).cursor);
  assert.deepEqual(cursors,SELECTION_KINDS.map(kind=>'select-'+kind));
  const drawn=cursors.map(cursorStyle);
  assert.equal(new Set(drawn).size,1);
  assert(drawn.every(c=>c.startsWith('url("data:image/svg+xml,')&&c.endsWith('crosshair')));
  assert.equal(pointerMode({tool:'select',selectionKind:'polygon',alt:true}).tool,'eyedropper');
  assert.equal(pointerMode({tool:'select',gesture:{kind:'select',selectionKind:'lasso'}}).cursor,'select-lasso');
  assert.equal(selectionCursor('wand'),'select-wand');
  assert.equal(selectionCursor('unknown'),'select');
});
test('text and contenteditable controls keep normal text shortcuts',()=>{
  assert.equal(isTextTarget(null),false);
  assert.equal(isTextTarget({isContentEditable:true}),true);
  assert.equal(isTextTarget({closest:()=>({})}),true);
  assert.equal(isTextTarget({closest:()=>null}),false);
});

import {TOOLS,TOOL_GROUPS} from '../src/interaction.js';
test('selection tools share one slot and have distinct icons',()=>{
 const group=TOOL_GROUPS.find(group=>group.includes('select'));
 assert.deepEqual(group,['select','selection-ellipse','selection-lasso','selection-polygon','selection-wand']);
 assert.equal(new Set(group.map(id=>TOOLS.find(tool=>tool[0]===id)[1])).size,5);
});

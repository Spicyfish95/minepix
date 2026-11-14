import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_INPUT,validateInput,pointerTool,wheelIntent} from '../src/input-preferences.js';
test('左右键映射、滚轮动作及 Ctrl 覆盖',()=>{const p=validateInput({...DEFAULT_INPUT,left:'pan',right:'eyedropper',wheel:'frames',invert:true});assert.equal(pointerTool('pencil',p,0),'hand');assert.equal(pointerTool('pencil',p,2),'eyedropper');assert.equal(wheelIntent({deltaY:10},p).delta,-10);assert.equal(wheelIntent({deltaY:10,ctrlKey:true},p).action,'zoom');});
test('速度与动作边界验证',()=>{assert.throws(()=>validateInput({...DEFAULT_INPUT,zoomStep:1}));assert.throws(()=>validateInput({...DEFAULT_INPUT,right:'unknown'}));assert.equal(wheelIntent({deltaY:1,shiftKey:true},DEFAULT_INPUT).horizontal,true);});

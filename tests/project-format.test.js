import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,validateDocument,colorValue} from '../src/model.js';
import {normalizeProject} from '../src/project-format.js';
test('内存模型拒绝未知版本',()=>assert.throws(()=>validateDocument({...createDocument(1,1),version:1}),/版本/));
test('v2 往返与未知版本/必需特性拒绝',()=>{const d=createDocument(1,1);assert.deepEqual(validateDocument(d),d);assert.throws(()=>normalizeProject({...d,version:3}),/版本/);assert.throws(()=>normalizeProject({...d,requiredFeatures:['unknown']}),/必需/);});

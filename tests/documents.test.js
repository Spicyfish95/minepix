import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentStore} from '../src/document-manager.js';
test('标签保存、切换、替换和关闭保持各自状态',()=>{const store=new DocumentStore();store.add({documentId:'a',doc:{name:'A'},undo:[1]});store.add({documentId:'b',doc:{name:'B'},undo:[]});assert.equal(store.get('a').undo.length,1);store.save({documentId:'b',doc:{name:'B2'},undo:[2]});assert.equal(store.get('a').doc.name,'A');assert.equal(store.remove('b').documentId,'a');store.replace({documentId:'c',doc:{name:'C'}});assert.equal(store.items.length,1);assert.equal(store.active,'c');assert.equal(store.remove('c'),null);});

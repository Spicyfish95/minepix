import {test} from 'node:test';
import assert from 'node:assert/strict';
import {systemLocale} from '../src/i18n.js';

test('系统中文使用中文，其余不支持语言默认英语',()=>{
 assert.equal(systemLocale('zh-CN'),'zh');
 assert.equal(systemLocale('zh-Hans-HK'),'zh');
 assert.equal(systemLocale('zh-HK'),'en');
 assert.equal(systemLocale('zh-TW'),'en');
 assert.equal(systemLocale('en-US'),'en');
 assert.equal(systemLocale('ja-JP'),'en');
 assert.equal(systemLocale('fr-FR'),'en');
});

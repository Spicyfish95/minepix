import test from 'node:test';
import assert from 'node:assert/strict';
import {validateImeAudit} from '../src/ime-audit.js';
const segment=data=>[{type:'compositionstart',trusted:true},{type:'input',trusted:true,composing:true,data},{type:'compositionend',trusted:false,data}];
test('实机IME允许分词确认，依据真实start/input与完整end序列',()=>{for(const events of [segment('像素测试'),[...segment('像素'),...segment('测试')]])assert.equal(validateImeAudit({value:'像素测试',events}).ok,true);});
test('实机IME拒绝粘贴、未结束组字、未受信输入与错误文本',()=>{const good={value:'像素测试',events:segment('像素测试')};assert.equal(validateImeAudit({...good,events:[]}).ok,false);assert.equal(validateImeAudit({...good,events:good.events.slice(0,2)}).ok,false);assert.equal(validateImeAudit({...good,events:good.events.map(e=>({...e,trusted:false}))}).ok,false);assert.equal(validateImeAudit({...good,value:'测试'}).ok,false);});

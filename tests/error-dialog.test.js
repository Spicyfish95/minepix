import test from 'node:test';
import assert from 'node:assert/strict';
import {errorText,installErrorDialog} from '../src/error-dialog.js';

test('错误弹窗保留错误正文并安全显示 HTML 字符',()=>{
 assert.equal(errorText(new Error('<img onerror=bad>')),'<img onerror=bad>');
 assert.equal(errorText('失败'),'失败');assert.equal(errorText(null),'未知错误');
});

test('全局异常、拒绝及显式操作错误显示弹窗，重复错误更新正文',()=>{
 const listeners={},detail={},reported=[];let shown=0;
 const dialog={setAttribute(){},showModal(){this.open=true;shown++;}};
 const document={body:{append(){}},createElement:()=>dialog,getElementById:()=>detail};
 const report=installErrorDialog({addEventListener:(name,fn)=>listeners[name]=fn},document,text=>reported.push(text));
 report(new Error('打开失败'));assert.equal(detail.textContent,'打开失败');assert.equal(shown,1);
 listeners.error({error:new Error('绘画失败')});assert.equal(shown,1);assert.equal(detail.textContent,'绘画失败');
 dialog.open=false;let prevented=false;
 listeners.unhandledrejection({reason:'异步失败',preventDefault(){prevented=true;}});
 assert.equal(shown,2);assert.ok(prevented);assert.deepEqual(reported,['打开失败','绘画失败','异步失败']);
});

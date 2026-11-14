import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPreview,zoomPreview,panPreview,previewMarkup} from '../src/import-preview.js';
import {repairFields} from '../src/image-import.js';

test('像素处理高级设置按用途分组，加载占位覆盖同一预览区域',()=>{
 const fields=repairFields();
 for(const name of ['处理方式','网格与尺寸','采样与轮廓','输出与颜色'])assert.ok(fields.includes(`<legend>${name}</legend>`));
 assert.equal((fields.match(/<fieldset/g)||[]).length,4);
 assert.ok(previewMarkup.includes('id="import-preview-loading"'));
});

test('适应内容填满可用空间，保持比例并居中',()=>{
 const view=fitPreview({width:800,height:400},{width:100,height:100});assert.equal(view.scale,3.76);assert.equal(view.x,212);assert.equal(view.y,12);
 const wide=fitPreview({width:800,height:400},{width:1000,height:100});assert.ok(Math.abs(wide.scale-.752)<1e-9);assert.ok(Math.abs(wide.x-24)<1e-9);
});
test('滚轮缩放保持鼠标下的图像坐标不变',()=>{
 const initial={scale:2,x:100,y:50},point={x:340,y:170},next=zoomPreview(initial,1.5,point);
 assert.equal((point.x-next.x)/next.scale,(point.x-initial.x)/initial.scale);assert.equal((point.y-next.y)/next.scale,(point.y-initial.y)/initial.scale);
 assert.equal(zoomPreview(initial,1e9,point).scale,1024);
});
test('中键拖动只平移，不修改缩放与输入状态',()=>{
 const view={scale:3,x:20,y:30};assert.deepEqual(panPreview(view,-9,14),{scale:3,x:11,y:44});assert.deepEqual(view,{scale:3,x:20,y:30});
});


test('共享处理占位含耐心文字与不定进度条，不编造百分比',()=>{
 assert.ok(previewMarkup.includes('请耐心等待'));
 assert.ok(previewMarkup.includes('aria-live="polite"'));
 const progress=previewMarkup.match(/<progress\b[^>]*>/)[0];assert.ok(progress.includes('aria-label="图片处理进度"'));assert.ok(!/\bvalue=/.test(progress));
});

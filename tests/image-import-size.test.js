import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/image-import.js',import.meta.url),'utf8');
const reset=source.match(/const resetSize=form=>\{[^}]+\};/)[0];
for(const [width,height]of[[8192,4097],[4097,8192],[32,24]])test(`导入 ${width} × ${height} 保留原图尺寸而不按旧预算缩小`,()=>{
 const form={elements:{width:{value:0},height:{value:0}}};
 vm.runInNewContext(reset+'resetSize(form);',{source:{width,height},form});
 assert.deepEqual([form.elements.width.value,form.elements.height.value],[width,height]);
});

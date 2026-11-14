import test from 'node:test';
import assert from 'node:assert/strict';
import {previewRenderError,assertPreviewRenderSize,rasterizePreviewTiles,tintPaintedCells,PREVIEW_PIXEL_LIMIT} from '../src/terrain-preview.js';
import {createDocument,validateDocument} from '../src/model.js';

test('预览8M像素及8192单边精确边界允许，不分配边界数组',()=>{
 for(const [w,h]of[[8192,1024],[1024,8192],[4096,2048]])assert.equal(previewRenderError(w,h),'');
 assert.equal(8192*1024,PREVIEW_PIXEL_LIMIT);
 for(const [w,h]of[[8193,1],[1,8193],[4096,2049],[65536,65536]])assert.throws(()=>assertPreviewRenderSize(w,h),/8M.*8192/);
});
test('合法作品可保留超大预览元数据，渲染在分配前明确拒绝',()=>{
 const doc=createDocument(1,1);doc.width=doc.height=1024;doc.frames[0].celProperties={1:{x:0,y:0,width:1,height:1,opacity:100}};doc.layers[0].type='tileset';doc.layers[0].tileset={w:1024,h:1024,mode:'corners-and-sides',terrains:[],tiles:[]};
 doc.previewTerrain={layerId:1,w:64,h:64,cells:Array(64*64).fill(-1)};
 const before=structuredClone(doc);assert.deepEqual(validateDocument(doc).previewTerrain,doc.previewTerrain);
 assert.throws(()=>rasterizePreviewTiles({width:65536,height:65536,atlas:[],tileW:1024,tileH:1024,cols:64,tiles:[]}),/地形预览最多 8M/);
 assert.deepEqual(doc,before);
});
test('tint超限在读取或复制源像素前拒绝，正常小输出像素保持',()=>{
 const poison={slice(){throw new Error('不应复制源像素');}};
 assert.throws(()=>tintPaintedCells(poison,{width:8193,height:1}),/地形预览最多 8M/);
 const atlas=[0x448844ff,0];
 assert.deepEqual(rasterizePreviewTiles({width:2,height:1,atlas,atlasWidth:2,tileW:2,tileH:1,cols:1,tiles:[0]}),atlas);
 assert.deepEqual(atlas,[0x448844ff,0]);
});

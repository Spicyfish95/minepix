import {validateSlices} from '../slices.js';
import {assertCapacity,validateTags} from '../model.js';
export function sheetManifestPlan(metadata){
  if(!metadata||metadata.app!=='pixel-studio'||!Array.isArray(metadata.frames)||!metadata.frames.length)throw new Error('仅支持像素工坊精灵表 JSON');
  const {w:sheetWidth,h:sheetHeight}=metadata.size||{};
  if(![sheetWidth,sheetHeight].every(Number.isInteger)||sheetWidth<1||sheetHeight<1||sheetWidth>16384||sheetHeight>16384||sheetWidth*sheetHeight>32*1024*1024)throw new Error('精灵表尺寸需在 16384 边长及 32M 像素内');
  const first=metadata.frames[0]?.frame;if(!first)throw new Error('精灵表缺少帧矩形');
  const source=metadata.frames[0].trimmed?metadata.frames[0].sourceSize:{w:first.w,h:first.h};if(!source)throw new Error('裁边帧缺少原始尺寸');assertCapacity(source.w,source.h,1,metadata.frames.length);
  const frames=metadata.frames.map(item=>{
    const r=item?.frame;
    if(!r||![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>sheetWidth||r.y+r.h>sheetHeight||item.rotated)throw new Error('帧矩形需位于图片内，不支持旋转打包');
    if(!Number.isInteger(item.duration)||item.duration<20||item.duration>10000)throw new Error('帧时长需为 20–10000 ms');
    const size=item.trimmed?item.sourceSize:{w:r.w,h:r.h},offset=item.trimmed?item.spriteSourceSize:{x:0,y:0,w:r.w,h:r.h};
    if(!size||!offset||size.w!==source.w||size.h!==source.h||![offset.x,offset.y,offset.w,offset.h].every(Number.isInteger)||offset.x<0||offset.y<0||offset.w!==r.w||offset.h!==r.h||offset.x+r.w>source.w||offset.y+r.h>source.h)throw new Error('裁边来源尺寸或偏移无效');
    return{frame:{...r},duration:item.duration,offsetX:offset.x,offsetY:offset.y,empty:!!item.empty};
  });
  return{slices:validateSlices(metadata.slices,source.w,source.h,frames.length),width:source.w,height:source.h,sheetWidth,sheetHeight,frames,tags:validateTags(metadata.tags,frames.length)};
}

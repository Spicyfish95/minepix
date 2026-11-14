// 参考栏位的地形预览：只记录每格的地形 id，按图集当前的 peering 规则解析成图块。
// 预览数据存在 doc.previewTerrain，不参与合成、导出与历史栈。
import {solveConnect} from './terrain-connect.js';

export const PREVIEW_PIXEL_LIMIT=8*1024*1024,PREVIEW_EDGE_LIMIT=8192;
export function previewRenderError(width,height){
  return width>PREVIEW_EDGE_LIMIT||height>PREVIEW_EDGE_LIMIT||width*height>PREVIEW_PIXEL_LIMIT
    ?'地形预览最多 8M 像素，单边最多 8192 像素。请减小预览格子数或图块尺寸。':'';
}
export function assertPreviewRenderSize(width,height){
  const error=previewRenderError(width,height);if(error)throw new Error(error);
}

export function createPreviewTerrain(layerId,cols,rows){
  return{layerId,w:cols,h:rows,cells:new Array(cols*rows).fill(-1)};
}

// 读取项目里的预览字段：结构不合法就当作没有预览，不让整个项目打不开。
export function validatePreviewTerrain(value){
  if(!value||typeof value!=='object')return null;
  const{layerId,w,h,cells}=value;
  if(!Number.isInteger(layerId)||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>4096||h>4096)return null;
  if(!Array.isArray(cells)||cells.length!==w*h||!cells.every(id=>id===null||Number.isInteger(id)&&id>=-1))return null;
  return{layerId,w,h,cells:cells.map(id=>id===null?-1:id)};
}

// 按比例重采样到另一套格子数，尽量保留已画地形的位置。
export function resizePreviewTerrain(preview,cols,rows){
  if(preview.w===cols&&preview.h===rows)return preview;
  const cells=new Array(cols*rows).fill(-1);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const sx=Math.min(preview.w-1,Math.floor(x*preview.w/cols)),sy=Math.min(preview.h-1,Math.floor(y*preview.h/rows));
    cells[y*cols+x]=preview.cells[sy*preview.w+sx];
  }
  return{layerId:preview.layerId,w:cols,h:rows,cells};
}

export function setPreviewCell(preview,cx,cy,terrain){
  if(cx<0||cy<0||cx>=preview.w||cy>=preview.h)return false;
  const index=cy*preview.w+cx;
  if(preview.cells[index]===terrain)return false;
  preview.cells[index]=terrain;
  return true;
}

// 按 Godot 的 terrain_fill_connect 解析整张预览：把已刷到的格当成一次连续落笔，
// 连同它们的八邻格一起解约束，所以后刷的格会纠正先前的边缘图块。
export function resolvePreviewCells(tileset,cols,rows,cells,previous){
  const painted=[];
  for(let i=0;i<cells.length;i++)if(cells[i]>=0)painted.push(i);
  const{ids,exact}=solveConnect({tileset,cols,rows,cells,painted,previous});
  return ids.map((id,index)=>({id,exact:id>=0&&exact[index]}));
}

// 只要图块 id 的调用方；-1 表示空地或没解出来的格子。
export function resolvePreviewTiles(tileset,cols,rows,cells){
  return resolvePreviewCells(tileset,cols,rows,cells).map(cell=>cell.id);
}

// 地形 id → 地形色；颜色串支持 #rgb / #rrggbb / #rrggbbaa。
function terrainColor(color){
  const hex=String(color??'').replace('#','');
  if(!/^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(hex))return 0x8a8a8aff;
  const full=hex.length<6?hex.split('').map(c=>c+c).join(''):hex;
  const rgb=parseInt(full.slice(0,6),16)||0;
  return full.length===8?((rgb<<8)|parseInt(full.slice(6,8),16))>>>0:(rgb<<8|0xff)>>>0;
}

// 只给「按规则解不出来（exact === false）」的格子补一层地形色：解出来的格子保持图块原样，
// 不再给所有已刷格铺底色，否则整片地形会被染成地形色，看着像匹配错了。
export function tintPaintedCells(pixels,{width,height,tileW,tileH,cols,cells,exact,terrains,alpha=.25}){
  assertPreviewRenderSize(width,height);
  const output=pixels.slice(),colors=new Map(),strength=Math.max(0,Math.min(1,alpha));
  const level=Math.round(strength*255);
  for(let i=0;i<cells.length;i++){
    const terrain=cells[i];
    if(!(terrain>=0))continue;
    if(exact&&exact[i])continue;
    if(!colors.has(terrain))colors.set(terrain,terrainColor(terrains?.find(item=>item.id===terrain)?.color));
    const tint=colors.get(terrain),cx=i%cols,cy=Math.floor(i/cols);
    for(let y=0;y<tileH;y++)for(let x=0;x<tileW;x++){
      const px=cx*tileW+x,py=cy*tileH+y;
      if(px>=width||py>=height)continue;
      const index=py*width+px;
      if(output[index]&255)continue;
      output[index]=((tint>>>8&0xffffff)<<8|level)>>>0;
    }
  }
  return output;
}

// 把解析好的图块 id 铺成预览画布的像素数组：图集定位规则与 composeTilemap 一致。
// width/height 是预览画布尺寸，atlasWidth/atlasCols 描述图集所在的图层画布（两者不再相同）。
export function rasterizePreviewTiles({width,height,atlas,atlasWidth=width,atlasCols,tileW,tileH,cols,tiles}){
  assertPreviewRenderSize(width,height);
  const output=new Array(width*height).fill(0),atlasStride=atlasWidth||width,atlasColumns=atlasCols||Math.floor(atlasStride/tileW);
  for(let i=0;i<tiles.length;i++){
    const id=tiles[i];
    if(!(id>=0))continue;
    const ox=id%atlasColumns*tileW,oy=Math.floor(id/atlasColumns)*tileH,cx=i%cols,cy=Math.floor(i/cols);
    for(let y=0;y<tileH;y++)for(let x=0;x<tileW;x++){
      const px=cx*tileW+x,py=cy*tileH+y;
      if(px>=width||py>=height)continue;
      const pixel=atlas[(oy+y)*atlasStride+ox+x];
      if(pixel&255)output[py*width+px]=pixel;
    }
  }
  return output;
}

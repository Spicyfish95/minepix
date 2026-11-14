// 决定粘贴落点。目标选区在别处时用选区左上角；
// 只有在「同一文档内、选区还压在复制区域上」时，才把粘贴内容挪到选区外侧，
// 避免 Ctrl+V 静默原地覆盖、让用户以为没粘贴。
// 选区四周都没有空位（例如选区几乎占满画布）时退回画布原点。
export function pasteTarget(doc,region,selection,sameDocument=true){
  if(selection&&(selection.x!==region.x||selection.y!==region.y))return{x:selection.x,y:selection.y};
  if(!sameDocument)return{x:region.x,y:region.y};
  const fits=(x,y)=>x>=0&&y>=0&&x+region.w<=doc.width&&y+region.h<=doc.height;
  for(const [x,y]of[[region.x+region.w,region.y],[region.x,region.y+region.h],[region.x+region.w,region.y+region.h]])if(fits(x,y))return{x,y};
  const maxX=doc.width-region.w,maxY=doc.height-region.h;
  return region.x||region.y?{x:0,y:0}:{x:maxX,y:maxY};
}

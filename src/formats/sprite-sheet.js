import {assertCapacity} from '../model.js';

function gridRects(count,columns,rows,width,height,x,y,gapX,gapY,order){
  return Array.from({length:count},(_,i)=>{const col=order==='columns'?Math.floor(i/rows):i%columns,row=order==='columns'?i%rows:Math.floor(i/columns);return{x:x+col*(width+gapX),y:y+row*(height+gapY),w:width,h:height};});
}
export function sheetLayout(width,height,count,{columns=1,scale=1,margin=0,gapX=0,gapY=0,order='rows'}={}){
  if(![width,height,count,columns,scale,margin,gapX,gapY].every(Number.isInteger)||width<1||height<1||count<1||count>256||columns<1||columns>256||scale<1||scale>8||[margin,gapX,gapY].some(v=>v<0||v>512)||!['rows','columns'].includes(order))throw new Error('精灵表布局参数无效');
  columns=Math.min(columns,count);const rows=Math.ceil(count/columns),w=(width*columns+gapX*(columns-1)+margin*2)*scale,h=(height*rows+gapY*(rows-1)+margin*2)*scale;
  if(w>16384||h>16384||w*h>32*1024*1024)throw new Error('导出图像过大，请减少放大倍数或调整布局');
  return{width:w,height:h,columns,rows,rects:gridRects(count,columns,rows,width*scale,height*scale,margin*scale,margin*scale,gapX*scale,gapY*scale,order)};
}
export function sheetImportPlan(imageWidth,imageHeight,{width,height,offsetX=0,offsetY=0,margin=0,gapX=0,gapY=0,count=0,duration=100,order='rows'}){
  if(![width,height,offsetX,offsetY,margin,gapX,gapY,count,duration].every(Number.isInteger)||width<1||height<1||[offsetX,offsetY,margin,gapX,gapY,count].some(v=>v<0)||duration<20||duration>10000||!['rows','columns'].includes(order))throw new Error('精灵表切片参数无效');
  const x=offsetX+margin,y=offsetY+margin,columns=Math.floor((imageWidth-x-margin+gapX)/(width+gapX)),rows=Math.floor((imageHeight-y-margin+gapY)/(height+gapY));
  if(columns<1||rows<1||count>columns*rows)throw new Error('切片区域不足，请检查尺寸、偏移与帧数');
  count=count||columns*rows;assertCapacity(width,height,1,count);
  return{width,height,columns,rows,duration,rects:gridRects(count,columns,rows,width,height,x,y,gapX,gapY,order)};
}

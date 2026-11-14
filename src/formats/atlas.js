import {scaleSlices,remapSliceFrames} from '../slices.js';
import {composite} from '../model.js';
import {remapTags} from '../timeline-commands.js';
export function atlasMetadata(doc,indices,{columns=8,scale=1,margin=0,gapX=0,gapY=0,order='rows',trim=false,pack=false,extrude=0}={}){
  if(![columns,scale,margin,gapX,gapY,extrude].every(Number.isInteger)||columns<1||columns>256||scale<1||scale>8||[margin,gapX,gapY].some(v=>v<0||v>512)||extrude<0||extrude>16)throw new Error('图集参数无效');
  const items=indices.map((sourceIndex,index)=>{let x=0,y=0,w=doc.width,h=doc.height,empty=false;
    if(trim){const rgba=composite(doc,sourceIndex);let left=w,top=h,right=-1,bottom=-1;for(let i=0;i<w*h;i++)if(rgba[i*4+3]){const px=i%w,py=Math.floor(i/w);left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);}empty=right<0;if(empty){w=h=1;}else{x=left;y=top;w=right-left+1;h=bottom-top+1;}}
    return{index,sourceIndex,duration:doc.frames[sourceIndex].duration,source:{x,y,w,h},empty,aw:w+2*extrude,ah:h+2*extrude};});
  let width,height;
  if(pack){const target=Math.max(...items.map(i=>i.aw),Math.ceil(Math.sqrt(items.reduce((sum,i)=>sum+(i.aw+gapX)*(i.ah+gapY),0)))),shelves=[];let bottom=margin;
    for(const item of [...items].sort((a,b)=>b.ah-a.ah||b.aw-a.aw||a.index-b.index)){let shelf=shelves.find(s=>item.ah<=s.h&&s.next+item.aw<=margin+target);if(!shelf){shelf={y:bottom,h:item.ah,next:margin};shelves.push(shelf);bottom+=item.ah+gapY;}item.x=shelf.next+extrude;item.y=shelf.y+extrude;shelf.next+=item.aw+gapX;}
    width=Math.max(...items.map(i=>i.x+i.source.w+extrude))+margin;height=Math.max(...items.map(i=>i.y+i.source.h+extrude))+margin;
  }else{columns=Math.min(columns,items.length);const rows=Math.ceil(items.length/columns),cw=Array(columns).fill(0),rh=Array(rows).fill(0);items.forEach((item,i)=>{item.col=order==='columns'?Math.floor(i/rows):i%columns;item.row=order==='columns'?i%rows:Math.floor(i/columns);cw[item.col]=Math.max(cw[item.col],item.aw);rh[item.row]=Math.max(rh[item.row],item.ah);});for(const item of items){item.x=margin+cw.slice(0,item.col).reduce((a,b)=>a+b,0)+item.col*gapX+extrude;item.y=margin+rh.slice(0,item.row).reduce((a,b)=>a+b,0)+item.row*gapY+extrude;}width=2*margin+cw.reduce((a,b)=>a+b,0)+(columns-1)*gapX;height=2*margin+rh.reduce((a,b)=>a+b,0)+(rows-1)*gapY;}
  width*=scale;height*=scale;if(width>16384||height>16384||width*height>32*1024*1024)throw new Error('导出图像过大，请调整图集参数');
  return{app:'pixel-studio',slices:scaleSlices(remapSliceFrames(doc.slices,indices),scale),image:doc.name+'-sheet.png',size:{w:width,h:height},tags:remapTags(doc.tags,indices),frames:items.map(item=>({index:item.index,sourceIndex:item.sourceIndex,duration:item.duration,frame:{x:item.x*scale,y:item.y*scale,w:item.source.w*scale,h:item.source.h*scale},trimmed:trim,empty:item.empty,sourceSize:{w:doc.width*scale,h:doc.height*scale},spriteSourceSize:{x:item.source.x*scale,y:item.source.y*scale,w:item.source.w*scale,h:item.source.h*scale}})),extrude:extrude*scale,packed:pack};
}
export function drawAtlasFrame(ctx,image,item,scale,extrude){
  const r=item.frame,s=item.spriteSourceSize;if(item.empty)return;const sx=s.x/scale,sy=s.y/scale,sw=s.w/scale,sh=s.h/scale;
  ctx.drawImage(image,sx,sy,sw,sh,r.x,r.y,r.w,r.h);
  if(!extrude)return;
  for(const dx of [-1,0,1])for(const dy of [-1,0,1]){if(!dx&&!dy)continue;ctx.drawImage(image,dx<0?sx:dx>0?sx+sw-1:sx,dy<0?sy:dy>0?sy+sh-1:sy,dx?1:sw,dy?1:sh,dx<0?r.x-extrude:dx>0?r.x+r.w:r.x,dy<0?r.y-extrude:dy>0?r.y+r.h:r.y,dx?extrude:r.w,dy?extrude:r.h);}
}

// Scan horizontal runs, queue only adjacent runs, and keep wrapping explicit.
export function floodSpans(width,height,x,y,matches,visit,mode='none'){
 if(x<0||y<0||x>=width||y>=height||!matches(x,y))return;
 const seen=new Uint8Array(width*height),stack=[y*width+x],wrapX=mode==='x'||mode==='both',wrapY=mode==='y'||mode==='both';
 const available=(x,y)=>!seen[y*width+x]&&matches(x,y);
 while(stack.length){
  const seed=stack.pop(),y=Math.floor(seed/width),x=seed%width;if(!available(x,y))continue;
  let left=x,right=x;while(left>0&&available(left-1,y))left--;while(right+1<width&&available(right+1,y))right++;
  for(let px=left;px<=right;px++){const i=y*width+px;seen[i]=1;visit(px,y,i);}
  if(wrapX){if(left===0&&available(width-1,y))stack.push(y*width+width-1);if(right===width-1&&available(0,y))stack.push(y*width);}
  for(let direction=-1;direction<=1;direction+=2){
   let ny=y+direction;if(ny<0||ny>=height){if(!wrapY)continue;ny=(ny+height)%height;}
   let inRun=false;for(let px=left;px<=right;px++){const next=available(px,ny);if(next&&!inRun)stack.push(ny*width+px);inRun=next;}
  }
 }
}

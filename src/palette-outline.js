// Traces the union boundary of a set of grid cells, so a multi-selection outline follows the
// selected swatches (steps included) as one continuous line instead of one rectangle per row.
//
// Each cell contributes a rectangle grown by half the gap on every side, which makes edge-adjacent
// cells share exact edges; the outline therefore runs through the middle of the gap between two
// selected swatches and half a gap outside a lone swatch. Every rectangle edge that faces an
// unselected neighbour is kept, and the kept directed edges are chained vertex by vertex into
// closed loops. Holes fall out of the same rule as loops wound the other way, and disconnected
// groups come back as separate loops.

export function paletteOutline(cells,{cellWidth,cellHeight,gapX=0,gapY=0,originX=0,originY=0}={}){
  const stepX=cellWidth+gapX,stepY=cellHeight+gapY,insetX=gapX/2,insetY=gapY/2;
  const occupied=new Set(cells.map(({col,row})=>col+':'+row));
  const outgoing=new Map();
  const addEdge=(fx,fy,tx,ty)=>{
    const key=fx+','+fy,list=outgoing.get(key);
    if(list)list.push({fx,fy,tx,ty});else outgoing.set(key,[{fx,fy,tx,ty}]);
  };
  for(const {col,row} of cells){
    const x0=originX+col*stepX-insetX,y0=originY+row*stepY-insetY,x1=x0+cellWidth+gapX,y1=y0+cellHeight+gapY;
    if(!occupied.has(col+':'+(row-1)))addEdge(x1,y0,x0,y0);
    if(!occupied.has((col+1)+':'+row))addEdge(x1,y1,x1,y0);
    if(!occupied.has(col+':'+(row+1)))addEdge(x0,y1,x1,y1);
    if(!occupied.has((col-1)+':'+row))addEdge(x0,y0,x0,y1);
  }
  const take=(key,edge)=>{
    const list=outgoing.get(key);
    list.splice(list.indexOf(edge),1);
    if(!list.length)outgoing.delete(key);
    return edge;
  };
  const loops=[];
  while(outgoing.size){
    const startKey=outgoing.keys().next().value;
    let current=take(startKey,outgoing.get(startKey)[0]);
    const loop=[[current.fx,current.fy]];
    while(true){
      loop.push([current.tx,current.ty]);
      if(current.tx===loop[0][0]&&current.ty===loop[0][1])break;
      current=take(current.tx+','+current.ty,turnSharpest(current,outgoing.get(current.tx+','+current.ty)));
    }
    loops.push(withoutCollinear(loop.slice(0,-1)));
  }
  return loops;
}

// Neighbouring cells share edges, so a straight side arrives as several collinear segments;
// dropping those midpoints leaves only the real corners.
function withoutCollinear(loop){
  const corners=[];
  for(let index=0;index<loop.length;index++){
    const [px,py]=loop[(index-1+loop.length)%loop.length],[x,y]=loop[index],[nx,ny]=loop[(index+1)%loop.length];
    if((x-px)*(ny-y)-(y-py)*(nx-x)!==0)corners.push(loop[index]);
  }
  return corners;
}

// Cells that meet only at a corner leave two ways out of that vertex; taking the sharpest turn
// keeps each group closed on itself instead of welding two diagonal groups into one outline.
function turnSharpest(edge,candidates){
  if(candidates.length===1)return candidates[0];
  const dx=edge.tx-edge.fx,dy=edge.ty-edge.fy;
  let best=candidates[0],bestAngle=Infinity;
  for(const candidate of candidates){
    const ex=candidate.tx-candidate.fx,ey=candidate.ty-candidate.fy;
    const angle=Math.atan2(dx*ey-dy*ex,dx*ex+dy*ey);
    if(angle<bestAngle){bestAngle=angle;best=candidate;}
  }
  return best;
}

// SVG path for the traced loops, optionally rounding each corner with a quadratic curve.
export function outlinePathData(loops,radius=0){
  const parts=[];
  for(const loop of loops){
    const count=loop.length;
    for(let index=0;index<count;index++){
      const [px,py]=loop[(index-1+count)%count],[x,y]=loop[index],[nx,ny]=loop[(index+1)%count];
      const inLength=Math.hypot(x-px,y-py),outLength=Math.hypot(nx-x,ny-y);
      const trim=Math.min(radius,inLength/2,outLength/2);
      parts.push((index?'L':'M')+round(x-(x-px)/inLength*trim)+' '+round(y-(y-py)/inLength*trim));
      parts.push(trim>0
        ?'Q'+round(x)+' '+round(y)+' '+round(x+(nx-x)/outLength*trim)+' '+round(y+(ny-y)/outLength*trim)
        :'L'+round(x)+' '+round(y));
    }
    parts.push('Z');
  }
  return parts.join('');
}

// Signed area per loop: positive for outer boundaries, negative for holes.
export function outlineArea(loops){
  return loops.reduce((sum,loop)=>{
    let twice=0;
    for(let index=0;index<loop.length;index++){
      const [x0,y0]=loop[index],[x1,y1]=loop[(index+1)%loop.length];
      twice+=x0*y1-x1*y0;
    }
    return sum+twice/2;
  },0);
}

function round(value){return Math.round(value*100)/100;}

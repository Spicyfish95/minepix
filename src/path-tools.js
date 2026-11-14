import { line } from './model.js';

export function rasterCurve(start,end,control,put){
  const steps=Math.max(8,Math.ceil((Math.hypot(control.x-start.x,control.y-start.y)+Math.hypot(end.x-control.x,end.y-control.y))*2));
  let previous=start;
  for(let i=1;i<=steps;i++){
    const t=i/steps,u=1-t,next={x:Math.round(u*u*start.x+2*u*t*control.x+t*t*end.x),y:Math.round(u*u*start.y+2*u*t*control.y+t*t*end.y)};
    line(previous.x,previous.y,next.x,next.y,put);previous=next;
  }
}

export function rasterPolygon(points,filled,put){
  if(!points.length)return;
  if(filled&&points.length>=3){
    let minY=Infinity,maxY=-Infinity;for(const p of points){minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    for(let y=minY;y<=maxY;y++){
      const crossings=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        if((a.y>y)!==(b.y>y))crossings.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
      }
      crossings.sort((a,b)=>a-b);
      for(let i=0;i+1<crossings.length;i+=2)for(let x=Math.ceil(crossings[i]);x<=Math.floor(crossings[i+1]);x++)put(x,y);
    }
  }
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];line(a.x,a.y,b.x,b.y,put);
  }
}

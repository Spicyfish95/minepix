import { LIMIT } from './model.js';

const rotate=(x,y,angle)=>{const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:x*c-y*s,y:x*s+y*c};};
export const transformState=region=>({x:region.x,y:region.y,width:region.w,height:region.h,angle:0,u:.5,v:.5});
export function transformPoint(state,u,v){
  const p=rotate((u-state.u)*state.width,(v-state.v)*state.height,state.angle);
  return{x:state.x+state.u*state.width+p.x,y:state.y+state.v*state.height+p.y};
}
export function localPoint(state,point){
  const pivot=transformPoint(state,state.u,state.v),p=rotate(point.x-pivot.x,point.y-pivot.y,-state.angle);
  return{x:state.u+p.x/state.width,y:state.v+p.y/state.height};
}
export function relocatePivot(state,point){
  const top=transformPoint(state,0,0),local=localPoint(state,point),next={...state,u:local.x,v:local.y};
  const moved=transformPoint(next,0,0);
  return{...next,x:next.x+top.x-moved.x,y:next.y+top.y-moved.y};
}
const handles=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
export function transformHandles(state,zoom){
  const points=handles.map(([id,u,v])=>({id,u,v,...transformPoint(state,u,v)}));
  const top=transformPoint(state,.5,0),offset=rotate(0,-26/zoom,state.angle);
  return[...points,{id:'rotate',x:top.x+offset.x,y:top.y+offset.y},{id:'pivot',...transformPoint(state,state.u,state.v)}];
}
export function hitTransform(state,point,zoom){
  const points=transformHandles(state,zoom);
  for(const handle of [points[9],points[8],...points.slice(0,8)])if(Math.hypot(point.x-handle.x,point.y-handle.y)*zoom<=8)return handle.id;
  const p=localPoint(state,point);return p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?'move':null;
}
export function transformCursor(state,handle,dragging=false){
  if(handle==='move')return 'move';if(handle==='pivot')return 'crosshair';if(handle==='rotate')return dragging?'grabbing':'grab';if(!handle)return 'default';
  const [,u,v]=handles.find(([id])=>id===handle),angle=state.angle+Math.atan2(v-.5,u-.5)*180/Math.PI;
  return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][((Math.round(angle/45)%4)+4)%4];
}
export function dragTransform(state,handle,start,point,shift=false){
  if(handle==='move')return{...state,x:state.x+Math.round(point.x-start.x),y:state.y+Math.round(point.y-start.y)};
  if(handle==='pivot')return relocatePivot(state,{x:Math.round(point.x*2)/2,y:Math.round(point.y*2)/2});
  if(handle==='rotate'){
    const pivot=transformPoint(state,state.u,state.v);
    let angle=state.angle+(Math.atan2(point.y-pivot.y,point.x-pivot.x)-Math.atan2(start.y-pivot.y,start.x-pivot.x))*180/Math.PI;
    angle=((angle+540)%360)-180;angle=shift?Math.round(angle/15)*15:Math.round(angle*10)/10;
    return{...state,angle};
  }
  const [,u,v]=handles.find(([id])=>id===handle),anchor=transformPoint(state,1-u,1-v),delta=rotate(point.x-anchor.x,point.y-anchor.y,-state.angle);
  let width=u===.5?state.width:Math.round(delta.x/(2*u-1)),height=v===.5?state.height:Math.round(delta.y/(2*v-1));
  if(shift&&u!==.5&&v!==.5){const ratio=Math.max(1/state.width,1/state.height,Math.max(width/state.width,height/state.height));width=Math.round(state.width*ratio);height=Math.round(state.height*ratio);}
  width=Math.max(1,width);height=Math.max(1,height);
  if(width*height>LIMIT){const ratio=Math.sqrt(LIMIT/(width*height));width=Math.max(1,Math.floor(width*ratio));height=Math.max(1,Math.floor(height*ratio));}
  const next={...state,width,height},moved=transformPoint(next,1-u,1-v);
  return{...next,x:next.x+anchor.x-moved.x,y:next.y+anchor.y-moved.y};
}

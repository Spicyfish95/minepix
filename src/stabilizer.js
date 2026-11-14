// A distance-based trailing point: the stroke follows only when the pointer pulls
// farther than the configured radius. Releasing does not snap it to the pointer.
export function createStabilizer(start,distance){
 let position={...start},last={...start};
 return{
  move(point){
   const dx=point.x-position.x,dy=point.y-position.y,length=Math.hypot(dx,dy);
   if(distance&&length<=distance)return null;
   const amount=length?(length-distance)/length:0;
   position=distance?{x:position.x+dx*amount,y:position.y+dy*amount}:{...point};
   const next={x:Math.round(position.x),y:Math.round(position.y)};
   if(next.x===last.x&&next.y===last.y)return null;last=next;return next;
  },
  position:()=>({...position})
 };
}

export function createShading(palette,indices,direction=-1){
 const ramp=indices.toSorted((a,b)=>a-b).map(index=>({index,color:parseInt(palette[index].slice(1).padEnd(8,'f'),16)>>>0}));
 return (pixel,index)=>{
  if(!(pixel&255)||ramp.length<2)return{color:pixel,index};
  const position=index===undefined?ramp.findIndex(entry=>(entry.color>>>8)===(pixel>>>8)):ramp.findIndex(entry=>entry.index===index);
  if(position<0)return{color:pixel,index};
  const next=ramp[Math.max(0,Math.min(ramp.length-1,position+direction))];
  return{color:index===undefined?((next.color&0xffffff00)|(pixel&255))>>>0:next.color,index:next.index};
 };
}

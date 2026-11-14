export function playbackSequence(indices,direction='forward'){
  if(direction==='reverse')return [...indices].reverse();
  if(direction==='pingpong')return [...indices,...indices.slice(1,-1).reverse()];
  return [...indices];
}
export function createPlayback(doc,indices,direction,loop,start,now){
  const sequence=playbackSequence(indices,direction);if(!loop&&direction==='pingpong'&&indices.length>1)sequence.push(indices[0]);
  const durations=sequence.map(i=>doc.frames[i].duration),cycle=durations.reduce((a,b)=>a+b,0);
  let position=loop?Math.max(0,sequence.indexOf(start)):0,deadline=now+durations[position],finished=false;
  return{
    get frame(){return sequence[position];},get nextAt(){return deadline;},get finished(){return finished;},
    advance(time){
      if(loop&&time-deadline>=cycle)deadline+=Math.floor((time-deadline)/cycle)*cycle;
      while(!finished&&time>=deadline){
        if(position===sequence.length-1&&!loop){finished=true;break;}
        position=(position+1)%sequence.length;deadline+=durations[position];
      }
      return sequence[position];
    }
  };
}

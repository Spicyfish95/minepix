export const wrapCoordinate=(value,size)=>((value%size)+size)%size;
export function tiledPoint(doc,x,y,mode='none'){return{x:mode==='x'||mode==='both'?wrapCoordinate(x,doc.width):x,y:mode==='y'||mode==='both'?wrapCoordinate(y,doc.height):y};}
export function tiledCopies(mode){const xs=mode==='x'||mode==='both'?[-1,0,1]:[0],ys=mode==='y'||mode==='both'?[-1,0,1]:[0];return ys.flatMap(y=>xs.map(x=>({x,y})));}
export function insideTiledCanvas(doc,p,mode){const x=mode==='x'||mode==='both',y=mode==='y'||mode==='both';return p.x>=(x?-doc.width:0)&&p.x<doc.width*(x?2:1)&&p.y>=(y?-doc.height:0)&&p.y<doc.height*(y?2:1);}

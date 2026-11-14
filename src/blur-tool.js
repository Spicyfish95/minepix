import {tiledPoint} from './tiled-mode.js';
import {selectionContains} from './model.js';

const channels=value=>[value>>>24,value>>>16&255,value>>>8&255,value&255];
export function blurAt(doc,pixels,x,y,footprint=[{x:0,y:0}],selection=null,tiledMode){
  const source=pixels.slice();
  for(const offset of footprint){
    const {x:px,y:py}=tiledPoint(doc,x+offset.x,y+offset.y,tiledMode);if(px<0||py<0||px>=doc.width||py>=doc.height||!selectionContains(selection,px,py))continue;
    const sums=[0,0,0,0];let count=0;
    for(let y=py-1;y<=py+1;y++)for(let x=px-1;x<=px+1;x++){
      const {x:xx,y:yy}=tiledPoint(doc,x,y,tiledMode);if(xx<0||yy<0||xx>=doc.width||yy>=doc.height)continue;
      const value=channels(source[yy*doc.width+xx]);for(let i=0;i<4;i++)sums[i]+=value[i];count++;
    }
    pixels[py*doc.width+px]=((Math.round(sums[0]/count)<<24)|(Math.round(sums[1]/count)<<16)|(Math.round(sums[2]/count)<<8)|Math.round(sums[3]/count))>>>0;
  }
}

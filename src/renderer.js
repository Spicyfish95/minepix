import {composite} from './model.js';
function union(a,b){if(!a)return b;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};}
export {compositeInto as compositeRegion} from './compositor.js';
import {compositeInto as compositeRegion} from './compositor.js';
export class FrameCache{
 constructor(budget=64*1024*1024,options={}){this.options=options;this.budget=budget;this.stats={full:0,partial:0,hits:0};this.clear();}
 clear(){this.entries=new Map();this.document=null;this.signature='';}
 get memoryBytes(){return[...this.entries.values()].reduce((sum,entry)=>sum+entry.rgba.byteLength*2,0);}
 invalidate(index,rect=null){const entry=this.entries.get(index);if(!entry)return;if(!rect)this.entries.delete(index);else entry.dirty=union(entry.dirty,rect);}
 get(doc,index){const signature=doc.width+':'+doc.height+':'+doc.layers.map(layer=>[layer.visible,layer.opacity,layer.blendMode,layer.type,layer.parentId,layer.passThrough,layer.reference?.x,layer.reference?.y,layer.reference?.scale,layer.reference?.width,layer.reference?.height,layer.clearColor].join(',')).join(';');if(this.document!==doc||this.signature!==signature){this.clear();this.document=doc;this.signature=signature;}
 const properties=JSON.stringify(doc.frames[index].celProperties);let entry=this.entries.get(index);if(entry&&(entry.properties!==properties||entry.refs.some((cel,i)=>cel!==doc.frames[index].cels[i]))){this.entries.delete(index);entry=null;}
 if(!entry){entry={properties,rgba:composite(doc,index,this.options),refs:[...doc.frames[index].cels],revision:1,updated:null};this.entries.set(index,entry);this.stats.full++;}else if(entry.dirty){entry.updated=compositeRegion(doc,index,entry.dirty,entry.rgba,this.options);entry.dirty=null;entry.revision++;this.stats.partial++;}else this.stats.hits++;
 this.entries.delete(index);this.entries.set(index,entry);while(this.memoryBytes>this.budget&&this.entries.size>1)this.entries.delete(this.entries.keys().next().value);return entry;
 }
}

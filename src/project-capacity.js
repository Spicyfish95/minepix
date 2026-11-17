export function assertCapacity(w,h,layers,frames){
 if(![w,h,layers,frames].every(Number.isSafeInteger)||w<1||h<1||layers<1||frames<1||layers>64||frames>256||!Number.isSafeInteger(w*h))throw new Error('画布宽高需为正整数；最多 64 图层、256 帧。');
}
export function assertProjectCapacity(doc,{width=doc.width,height=doc.height,layers=doc.layers.length,frames=doc.frames.length}={}){
 assertCapacity(width,height,layers,frames);
}

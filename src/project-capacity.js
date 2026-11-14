export const LIMIT=32*1024*1024;
export function assertCapacity(w,h,layers,frames){
 if(![w,h,layers,frames].every(Number.isInteger)||w<1||h<1||layers<1||frames<1||layers>64||frames>256||w*h*layers*frames>LIMIT)throw new Error('画布宽高需为正整数；最多 64 图层、256 帧，总像素不超过 32M。');
}
export const celPixelCount=doc=>doc.frames.reduce((sum,frame)=>sum+frame.cels.reduce((n,cel)=>n+cel.length,0),0);
export const sourcePixelCount=doc=>(doc.references||[]).reduce((n,ref)=>n+ref.width*ref.height,0)+doc.layers.reduce((n,layer)=>n+(layer.reference?.data?layer.reference.width*layer.reference.height:0),0);
// A linked cel counts once per frame, matching project loading and its logical canvas budget.
export function assertProjectCapacity(doc,{width=doc.width,height=doc.height,layers=doc.layers.length,frames=doc.frames.length,pixels=celPixelCount(doc),sources=sourcePixelCount(doc)}={}){
 assertCapacity(width,height,layers,frames);
 if(Math.max(width*height*layers*frames,pixels)+sources>LIMIT)throw new Error('参考图片与cel总像素超过32M');
}

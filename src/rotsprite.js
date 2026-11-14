// RotSprite's pixel-preserving preparation: three Scale2x passes produce an 8x
// image, sampled by the inverse transform. Unlike interpolating RGB, Scale2x
// chooses existing colors/indices according to adjacent edge agreement.
export function scale2xImage(data,width,height){
 const result=new data.constructor(width*height*4),nextWidth=width*2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,e=data[i],b=y?data[i-width]:e,d=x?data[i-1]:e,f=x+1<width?data[i+1]:e,h=y+1<height?data[i+width]:e,at=y*2*nextWidth+x*2;
  result[at]=d===b&&d!==h&&b!==f?d:e;
  result[at+1]=b===f&&b!==d&&f!==h?f:e;
  result[at+nextWidth]=h===d&&h!==f&&d!==b?d:e;
  result[at+nextWidth+1]=f===h&&f!==b&&h!==d?f:e;
 }
 return result;
}
const prepared=new WeakMap();
export function prepareRotSprite(region){
 if(prepared.has(region))return prepared.get(region);
 let data=region.indexed?Uint8Array.from(region.indexed.data):Uint32Array.from(region.data),width=region.w,height=region.h;
 for(let pass=0;pass<3;pass++){data=scale2xImage(data,width,height);width*=2;height*=2;}
 const result={data,width,height};prepared.set(region,result);return result;
}

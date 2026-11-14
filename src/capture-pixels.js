export function captureCanvas(bytes,dom){
 const header=new DataView(bytes),width=header.getUint32(0,true),height=header.getUint32(4,true);
 if(!width||!height||bytes.byteLength!==8+width*height*4)throw new Error('截图像素数据不完整');
 const canvas=dom.createElement('canvas');canvas.width=width;canvas.height=height;
 canvas.getContext('2d').putImageData(new dom.defaultView.ImageData(new Uint8ClampedArray(bytes,8),width,height),0,0);
 return canvas;
}

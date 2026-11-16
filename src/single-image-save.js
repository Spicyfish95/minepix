import {composite} from './model.js';
import {encodeCanvas} from './export-formats.js';
export function encodeSingleImage(document,frameIndex,format){
 if(!document.frames[frameIndex])throw new Error('保存的帧不存在');
 if(format==='ico'&&(document.width>256||document.height>256))throw new Error('ICO 图像单边不能超过 256 像素，请先缩小作品');
 const canvas=globalThis.document.createElement('canvas');canvas.width=document.width;canvas.height=document.height;
 const context=canvas.getContext('2d',{willReadFrequently:true}),pixels=composite(document,frameIndex);
 context.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
 return encodeCanvas(canvas,format==='gif'?'png':format);
}

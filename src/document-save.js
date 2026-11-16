import {IMAGE_SAVE_FORMATS,PROJECT_SAVE_FORMATS} from './save-format.js';
export function createDocumentSaver({choosePath,savePacked,saveImage,encodeImage,getDefaultFormat}){
 return async(document,name,saveAs=false,filePath=null,frameIndex=0)=>{
  const destination=await choosePath({name,saveAs,filePath,defaultFormat:getDefaultFormat()});
  if(!destination)return null;
  if(IMAGE_SAVE_FORMATS.includes(destination.format))return saveImage(destination.filePath,encodeImage(document,frameIndex,destination.format));
  if(!PROJECT_SAVE_FORMATS.includes(destination.format))throw new Error('不支持的保存格式');
  return savePacked(document,name,destination.filePath);
 };
}

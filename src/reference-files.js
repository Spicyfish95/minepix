const hasPath=reference=>typeof reference.path==='string'&&!!reference.path.trim();
function externalReference(reference){
 const {data,missing,...metadata}=reference;
 if(typeof metadata.path!=='string'||!metadata.path)throw new Error('参考图缺少源文件路径，请重新导入');
 return metadata;
}
export function projectForSave(document){
 return{...document,...(Array.isArray(document.references)?{references:document.references.map(externalReference)}:{}),layers:document.layers?.map(layer=>layer.reference?.data||layer.reference?.path?{...layer,reference:externalReference(layer.reference)}:layer)};
}
export async function loadReferenceFiles(document,read){
 if(Array.isArray(document.references))document.references=document.references.filter(hasPath);
 for(const [index,layer]of (document.layers||[]).entries()){
  const reference=layer.reference;
  if(reference&&reference.data!==undefined&&!hasPath(reference)){
   const {x,y,scale}=reference;layer.reference={x,y,scale};
   for(const frame of document.frames)frame.cels[index].fill(0);
  }
 }
 const references=[...(document.references||[]),...(document.layers||[]).flatMap(layer=>layer.reference?.path||layer.reference?.data?[layer.reference]:[])];
 const cache=new Map();
 for(const reference of references){
  delete reference.data;delete reference.missing;
  if(!cache.has(reference.path))cache.set(reference.path,read(reference.path).then(image=>({image}),error=>({error})));
  const result=await cache.get(reference.path);
  if(result.error)reference.missing=String(result.error.message||result.error);
  else Object.assign(reference,result.image);
 }
 return document;
}

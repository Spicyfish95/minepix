export const DEFAULT_CANVAS_BACKGROUND={size:8,color1:'#c7d0d7',color2:'#d8dfe4'};

export function validateCanvasBackground(value=DEFAULT_CANVAS_BACKGROUND){
  const size=Number(value.size),color1=String(value.color1||''),color2=String(value.color2||'');
  if(!Number.isInteger(size)||size<1||size>64||!/^#[0-9a-f]{6}$/i.test(color1)||!/^#[0-9a-f]{6}$/i.test(color2))throw new Error('透明背景方格需为 1–64 px，颜色需为 HEX');
  return{size,color1:color1.toLowerCase(),color2:color2.toLowerCase()};
}

export function applyCanvasBackground(element,value,zoom=1){
  const background=validateCanvasBackground(value);
  element.style.setProperty('--document-checker-a',background.color1);
  element.style.setProperty('--document-checker-b',background.color2);
  element.style.setProperty('--document-checker-size',background.size*2*zoom+'px');
}

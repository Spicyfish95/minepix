import {colorValue} from './model.js';
import {applyImageAdjustment} from './image-adjustments.js';

const numeric=(name,label,min,max)=>`<label class="adjustment-channel"><span>${label}</span><input name="${name}" type="range" min="${min}" max="${max}" value="0"><input data-field="${name}" type="number" min="${min}" max="${max}" value="0" required aria-label="${label}"></label>`;
export async function imageAdjustmentDialog(type,{source,frame,layer,selection,foreground,modal,$,preview,restore,commit}){
 const fields=type==='outline'?'<label>描边颜色<input name="outlineColor" type="color" value="'+foreground.slice(0,7)+'"></label><label>描边透明度<input name="outlineAlpha" type="number" min="0" max="255" value="'+(foreground.length===9?parseInt(foreground.slice(7),16):255)+'" required></label><label>描边宽度<input name="outlineWidth" type="number" min="1" max="100" value="1" required> px</label><label>描边位置<select name="outlinePlacement"><option value="outside">外侧</option><option value="inside">内侧</option></select></label><label>边角形状<select name="outlineShape"><option value="circle">圆形</option><option value="square">方形</option></select></label>':type==='hsv'?numeric('hue','色相偏移',-180,180)+numeric('saturation','饱和度偏移',-100,100)+numeric('value','明度偏移',-100,100):type==='brightness'?numeric('brightness','亮度偏移',-100,100)+numeric('contrast','对比度',-100,100):'<p>反转 RGB 通道，保留透明度。</p>';
 let chosen,calculate,accepted=false;
 try{
  const values=await modal(type==='outline'?'图像描边':'图像颜色调整','<div class="image-adjustment-fields">'+fields+'<label>作用范围<select name="scope"><option value="cel">当前 cel</option><option value="layer">当前层全部帧</option><option value="sprite">整个精灵</option></select></label><label><input name="preview" type="checkbox" checked>预览图像</label><p>仅处理可见且未锁定的像素图层，遵守选区。索引模式映射到当前色板。</p></div>',form=>{
   calculate=()=>{const next=structuredClone(source),settings={type,scope:form.elements.scope.value,frame,layer,selection};for(const el of form.querySelectorAll('input[type=range][name]'))settings[el.name]=+el.value;if(type==='outline')Object.assign(settings,{outlineWidth:+form.elements.outlineWidth.value,outlineColor:colorValue(form.elements.outlineColor.value+(+form.elements.outlineAlpha.value).toString(16).padStart(2,'0')),outlinePlacement:form.elements.outlinePlacement.value,outlineShape:form.elements.outlineShape.value});applyImageAdjustment(next,settings);return next;};
   const update=event=>{
    const target=event?.target;if(target?.dataset.field)form.elements[target.dataset.field].value=target.value;else if(target?.type==='range')form.querySelector(`[data-field="${target.name}"]`).value=target.value;
    if(!form.checkValidity())return;chosen=calculate();if(form.elements.preview.checked)preview(chosen);else restore();
   };
   form.oninput=update;update();
  },()=>{chosen=calculate();});
  restore();if(values){commit(chosen);accepted=true;}
 }finally{$('modal-form').oninput=null;if(!accepted)restore();}
}

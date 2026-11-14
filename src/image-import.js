import {createImportPreview,previewMarkup} from './import-preview.js';
import {createDocument,assertCapacity} from './model.js';
import {sheetImportPlan} from './formats/sprite-sheet.js';
import {canRepairImage,imageMime,REPAIR_DEFAULTS} from './pixel-repair.js';
import {createRepairClient} from './pixel-repair-client.js';

export const PROCESSING_OPTION_LABELS={"auto": "自动", "edge-grid": "边缘网格", "uniform-grid": "均匀网格", "frame-lattice": "边框格点", "pitch-lattice": "间距格点", "color-period": "颜色周期", "border-runs": "边界连续段", "edge-spacing": "边缘间距", "custom-size": "自定义尺寸", "resize": "缩放", "most-common": "最常见颜色", "average": "平均颜色", "median": "中位颜色", "k-means": "K 均值聚类", "contrast": "对比度", "nearest": "最近邻", "structure": "保留结构", "two-stage": "双阶段", "dual-rt-two-stage": "双向双阶段", "box": "区域平均", "most-frequent": "最高频颜色", "dominant": "主色", "none": "无", "pixeloe": "PixelOE 轮廓", "pixeloe-lines": "PixelOE 线条轮廓", "union": "联合引导", "replace": "替换引导", "straight": "直通 Alpha", "premultiplied": "预乘 Alpha", "ordered": "有序抖动", "floyd-steinberg": "Floyd–Steinberg 抖动"};

const select=(name,label,items)=>`<label>${label}<select name="repair.${name}">${items.map(item=>{const[value,text]=Array.isArray(item)?item:[item,PROCESSING_OPTION_LABELS[item]];return`<option value="${value}">${text}</option>`;}).join('')}</select></label>`;
const number=(name,label,min,max,value,step=1)=>`<label>${label}<input name="repair.${name}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required></label>`;
const checkbox=(name,label)=>`<label><input name="repair.${name}" type="checkbox">${label}</label>`;
export function repairFields(){return '<details id="repair-advanced" hidden><summary>高级设置</summary><div class="repair-groups"><fieldset class="repair-group"><legend>处理方式</legend><div class="repair-settings">'+
 select('mode','处理模式',[['recover-grid','恢复像素网格'],['convert','转为像素画']])+
 '</div></fieldset><fieldset class="repair-group"><legend>网格与尺寸</legend><div class="repair-settings">'+
 select('algorithm','网格算法',['auto','edge-grid','uniform-grid','frame-lattice','pitch-lattice','color-period','border-runs','edge-spacing','custom-size','resize'])+
 number('targetWidth','目标宽度',1,512,64)+number('targetHeight','目标高度',1,512,64)+
 '<div class="repair-option-row">'+checkbox('manual','指定网格尺寸')+number('cellWidth','网格宽',1,128,8)+number('cellHeight','网格高',1,128,8)+'</div>'+
 '</div></fieldset><fieldset class="repair-group"><legend>采样与轮廓</legend><div class="repair-settings">'+
 select('method','缩小采样',['structure','nearest','box','most-frequent','dominant','two-stage'])+
 select('prepass','轮廓预处理',['none','pixeloe','pixeloe-lines'])+select('lineGuide','线稿引导',['union','replace'])+
 number('outlineStrength','轮廓保护',0,100,0)+
 '<div class="repair-option-row">'+checkbox('blockPicker','转换时按块采色')+select('colorPicker','每格采色',['most-common','average','median','k-means','contrast','nearest','structure','two-stage','dual-rt-two-stage'])+'</div>'+
 '<div class="repair-option-row">'+checkbox('removeNoise','去除相近颜色噪点')+'</div>'+
 '</div></fieldset><fieldset class="repair-group"><legend>输出与颜色</legend><div class="repair-settings">'+
 select('alphaMode','透明度采样',['straight','premultiplied'])+
 '<div class="repair-option-row">'+checkbox('preserveDimensions','保持原图尺寸')+'</div>'+
 '<div class="repair-option-row repair-color-options">'+checkbox('reduceColors','限制颜色')+checkbox('adaptive','自适应颜色数量')+
 number('maxColors','最大颜色数',1,256,16)+select('dither','限色抖动',['none','ordered','floyd-steinberg'])+'</div>'+
 '</div></fieldset></div><details class="repair-unlock-help"><summary>参数启用条件</summary><ul id="repair-unlock-hints"></ul></details><p class="muted">恢复模式使用网格算法、网格尺寸与每格采色；转换模式使用目标尺寸和缩小采样。自定义尺寸算法也使用目标宽高。限色抖动仅在限制颜色开启时生效。</p></details>';}

export function repairControlReasons(settings){
 const recover=settings.mode==='recover-grid',manual=recover&&settings.manual;
 return{
  manual:recover?'':'将处理模式切换为“恢复像素网格”',
  algorithm:!recover?'将处理模式切换为“恢复像素网格”':manual?'关闭“指定网格尺寸”，使用自动网格算法':'',
  cellWidth:manual?'':'选择“恢复像素网格”并开启“指定网格尺寸”',cellHeight:manual?'':'选择“恢复像素网格”并开启“指定网格尺寸”',
  blockPicker:recover?'将处理模式切换为“转为像素画”':'',
  colorPicker:!recover&&!settings.blockPicker?'开启“转换时按块采色”，或切换为“恢复像素网格”':'',
  method:recover?'选择“转为像素画”并关闭“转换时按块采色”':settings.blockPicker?'关闭“转换时按块采色”':'',
  adaptive:settings.reduceColors?'':'开启“限制颜色”',maxColors:settings.reduceColors?'':'开启“限制颜色”',dither:settings.reduceColors?'':'开启“限制颜色”',
  lineGuide:settings.prepass==='pixeloe-lines'?'':'将轮廓预处理切换为“PixelOE 线条轮廓”'
 };
}

export function syncRepairControls(form){
 const reasons=repairControlReasons(repairSettings(form)),active=form.elements.processing.value==='repair',hints=form.querySelector('#repair-unlock-hints');hints.replaceChildren();
 for(const key of Object.keys(REPAIR_DEFAULTS)){
  const control=form.elements['repair.'+key],reason=reasons[key]||'',label=control.closest('label');
  control.disabled=!active||!!reason;label.title=reason;control.title=reason;
  if(active&&reason){const item=document.createElement('li'),caption=[...label.childNodes].filter(node=>node!==control).map(node=>node.textContent).join('').trim();item.textContent=caption+'：'+reason;hints.append(item);}
 }
}

export function repairSettings(form){
 return Object.fromEntries(Object.entries(REPAIR_DEFAULTS).map(([key,value])=>{const el=form.elements['repair.'+key];return[key,typeof value==='boolean'?el.checked:typeof value==='number'?+el.value:el.value];}));
}

export async function rasterImportDocument(file,{modal,$,showError}){
 const original=new Image();
 await new Promise((resolve,reject)=>{original.onload=resolve;original.onerror=()=>reject(new Error('图片无法解码'));original.src='data:'+(file.mime||imageMime(file.name)||'image/png')+';base64,'+file.data;});
 const supported=canRepairImage(file),sourceCanvas=document.createElement('canvas');sourceCanvas.width=original.width;sourceCanvas.height=original.height;
 const sourceContext=sourceCanvas.getContext('2d',{willReadFrequently:true});sourceContext.drawImage(original,0,0);
 let source=original,ready=true,loading=false,client,processed=false,previewView,sourcePixels,resultPalette=null;
 const fields='<div class="sheet-fields"><label><span id="png-width-title">导入宽度</span><input name="width" type="number" min="1" required></label><label><span id="png-height-title">导入高度</span><input name="height" type="number" min="1" required></label>'+[['offsetX','起始偏移 X'],['offsetY','起始偏移 Y'],['margin','四边边距'],['gapX','水平间距'],['gapY','垂直间距'],['count','帧数（0 为全部）']].map(([key,label])=>`<label class="sheet-only">${label}<input name="${key}" type="number" min="0" value="0" required></label>`).join('')+'<label class="sheet-only">帧时长 (ms)<input name="duration" type="number" min="20" max="10000" value="100" required></label><label class="sheet-only">排列方向<select name="order"><option value="rows">逐行</option><option value="columns">逐列</option></select></label></div>';
 const options=form=>Object.fromEntries(['width','height','offsetX','offsetY','margin','gapX','gapY','count','duration','order'].map(key=>[key,key==='order'?form.elements[key].value:+form.elements[key].value]));
 const planFor=form=>{
  if(form.elements.mode.value==='sheet')return sheetImportPlan(source.width,source.height,options(form));
  const width=+form.elements.width.value,height=+form.elements.height.value;assertCapacity(width,height,1,1);
  return{width,height,columns:1,rows:1,duration:100,rects:[{x:0,y:0,w:source.width,h:source.height}]};
 };
 const resetSize=form=>{const scale=Math.min(1,Math.sqrt((32*1024*1024)/(source.width*source.height)));form.elements.width.value=Math.max(1,Math.floor(source.width*scale));form.elements.height.value=Math.max(1,Math.floor(source.height*scale));};
 let selectedPlan,selectedMode;
 const values=await modal(file.name.toLowerCase().endsWith('.png')?'导入 PNG':'导入图片',
  previewMarkup+'<section id="repair-palette" hidden><p>限色结果 · <span id="repair-palette-count"></span> 色 · 导入后设为当前色板</p><ul id="repair-palette-colors" aria-label="处理结果颜色列表"></ul></section><p id="sheet-import-info"></p>'+(supported?'<label>图片处理<select name="processing"><option value="normal">普通导入（默认）</option><option value="repair">像素处理</option></select></label>'+repairFields():'')+
  '<label>导入方式<select name="mode"><option value="single">单张图片</option><option value="sheet">精灵表</option></select></label>'+fields+
  '<p id="repair-status" role="status" aria-live="polite"></p>',form=>{
   previewView=createImportPreview($('image-import-preview'));
   resetSize(form);if(supported)$('repair-advanced').querySelectorAll('input,select').forEach(el=>el.disabled=true);
   const clearPalette=()=>{resultPalette=null;$('repair-palette').hidden=true;$('repair-palette-colors').replaceChildren();};
   const showPalette=palette=>{
    clearPalette();if(!palette)return;resultPalette=palette;
    $('repair-palette-count').textContent=palette.length;
    for(const color of palette){const item=document.createElement('li'),swatch=document.createElement('span'),code=document.createElement('code');swatch.className='repair-palette-swatch';swatch.style.backgroundColor=color;code.textContent=color;item.append(swatch,code);$('repair-palette-colors').append(item);}
    $('repair-palette').hidden=false;
   };
   const isRepair=()=>form.elements.processing?.value==='repair';
   const preview=()=>{
    const single=form.elements.mode.value==='single';form.querySelectorAll('.sheet-only').forEach(label=>label.hidden=single);
    $('png-width-title').textContent=single?'导入宽度':'单帧宽';$('png-height-title').textContent=single?'导入高度':'单帧高';
    $('modal-submit').disabled=loading||!ready;
    if(!ready)return;
    try{
     const plan=planFor(form);previewView.setImage(source,single?[]:plan.rects);
     $('sheet-import-info').textContent=single?`${processed?'处理结果':'原图'} ${source.width} × ${source.height} px → 导入 ${plan.width} × ${plan.height} px`:`${plan.columns} 列 × ${plan.rows} 行 · 导入 ${plan.rects.length} 帧；不足一帧的尾边忽略。`;
     $('modal-error').textContent='';
    }catch(error){$('modal-submit').disabled=true;$('sheet-import-info').textContent='';$('modal-error').textContent=error.message;}
   };
   client=createRepairClient({
    onStatus:stage=>previewView.setStatus(stage),
    onState(value){loading=value;$('sheet-import-preview').setAttribute('aria-busy',String(value));$('repair-status').classList.toggle('loading',value);if(value){clearPalette();ready=false;previewView.loading();$('sheet-import-info').textContent='';$('modal-error').textContent='';$('repair-status').textContent='';}$('modal-submit').disabled=value||!ready;},
    onResult(result){showPalette(result.palette);const canvas=document.createElement('canvas');canvas.width=result.width;canvas.height=result.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.data),result.width,result.height),0,0);source=canvas;ready=true;processed=true;if(form.elements.mode.value==='single')resetSize(form);$('repair-status').textContent=`像素处理完成 · ${result.width} × ${result.height} px`;preview();},
    onError(error){clearPalette();ready=false;previewView.clear();$('modal-submit').disabled=true;$('repair-status').textContent='像素处理失败，请调整高级设置或切换普通导入';$('modal-error').textContent=error.message;showError('像素处理失败：'+error.message);}
   });
   const request=()=>{clearPalette();syncRepairControls(form);const settings=repairSettings(form);if([...$('repair-advanced').querySelectorAll('input,select')].some(el=>!el.checkValidity())){client.cancel();ready=false;$('modal-submit').disabled=true;$('modal-error').textContent='请填写有效的高级设置参数';return;}client.request(sourcePixels??=sourceContext.getImageData(0,0,original.width,original.height),settings);};
   form.oninput=event=>{
    if(event.target.name==='processing'){
     const repair=isRepair();$('repair-advanced').hidden=!repair;$('repair-advanced').querySelectorAll('input,select').forEach(el=>el.disabled=!repair);
     if(repair)request();else{clearPalette();client.cancel();source=original;processed=false;ready=true;resetSize(form);$('repair-status').textContent='';preview();}
    }else if(event.target.name?.startsWith('repair.')&&isRepair())request();else preview();
   };
   // Existing callers use change for sheet mode; keep this route as well.
   form.elements.mode.onchange=preview;preview();
  },()=>{
   if(loading||!ready)throw new Error('请等待像素处理完成后再确定');
   selectedPlan=planFor($('modal-form'));selectedMode=$('modal-form').elements.mode.value;
  });
 client?.dispose();previewView?.dispose();$('modal-form').oninput=null;$('modal-submit').disabled=false;
 if(!values)return null;
 const plan=selectedPlan,next=createDocument(plan.width,plan.height,file.name.replace(/\.[^.]+$/,'')),canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;
 if(resultPalette)next.palette=[...resultPalette];
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=!processed;next.frames=[];
 for(const r of plan.rects){ctx.clearRect(0,0,canvas.width,canvas.height);if(selectedMode==='single')ctx.drawImage(source,0,0,source.width,source.height,0,0,plan.width,plan.height);else ctx.drawImage(source,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  const rgba=ctx.getImageData(0,0,plan.width,plan.height).data,pixels=[];for(let i=0;i<rgba.length;i+=4)pixels.push(((rgba[i]<<24)|(rgba[i+1]<<16)|(rgba[i+2]<<8)|rgba[i+3])>>>0);next.frames.push({duration:plan.duration,cels:[pixels]});
 }
 return next;
}

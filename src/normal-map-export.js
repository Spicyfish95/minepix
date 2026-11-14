import {normalAngleGuideMarkup,updateNormalAngleGuide,bindNormalAngleGuide} from './normal-map-angle-guide.js';
import {lightingPreviewMarkup,createLightingPreview} from './normal-map-light-preview.js';
import {createImportPreview,previewMarkup} from './import-preview.js';
import {defaultNormalMapOptions,NORMAL_MAP_LIMITS} from './normal-map.js';
import {createNormalMapClient} from './normal-map-client.js';

const numericFields=[['shapeStrength','形状强度'],['normalStrength','法线强度'],['smoothing','平滑次数'],['facets','切面密度'],['paintedLightAngle','原绘光照角度'],['paintedLightInfluence','原绘光照影响']];
export function normalMapFields(){
 const defaults=defaultNormalMapOptions(),number=([key,label])=>`<label>${label}<input name="${key}" type="number" min="0" max="${NORMAL_MAP_LIMITS[key]}" step="1" value="${defaults[key]}" required></label>`;
 return '<label>法线预设<select name="preset"><option value="object">物体</option><option value="character">角色</option><option value="architecture">建筑</option><option value="terrain">地形</option></select></label><details id="normal-map-advanced"><summary>高级设置</summary><div class="repair-groups"><fieldset class="repair-group"><legend>形状与切面</legend><div class="repair-settings">'+numericFields.slice(0,4).map(number).join('')+'</div></fieldset><fieldset class="repair-group"><legend>光照与输出</legend><div class="normal-light-settings"><div class="repair-settings">'+numericFields.slice(5).map(number).join('')+'<div class="repair-option-row"><label><input name="autoLight" type="checkbox" checked>自动估计原绘光照</label>'+numericFields.slice(4,5).map(number).join('')+'</div><div class="repair-option-row"><label><input name="mergeOutlines" type="checkbox" checked>合并轮廓法线</label><label><input name="invertY" type="checkbox">翻转 Y（DirectX）</label></div></div>'+normalAngleGuideMarkup()+'</div></fieldset></div></details>';
}

export async function exportNormalMap(source,{modal,$,showError,saveData,name,message}){
 const image=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);
 let client,preview,lighting,disposeAngle,result=null,output,manualAngle=defaultNormalMapOptions().paintedLightAngle;
 try{
  const values=await modal('导出法线贴图','<div id="normal-preview-pair">'+previewMarkup+lightingPreviewMarkup()+'</div><p>当前帧可见图层 · 原始尺寸 PNG · 保留透明度</p>'+normalMapFields()+'<p id="normal-map-status" role="status" aria-live="polite"></p>',form=>{
   preview=createImportPreview($('image-import-preview'));
   $('image-import-preview').setAttribute('aria-label','法线贴图预览');
   lighting=createLightingPreview($('normal-light-preview'),image);
   client=createNormalMapClient({
    onStatus:stage=>preview.setStatus(stage),
    onResult(value){result=value;if(form.elements.autoLight.checked){form.elements.paintedLightAngle.value=value.estimatedAngle??'';form.elements.paintedLightAngle.placeholder=value.estimatedAngle===null?'无法可靠估计':'';updateNormalAngleGuide($('normal-angle-guide'),value.estimatedAngle,true);}output=document.createElement('canvas');output.width=value.width;output.height=value.height;output.getContext('2d').putImageData(new ImageData(value.data,value.width,value.height),0,0);preview.setImage(output);lighting?.setNormals(value,form.elements.invertY.checked);$('modal-submit').disabled=false;$('normal-map-status').textContent=`法线贴图完成 · ${value.width} × ${value.height} px`;},
    onError(error){preview.clear();$('modal-submit').disabled=true;$('modal-error').textContent=error.message;$('normal-map-status').textContent='法线贴图计算失败';showError('法线贴图计算失败：'+error.message);}
   });
   const request=()=>{
    result=null;lighting?.clear();$('modal-submit').disabled=true;$('modal-error').textContent='';$('normal-map-status').textContent='';
    form.elements.paintedLightAngle.disabled=form.elements.autoLight.checked;form.elements.paintedLightAngle.title=form.elements.autoLight.checked?'关闭“自动估计原绘光照”后可调整角度':'';
    if(form.elements.autoLight.checked){form.elements.paintedLightAngle.value='';updateNormalAngleGuide($('normal-angle-guide'),null,true,true);}else updateNormalAngleGuide($('normal-angle-guide'),form.elements.paintedLightAngle.valueAsNumber,false);
    if(!form.checkValidity()){client.cancel();preview.clear();$('modal-error').textContent='请填写有效的高级设置参数';return;}
    const settings={preset:form.elements.preset.value};
    for(const [key]of numericFields)if(!form.elements[key].disabled)settings[key]=+form.elements[key].value;
    for(const key of ['mergeOutlines','invertY'])settings[key]=form.elements[key].checked;
    preview.loading();client.request(image,settings);
   };
   form.oninput=event=>{
    if(event.target.name==='autoLight'&&!form.elements.autoLight.checked){form.elements.paintedLightAngle.value=manualAngle;form.elements.paintedLightAngle.placeholder='';}
    if(event.target.name==='paintedLightAngle'&&!form.elements.autoLight.checked)manualAngle=form.elements.paintedLightAngle.valueAsNumber;
    if(event.target.name==='preset'){
     const defaults=defaultNormalMapOptions(form.elements.preset.value);
     for(const [key]of numericFields)form.elements[key].value=defaults[key];manualAngle=defaults.paintedLightAngle;
    }
    request();
   };
   disposeAngle=bindNormalAngleGuide($('normal-angle-guide'),angle=>{form.elements.paintedLightAngle.value=angle;form.elements.paintedLightAngle.dispatchEvent(new Event('input',{bubbles:true}));});
   request();
  },()=>{if(!result)throw new Error('请等待法线贴图生成完成后再确定');},{confirm:'导出 PNG'});
  if(values){const saved=await saveData(output.toDataURL('image/png').split(',')[1],'png',name+'-normal');message(saved?'法线贴图已导出':'已取消导出');}
 }finally{disposeAngle?.();client?.dispose();preview?.dispose();lighting?.dispose();$('modal-form').oninput=null;$('modal-submit').disabled=false;}
}

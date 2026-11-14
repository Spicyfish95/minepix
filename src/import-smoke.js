import {checkFormLayout} from './form-layout-smoke.js';
import {repairPalette} from './pixel-repair.js';
export async function pixelRepairSmoke({$,openDocument,importFile,documentState,grass}){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const waitFor=async(predicate)=>{const until=performance.now()+30000;while(!predicate()){if(performance.now()>until)throw new Error('等待导入状态超时：'+$('repair-status')?.textContent+' / '+$('modal-error')?.textContent);await new Promise(r=>setTimeout(r,20));}};
 const input=(el,value)=>{if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 try{
  let pending=importFile(grass,true);check('grass 实际文件进入 Aseprite 确认且提示转换',$('modal').open&&$('ase-warnings').textContent.includes('普通像素图层')&&!$('modal-form').elements.processing);
  $('modal-form').requestSubmit($('modal-submit'));await pending;
  check('grass 确认后进入普通索引图层画布',documentState().width===128&&documentState().layers.length===2&&documentState().layers.every(l=>!l.tilemap)&&documentState().frames[0].cels[1].filter(p=>p&255).length===9086);
  const initial=JSON.stringify(documentState());pending=openDocument();await waitFor(()=>$('modal').open);
  let form=$('modal-form');
  const checkImportColumns=name=>{
   const mode=form.elements.mode.closest('label').getBoundingClientRect(),width=form.elements.width.closest('label').getBoundingClientRect(),height=form.elements.height.closest('label').getBoundingClientRect();
   check(name+'：导入方式半行宽且宽高仍在下一行左右排列',Math.abs(mode.width-width.width)<1&&Math.abs(mode.left-width.left)<1&&Math.abs(width.top-height.top)<1&&width.top>=mode.bottom&&height.left>=width.right);
   if(form.elements.processing){const processing=form.elements.processing.closest('label').getBoundingClientRect();check(name+'：图片处理半行宽',Math.abs(processing.width-width.width)<1);}
  };
  checkImportColumns('普通单图');
  check('原生文件打开默认普通导入',form.elements.processing.value==='normal'&&!$('modal-submit').disabled);
  check('普通导入隐藏高级设置',$('repair-advanced').hidden&&!$('repair-advanced').open);
  await new Promise(requestAnimationFrame);
  check('预览位于导入弹窗内容顶部',$('modal-content').firstElementChild===$('image-import-preview'));
  const area=$('image-import-preview').getBoundingClientRect(),canvas=$('sheet-import-preview'),zoomLabel=$('import-preview-zoom');await waitFor(()=>zoomLabel.textContent.includes('%'));
  check('预览铺满弹窗可用宽度且使用大预览区',area.width>$('modal').clientWidth*.85&&area.height>=220);
  const beforeZoom=zoomLabel.textContent,beforePixels=canvas.toDataURL();canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-200,clientX:area.left+area.width/2,clientY:area.top+area.height/2,bubbles:true,cancelable:true}));
  check('滚轮实际缩放预览',zoomLabel.textContent!==beforeZoom&&canvas.toDataURL()!==beforePixels);
  const capture=canvas.setPointerCapture;canvas.setPointerCapture=()=>{};const zoomed=canvas.toDataURL();
  canvas.dispatchEvent(new PointerEvent('pointerdown',{button:1,pointerId:91,clientX:area.left+100,clientY:area.top+100,bubbles:true,cancelable:true}));
  canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,clientX:area.left+140,clientY:area.top+125,bubbles:true}));
  canvas.dispatchEvent(new PointerEvent('pointerup',{button:1,pointerId:91,bubbles:true}));canvas.setPointerCapture=capture;
  check('中键拖动实际平移预览',canvas.toDataURL()!==zoomed&&!canvas.classList.contains('panning'));
  $('import-preview-fit').click();check('右上角图标按钮恢复适应内容',zoomLabel.textContent===beforeZoom&&canvas.toDataURL()===beforePixels&&$('import-preview-fit').querySelector('svg'));
  check('处理选择文案为像素处理',form.elements.processing.options[1].textContent==='像素处理');

  form.requestSubmit($('modal-submit'));await pending;
  check('普通导入尺寸与像素保留',documentState().width===64&&documentState().height===64&&documentState().frames[0].cels[0][0]===0xff0000ff);
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.mode,'sheet');input(form.elements.width,8);input(form.elements.height,8);input(form.elements.count,2);input(form.elements.duration,70);checkImportColumns('普通精灵表');form.requestSubmit($('modal-submit'));await pending;
  check('普通精灵表仍按切片顺序和时长导入',documentState().width===8&&documentState().frames.length===2&&documentState().frames[1].duration===70&&documentState().frames[1].cels[0][0]===0x00ff00ff);
  const normal=JSON.stringify(documentState());pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');
  input(form.elements.processing,'repair');
  check('修复开始立即显示加载且禁用确定',$('modal-submit').disabled&&$('repair-status').classList.contains('loading')&&$('sheet-import-preview').getAttribute('aria-busy')==='true');
  check('处理中占位含耐心提示及不定进度条',!$('import-preview-loading').hidden&&$('sheet-import-preview').hidden&&!!$('import-preview-loading').querySelector('svg')&&$('import-preview-loading').textContent.includes('请耐心等待')&&!$('import-preview-progress').hasAttribute('value'));
  form.requestSubmit($('modal-submit'));check('处理中请求提交保持表单',$('modal').open&&JSON.stringify(documentState())===normal);
  check('高级设置默认折叠且可展开',!$('repair-advanced').hidden&&!$('repair-advanced').open);$('repair-advanced').open=true;
  await new Promise(requestAnimationFrame);const content=$('modal-content');content.scrollTop=content.scrollHeight;await new Promise(requestAnimationFrame);const pinned=$('image-import-preview').getBoundingClientRect(),view=content.getBoundingClientRect();check('滚动高级设置到底部仍看得到处理预览',content.scrollTop>0&&pinned.top>=view.top-2&&pinned.bottom<=view.bottom+2&&getComputedStyle($('image-import-preview')).position==='sticky');
  await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  check('手动网格未开启时宽高禁用并置灰',form.elements['repair.cellWidth'].disabled&&form.elements['repair.cellHeight'].disabled&&+getComputedStyle(form.elements['repair.cellWidth']).opacity<1);
  check('限色未开启时关联参数禁用',['adaptive','maxColors','dither'].every(key=>form.elements['repair.'+key].disabled));
  check('默认自动算法完成预览且解锁确认',!$('error-dialog').open&&!$('modal-submit').disabled&&$('sheet-import-preview').width>0&&$('repair-status').textContent.includes('完成'));
  input(form.elements['repair.manual'],true);input(form.elements['repair.cellWidth'],8);input(form.elements['repair.cellHeight'],8);
  check('开启手动网格后宽高可编辑',!form.elements['repair.cellWidth'].disabled&&!form.elements['repair.cellHeight'].disabled);
  check('快速调整参数重新锁定确认',$('modal-submit').disabled);
  await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  check('新配置预览为8×8处理结果',!$('error-dialog').open&&$('sheet-import-info').textContent.includes('处理结果 8 × 8')&&form.elements.width.value==='8');
  input(form.elements['repair.reduceColors'],true);input(form.elements['repair.maxColors'],4);
  check('限色重新计算时清除旧列表',$('repair-palette').hidden&&$('repair-palette-colors').children.length===0);
  await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  const listedColors=()=>[...$('repair-palette-colors').querySelectorAll('code')].map(el=>el.textContent);
  const limitedColors=listedColors();
  check('开启限色后关联参数可编辑',['adaptive','maxColors','dither'].every(key=>!form.elements['repair.'+key].disabled));
  check('限色显示色块与HEX列表',!$('repair-palette').hidden&&limitedColors.length>0&&limitedColors.length<=4&&$('repair-palette-colors').querySelectorAll('.repair-palette-swatch').length===limitedColors.length&&+$('repair-palette-count').textContent===limitedColors.length);
  const preview=$('sheet-import-preview').toDataURL();
  form.requestSubmit($('modal-submit'));await pending;
  const repaired=documentState();
  check('确认导入使用修复像素而非原图',repaired.width===8&&repaired.height===8);
  const bytes=new Uint8ClampedArray(repaired.frames[0].cels[0].flatMap(p=>[p>>>24,p>>>16&255,p>>>8&255,p&255]));
  check('限色列表与实际像素一致',JSON.stringify(limitedColors)===JSON.stringify(repairPalette(bytes)));
  check('单图导入后自动设置当前色板',JSON.stringify(repaired.palette)===JSON.stringify(limitedColors)&&document.querySelectorAll('#palette .swatch').length===limitedColors.length);
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');$('modal').close('cancel');await pending;await new Promise(r=>setTimeout(r,300));
  check('加载期间取消不修改项目或弹出过期错误',documentState()===repaired&&!$('error-dialog').open&&!$('modal-submit').disabled&&$('import-preview-loading').hidden);
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');input(form.elements.processing,'normal');
  check('切回普通导入取消计算并恢复原图',!$('modal-submit').disabled&&form.elements.width.value==='64'&&$('repair-advanced').hidden);
  $('modal').close('cancel');await pending;
  const file=await window.desktop.open();await importFile({...file,data:'bad'}).catch(error=>window.dispatchEvent(new ErrorEvent('error',{error})));
  check('损坏图片显示错误框并保留文档',$('error-dialog').open&&documentState()===repaired);$('error-dialog').close();
  // A uniform image has no recoverable grid: show a repair failure, keep confirmation locked, then recover through normal import.
  const blank=document.createElement('canvas');blank.width=32;blank.height=32;
  pending=importFile({type:'image',name:'blank.png',data:blank.toDataURL().split(',')[1]},true);await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');
  await waitFor(()=>$('error-dialog').open);
  check('算法失败弹窗且确定保持禁用',$('modal-submit').disabled&&$('error-detail').textContent.includes('像素处理失败'));$('error-dialog').close();input(form.elements.processing,'normal');
  check('失败后可切回普通导入继续',!$('modal-submit').disabled);$('modal').close('cancel');await pending;
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');input(form.elements['repair.targetWidth'],0);input(form.elements.processing,'normal');
  check('无效高级参数不会阻止普通导入',form.checkValidity()&&!$('modal-submit').disabled&&form.elements['repair.targetWidth'].disabled);$('modal').close('cancel');await pending;
  const svg=btoa('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
  pending=importFile({type:'image',name:'other.svg',mime:'image/svg+xml',data:svg},true);await waitFor(()=>$('modal').open);
  check('可显示但非工具支持类型无修复选项',!$('modal-form').elements.processing&&!$('repair-advanced'));$('modal').close('cancel');await pending;
  // Verify the same palette is carried into a sliced import and reset on mode changes.
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');input(form.elements['repair.manual'],true);input(form.elements['repair.cellWidth'],8);input(form.elements['repair.cellHeight'],8);input(form.elements['repair.reduceColors'],true);input(form.elements['repair.maxColors'],2);
  await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  const twoColors=listedColors();check('限色参数变化更新列表',twoColors.length<=2&&twoColors.length<limitedColors.length);
  input(form.elements['repair.reduceColors'],false);await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  check('关闭限色隐藏并清空列表',$('repair-palette').hidden&&listedColors().length===0);
  input(form.elements['repair.reduceColors'],true);await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  input(form.elements.processing,'normal');check('普通导入隐藏并清空列表',$('repair-palette').hidden&&listedColors().length===0);
  input(form.elements.processing,'repair');await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  const sheetColors=listedColors();input(form.elements.mode,'sheet');input(form.elements.width,4);input(form.elements.height,4);input(form.elements.count,2);
  form.requestSubmit($('modal-submit'));await pending;
  check('精灵表导入后自动设置当前色板',documentState().frames.length===2&&JSON.stringify(documentState().palette)===JSON.stringify(sheetColors));
  // Leave a completed preview open for visual inspection in both source and packaged runs.
  pending=openDocument();await waitFor(()=>$('modal').open);form=$('modal-form');input(form.elements.processing,'repair');input(form.elements['repair.manual'],true);input(form.elements['repair.cellWidth'],8);input(form.elements['repair.cellHeight'],8);input(form.elements['repair.reduceColors'],true);await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);$('repair-advanced').open=true;

  check('禁用项显示具体解锁条件',form.elements['repair.method'].closest('label').title.includes('转为像素画')&&$('repair-unlock-hints').textContent.includes('PixelOE 线条轮廓'));
  input(form.elements['repair.prepass'],'pixeloe-lines');check('选择线条轮廓可启用线稿引导',!form.elements['repair.lineGuide'].disabled);input(form.elements['repair.prepass'],'none');
  input(form.elements['repair.mode'],'convert');
  check('转换模式未开启按块采色时采色下拉禁用',form.elements['repair.colorPicker'].disabled&&!form.elements['repair.method'].disabled);
  input(form.elements['repair.blockPicker'],true);check('开启按块采色启用采色并禁用缩小采样',!form.elements['repair.colorPicker'].disabled&&form.elements['repair.method'].disabled);
  input(form.elements['repair.mode'],'recover-grid');await waitFor(()=>!$('modal-submit').disabled||$('error-dialog').open);
  const modeControl=form.elements['repair.mode'],style=getComputedStyle(modeControl),measure=document.createElement('canvas').getContext('2d');measure.font=style.font;
  check('处理模式文字与下拉箭头不重叠',modeControl.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)>=measure.measureText(modeControl.selectedOptions[0].textContent).width);
  check('限色列表按色系及亮度排列',JSON.stringify(listedColors())===JSON.stringify(['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffffff','#505050']));
  window.minepixLocale.set('en');await new Promise(r=>setTimeout(r,50));
  check('高级设置参数及所有选项可切换英文',!/[\u3400-\u9fff]/.test($('repair-advanced').textContent)&&form.elements['repair.algorithm'].options[0].textContent==='Auto'&&form.elements.processing.options[1].textContent==='Pixel processing');
  window.minepixLocale.set('zh');await new Promise(r=>setTimeout(r,50));
  check('切回中文恢复参数与选项且保留设置',form.elements['repair.algorithm'].options[0].textContent==='自动'&&form.elements['repair.cellWidth'].value==='8'&&form.elements['repair.manual'].checked);
  check('限色色板列表可见且无水平溢出',!$('repair-palette').hidden&&$('repair-palette-colors').scrollWidth<=$('repair-palette-colors').clientWidth+1);
  const WorkerClass=window.Worker;let burstWorkers=0;window.Worker=class extends WorkerClass{constructor(...args){super(...args);burstWorkers++;}};
  try{
   input(form.elements['repair.maxColors'],20);input(form.elements['repair.maxColors'],8);input(form.elements['repair.maxColors'],16);
   check('连续调整立即进入等待参数状态',$('import-preview-stage').textContent.includes('等待参数稳定')&&!$('import-preview-progress').hasAttribute('value'));
   await new Promise(resolve=>setTimeout(resolve,100));check('像素参数未稳定时不启动后台生成',burstWorkers===0);
   await waitFor(()=>!$('modal-submit').disabled);check('像素连续参数只生成最后一次',burstWorkers===1&&$('import-preview-loading').hidden&&$('image-import-preview').getAttribute('aria-busy')==='false');
  }finally{window.Worker=WorkerClass;}
  const settings=$('repair-advanced').querySelector('.repair-settings');check('高级参数为紧凑布局',getComputedStyle(settings).gridTemplateColumns.split(' ').length===4&&form.elements['repair.algorithm'].getBoundingClientRect().height<=30);
  const control=name=>form.elements['repair.'+name],label=name=>control(name).closest('label');
  const groups=[...$('repair-advanced').querySelectorAll('.repair-settings')];
  check('各分组普通参数先于开关且开关从新行开始',groups.every(group=>{
   const children=[...group.children],firstRow=children.findIndex(el=>el.classList.contains('repair-option-row'));
   if(firstRow<0)return true;
   const rowTop=children[firstRow].getBoundingClientRect().top;
   return children.slice(firstRow).every(el=>el.classList.contains('repair-option-row'))&&children.slice(0,firstRow).every(el=>!el.querySelector('input[type=checkbox]')&&el.getBoundingClientRect().bottom<=rowTop+1);
  }));
  const isolatedRow=names=>{
   const row=control(names[0]).closest('.repair-option-row'),bounds=row.getBoundingClientRect(),items=[...row.querySelectorAll('input,select')];
   return items.map(el=>el.name).join(',')===names.map(name=>'repair.'+name).join(',')&&names.every((name,i)=>{
    const r=label(name).getBoundingClientRect();return r.top>=bounds.top-1&&r.bottom<=bounds.bottom+1&&(i===0||r.left>=label(names[i-1]).getBoundingClientRect().right);
   })&&Math.abs(bounds.width-row.parentElement.getBoundingClientRect().width)<12;
  };
  check('指定网格开关及宽高独占一行且开关在前',isolatedRow(['manual','cellWidth','cellHeight']));
  check('按块采色开关及采色下拉独占一行且开关在前',isolatedRow(['blockPicker','colorPicker']));
  check('限色开关及关联参数独占一行且开关在前',isolatedRow(['reduceColors','adaptive','maxColors','dither']));
  content.scrollTop=content.scrollHeight;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);check('高级设置无水平溢出',form.scrollWidth<=form.clientWidth+1);
  checkImportColumns('像素处理');
  checkFormLayout($('modal-content'),check,'像素导入');
  const buttons=$('modal-submit').getBoundingClientRect(),dialog=$('modal').getBoundingClientRect();
  check('高级设置展开后确定按钮完整可见',buttons.bottom<=dialog.bottom&&buttons.bottom<=innerHeight&&buttons.top>=dialog.top);
  return{ok:true,results,preview,grassImported:initial.length>0};
 }catch(error){return{ok:false,results,error:error.stack};}
}

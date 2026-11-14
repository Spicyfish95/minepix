export function checkFormLayout(root,check,name){
 const fields=[...root.querySelectorAll('.form-field')].filter(field=>field.getBoundingClientRect().width>0);
 const failures=[];
 for(const field of fields){
  const caption=field.querySelector(':scope>.field-caption'),control=field.querySelector(':scope>.field-control');
  if(!caption||!control)throw new Error('表单字段缺少标签或控件：'+field.outerHTML);
  if(control.hidden)continue;
  const a=caption.getBoundingClientRect(),b=control.getBoundingClientRect(),r=field.getBoundingClientRect();
  if(a.right>b.left+1||Math.abs(a.top+a.height/2-b.top-b.height/2)>1||b.right>r.right+1)failures.push(caption.textContent.trim()+JSON.stringify({caption:[a.left,a.right,a.top,a.height],control:[b.left,b.right,b.top,b.height],field:[r.left,r.right]}));
 }
 const captions=fields.map(field=>field.querySelector(':scope>.field-caption'));
 check(name+'：标签有冒号且不重复',captions.every(caption=>caption.dataset.hasColon==='true'?getComputedStyle(caption,'::after').content==='none':getComputedStyle(caption,'::after').content.includes('：')));
 const selects=fields.flatMap(field=>[...field.querySelectorAll('select.field-control')]).filter(el=>!el.hidden);
 if(selects.length)check(name+'：下拉箭头独立留白',selects.every(select=>parseFloat(getComputedStyle(select).paddingRight)>=28&&getComputedStyle(select).appearance==='none'));
 check(name+'：文字在左、控件在右且垂直居中'+(failures.length?' '+failures.join('/') : ''),fields.length>0&&!failures.length);
 if(root.matches('#modal-content:not(:has(>.export-presets)):has(>.sheet-fields,>#repair-advanced,>#normal-map-advanced)')){
  const standalone=[...root.querySelectorAll(':scope>.form-field,:scope>.export-presets>.form-field')].filter(el=>el.getBoundingClientRect().width>0);
  if(standalone.length)check(name+'：独立参数只占半行且右侧留空',standalone.every(field=>{
   const parent=field.parentElement,style=getComputedStyle(parent),expected=(parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-16)/2;
   return Math.abs(field.getBoundingClientRect().width-expected)<1;
  }));
 }
 const grids=[...root.querySelectorAll('.repair-settings')].filter(grid=>grid.getBoundingClientRect().width>0);
 for(const grid of grids){
  const first=grid.querySelector(':scope>.form-field').getBoundingClientRect(),gap=parseFloat(getComputedStyle(grid).columnGap),pitch=first.width+gap;
  const labels=[...grid.querySelectorAll('.form-field')];
  check(name+'：分组各行列边界一致/'+grid.closest('fieldset').querySelector('legend').textContent,labels.every(label=>{
   const r=label.getBoundingClientRect(),column=Math.round((r.left-first.left)/pitch);
   return Math.abs(r.width-first.width)<1&&Math.abs(r.left-first.left-column*pitch)<1;
  }));
 }
}

export async function formLayoutSmoke({$,actions,settingsDialog,setTool,applyLocale,createDocument,replaceDocument}){
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const frame=()=>new Promise(requestAnimationFrame);
 const inspect=(root,name)=>{checkFormLayout(root,check,name);const units=[...root.querySelectorAll('.number-unit')].filter(node=>node.getBoundingClientRect().width>0);if(units.length)check(name+'：单位在输入框内右侧置灰且保持纯数值',units.every(node=>{const input=node.querySelector('input'),style=getComputedStyle(node,'::after'),a=node.getBoundingClientRect(),b=input.getBoundingClientRect();return style.position==='absolute'&&style.right==='7px'&&style.content===JSON.stringify(node.dataset.unit)&&style.color!==getComputedStyle(input).color&&Math.abs(a.right-b.right)<1&&input.validity.valid&&!input.value.includes(node.dataset.unit);}));};
 try{
  // The preceding behavior suite closes a menu-opened settings dialog asynchronously.
  while($('modal').classList.contains('application-settings'))await new Promise(resolve=>setTimeout(resolve,20));
  const sample=createDocument(8,8,'表单布局验收');sample.frames[0].cels[0][0]=0xff0000ff;replaceDocument(sample,true);
  let pending=settingsDialog();
  for(const tab of $('settings-tabs').children){
   tab.click();await frame();
   const page=$('settings-page-'+tab.dataset.page);
   if(page.querySelector('.form-field')){inspect(page,'软件设置/'+tab.dataset.page);check('单行设置标签不换行/'+tab.dataset.page,[...page.querySelectorAll('.field-caption')].every(el=>getComputedStyle(el).whiteSpace==='nowrap'));}
   let seenSwitch=false,ordered=true;
   for(const child of page.children){
    if(child.tagName==='H3'){seenSwitch=false;continue;}
    if(!child.classList.contains('form-field')||child.hasAttribute('data-master-switch'))continue;
    if(child.querySelector('input[type=checkbox]'))seenSwitch=true;else if(seenSwitch)ordered=false;
   }
   check('软件设置/'+tab.dataset.page+'普通选项在开关前',ordered);
  }
  $('settings-tab-onion').click();check('洋葱皮总开关位于第一项',$('settings-page-onion').firstElementChild.contains($('modal-form').elements['onion.enabled']));const enabled=$('modal-form').elements['onion.enabled'];enabled.checked=false;enabled.dispatchEvent(new Event('input',{bubbles:true}));check('关闭洋葱皮禁用关联偏好',$('modal-form').elements['onion.before'].disabled);enabled.checked=true;enabled.dispatchEvent(new Event('input',{bubbles:true}));check('开启洋葱皮恢复关联偏好',!$('modal-form').elements['onion.before'].disabled);
  $('settings-tab-keys').click();const profile=$('modal-form').elements['keys.profile'];profile.value='aseprite';profile.dispatchEvent(new Event('change'));await frame();
  inspect($('settings-page-keys'),'快捷键预设重建');
  applyLocale('en');await frame();inspect($('settings-page-keys'),'英文快捷键');applyLocale('zh');
  $('modal').close('cancel');await pending;
  for(const action of ['new','canvas-size','sprite-size','grid-settings','replace-color','image-brightness','image-outline','select-color-range','slices','onion-settings','pen-settings','input']){
   pending=actions[action]();await frame();check('实际打开参数窗口/'+action,$('modal').open);
   inspect($('modal-content'),action);
   if(action==='slices'){
    for(const names of [['pivot','px','py'],['center','cx','cy','cw','ch']]){
     const row=$('modal-form').elements[names[0]].closest('.form-option-row');
     check('切片关联参数独占一行/'+names[0],!!row&&[...row.querySelectorAll('input')].map(el=>el.name).join(',')===names.join(','));
    }
   }
   $('modal').close('cancel');await pending;
  }
  for(const mode of ['gif','sheet-pair']){
   pending=actions[mode==='gif'?'gif':'sheet-pair']();await frame();inspect($('modal-content'),'导出/'+mode);
   check('导出保留单行右对齐/'+mode,[...$('modal-content').querySelectorAll(':scope>.form-field')].filter(el=>el.getBoundingClientRect().width>0).every(el=>Math.abs(el.getBoundingClientRect().width-$('modal-content').clientWidth)<1&&getComputedStyle(el.querySelector('.field-caption')).whiteSpace==='nowrap'));
   const unlabelled=$('modal-form').elements.presetName;
   check('无文字预设输入保持原布局/'+mode,!unlabelled.closest('.form-field'));
   $('modal').close('cancel');await pending;
  }
  setTool('pencil');
  for(const id of ['fill-menu','gradient-menu','stabilizer-menu','pattern-menu','text-style-menu','text-paint-menu','brush-presets-menu']){
   setTool(id==='fill-menu'?'fill':id==='gradient-menu'?'gradient':id.startsWith('text-')?'text':'pencil');
   if(id==='pattern-menu'){actions['select-all']();actions['capture-brush']();}
   const panel=$(id);panel.showPopover();await frame();inspect(panel,'工具参数/'+id);
   if(id==='stabilizer-menu'||id==='text-paint-menu')check('工具关联参数独占一行/'+id,panel.querySelector('.form-option-row')?.children.length===2);
   panel.hidePopover();
  }
  check('无文字工具图标保持原布局',!$('brush-shape').closest('label').classList.contains('form-field')&&!$('paint-opacity').closest('label').classList.contains('form-field'));
  setTool('pencil');void settingsDialog();$('settings-tab-brush').click();await frame();inspect($('settings-page-brush'),'最终笔刷设置布局');
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
}

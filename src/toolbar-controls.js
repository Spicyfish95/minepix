import {normalizeFormLayout,orderFormOptions,normalizeNumberUnits} from './form-layout.js';
import {setButtonIcon} from './icons.js';
import {uiGet as $,uiAll,uiQuery} from './ui-surfaces.js';

const updates=[];
export function syncToolbarControls(){for(const update of updates)update();}

export function normalizeInlineControls(root){
 normalizeNumberUnits(root);
 for(const input of root.querySelectorAll('label input[type=color]')){
  const label=input.closest('label'),field=document.createElement('div');
  field.className=label.className+' color-field';
  const caption=[...label.childNodes].filter(node=>node!==input).map(node=>node.textContent).join('').trim();
  input.setAttribute('aria-label',input.getAttribute('aria-label')||caption);
  field.append(...label.childNodes);label.replaceWith(field);
 }
 if(!root.matches('.options')){normalizeFormLayout(root);orderFormOptions(root);}
}

function popup(host,id,title,icon,nodes,trigger=null){
 const button=trigger||document.createElement('button'),panel=document.createElement('div');
 button.type='button';button.className='icon-button visual-button toolbar-control-trigger';
 button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 setButtonIcon(button,typeof icon==='function'?icon():icon);panel.id=id;panel.className='toolbar-popover';panel.popover='auto';
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);panel.append(...nodes);
 button.popoverTargetElement=panel;host.append(button,panel);
 for(const ids of id==='stabilizer-menu'?[['stabilizer-enabled','stabilizer-distance']]:id==='text-paint-menu'?[['text-stroke','text-stroke-width']]:[]){
  const row=document.createElement('div');row.className='form-option-row';
  const fields=ids.map(id=>panel.querySelector('#'+id).closest('label,.color-field'));fields[0].before(row);row.append(...fields);
 }
 for(const command of panel.querySelectorAll('button')){const text=command.textContent.trim()||command.getAttribute('aria-label')||command.title;command.classList.remove('visual-button','icon-button');command.querySelectorAll('svg').forEach(icon=>icon.remove());if(!command.textContent.trim())command.textContent=text;}
 normalizeFormLayout(panel);orderFormOptions(panel);
 panel.addEventListener('beforetoggle',event=>{
  button.setAttribute('aria-expanded',String(event.newState==='open'));
  if(event.newState==='open'){
   const r=button.getBoundingClientRect();panel.style.left=r.left+'px';panel.style.top=r.bottom+5+'px';
   requestAnimationFrame(()=>{panel.style.left=Math.max(8,Math.min(r.left,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+5,innerHeight-panel.offsetHeight-8))+'px';});
  }
 });
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();panel.hidePopover();button.focus();}});
 return {button,panel};
}

function selectControl(select,icon){
 const host=select.closest('label'),title=host.textContent.replace(select.textContent,'').trim();
 select.setAttribute('aria-label',select.getAttribute('aria-label')||title);
 for(const node of [...host.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
 host.classList.add('toolbar-select-label');select.hidden=true;
 const choices=document.createElement('div');choices.className='toolbar-choices';
 const {button,panel}=popup(host,'toolbar-menu-'+select.id,title,icon,[select,choices]);
 const update=()=>{
  button.disabled=select.disabled;button.dataset.value=select.value;
  const name=typeof icon==='function'?icon(select.value):icon;
  if(button.querySelector('.icon')?.dataset.icon!==name)setButtonIcon(button,name);
  if(select.id==='brush-shape')button.querySelector('.icon').style.transform=select.value==='line'?'rotate('+$('brush-angle').value+'deg)':'';
 };
 const render=()=>{
  choices.replaceChildren();
  for(const option of select.options){
   const choice=document.createElement('button');choice.type='button';choice.textContent=option.textContent;choice.dataset.value=option.value;
   choice.disabled=option.disabled;choice.setAttribute('aria-pressed',String(option.selected));
   choice.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));panel.hidePopover();button.focus();};choices.append(choice);
  }
 };
 panel.addEventListener('beforetoggle',event=>{if(event.newState==='open')render();});
 select.addEventListener('change',update);updates.push(update);update();
}

function group(id,title,icon,ids){
 const nodes=ids.map(id=>$(id).closest('label')||$(id)),host=document.createElement('span');
 host.id=id+'-group';host.className='toolbar-dropdown-group';nodes[0].before(host);
 return popup(host,id+'-menu',title,icon,nodes);
}

function inlineSlider(id,title,max){
 const number=$(id),label=number.closest('label'),range=document.createElement('input');
 label.classList.add('toolbar-slider');label.title=title;
 for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
 range.id=id+'-range';range.type='range';range.min=0;range.max=number.max=max;range.step=1;
 range.setAttribute('aria-label',title+'滑条');number.setAttribute('aria-label',title);label.prepend(range);
 range.oninput=()=>{number.value=range.value;number.dispatchEvent(new Event('change',{bubbles:true}));};
 number.addEventListener('input',()=>{if(number.value!==''&&number.validity.valid)number.dispatchEvent(new Event('change',{bubbles:true}));});
 const update=()=>{range.value=number.value;range.disabled=number.disabled;};
 number.addEventListener('change',update);updates.push(update);update();return label;
}

function initPresets({getBrush,applyBrush}){
 const trigger=uiQuery('[data-action=brush-presets]'),host=document.createElement('span');
 host.className='toolbar-preset-group';trigger.before(host);
 const list=document.createElement('div'),label=document.createElement('label'),name=document.createElement('input'),caption=document.createElement('span');
 list.className='preset-list';list.setAttribute('role','group');list.setAttribute('aria-label','笔刷预设');
 name.id='preset-name';name.type='text';name.maxLength=40;name.value='我的笔刷';caption.textContent='名称';label.append(caption,name);
 const buttons=document.createElement('div'),save=document.createElement('button'),remove=document.createElement('button'),feedback=document.createElement('p');
 buttons.className='preset-actions';save.type=remove.type='button';save.id='preset-save';remove.id='preset-remove';setButtonIcon(save,'save','保存当前设置');setButtonIcon(remove,'clear','删除预设');buttons.append(save,remove);feedback.setAttribute('aria-live','polite');
 const {button,panel}=popup(host,'brush-presets-menu','笔刷预设','brush-presets',[list,label,buttons,feedback],trigger);
 // The shared action dispatcher opens this command for both menu and toolbar entry points.
 button.popoverTargetElement=null;
 const key='pixel-studio-brush-presets',defaults=[{name:'像素铅笔',size:1,shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:true,filled:false,pattern:null},{name:'圆头 4px',size:4,shape:'circle',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null},{name:'半透明圆笔',size:8,shape:'circle',angle:0,opacity:35,ink:'simple',pixelPerfect:false,filled:false,pattern:null}];
 let presets=[],selected=-1;
 const render=()=>{
  list.replaceChildren();remove.disabled=selected<0||presets.length<2;
  presets.forEach((preset,index)=>{const choice=document.createElement('button');choice.type='button';choice.dataset.presetIndex=index;choice.setAttribute('aria-pressed',String(selected===index));
   setButtonIcon(choice,'brush-'+preset.shape,preset.name);choice.onclick=()=>{selected=index;name.value=preset.name;applyBrush(preset);render();};list.append(choice);
  });
 };
 panel.addEventListener('beforetoggle',event=>{if(event.newState==='open'){presets=JSON.parse(localStorage.getItem(key)||'null')||structuredClone(defaults);selected=Math.min(selected,presets.length-1);feedback.textContent='';render();}});
 save.onclick=()=>{const value=name.value.trim();if(!value){name.focus();return;}const preset={name:value,...getBrush()},index=presets.findIndex(item=>item.name===value);if(index<0){presets.push(preset);selected=presets.length-1;}else{presets[index]=preset;selected=index;}localStorage.setItem(key,JSON.stringify(presets));feedback.textContent='已保存笔刷预设';render();};
 remove.onclick=()=>{presets.splice(selected,1);selected=Math.min(selected,presets.length-1);localStorage.setItem(key,JSON.stringify(presets));name.value=presets[selected].name;feedback.textContent='已删除笔刷预设';render();};
 updates.push(()=>{host.hidden=button.hidden;});
}

export function initToolbarControls(presets){
 const toolbar=uiQuery('.options');normalizeInlineControls(toolbar);
 const brush=$('brush');brush.setAttribute('aria-label','笔刷大小');
 for(const node of [...brush.closest('label').childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
 group('symmetry','对称设置','axis-horizontal',['symmetry','symmetry-vertical','symmetry-reset']);
 const sliders=document.createElement('span');sliders.id='brush-sliders';sliders.className='toolbar-sliders';
 sliders.append(inlineSlider('paint-opacity','透明度',100),inlineSlider('brush-angle','角度',360));
 $('paint-options').append(sliders);
 for(const [id,title,icon] of [['stabilizer','笔画稳定器','stabilizer'],['fill','填充设置','fill'],['gradient','渐变设置','gradient'],['pattern','图案笔刷','pattern-align']]){
  const host=$(id+'-controls'),nodes=[...host.children];host.classList.add('toolbar-dropdown-group');popup(host,id+'-menu',title,icon,nodes);
 }
 group('text-style','字体设置','text',['text-family','text-size','text-bold','text-italic','text-antialias','text-ligatures']);
 group('text-paint','文字绘制','text-paint',['text-fill','text-stroke','text-stroke-width']);
 group('wand','魔棒容差','select-wand',['wand-tolerance']);
 $('paint-options').prepend($('symmetry-group'));
 $('selection-kind').closest('label').hidden=true;
 const selectionActions=uiQuery('.selection-inline-actions');
 for(const [id,title,icon,names]of [
  ['selection-choose','选择操作','select',['invert-selection','reselect','select-content','deselect']],
  ['selection-transform','选区变换','move',['transform-selection','flip-x','flip-y']],
  ['selection-pixels','选区像素','copy',['copy','paste','clear']]]){
  const host=document.createElement('span');host.id=id+'-group';host.className='toolbar-dropdown-group';selectionActions.append(host);
  const commands=names.map(name=>selectionActions.querySelector(`[data-action="${name}"]`));
  for(const button of commands){const label=button.getAttribute('aria-label')||button.textContent.trim()||button.title;button.classList.remove('visual-button','icon-button');button.textContent=label;}
  const {panel}=popup(host,id+'-menu',title,icon,commands);
  panel.addEventListener('click',event=>{if(event.target.closest('[data-action]:not(:disabled)'))panel.hidePopover();});
 }
 selectionActions.querySelector('.divider').remove();
 const icons={'brush-shape' :value=>'brush-'+(value||$('brush-shape').value),'ink-mode':'ink','selection-kind':'select','selection-operation':'merge','text-align':value=>'text-align-'+(value||$('text-align').value),'tiled-mode':'tiled-mode'};
 for(const select of uiAll('.options select, #tiled-mode'))if(select.id!=='selection-kind'&&!select.closest('.toolbar-popover'))selectControl(select,icons[select.id]);
 for(const input of toolbar.querySelectorAll('input[type=checkbox]')){
  if(input.closest('.toolbar-popover'))continue;
  const label=input.closest('label'),title=label.textContent.trim(),button=document.createElement('button');
  input.setAttribute('aria-label',title);input.hidden=true;input.tabIndex=-1;label.classList.add('toolbar-toggle-label');
  for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
  button.type='button';button.className='icon-button visual-button toolbar-toggle';button.title=title;button.setAttribute('aria-label',title);
  setButtonIcon(button,input.id==='pixel-perfect'?'pixel-perfect':'shape-filled');
  const update=()=>{button.disabled=input.disabled;button.classList.toggle('active',input.checked);button.setAttribute('aria-pressed',String(input.checked));};
  button.onclick=event=>{event.preventDefault();input.click();};input.addEventListener('change',update);updates.push(update);label.append(button);update();
 }
 // Keep all dropdowns together, followed by the toggle icons, in each tool row.
 const groupUpdates=[];
 for(const root of [toolbar,$('paint-options'),$('selection-options'),$('text-options')]){
  const choices=document.createElement('span'),toggles=document.createElement('span');choices.className='toolbar-dropdowns';toggles.className='toolbar-toggles';
  for(const node of [...root.children]){
   if(node.matches('.toolbar-select-label,.toolbar-dropdown-group'))choices.append(node);
   else if(node.matches('.toolbar-toggle-label'))toggles.append(node);
  }
  const before=[...root.children].find(node=>node.matches('[data-action],.drawing-options'));
  if(choices.children.length)root.insertBefore(choices,before||null);
  if(toggles.children.length)root.insertBefore(toggles,before||null);
  const sections=[choices,toggles,...root.querySelectorAll(':scope>.toolbar-sliders')].filter(section=>section.parentElement===root);
  const separators=sections.slice(1).map(section=>{
   const divider=document.createElement('span');divider.className='divider toolbar-separator';divider.setAttribute('aria-hidden','true');section.before(divider);return divider;
  });
  groupUpdates.push(()=>{
   for(const section of sections)section.hidden=[...section.children].every(child=>child.hidden);
   for(let i=1;i<sections.length;i++)separators[i-1].hidden=sections[i].hidden||!sections.slice(0,i).some(section=>!section.hidden);
  });
 }
 initPresets(presets);
 const canvas=uiQuery('.canvas-actions'),fit=canvas.querySelector('[data-action=fit]');
 fit.classList.add('icon-button','visual-button');setButtonIcon(fit,'fit','适应内容');canvas.prepend(fit);
 const tiled=$('tiled-mode').closest('label');tiled.classList.add('canvas-tiled-control');fit.after(tiled);
 for(const button of toolbar.querySelectorAll('[data-action]')){
  if(button.closest('.toolbar-popover'))continue;
  const title=button.title||button.textContent.trim(),icon=button.querySelector('.icon')?.dataset.icon||'settings';
  button.classList.add('icon-button','visual-button');setButtonIcon(button,icon,title);
 }
 updates.push(()=>{
  $('symmetry-group').hidden=brush.closest('label').hidden;
  $('wand-group').hidden=$('wand-tolerance').closest('label').hidden;
 });
 updates.push(...groupUpdates);
 window.addEventListener('resize',()=>uiAll('.toolbar-popover:popover-open').forEach(panel=>panel.hidePopover()));
 syncToolbarControls();
}

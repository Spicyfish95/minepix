import {uiGet,uiAll,uiQuery} from './ui-surfaces.js';
const $=uiGet;
const action=name=>uiQuery(`[data-action="${name}"]`);
function popup(id,title,parent,nodes){
  const trigger=document.createElement('button'),panel=document.createElement('div');
  trigger.id=id+'-trigger';trigger.className='context-trigger';trigger.textContent=title+' ▾';trigger.setAttribute('popovertarget',id);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  panel.id=id;panel.className='context-popover';panel.popover='auto';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);panel.append(...nodes);document.body.append(panel);parent.append(trigger);
  panel.addEventListener('beforetoggle',event=>{trigger.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open'){const rect=panel.contextPoint||trigger.getBoundingClientRect(),view=trigger.ownerDocument.defaultView;panel.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-290))+'px';panel.style.top='8px';requestAnimationFrame(()=>{panel.style.top=Math.max(8,Math.min(rect.bottom+5,view.innerHeight-panel.offsetHeight-8))+'px';panel.contextPoint=null;});}});
  panel.addEventListener('click',event=>{if(event.target.closest('[data-action]')){panel.hidePopover();trigger.focus({preventScroll:true});}});
  return trigger;
}
function submenu(panelId,title,nodes){
 const parent=$(panelId),group=document.createElement('div'),trigger=document.createElement('button'),panel=document.createElement('div');
 group.className='context-submenu';trigger.type='button';trigger.className='has-submenu';trigger.textContent=title;trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
 panel.id=panelId+'-sub-'+parent.querySelectorAll('.context-submenu').length;panel.className='context-popover context-child';panel.popover='auto';panel.setAttribute('role','menu');panel.setAttribute('aria-label',title);panel.append(...nodes);trigger.setAttribute('popovertarget',panel.id);group.append(trigger,panel);parent.append(group);
 trigger.onpointerenter=()=>panel.showPopover();
 panel.addEventListener('beforetoggle',event=>{trigger.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')requestAnimationFrame(()=>{const r=trigger.getBoundingClientRect(),view=trigger.ownerDocument.defaultView;panel.style.left=Math.max(8,r.right+panel.offsetWidth+8>view.innerWidth?r.left-panel.offsetWidth-4:r.right+4)+'px';panel.style.top=Math.max(8,Math.min(r.top,view.innerHeight-panel.offsetHeight-8))+'px';});});
 parent.addEventListener('pointerover',event=>{const button=event.target.closest('button');if(button&&button!==trigger&&!group.contains(button)&&panel.matches(':popover-open'))panel.hidePopover();});
 trigger.onkeydown=event=>{if(event.key==='ArrowRight'){event.preventDefault();panel.showPopover();panel.querySelector('button:not([hidden]):not(:disabled)')?.focus();}};
 panel.onkeydown=event=>{if(event.key==='ArrowLeft'){event.preventDefault();panel.hidePopover();trigger.focus();}};
 return group;
}
export function initContextUI(){
  const options=uiQuery('.options'),drawing=uiQuery('.drawing-options');
  drawing.id='paint-options';
  popup('view-menu','视图',options,[$('grid').closest('label'),$('onion').closest('label'),action('onion-settings'),action('fit')]);
  popup('brush-menu','笔刷',drawing,[action('capture-brush'),action('brush-presets')]);
  popup('palette-menu','颜色操作',uiQuery('.palette-panel .panel-heading>span'),[action('import-palette'),action('export-palette'),action('extract-palette')]);
  uiQuery('.palette-file-actions').remove();
  popup('canvas-menu','画布',uiQuery('.canvas-label'),['canvas-size','crop-selection','trim-canvas','sprite-size','slices'].map(action));
  const layerHeading=uiQuery('.layer-heading>span');
  const blendLabel=$('layer-blend').closest('label'),opacityLabel=$('opacity').closest('label');
  for(const host of [blendLabel,opacityLabel])host.hidden=false;
  popup('layer-menu','图层操作',layerHeading,[...uiAll('.layer-controls button,.layer-merge-controls button'),$('layer-continuous').closest('label'),blendLabel,opacityLabel]);
  for(const [id,text] of [['layer-blend','混合'],['opacity','不透明度']]){const host=$(id).closest('label'),name=document.createElement('span');name.textContent=text;for(const node of [...host.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();host.prepend(name);}
  const opacityCaption=opacityLabel.querySelector('span'),opacityControl=document.createElement('span');
  opacityCaption.className='field-caption';opacityControl.className='field-control layer-opacity-control';
  opacityControl.append($('opacity'),opacityLabel.querySelector('output'));opacityLabel.classList.add('form-field');opacityLabel.append(opacityControl);
  uiAll('.layer-controls,.layer-merge-controls').forEach(node=>node.remove());
  for(const id of ['palette-menu','layer-menu']){const button=$(id+'-trigger');button.textContent='⋯';button.setAttribute('aria-label',$(id).getAttribute('aria-label'));button.title=$(id).getAttribute('aria-label');}
  uiGet('layer-menu-trigger').hidden=true;
  const timeline=uiQuery('.timeline-toolbar');
  popup('frame-menu','帧操作',timeline,[action('delete-frame'),$('frame-actions'),$('cel-actions'),action('link-cels'),action('unlink-cels'),action('frame-fps')]);
  popup('playback-menu','播放设置',uiQuery('.timeline-options'),[action('add-tag'),action('edit-tag'),action('delete-tag'),$('play-direction').closest('label'),$('play-once').closest('label')]);
  for(const name of ['input','keymap','pen-settings'])action(name).remove();
  const strip=document.createElement('div');strip.className='document-strip';const tabs=uiGet('document-tabs'),theme=uiGet('theme-toggle');tabs.before(strip);strip.append(tabs);
  const recent=document.createElement('button');recent.dataset.action='recent-files';recent.textContent='最近文件…';const plus=popup('document-menu','新建或打开',strip,[action('new'),action('open'),recent]);plus.title='新建或打开文档';plus.setAttribute('aria-label',plus.title);plus.classList.add('document-plus');strip.append(theme);document.querySelector('header').remove();
  const layerActions=document.createElement('span');layerActions.className='layer-actions';
  layerHeading.insertBefore(layerActions,action('add-layer'));
  for(const [name,title] of [['rename-layer','重命名图层'],['layer-up','上移图层'],['layer-down','下移图层'],['duplicate-layer','复制图层'],['delete-layer','删除图层']]){
    const button=action(name)||document.createElement('button');
    button.dataset.action=name;button.title=title;button.setAttribute('aria-label',title);
    layerActions.append(button);
  }
  uiGet('layer-menu').prepend(action('layer-parent'));
  submenu('layer-menu','图层组',['group-layer','ungroup-layer'].map(action));
  submenu('layer-menu','合并',['merge-down','merge-visible'].map(action));
  submenu('frame-menu','帧编辑',[action('delete-frame'),uiGet('frame-actions'),action('frame-fps')]);
  submenu('frame-menu','cel范围',[uiGet('cel-actions')]);submenu('frame-menu','共享图像',[action('link-cels'),action('unlink-cels')]);
  submenu('playback-menu','动画标签',[action('add-tag'),action('edit-tag'),action('delete-tag')]);submenu('playback-menu','播放方式',[uiGet('play-direction').closest('label'),uiGet('play-once').closest('label')]);
  uiAll('.timeline-options>.divider').forEach(node=>node.remove());
  window.addEventListener('resize',()=>uiAll('.context-popover:popover-open').forEach(panel=>panel.hidePopover()));
}
export function updateContextUI({tool,shape,selection,layer,layerCount,selectedFrames,linked}){
  const painting=['pencil','eraser','line','rect','ellipse','fill','curve','polygon','contour'].includes(tool),shapes=['rect','ellipse','polygon','contour'].includes(tool);
  for(const id of ['brush','symmetry','brush-shape'])$(id).closest('label').hidden=!painting||tool==='fill';
  $('brush-angle').closest('label').hidden=!painting||shape!=='line';
  $('pixel-perfect').closest('label').hidden=!['pencil','eraser'].includes(tool);
  $('shape-filled').closest('label').hidden=!shapes;
  $('wand-tolerance').closest('label').hidden=$('selection-kind').value!=='wand';
  action('capture-brush').hidden=!selection;action('crop-selection').hidden=!selection;
  const group=layer.type==='group',reference=layer.type==='reference',background=layer.type==='background';
  {const button=action('toggle-background'),text=background?'转为普通图层':'设为背景图层',label=button.querySelector('span');if(label)label.textContent=text;else button.textContent=text;}
  action('toggle-background').hidden=group||reference;action('group-layer').hidden=background;
  action('ungroup-layer').hidden=!group;action('layer-parent').hidden=background;
  action('merge-down').hidden=group||reference||layerCount<2;action('merge-visible').hidden=layerCount<2;
  $('layer-continuous').closest('label').hidden=group||reference;
  for(const id of ['layer-blend','opacity'])$(id).closest('label').hidden=reference;
  for(const id of ['edit-tag','delete-tag'])$(id).hidden=false;
  action('reverse-frames').hidden=selectedFrames<2;
  action('link-cels').hidden=group||reference||selectedFrames<2;action('unlink-cels').hidden=!linked;
  for(const details of uiAll('.context-submenu'))details.hidden=[...details.lastElementChild.children].every(node=>node.hidden);
}

import {iconMarkup,setButtonIcon,ACTION_ICONS} from './icons.js';
import {uiAll} from './ui-surfaces.js';
const controlUpdates=[];
export function syncVisualControls(){for(const update of controlUpdates)update();}

export function syncVisualTimeline(value){
 for(const button of uiAll('.visual-segments [data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===value));
}

// Keep command names in menus and tooltips; the workspace itself shows the artwork.
export function initVisualWorkspace(){
 const compactButton=(button,icon,label)=>{
  button.title=label;button.setAttribute('aria-label',label);button.classList.add('visual-button');
  button.innerHTML=iconMarkup(icon);
 };
 const commands={'add-color':['plus','添加前景色到色板'],copy:['copy','复制'],paste:['paste','粘贴'],'flip-x':['flip-x','水平翻转'],'flip-y':['flip-y','垂直翻转'],clear:['clear','清除像素'],deselect:['deselect','取消选区'],play:['play','播放 / 暂停'],'add-frame':['frame-add','添加空白帧'],'duplicate-frame':['frame-copy','复制帧'],shortcuts:['keyboard','快捷键与鼠标设置']};
 for(const [action,[icon,label]]of Object.entries(commands)){
  const button=action==='add-color'?document.getElementById(action):document.querySelector(`[data-action="${action}"]`);
  compactButton(button,icon,label);
 }
 for(const [id,icon,label]of [['palette-menu','palette','颜色操作'],['frame-menu','frame','帧操作'],['playback-menu','settings','播放设置']])compactButton(document.getElementById(id+'-trigger'),icon,label);
 for(const [id,icon,label]of [['layer-blend','layers','图层混合模式'],['opacity','alpha','图层不透明度'],['group-mode','folder','图层组模式'],['timeline-mode','select','时间轴选择模式'],['play-range','play','播放范围']]){
  const input=document.getElementById(id),host=input.closest('label');
  if(host.closest('[popover]')){host.title=label;input.setAttribute('aria-label',label);continue;}
  for(const node of [...host.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
  host.insertAdjacentHTML('afterbegin',iconMarkup(icon));host.title=label;input.setAttribute('aria-label',label);
 }
 // The original select remains the single source of truth for keyboard/menu commands.
 const select=document.getElementById('timeline-mode'),group=document.createElement('div');
 group.className='visual-segments';group.setAttribute('role','group');group.setAttribute('aria-label','时间轴选择模式');
 for(const [value,icon,label]of [['frames','frame','选择帧列'],['cels','grid','选择 cel 矩形']]){
  const button=document.createElement('button');button.type='button';button.dataset.mode=value;
  compactButton(button,icon,label);button.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);
 }
 const sync=()=>syncVisualTimeline(select.value);
 select.addEventListener('change',sync);select.closest('label').hidden=true;select.closest('label').before(group);sync();
 const duration=document.getElementById('duration-scope');duration.classList.add('visual-duration');duration.title='当前帧 / 所选帧时长';
 duration.closest('label').classList.add('timeline-duration-field');
 document.getElementById('duration').setAttribute('aria-label','帧时长（毫秒）');
 document.getElementById('preview-frame').title='当前帧 / 总帧数';
 for(const node of document.querySelectorAll('.panel-heading strong[data-heading-icon]')){
  node.title=node.textContent.trim();node.setAttribute('aria-label',node.title);
  for(const child of [...node.childNodes])if(child.nodeType===Node.TEXT_NODE)child.remove();
 }
 document.querySelector('.canvas-mode').title='透明背景';
 const colorHeading=document.querySelector('.palette-panel>.panel-heading'),adjustHeading=document.querySelector('.color-adjust-heading');
 adjustHeading.prepend(...colorHeading.querySelectorAll('button'));colorHeading.remove();

 const action=name=>document.querySelector(`[data-action="${name}"]`),get=id=>document.getElementById(id);
 const moveCommand=(name,parent,icon)=>{const button=action(name);compactButton(button,icon,button.getAttribute('aria-label')||button.textContent.trim()||button.title);parent.append(button);return button;};
 const toggle=(id,parent,icon,label)=>{
  const input=get(id),button=document.createElement('button');button.type='button';button.dataset.toggle=id;
  const text=()=>typeof label==='function'?label(input.checked):label;
  compactButton(button,icon,text());input.closest('label').hidden=true;parent.append(input.closest('label'),button);
  const update=()=>{button.setAttribute('aria-pressed',String(input.checked));compactButton(button,icon,text());};controlUpdates.push(update);input.addEventListener('change',update);
  button.onclick=()=>{input.click();update();};update();return button;
 };
 const cycle=(select,parent,icons,label)=>{
  const button=document.createElement('button');button.type='button';button.dataset.select=select.id||select.getAttribute('aria-label');
  select.hidden=true;parent.append(select,button);
  const update=()=>{const option=select.selectedOptions[0];compactButton(button,icons[select.value]||icons.default,`${label}：${option.textContent}（点击切换）`);button.dataset.value=select.value;};
  button.onclick=()=>{select.selectedIndex=(select.selectedIndex+1)%select.options.length;select.dispatchEvent(new Event('change',{bubbles:true}));update();};
  select.addEventListener('change',update);controlUpdates.push(update);update();return button;
 };
 const removePopup=id=>{get(id+'-trigger')?.remove();get(id).remove();};
 // One drawing row, with the same control sizing throughout.
 const toolbar=document.querySelector('.options'),paint=get('paint-options'),selection=get('selection-options'),textOptions=get('text-options');
 toolbar.querySelector(':scope>.right').remove();paint.querySelector(':scope>.right').remove();
 toolbar.append(paint,selection,textOptions);toolbar.querySelector(':scope>.divider').after(moveCommand('brush-presets',toolbar,'brush-presets'));moveCommand('capture-brush',paint,'select');// 颜色操作菜单是文字菜单，替换颜色要带图标+文案，不能只留一个图标（visual-button 会屏蔽文字）。
const replaceCommand=moveCommand('replace-color',get('palette-menu'),'swap');replaceCommand.classList.remove('visual-button');replaceCommand.replaceChildren();setButtonIcon(replaceCommand,'swap','替换颜色');removePopup('brush-menu');
 // 选区命令直接展开为图标按钮，随选区参数行在选区工具激活时显示。
 for(const [name,icon]of [['invert-selection','invert'],['reselect','reselect'],['select-content','select'],['transform-selection','move']]){const button=action(name);compactButton(button,icon,button.getAttribute('aria-label')||button.textContent.trim()||button.title);}
 // 画布右上只留适应、网格开关与网格设置，其余命令保留在左侧「画布」弹出菜单。
 const canvasActions=document.querySelector('.canvas-actions'),canvasMenuTrigger=get('canvas-menu-trigger');
 canvasMenuTrigger.title='画布尺寸、裁剪与切片';canvasMenuTrigger.setAttribute('aria-label',canvasMenuTrigger.title);
 document.querySelector('.canvas-label').prepend(canvasMenuTrigger);
 moveCommand('fit',canvasActions,'fit');const gridButton=toggle('grid',canvasActions,'grid-guide',checked=>checked?'隐藏像素网格':'显示像素网格');
 const guideButton=document.createElement('button');guideButton.type='button';guideButton.dataset.action='toggle-grid-guide';compactButton(guideButton,'pixel-grid','显示网格');
 moveCommand('grid-settings',canvasActions,'settings');
 // 顺序固定为 适应画布 / 像素网格 / 参考网格 / 网格设置，不依赖原有 DOM 位置。
 canvasActions.append(action('fit'),gridButton,guideButton,action('grid-settings'));
 const timebar=document.querySelector('.timeline-toolbar'),timeOptions=document.querySelector('.timeline-options');
 timeOptions.querySelector(':scope>.divider')?.remove();
 const timelineGroup=(className,label)=>{const node=document.createElement('div');node.className=className+' timeline-control-group';node.setAttribute('role','group');node.setAttribute('aria-label',label);return node;};
 const selectionGroup=timelineGroup('timeline-selection-actions','选择与 Cel 属性');
 selectionGroup.append(group,select.closest('label'),get('frame-selection-info'));
 selectionGroup.append(get('play-range').closest('label'));
 moveCommand('cel-properties',selectionGroup,'cel-properties');
 const frameGroup=timelineGroup('inline-frame-actions','帧编辑');
 timeOptions.append(frameGroup);
 for(const [name,icon]of [['add-frame','frame-add'],['duplicate-frame','frame-copy'],['delete-frame','frame-delete']])moveCommand(name,frameGroup,icon);
 frameGroup.append(get('frame-actions'));
 frameGroup.append(action('frame-fps'));
 for(const [name,icon]of [['frame-left','frame-shift-left'],['frame-right','frame-shift-right'],['reverse-frames','frames-reverse']])compactButton(action(name),icon,action(name).title||action(name).textContent.trim());
 cycle(get('frame-insert'),get('frame-insert').closest('label'),{after:'insert-after',before:'insert-before'},'插入位置');
 for(const text of [...get('frame-insert').closest('label').childNodes])if(text.nodeType===Node.TEXT_NODE)text.remove();
 const celGroup=get('cel-actions');celGroup.classList.add('timeline-control-group');celGroup.setAttribute('role','group');celGroup.setAttribute('aria-label','Cel 范围编辑');
 for(const button of celGroup.querySelectorAll('button'))compactButton(button,button.dataset.action==='clear-cels'?'cel-clear':ACTION_ICONS[button.dataset.action],button.title||button.textContent.trim());
 const linkGroup=timelineGroup('timeline-link-actions','共享图像');
 for(const [name,icon]of [['link-cels','cel-link'],['unlink-cels','cel-unlink']])moveCommand(name,linkGroup,icon);
 const tagGroup=timelineGroup('inline-tag-actions','动画标签');
 for(const [name,icon]of [['add-tag','tag-add'],['edit-tag','tag-edit'],['delete-tag','tag-delete']])moveCommand(name,tagGroup,icon);
 const onionGroup=timelineGroup('inline-onion-actions','洋葱皮');
 toggle('onion',onionGroup,'onion','显示洋葱皮');moveCommand('onion-settings',onionGroup,'settings');removePopup('view-menu');
 timeOptions.replaceChildren(selectionGroup,frameGroup,celGroup,linkGroup,tagGroup,onionGroup);removePopup('frame-menu');
 // 上排：上一帧/播放/下一帧贴左，其余播放项（方向、单次、范围与帧时长）贴右。
 const transportGroup=timelineGroup('timeline-transport-actions','播放控制');
 for(const name of ['previous','play','next'])transportGroup.append(action(name));
 const playbackOptions=document.createElement('div');playbackOptions.className='timeline-playback-options';
 const transportDivider=timebar.querySelector(':scope>.divider');if(transportDivider)playbackOptions.append(transportDivider);
 const playback=document.createElement('div');playback.className='inline-playback-actions';playbackOptions.append(playback);
 const direction=get('play-direction');direction.closest('label').hidden=true;playback.append(direction.closest('label'));
 cycle(direction,playback,{tag:'tag',forward:'play',reverse:'play-reverse',pingpong:'repeat'},'播放方向');
 toggle('play-once',playback,'once','单次播放');removePopup('playback-menu');
 const range=get('play-range');range.closest('label').hidden=true;cycle(range,playback,{all:'frame',selected:'select',default:'tag'},'播放范围');
 const timing=timelineGroup('timeline-timing-actions','帧率与时长');moveCommand('frame-fps',timing,'fps');timing.append(get('duration').closest('label'));playbackOptions.append(timing);
 timebar.querySelector(':scope>.right')?.remove();timebar.append(transportGroup,playbackOptions);
 // One color command row below the dock tab, followed by palette and picker.
 const colors=document.querySelector('.palette-panel'),colorActions=document.createElement('div');colorActions.className='color-action-row';
 const paletteEditor=action('palette-editor');compactButton(paletteEditor,'settings','编辑、排序和删除色板颜色');
 const paletteSize=action('palette-size');compactButton(paletteSize,'grid','色板尺寸');
 colorActions.append(get('add-color'),paletteSize,paletteEditor,get('palette-menu-trigger'),get('doc-color-mode'));colors.prepend(colorActions);
 const modeButton=get('doc-color-mode');compactButton(modeButton,'image','文档颜色模式');
 controlUpdates.push(()=>{const mode=modeButton.dataset.mode;setButtonIcon(modeButton,mode==='INDEXED 8'?'grid':mode==='GRAY 16'?'alpha':'image');modeButton.title='文档颜色模式：'+mode;modeButton.setAttribute('aria-label',modeButton.title);});
 const colorCurrent=document.querySelector('.color-current');get('color-adjustments').insertBefore(colorCurrent,document.querySelector('.color-sv'));
 const channelMode=adjustHeading.querySelector('select');cycle(channelMode,colorCurrent,{hsv:'color-hsv',rgb:'color-rgb'},'颜色通道');
 document.querySelector('footer').insertBefore(get('doc-meta'),action('shortcuts'));document.querySelector('.document-bar').hidden=true;
 for(const button of document.querySelectorAll('[popover] button')){const text=button.textContent.trim()||button.getAttribute('aria-label')||button.title;button.classList.remove('visual-button','icon-button');button.querySelectorAll('svg').forEach(icon=>icon.remove());if(!button.textContent.trim())button.textContent=text;}
 syncVisualControls();
}

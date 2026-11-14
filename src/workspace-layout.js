import {panelWindowChrome} from './window-chrome.js';
import {iconMarkup} from './icons.js';
import {registerSurface,uiGet,syncSurfaceThemes,onUI} from './ui-surfaces.js';
import {registerLocaleSurface} from './i18n.js';
export const LAYOUT_KEY='pixel-studio-layout-v1';
const panelIcons={tools:'pencil',colors:'palette',preview:'zoom',layers:'layers',timeline:'frame',reference:'image',tileset:'tileset','terrain-preview':'terrain'};
const titles={tools:'工具',colors:'颜色',preview:'预览',layers:'图层',timeline:'时间轴',reference:'参考',tileset:'图集','terrain-preview':'地形预览'},homes={tools:'left-top',colors:'left-bottom',preview:'right-top',layers:'right-bottom',timeline:'bottom',reference:'left-top',tileset:'right-bottom','terrain-preview':'left-top'};
// 编辑器逻辑（洋葱皮、播放范围、帧选择等）直接读写这些栏目的控件；存档里缺了它们，渲染时会抛错并卡住新建/打开，所以加载时补回默认栏位。
const CORE=['tools','colors','preview','layers','timeline'];
// 图集栏位只在使用图集图层时出现，因此默认布局不含它；需要时由编辑器插入并在退出时移除。
// 默认布局取用户实际使用的落位：工具在顶部，参考在左上、颜色左下，预览右上、图层右下，时间轴在底部。
const emptyState=()=>({version:1,slots:{top:['tools'],'left-top':['reference'],'left-bottom':['colors'],'right-top':['preview'],'right-bottom':['layers'],bottom:['timeline']},active:{top:'tools','left-top':'reference','left-bottom':'colors','right-top':'preview','right-bottom':'layers',bottom:'timeline'},sizes:{left:420,right:420,top:80,bottom:285,leftSplit:.504,rightSplit:.3},collapsed:true,floating:{}});
export function readLayout(){
 try{
  const state=JSON.parse(localStorage.getItem(LAYOUT_KEY));
  if(!state||state.version!==1)return emptyState();
  const ids=[...Object.values(state.slots).flat(),...Object.keys(state.floating)];
  if(new Set(ids).size!==ids.length||ids.some(id=>!titles[id]))return emptyState();
  // 核心栏目缺失时补回默认栏位而不是整份丢弃，保留用户其余落位与尺寸。
  let repaired=false;
  for(const id of CORE)if(!ids.includes(id)){ids.push(id);state.slots[homes[id]].push(id);if(!state.active[homes[id]])state.active[homes[id]]=id;repaired=true;}
  // 修复缺失栏目不改变用户保存的折叠状态；未保存状态时沿用默认折叠。
  state.collapsed=typeof state.collapsed==='boolean'?state.collapsed:true;
  // 接受包含参考、图集与独立地形预览的存档；图集与地形栏的显隐由编辑器按需管理。
  // 旧存档只有五个面板：补回参考栏，保留用户原有落位与尺寸。
  if(ids.length===5){state.slots[homes.reference].push('reference');ids.push('reference');repaired=true;}
  if(ids.length<6||ids.length>8)return emptyState();
  if(repaired)localStorage.setItem(LAYOUT_KEY,JSON.stringify(state));
  return state;
 }catch{return emptyState();}
}
export function initWorkspaceLayout({canShowPanel=()=>true}={}){
 const root=document.createElement('div');root.id='dock-layout';const center=document.createElement('div');center.className='dock-center';const workspace=document.querySelector('.workspace');center.append(workspace);
 const main=document.querySelector('main'),timeline=document.querySelector('.timeline'),palette=document.querySelector('.palette-panel'),tools=document.getElementById('tools'),right=document.querySelector('.right-panel'),preview=document.createElement('section'),layers=document.createElement('section');
 preview.className='preview-panel';for(let i=0;i<3;i++)preview.append(right.firstElementChild);layers.className='layers-panel';layers.append(...right.children);
 const panels={tools,colors:palette,preview,layers,timeline,reference:document.getElementById('reference-panel'),tileset:document.getElementById('tileset-panel'),'terrain-preview':document.getElementById('terrain-preview-panel')};
 for(const [id,node]of Object.entries(panels)){node.dataset.panel=id;node.classList.add('dock-panel');}
 // 未进入任何栏位的面板挂在这个隐藏容器里，保证其控件始终在 DOM 中可查（面板被删掉时也不会整棵消失）。
 const parking=document.createElement('div');parking.className='dock-parking';parking.hidden=true;for(const node of Object.values(panels))parking.append(node);
 main.before(root);main.remove();document.body.append(parking);root.append(center);
 const slots={},bars={},contents={},sides={};let state=readLayout(),closing=false;const floats=new Map();let drag=null;const dragType='application/x-pixel-panel-'+crypto.randomUUID();onUI('keydown',event=>{if(drag&&event.key==='Escape')drag.cancelled=true;});
 const save=()=>localStorage.setItem(LAYOUT_KEY,JSON.stringify(state));
 // 用户显式隐藏过的栏目记在这里：图集栏位的自动同步不能把它重新打开。
 const userHidden=new Set();
 for(const ids of Object.values(state.slots))for(let i=ids.length-1;i>=0;i--)if(!canShowPanel(ids[i]))ids.splice(i,1);
 for(const id of Object.keys(state.floating))if(!canShowPanel(id))delete state.floating[id];
 const triggerPopupMove=(node,target)=>{for(const trigger of node.querySelectorAll('[popovertarget],[data-popup-target]')){const popup=uiGet(trigger.getAttribute('popovertarget')||trigger.dataset.popupTarget);if(popup){if(popup.matches(':popover-open'))popup.hidePopover();target.body.append(popup);}}};
 const transfer=(id,target)=>{if(panels[id].parentElement===target)return;triggerPopupMove(panels[id],target.ownerDocument);target.append(panels[id]);window.dispatchEvent(new CustomEvent('panel-moved',{detail:{id}}));};
 function applySizes(){
  const dragging=root.classList.contains('dragging-panels'),left=dragging||state.slots['left-top'].length+state.slots['left-bottom'].length>0,right=dragging||state.slots['right-top'].length+state.slots['right-bottom'].length>0;
  for(const [name,visible]of [['left',left],['right',right],['top',state.slots.top.length],['bottom',state.slots.bottom.length&&!state.collapsed]])root.querySelector('.resize-'+name).hidden=!visible;
  const box=root.getBoundingClientRect(),availableW=box.width||innerWidth,availableH=box.height||innerHeight;const[leftWidth,rightWidth]=fitPair(state.sizes.left,state.sizes.right,availableW,360,120),[topHeight,bottomHeight]=fitPair(state.sizes.top,state.sizes.bottom,availableH,200,66);
  root.style.setProperty('--dock-left',(left?leftWidth:0)+'px');root.style.setProperty('--dock-right',(right?rightWidth:0)+'px');root.style.setProperty('--dock-top',(state.slots.top.length?topHeight:dragging?54:0)+'px');root.style.setProperty('--dock-bottom',(state.slots.bottom.length?(state.collapsed?40:bottomHeight):dragging?54:0)+'px');
  for(const side of ['left','right']){const a=state.slots[side+'-top'].length,b=state.slots[side+'-bottom'].length;sides[side].hidden=!dragging&&!a&&!b;sides[side].querySelector('.dock-resizer').hidden=!a||!b;sides[side].style.gridTemplateRows=a&&b?`${state.sizes[side+'Split']}fr 5px ${1-state.sizes[side+'Split']}fr`:dragging?(a?'minmax(0,1fr) 5px 54px':b?'54px 5px minmax(0,1fr)':'1fr 5px 1fr'):a?'1fr 0 0':'0 0 1fr';}
 }
 function render(){
  for(const [name,slot]of Object.entries(slots)){
   const ids=state.slots[name];slot.classList.toggle('empty',!ids.length);slot.classList.toggle('collapsed',name==='bottom'&&state.collapsed);bars[name].replaceChildren();
   if(!ids.includes(state.active[name]))state.active[name]=ids[0];
   for(const id of ['tileset','terrain-preview'])panels[id].hidden=!Object.values(state.slots).some(list=>list.includes(id))&&!state.floating[id];
   for(const id of ids){const tab=document.createElement('button');tab.type='button';tab.draggable=true;tab.innerHTML=iconMarkup(panelIcons[id]);tab.title=titles[id];tab.setAttribute('aria-label',titles[id]);tab.dataset.panelTab=id;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(state.active[name]===id));tab.tabIndex=state.active[name]===id?0:-1;tab.onclick=()=>{state.active[name]=id;if(name==='bottom'&&state.collapsed){state.collapsed=false;render();}else{for(const button of bars[name].querySelectorAll('[data-panel-tab]')){const active=button.dataset.panelTab===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;panels[button.dataset.panelTab].hidden=!active;}applySizes();window.dispatchEvent(new Event('resize'));}save();};tab.ondragstart=event=>startDrag(event,id);tab.ondragend=event=>finishDrag(event,id);tab.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();panelMenu(event,[['删除该栏目',()=>setPanelVisible(id,false)]]);};bars[name].append(tab);transfer(id,contents[name]);panels[id].hidden=state.active[name]!==id;}
   const detachButton=document.createElement('button');detachButton.innerHTML=iconMarkup('detach');detachButton.title='将当前面板移到独立窗口';detachButton.setAttribute('aria-label',detachButton.title);detachButton.className='dock-detach';detachButton.disabled=!ids.length;detachButton.onclick=()=>detach(state.active[name]);bars[name].append(detachButton);
   if(name==='bottom'&&ids.length){const collapse=document.createElement('button');collapse.innerHTML=iconMarkup(state.collapsed?'collapse-up':'collapse-down');collapse.setAttribute('aria-label',state.collapsed?'显示下方栏位':'折叠下方栏位');collapse.title=collapse.getAttribute('aria-label');collapse.onclick=()=>{state.collapsed=!state.collapsed;render();save();};bars[name].append(collapse);}
  }
  applySizes();window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new CustomEvent('panels-changed',{detail:{present:Object.fromEntries(Object.keys(titles).map(id=>[id,panelPresent(id)]))}}));
 }
 window.addEventListener('resize',()=>applySizes());
 function removeFromSlot(id){for(const ids of Object.values(state.slots)){const index=ids.indexOf(id);if(index>=0)ids.splice(index,1);}}
 function dock(id,name,beforeId=null,after=false){if(!canShowPanel(id))return;const floating=floats.get(id);userHidden.delete(id);removeFromSlot(id);delete state.floating[id];const at=state.slots[name].indexOf(beforeId);state.slots[name].splice(at<0?state.slots[name].length:at+(after?1:0),0,id);state.active[name]=id;if(name==='bottom')state.collapsed=false;panels[id].hidden=false;render();save();if(floating){floating.returning=true;floating.child.close();floats.delete(id);}}
 function clearDrag(){root.classList.remove('dragging-panels');for(const slot of Object.values(slots))slot.classList.remove('drop-ready','drop-hover');for(const tab of root.querySelectorAll('[data-drop]'))delete tab.dataset.drop;applySizes();}
 function startDrag(event,id){
  const pending=drag={id,accepted:false,cancelled:false};event.dataTransfer.setData(dragType,id);event.dataTransfer.setData('text/plain','pixel-panel:'+id);event.dataTransfer.effectAllowed='move';
  // Let Chromium establish the native drag before empty targets change the source row.
  requestAnimationFrame(()=>{if(drag!==pending||pending.cancelled)return;root.classList.add('dragging-panels');for(const slot of Object.values(slots))slot.classList.add('drop-ready');applySizes();});
 }
 function finishDrag(event,id){const pending=drag;drag=null;clearDrag();if(pending?.id!==id||pending.accepted||pending.cancelled)return;const target=event.target.ownerDocument===document?document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]'):null;if(target){if(!state.slots[target.dataset.slot].includes(id))dock(id,target.dataset.slot);}else void detach(id);}
 function attachDrop(slot,name){slot.ondragover=event=>{if(!event.dataTransfer.types.includes(dragType))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';for(const other of Object.values(slots))other.classList.toggle('drop-hover',other===slot);for(const tab of root.querySelectorAll('[data-drop]'))delete tab.dataset.drop;const tab=event.target.closest('[data-panel-tab]');if(tab)tab.dataset.drop=event.clientX<tab.getBoundingClientRect().left+tab.offsetWidth/2?'before':'after';};slot.ondragleave=event=>{if(!slot.contains(event.relatedTarget))slot.classList.remove('drop-hover');};slot.ondrop=event=>{const id=event.dataTransfer.getData(dragType);if(!titles[id])return;event.preventDefault();event.stopPropagation();if(drag)drag.accepted=true;const tab=event.target.closest('[data-panel-tab]');if(tab?.dataset.panelTab!==id)dock(id,name,tab?.dataset.panelTab,event.clientX>=(tab?.getBoundingClientRect().left||0)+(tab?.offsetWidth||0)/2);clearDrag();};}
 for(const side of ['left','right']){const container=document.createElement('div');container.className='dock-side dock-'+side;sides[side]=container;root.append(container);}
 for(const name of Object.keys(state.slots)){const slot=document.createElement('section'),bar=document.createElement('div'),content=document.createElement('div');slot.className='dock-slot dock-'+name;slot.dataset.slot=name;bar.className='dock-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label',name+'面板');content.className='dock-content';slot.append(bar,content);slots[name]=slot;bars[name]=bar;contents[name]=content;(name.startsWith('left-')?sides.left:name.startsWith('right-')?sides.right:root).append(slot);attachDrop(slot,name);bar.oncontextmenu=event=>{if(event.target.closest('[data-panel-tab]'))return;event.preventDefault();const missing=Object.keys(titles).filter(id=>canShowPanel(id)&&!panelPresent(id));panelMenu(event,missing.map(id=>['添加「'+titles[id]+'」',()=>dock(id,name)]));};bar.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const tabs=[...bar.querySelectorAll('[role=tab]')],at=tabs.indexOf(event.target);if(at<0)return;event.preventDefault();const tab=tabs[(at+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];tab.click();tab.focus();};}
 // 顶部栏位最小高度＝标签栏 40 + 工具图标行 38（与上方参数栏 38 同高），否则工具条被压没。
 const minSize=name=>name==='top'?80:name==='left'||name==='right'?260:100;
 const maxSize=name=>name==='top'||name==='bottom'?Math.max(160,Math.min(900,innerHeight-240)):Math.max(240,Math.min(900,innerWidth-320));
 const fitPair=(a,b,total,reserve,min)=>{if(a+b<=total-reserve)return[a,b];const scale=(total-reserve)/(a+b);return[Math.max(min,Math.floor(a*scale)),Math.max(min,Math.floor(b*scale))];};
 function resizeHandle(parent,name,axis){const handle=document.createElement('div');handle.className='dock-resizer resize-'+name;handle.setAttribute('role','separator');handle.setAttribute('aria-label','调整'+name+'栏位');handle.tabIndex=0;handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);const initial={...state.sizes},start=axis==='x'?event.clientX:event.clientY;handle.onpointermove=e=>{const delta=(axis==='x'?e.clientX:e.clientY)-start;if(name.endsWith('Split')){const side=name.slice(0,-5);state.sizes[name]=Math.max(.15,Math.min(.85,initial[name]+delta/sides[side].clientHeight));}else state.sizes[name]=Math.max(minSize(name),Math.min(maxSize(name),initial[name]+delta*(['right','bottom'].includes(name)?-1:1)));applySizes();};handle.onpointerup=()=>{handle.onpointermove=null;save();};handle.onpointercancel=()=>{state.sizes=initial;handle.onpointermove=null;applySizes();};};handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;state.sizes[name]=name.endsWith('Split')?Math.max(.15,Math.min(.85,state.sizes[name]+step*.05)):Math.max(minSize(name),Math.min(maxSize(name),state.sizes[name]+step*10));applySizes();save();};parent.append(handle);return handle;}
 for(const side of ['left','right']){const handle=resizeHandle(sides[side],side+'Split','y');sides[side].insertBefore(handle,slots[side+'-bottom']);}
 for(const [name,axis]of [['left','x'],['right','x'],['top','y'],['bottom','y']])resizeHandle(root,name,axis);
 async function detach(id){
  if(!canShowPanel(id))return;
  if(floats.has(id)){floats.get(id).child.focus();return;}
  const home=Object.keys(state.slots).find(name=>state.slots[name].includes(id))||state.floating[id]?.home||homes[id];
  const child=window.open(new URL('./panel.html',location.href).href,'pixel-panel-'+id,'width=420,height=560');if(!child)throw new Error('无法创建面板窗口');
  const floating={child,home,index:state.slots[home].indexOf(id),returning:false};floats.set(id,floating);
  await new Promise(resolve=>{if(child.document.getElementById('floating-root'))resolve();else child.addEventListener('load',resolve,{once:true});});
   if(!canShowPanel(id)){floating.returning=true;child.close();floats.delete(id);return;}
   child.desktop=window.desktop.panelBridge(child);
   const unregister=registerSurface(child.document);child.document.title='MinePix · '+titles[id];panelWindowChrome(child.document,{pinnable:['reference','terrain-preview','preview'].includes(id)});syncSurfaceThemes(document.documentElement.dataset.theme);
   const unregisterLocale=registerLocaleSurface(child.document);
   child.document.addEventListener('pointerdown',event=>{if(event.button===0&&event.target.closest('.window-caption'))void child.desktop.startDragging();});
  const host=child.document.getElementById('floating-root'),bar=child.document.createElement('div');bar.className='floating-header';bar.draggable=true;bar.innerHTML=iconMarkup(panelIcons[id]);bar.title=titles[id];bar.setAttribute('aria-label',titles[id]);bar.ondragstart=event=>startDrag(event,id);bar.ondragend=event=>finishDrag(event,id);bar.oncontextmenu=event=>{event.preventDefault();panelMenu(event,[['删除该栏目',()=>setPanelVisible(id,false)]]);};host.append(bar);removeFromSlot(id);state.floating[id]={home,index:floating.index};transfer(id,host);panels[id].hidden=false;render();save();
  child.addEventListener('beforeunload',()=>{if(!closing&&!floating.returning)dock(id,home,state.slots[home][floating.index]||null);unregisterLocale();unregister();floats.delete(id);});child.addEventListener('resize',()=>child.document.querySelectorAll(':popover-open').forEach(node=>node.hidePopover()));child.focus();
 }
 function reset(){for(const [id,floating]of floats){floating.returning=true;transfer(id,document.createDocumentFragment());floating.child.close();}floats.clear();state=emptyState();render();save();}
 window.addEventListener('beforeunload',()=>{closing=true;for(const {child}of floats.values())child.close();});
 const restoreFloats=Object.keys(state.floating);for(const id of restoreFloats){const home=state.floating[id].home||homes[id];state.slots[home].splice(state.floating[id].index??state.slots[home].length,0,id);delete state.floating[id];}
 // 栏目显隐：隐藏＝从所有栏位移除（独立窗口一并关掉），显示＝放回默认栏位并激活。
 const panelPresent=id=>Object.values(state.slots).some(list=>list.includes(id))||!!state.floating[id];
 const setPanelVisible=(id,visible,{auto=false}={})=>{
  if(visible&&!canShowPanel(id))return;
  if(auto){if(visible&&userHidden.has(id))return;}
  else if(visible)userHidden.delete(id);
  else userHidden.add(id);
  if(visible===panelPresent(id)){
   if(!visible)return;
   if(auto)return;
   const floating=floats.get(id);
   if(floating){floating.child.focus();return;}
   const home=Object.keys(state.slots).find(name=>state.slots[name].includes(id));
   state.active[home]=id;if(home==='bottom')state.collapsed=false;render();save();return;
  }
  if(visible){
   const home=state.floating[id]?.home||homes[id];
   state.slots[home].push(id);if(!auto)state.active[home]=id;render();save();return;
  }
  const floating=floats.get(id);
  if(floating){floating.returning=true;transfer(id,panels[id].ownerDocument.createDocumentFragment());floating.child.close();floats.delete(id);}
  removeFromSlot(id);delete state.floating[id];panels[id].hidden=true;render();save();
 };
 // 栏目标签 / 栏位空白的右键菜单：删除该栏目、添加未显示的栏目。
 const panelMenu=(event,items)=>{
  const doc=event.currentTarget.ownerDocument;for(const node of doc.querySelectorAll('.panel-menu'))node.remove();
  const menu=doc.createElement('div');menu.className='panel-menu';
  for(const [label,run] of items){const button=doc.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{menu.remove();run();};menu.append(button);}
  if(!items.length){const empty=doc.createElement('p');empty.textContent='没有可添加的栏目';menu.append(empty);}
  doc.body.append(menu);
  menu.style.left=Math.max(4,Math.min(event.clientX,doc.documentElement.clientWidth-menu.offsetWidth-6))+'px';
  menu.style.top=Math.max(4,Math.min(event.clientY,doc.documentElement.clientHeight-menu.offsetHeight-6))+'px';
  const close=other=>{if(menu.contains(other.target))return;menu.remove();doc.removeEventListener('pointerdown',close,true);};
  setTimeout(()=>doc.addEventListener('pointerdown',close,true),0);
  return menu;
 };
 const api={dock,detach,reset,dragType,reveal:id=>{if(!canShowPanel(id))return;const floating=floats.get(id);if(floating){floating.child.focus();return;}const home=Object.keys(state.slots).find(name=>state.slots[name].includes(id));if(!home){setPanelVisible(id,true);return;}state.active[home]=id;if(home==='bottom')state.collapsed=false;render();save();},toggleBottom:()=>{state.collapsed=!state.collapsed;render();save();},state:()=>structuredClone(state),panels,floats,root,setPanelVisible,panelMenu,panelPresent,togglePanel:id=>setPanelVisible(id,!panelPresent(id))};render();for(const id of restoreFloats)void detach(id);return api;
}

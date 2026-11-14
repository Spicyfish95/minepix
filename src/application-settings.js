import {shortcutLabel} from './input-guide.js';
import {validateInput} from './input-preferences.js';
import {validatePen} from './pen-dynamics.js';
import {defaultKeymap,asepriteKeymap,validateKeymap,eventBinding} from './keymap-manager.js';
import {restoredExportOptions,pickExportOptions} from './export-settings.js';
import {setTheme,setAppearance} from './theme.js';
import {validateCanvasBackground} from './canvas-background.js';
export const APP_SETTINGS_KEY='pixel-studio-application-v1';
export const DEFAULT_APPLICATION={width:32,height:32,duration:100,language:'zh'};
const select=(label,options)=>({label,options}),number=(label,min,max,step=1)=>({label,type:'number',min,max,step}),check=label=>({label,type:'checkbox'});
const schemas={
 appearance:{title:'常规与显示',fields:{language:select('语言 / Language',{zh:'简体中文',en:'English'}),grid:check('显示网格'),symmetry:check('水平对称绘画'),width:number('新建默认宽度',1,33554432),height:number('新建默认高度',1,33554432),duration:number('新建默认帧时长（ms）',20,10000)}},
 visual:{title:'外观'},
 input:{title:'鼠标与滚轮',fields:{left:select('左键',{tool:'当前工具',pan:'平移',eyedropper:'吸色'}),right:select('右键',{erase:'擦除',background:'背景色绘画',pan:'平移',eyedropper:'吸色'}),wheel:select('滚轮',{zoom:'缩放',pan:'平移',frames:'切帧',brush:'笔刷大小'}),invert:check('反向滚动'),middlePan:check('中键平移'),zoomStep:number('缩放步长',1.05,2,.05),panSpeed:number('平移速度',.25,4,.25)}},
 canvasBackground:{title:'透明背景',fields:{defaultSize:number('新项目方格大小（px）',1,64),defaultColor1:{label:'新项目颜色一',type:'color'},defaultColor2:{label:'新项目颜色二',type:'color'},currentSize:number('当前项目方格大小（px）',1,64),currentColor1:{label:'当前项目颜色一',type:'color'},currentColor2:{label:'当前项目颜色二',type:'color'}}},
 pen:{title:'数位笔与触控',fields:{mode:select('笔压控制',{none:'关闭',size:'笔刷大小',opacity:'透明度',both:'大小与透明度'}),gamma:number('压力曲线',.25,4,.05),minSize:number('最小笔刷比例',.01,1,.01),eraser:check('笔尾橡皮'),touch:select('单指触控',{pan:'平移',draw:'当前工具绘画'})}},
 brush:{title:'笔刷',fields:{size:number('大小',1,128),shape:select('笔形',{square:'方形',circle:'圆形',line:'线形',pattern:'当前图案'}),patternMode:select('图案对齐',{source:'对齐到来源',destination:'对齐到落点',brush:'像素颜色/前景色'}),angle:number('线形角度',0,360),opacity:number('透明度',0,100),ink:select('墨水',{simple:'简单墨水',over:'Alpha 合成',copy:'复制 Alpha+颜色','lock-alpha':'锁定 Alpha'}),pixelPerfect:check('1px像素完美'),filled:check('填充形状')}},
 onion:{title:'洋葱皮',fields:{enabled:check('启用洋葱皮'),before:number('前帧数',0,8),after:number('后帧数',0,8),opacity:number('透明度',0,100),falloff:number('逐帧衰减',0,100),mode:select('着色',{tinted:'自定义颜色',original:'原色'}),previousColor:{label:'前帧颜色',type:'color'},nextColor:{label:'后帧颜色',type:'color'},layers:select('图层范围',{visible:'可见图层',current:'当前图层'}),position:select('叠放位置',{behind:'当前帧下方',front:'当前帧上方'}),wrap:check('循环帧'),limitRange:check('限定播放范围')}},
};
const exportFields={scale:number('放大倍数',1,8),columns:number('列数',1,256),margin:number('边距',0,512),gapX:number('水平间距',0,512),gapY:number('垂直间距',0,512),order:select('排列',{rows:'逐行',columns:'逐列'}),engineFormat:select('引擎格式',{native:'像素工坊',phaser:'Phaser 3',godot:'Godot 4'}),trim:check('裁边'),pack:check('紧密打包'),extrude:number('挤出',0,16),direction:select('播放方向',{tag:'标签默认',timeline:'时间轴',reverse:'倒放',pingpong:'往返'}),repeat:select('循环',{loop:'循环',once:'单次'}),colors:number('GIF色数',2,256),threshold:number('透明阈值',0,255),alphaMode:select('透明处理',{threshold:'阈值',matte:'合成背景'}),matte:{label:'合成背景',type:'color'}};
export async function applicationSettings({modal,state,apply,dispatch}){
 const draft=structuredClone(state),categories={...schemas,keys:{title:'快捷键'},exports:{title:'导出默认值'},workspace:{title:'工作区与数据'}};let form,after;
 const invalid=event=>{const page=event.target.closest('[role=tabpanel]');if(page)document.getElementById('settings-tab-'+page.dataset.page).click();};
 const fields=new Map(),addField=(panel,path,definition,value)=>{
  const label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement(definition.options?'select':'input');caption.textContent=definition.label;input.name=path;if(path==='onion.enabled')label.dataset.masterSwitch='true';
  if(definition.options)for(const [key,text]of Object.entries(definition.options))input.add(new Option(text,key));else{input.type=definition.type||'text';for(const attr of ['min','max','step'])if(definition[attr]!==undefined)input[attr]=definition[attr];}
  if(input.type==='checkbox')input.checked=value;else input.value=value;input.required=input.type==='number';label.append(caption,input);panel.append(label);fields.set(path,{input,definition});return input;
 };
 const read=()=>{for(const [path,{input}]of fields){const parts=path.split('.');let target=draft;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=path.startsWith('keys.bindings.')?input.value.split(';').map(s=>s.trim()).filter(Boolean):input.type==='checkbox'?input.checked:input.type==='number'?+input.value:input.value;}
  validateCanvasBackground({size:draft.canvasBackground.defaultSize,color1:draft.canvasBackground.defaultColor1,color2:draft.canvasBackground.defaultColor2});validateCanvasBackground({size:draft.canvasBackground.currentSize,color1:draft.canvasBackground.currentColor1,color2:draft.canvasBackground.currentColor2});draft.input=validateInput(draft.input);draft.pen=validatePen(draft.pen);draft.keys=validateKeymap(draft.keys);if(draft.brush.shape==='pattern'&&!draft.brush.pattern)throw new Error('请先从选区创建图案笔刷');return draft;
 };
 const result=await modal('软件设置','<div class="settings-layout"><div id="settings-tabs" role="tablist" aria-label="设置分类"></div><div id="settings-pages"></div></div>',current=>{
  form=current;form.addEventListener('invalid',invalid,true);document.getElementById('modal').classList.add('application-settings');
  const tabs=document.getElementById('settings-tabs'),pages=document.getElementById('settings-pages');
  const switchTab=name=>{for(const tab of tabs.children){tab.setAttribute('aria-selected',String(tab.dataset.page===name));tab.tabIndex=tab.dataset.page===name?0:-1;}for(const page of pages.children)page.hidden=page.dataset.page!==name;};
  for(const [name,category]of Object.entries(categories)){
   const tab=document.createElement('button'),page=document.createElement('section');tab.type='button';tab.textContent=category.title;tab.dataset.page=page.dataset.page=name;tab.id='settings-tab-'+name;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','settings-page-'+name);page.id='settings-page-'+name;page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',tab.id);tab.onclick=()=>switchTab(name);tabs.append(tab);pages.append(page);
   if(category.fields)for(const [key,definition]of Object.entries(category.fields))addField(page,name+'.'+key,definition,draft[name][key]);
  }
  const backgroundHelp=document.createElement('p');backgroundHelp.textContent='方格大小按作品像素计算；缩放画布时方格同步缩放，同一画布内的方格数量不变，不改变作品像素。新项目设置用于以后新建的项目；当前项目设置保存后应用，可撤销并随项目保存。';pages.querySelector('[data-page=canvasBackground]').prepend(backgroundHelp);
  const visual=pages.querySelector('[data-page=visual]');visual.innerHTML='<h2>外观</h2><h3>视觉风格</h3><div class="visual-mode-setting"><span>模式</span><div class="visual-mode-choices" role="group" aria-label="外观模式"></div></div>';
  const modeChoices=visual.querySelector('.visual-mode-choices');
  const syncModes=()=>{for(const button of modeChoices.children)button.setAttribute('aria-pressed',String(button.dataset.theme===draft.visual.theme));};
  for(const [value,label] of [['system','跟随系统'],['light','亮色主题'],['dark','深色主题']]){const button=document.createElement('button');button.type='button';button.className='visual-mode-choice';button.dataset.theme=value;button.title=label;button.setAttribute('aria-label',label);button.innerHTML=`<span class="visual-mode-preview ${value}" aria-hidden="true"><i></i><b></b></span><span class="visual-mode-label">${label}</span>`;button.onclick=()=>{draft.visual.theme=value;setTheme(value);syncModes();};modeChoices.append(button);}syncModes();
  const palette=document.createElement('div');palette.className='visual-palette-setting';palette.innerHTML='<label>主题色 <input type="color" id="visual-accent"></label><button type="button" id="visual-accent-reset">恢复默认</button><label>字体 <select id="visual-font"><option value="system">系统默认</option><option value="sans">无衬线</option><option value="mono">等宽字体</option></select></label>';visual.append(palette);
  const accent=palette.querySelector('#visual-accent'),font=palette.querySelector('#visual-font');accent.value=draft.visual.accent||getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();font.value=draft.visual.font;
  accent.oninput=()=>{draft.visual.accent=accent.value;setAppearance(draft.visual);};font.onchange=()=>{draft.visual.font=font.value;setAppearance(draft.visual);};palette.querySelector('#visual-accent-reset').onclick=()=>{draft.visual.accent=null;setAppearance(draft.visual);accent.value=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();};
  tabs.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const list=[...tabs.children],index=list.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,index+(event.key==='ArrowDown'?1:-1)));list[next].click();list[next].focus();};
  const keys=pages.querySelector('[data-page=keys]'),profile=addField(keys,'keys.profile',select('操作预设',{studio:'像素工坊',aseprite:'Aseprite常用'}),draft.keys.profile),search=document.createElement('input');search.placeholder='搜索动作或按键';search.setAttribute('aria-label','搜索快捷键');keys.append(search);
  const keyList=document.createElement('div');keyList.className='settings-key-list';keys.append(keyList);
  const fillKeys=()=>{for(const [path]of fields)if(path.startsWith('keys.bindings.'))fields.delete(path);keyList.replaceChildren();for(const [action,bindings]of Object.entries(draft.keys.bindings)){const input=addField(keyList,'keys.bindings.'+action,{label:shortcutLabel(action)},bindings.join('; '));input.onkeydown=event=>{if(['Tab','Backspace','Delete'].includes(event.key))return;const binding=eventBinding(event);if(binding){event.preventDefault();input.value=binding;}};}search.oninput=()=>{for(const row of keyList.children)row.hidden=!row.textContent.toLowerCase().includes(search.value.toLowerCase())&&!row.querySelector('input').value.toLowerCase().includes(search.value.toLowerCase());};};
  profile.onchange=()=>{draft.keys=profile.value==='aseprite'?asepriteKeymap():defaultKeymap();fillKeys();};fillKeys();
  const exports=pages.querySelector('[data-page=exports]');draft.exports={};for(const [family,mode,title]of [['png','png','当前帧PNG'],['sheet','sheet-pair','精灵表'],['gif','gif','GIF动画'],['sequence','sequence','PNG序列']]){const heading=document.createElement('h3');heading.textContent=title;exports.append(heading);draft.exports[family]=pickExportOptions(restoredExportOptions(state.exportState,mode,state.frameCount));for(const [key,value]of Object.entries(draft.exports[family]))if(exportFields[key])addField(exports,'exports.'+family+'.'+key,exportFields[key],value);}
  const workspace=pages.querySelector('[data-page=workspace]');workspace.innerHTML='<p>面板布局、快捷键、鼠标与数位笔、主题和导出默认值保存在本机。像素、图层、颜色模式和画布尺寸属于作品，不作为软件偏好。</p><p>项目自动恢复、临时写入与覆盖备份始终启用。</p>';
  for(const [pageName,label,action]of [['keys','应用并管理键位文件','keymap'],['brush','应用并管理笔刷预设','brush-presets'],['exports','应用并管理导出预设','export'],['workspace','应用并恢复项目','recover'],['workspace','应用并恢复默认布局','reset-layout']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{after=action;form.requestSubmit(document.getElementById('modal-submit'));};pages.querySelector('[data-page='+pageName+']').append(button);}
  const syncDependencies=()=>{const enabled=fields.get('onion.enabled').input.checked;for(const [path,{input}]of fields)if(path.startsWith('onion.')&&path!=='onion.enabled')input.disabled=!enabled;};
  fields.get('onion.enabled').input.oninput=syncDependencies;syncDependencies();
  switchTab('appearance');
 },read);
 form.removeEventListener('invalid',invalid,true);document.getElementById('modal').classList.remove('application-settings');
 if(result){apply(read());if(after)dispatch(after);}else{setTheme(state.visual.theme);setAppearance(state.visual);}
}

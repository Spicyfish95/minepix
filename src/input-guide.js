import {DEFAULT_BINDINGS,defaultKeymap,asepriteKeymap,validateKeymap,eventBinding} from './keymap-manager.js';
import {DEFAULT_INPUT,validateInput} from './input-preferences.js';
import {TOOLS} from './interaction.js';

const names={screenshot:'屏幕截图','capture-brush':'从选区建立笔刷',new:'新建文档',open:'打开文档',save:'保存项目','save-as':'另存为',export:'导出',undo:'撤销',redo:'重做',copy:'复制',cut:'剪切',paste:'粘贴','select-all':'全选',deselect:'取消选区',grid:'显示/隐藏网格',onion:'洋葱皮','add-layer':'新建图层','add-frame':'空白帧','duplicate-frame':'复制帧','flip-x':'水平翻转','flip-y':'垂直翻转',fit:'适应画布','actual-size':'原始大小','swap-colors':'交换前后景色',previous:'上一帧',next:'下一帧','zoom-in':'放大','zoom-out':'缩小','brush-smaller':'缩小笔刷','brush-larger':'放大笔刷',shortcuts:'快捷键与鼠标',play:'播放 / 暂停','canvas-size':'画布尺寸',slices:'切片','replace-color':'替换颜色','sprite-size':'图像大小','grid-settings':'网格设置','selection-ellipse':'椭圆选区','selection-lasso':'自由套索','selection-polygon':'多边形套索','selection-wand':'魔棒','invert-selection':'反选',reselect:'重选','reopen-document':'重新打开关闭的文档','close-document':'关闭文档','transform-selection':'缩放 / 旋转选区','grid-select':'网格选取（按住）'};

export function shortcutLabel(action){return action.startsWith('tool:')?TOOLS.find(tool=>tool[0]===action.slice(5))[2]:names[action];}

export async function inputGuide({modal,keys,input,saveData,openKeymap}){
 let draft=structuredClone(keys);const mouse={...input};let form;
 const html=`<div class="input-guide-layout">
 <section><h3>键盘快捷键</h3><label>操作预设<select name="profile"><option value="studio">MinePix 默认</option><option value="aseprite">Aseprite 常用子集</option></select></label>
 <label>搜索<input name="search" placeholder="动作、按键或名称" aria-label="搜索快捷键"></label>
 <div class="keymap-buttons"><button type="button" id="keymap-reset">重置默认</button><button type="button" id="keymap-export">导出配置</button><button type="button" id="keymap-import">导入配置</button></div>
 <p class="guide-note">点击按键框后按组合键；多个绑定用分号分隔，清空可取消绑定。确认后保存，冲突会提示。</p><div id="keymap-list" class="shortcut-list"></div></section>
 <section class="mouse-guide"><h3>鼠标与滚轮</h3>
 <label>左键<select name="mouse.left"><option value="tool">当前工具</option><option value="pan">平移</option><option value="eyedropper">吸色</option></select></label>
 <label>右键<select name="mouse.right"><option value="erase">擦除</option><option value="background">背景色绘画</option><option value="pan">平移</option><option value="eyedropper">吸色</option></select></label>
 <label>滚轮<select name="mouse.wheel"><option value="zoom">缩放</option><option value="pan">平移</option><option value="frames">切帧</option><option value="brush">笔刷大小</option></select></label>
 <label>反向滚动<input name="mouse.invert" type="checkbox" role="switch"></label><label>中键平移<input name="mouse.middlePan" type="checkbox" role="switch"></label>
 <label>缩放步长<input name="mouse.zoomStep" type="number" min="1.05" max="2" step=".05" required></label><label>平移速度<input name="mouse.panSpeed" type="number" min=".25" max="4" step=".25" required></label>
 <div class="input-gestures"><h3>固定交互</h3><p>空格：临时平移（MinePix 默认轻按切换播放）<br>Alt：临时吸色<br>选区工具按住 G：网格选取，松开恢复自由矩形<br>Ctrl / Cmd + 滚轮：缩放<br>平移滚轮 + Shift：水平平移<br>Shift / Ctrl：时间轴范围 / 离散选择<br>Esc：取消当前操作；方向键：微调/导航</p><p>固定交互不参与自定义绑定。Aseprite 预设的选区修饰键以其操作约定为准。</p></div></section></div>`;
 const readMouse=()=>{for(const key of Object.keys(DEFAULT_INPUT)){const field=form.elements['mouse.'+key];mouse[key]=field.type==='checkbox'?field.checked:field.type==='number'?+field.value:field.value;}return validateInput(mouse);};
 const fillMouse=()=>{for(const [key,value]of Object.entries(mouse)){const field=form.elements['mouse.'+key];if(field.type==='checkbox')field.checked=value;else field.value=value;}};
 const result=await modal('快捷键与鼠标操作',html,current=>{
  form=current;const dialog=document.getElementById('modal');dialog.classList.add('input-guide');
  const list=document.getElementById('keymap-list'),search=form.elements.search;
  const filter=()=>{const query=search.value.toLowerCase();for(const row of list.children)row.hidden=!(row.dataset.search+' '+row.querySelector('input').value.toLowerCase()).includes(query);};
  const fillKeys=()=>{list.replaceChildren();for(const action of Object.keys(DEFAULT_BINDINGS)){
   const row=document.createElement('label'),caption=document.createElement('span'),field=document.createElement('input');
   const name=shortcutLabel(action);caption.textContent=name;field.setAttribute('aria-label',name+'快捷键');field.value=draft.bindings[action].join('; ');field.dataset.binding=action;row.dataset.search=(action+' '+name).toLowerCase();
   field.onkeydown=event=>{if(event.isComposing||['Tab','Backspace','Delete','Escape'].includes(event.key))return;const binding=eventBinding(event);if(binding){event.preventDefault();field.value=binding;draft.bindings[action]=[binding];}else if(!['Control','Alt','Shift','Meta'].includes(event.key))event.preventDefault();};
   field.oninput=()=>{draft.bindings[action]=field.value.split(';').map(value=>value.trim()).filter(Boolean);};row.append(caption,field);list.append(row);
  }filter();};
  form.elements.profile.value=draft.profile;form.elements.profile.onchange=()=>{draft=form.elements.profile.value==='aseprite'?asepriteKeymap():defaultKeymap();fillKeys();};search.oninput=filter;
  document.getElementById('keymap-reset').onclick=()=>{draft=defaultKeymap();Object.assign(mouse,DEFAULT_INPUT);form.elements.profile.value='studio';search.value='';fillKeys();fillMouse();document.getElementById('modal-error').textContent='';};
  document.getElementById('keymap-export').onclick=async()=>{try{await saveData(JSON.stringify(validateKeymap(draft),null,2),'json','keymap');}catch(error){document.getElementById('modal-error').textContent=error.message;}};
  document.getElementById('keymap-import').onclick=async()=>{try{const text=await openKeymap();if(text){draft=validateKeymap(JSON.parse(text));form.elements.profile.value=draft.profile;fillKeys();document.getElementById('modal-error').textContent='';}}catch(error){document.getElementById('modal-error').textContent=error.message;}};
  fillKeys();fillMouse();
 },()=>({keys:validateKeymap(draft),input:readMouse()}));
 document.getElementById('modal').classList.remove('input-guide');
 return result?{keys:validateKeymap(draft),input:readMouse()}:null;
}

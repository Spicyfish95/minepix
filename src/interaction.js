import { ICONS } from './icons.js';
export const TOOLS = [
  ['pencil','pencil','铅笔','B'],['eraser','eraser','橡皮','E'],['fill','fill','填充','G'],['gradient','gradient','渐变','Shift+G'],
  ['eyedropper','eyedropper','吸管','I'],['line','line','直线','L'],['rect','rect','矩形','U'],
  ['ellipse','ellipse','椭圆','O'],['curve','curve','曲线','K'],['polygon','polygon','多边形','P'],['contour','contour','轮廓','C'],['select','select-rect','矩形选区','M'],['selection-ellipse','select-ellipse','椭圆选区',''],['selection-lasso','select-lasso','自由套索',''],['selection-polygon','select-polygon','多边形套索',''],['selection-wand','select-wand','魔棒选区',''],['move','move','移动','V'],
  ['blur','blur','模糊','R'],['text','text','文字','T'],['slice','slice','切片工具','Shift+C'],['hand','hand','平移','H'],['zoom','zoom','缩放','Z']
];
export const TOOL_GROUPS = [
  ['select','selection-ellipse','selection-lasso','selection-polygon','selection-wand'],['move'],['pencil'],['eraser'],['eyedropper'],['zoom'],['hand'],['fill','gradient'],
  ['line','curve'],['rect','ellipse'],['contour','polygon'],['blur'],['text'],['slice']
];
export const SHORTCUTS = [
  ['cel 范围','时间轴切换 cel 矩形；拖动或 Shift 选矩形，方向键导航 / Shift 扩展；聚焦时间轴时 Ctrl+C/X/V 与 Delete 操作 cel'],
  ['时间轴多选','点击帧头或 cel；Shift 连续范围，Ctrl / Cmd 离散多选；拖动帧头重排全部图层'],
  ['工具切换','B 铅笔 / E 橡皮 / G 填充 / I 吸管'],
  ['形状与选区','L 直线 / U 矩形 / O 椭圆 / K 曲线 / P 多边形 / C 轮廓 / M 选区 / V 移动'],
  ['平移与缩放','H 平移 / Z 缩放；缩放工具按 Alt 缩小'],
  ['临时工具','按住 Alt 吸色；按住空格或中键拖动平移'],
  ['网格选取','选区工具中按住 G 进入网格选取，松开恢复自由矩形；点击选中整格，拖动选择多格'],
  ['动画播放','单按空格播放 / 暂停；平移后松开不触发播放'],
  ['绘图约束','Shift：直线按 45°、矩形 / 椭圆 / 选区等宽高、移动锁定轴'],
  ['鼠标操作','滚轮以鼠标为中心缩放；绘画工具右键擦除'],
  ['笔刷与颜色','- 缩小 / = 放大；X 交换前景色与背景色'],
  ['文件操作','Ctrl+N 新建 / Ctrl+O 打开 / Ctrl+S 保存 / Ctrl+Shift+S 另存为 / Ctrl+Shift+E 导出'],
  ['历史记录','Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做'],
  ['剪贴板','Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴'],
  ['选区','Ctrl+A 全选 / Ctrl+D 取消 / Ctrl+T 缩放旋转 / Delete 清除 / Esc 取消当前操作'],
  ['移动像素','V 工具或有选区时方向键移动 1 px；Shift+方向键移动 10 px'],
  ['动画帧','逗号 / 句号切换帧；无选区且非移动工具时也可用左右键'],
  ['新建内容','Shift+N 空白帧 / Shift+D 复制帧 / Ctrl+Shift+N 新图层'],
  ['翻转','Shift+H 水平翻转 / Shift+V 垂直翻转'],
  ['视图','F 适应画布 / 1 原始大小 / Ctrl+= 放大 / Ctrl+- 缩小'],
  ['显示辅助','Ctrl+G 显示/隐藏网格 / Ctrl+Shift+O 洋葱皮；旁边洋葱图标设置前后帧、染色及范围；F1 快捷键说明'],
  ['地形预览','参考栏位的「地形预览」页签：选图集图层与地形后左键刷格子、右键擦除；只做显示效果，不进出图、不进图层']
];
export function isTextTarget(target) {
  return !!target && (target.isContentEditable || !!target.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}
export function shortcut(event) {
  if(event.isComposing || event.keyCode === 229)return null;
  const key=event.code?.startsWith('Key')?event.code.slice(3).toLowerCase():String(event.key).toLowerCase();
  if(event.ctrlKey||event.metaKey){
    if(event.altKey)return null;
    const map=event.shiftKey?{n:'add-layer',s:'save-as',e:'export',z:'redo',o:'onion'}:{n:'new',o:'open',s:'save',z:'undo',y:'redo',c:'copy',x:'cut',v:'paste',a:'select-all',d:'deselect',g:'grid'};
    return map[key]?{action:map[key]}:null;
  }
  if(event.altKey)return null;
  if(event.code==='Space'||key===' ')return {action:'space'};
  if(key==='escape')return {action:'cancel'};
  if(key==='f1')return {action:'shortcuts'};
  if(key==='delete'||key==='backspace')return {action:'clear'};
  if(key.startsWith('arrow'))return {action:'arrow',direction:key.slice(5)};
  if(event.code==='BracketLeft'||key==='[')return {action:'brush',delta:-1};
  if(event.code==='BracketRight'||key===']')return {action:'brush',delta:1};
  if(event.code==='Comma'||key===',')return {action:'previous'};
  if(event.code==='Period'||key==='.')return {action:'next'};
  if(['=','+'].includes(event.key)||event.code==='NumpadAdd')return {action:'zoom-in'};
  if(event.key==='-'||event.code==='NumpadSubtract')return {action:'zoom-out'};
  if(key==='1'||event.code==='Digit1'||event.code==='Numpad1')return {action:'actual-size'};
  if(key==='x')return {action:'swap-colors'};
  if(key==='f')return {action:'fit'};
  if(event.shiftKey&&{n:1,d:1,h:1,v:1}[key])return {action:{n:'add-frame',d:'duplicate-frame',h:'flip-x',v:'flip-y'}[key]};
  const tool=TOOLS.find(t=>t[3].toLowerCase()===key);
  return tool?{action:'tool',tool:tool[0]}:null;
}
export const SELECTION_KINDS=['rect','ellipse','lasso','polygon','wand','grid'];
export function selectionCursor(kind) {
  return SELECTION_KINDS.includes(kind)?'select-'+kind:'select';
}
export function pointerMode({tool,space=false,alt=false,gesture=null,button=0,busy=false,playing=false,locked=false,visible=true,rightButtonMode='erase',selectionKind='rect'}) {
  if(busy)return {tool,cursor:'wait',blocked:true};
  if(gesture?.kind==='pan')return {tool:'hand',cursor:'grabbing'};
  const active=gesture?.kind || (space||button===1?'hand':alt&&tool!=='zoom'?'eyedropper':tool);
  if(active==='hand')return {tool:active,cursor:'grab'};
  if(active==='zoom')return {tool:active,cursor:alt?'zoom-out':'zoom-in'};
  const edits=!['select','slice','eyedropper'].includes(active);
  if(playing || (edits&&(locked||!visible)))return {tool:active,cursor:'not-allowed',blocked:true};
  const erasing=active==='eraser'||gesture?.erasing||(gesture?.erasing===undefined&&gesture?.color===0)||button===2&&rightButtonMode==='erase'&&['pencil','line','rect','ellipse','fill','curve','polygon','contour'].includes(active);
  return {tool:active,cursor:active==='select'?selectionCursor(gesture?.selectionKind||selectionKind):erasing?'eraser':active,brush:['pencil','eraser','line','rect','ellipse','curve','polygon','contour','blur'].includes(active),erasing};
}
// 绘制类光标分组：同组工具共用一套光标，十字准星中点即绘制落点，右下角小图元仅用于区分工具组，不复用工具栏图标。
const CURSOR_GROUPS={'select':'select','select-rect':'select','select-ellipse':'select','select-lasso':'select','select-polygon':'select','select-wand':'select','select-grid':'select',line:'line',curve:'line',rect:'shape',ellipse:'shape',contour:'path',polygon:'path',blur:'blur',pencil:'pencil',eraser:'eraser',move:'move'};
// 填充与取色保留原工具图标光标：它们是「点选」而非绘制，用户明确要求不改。
const TOOL_ICON_CURSORS={fill:[9,9],eyedropper:[3,17]};
const CROSS='<path d="M10 2.6v4.6M10 12.8v4.6M2.6 10h4.6M12.8 10h4.6"/>';
const GROUP_GLYPHS={select:'<path d="M12.9 12.9h5.7v5.7h-5.7z" stroke-dasharray="1.7 1.5"/>',line:'<path d="M12.5 18.7 18.5 12.7"/><circle cx="12.1" cy="19.1" r=".8"/><circle cx="18.9" cy="12.3" r=".8"/>',shape:'<path d="M12.9 12.9h5.4v5.4h-5.4z"/><circle cx="12.9" cy="12.9" r=".8"/><circle cx="18.3" cy="18.3" r=".8"/>',path:'<path d="M12.4 18.5 15.7 12.6 18.9 18.3z"/><circle cx="12.4" cy="18.5" r=".7"/><circle cx="18.9" cy="18.3" r=".7"/>',blur:'<circle cx="15.9" cy="15.9" r="3" stroke-dasharray="1.5 1.7"/><circle cx="15.9" cy="15.9" r="1.1"/>',pencil:'<path d="M12.6 18.6 18.6 12.6M12 19.4l1.7-.5"/>',eraser:'<path d="M12.7 17.4 16.3 13.8l2.4 2.4-3.6 3.6z"/>'};
const MOVE_GLYPH='<path d="M10 2v6M10 12v6M2 10h6M12 10h6M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3"/>';
const cursorCache=new Map();
export function cursorStyle(kind) {
  const iconHot=TOOL_ICON_CURSORS[kind];
  if(iconHot){
    if(!cursorCache.has(kind)){
      const shape=ICONS[kind],svg=`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="-1 -1 26 26"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#11151c" stroke-width="3">${shape}</g><g stroke="#fff4d2" stroke-width="1.6">${shape}</g></g></svg>`;
      cursorCache.set(kind,`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${iconHot[0]} ${iconHot[1]}, crosshair`);
    }
    return cursorCache.get(kind);
  }
  const group=CURSOR_GROUPS[kind];
  if(!group)return kind;
  if(!cursorCache.has(kind)){
    const paint=(shape,width)=>`<g fill="none" stroke="${width>2?'#11151c':'#fff4d2'}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${shape}</g>`;
    const svg=group==='move'
      ?`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${paint(MOVE_GLYPH,2.6)}${paint(MOVE_GLYPH,1.5)}</svg>`
      :`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${paint(CROSS+GROUP_GLYPHS[group],2.6)}${paint(CROSS+GROUP_GLYPHS[group],1.5)}<circle cx="10" cy="10" r="2.3" fill="#11151c"/><circle cx="10" cy="10" r="1.2" fill="#fff4d2"/></svg>`;
    cursorCache.set(kind,`url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, ${group==='move'?'move':'crosshair'}`);
  }
  return cursorCache.get(kind);
}
export function constrainPoint(kind,start,end,shift,width,height) {
  if(!shift)return end;
  let dx=end.x-start.x,dy=end.y-start.y;
  if(kind==='move')return Math.abs(dx)>=Math.abs(dy)?{x:end.x,y:start.y}:{x:start.x,y:end.y};
  if(kind==='line'||kind==='gradient'){
    const angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;
    const size=Math.max(Math.abs(dx),Math.abs(dy));
    dx=Math.round(Math.cos(angle))*size;dy=Math.round(Math.sin(angle))*size;
  }else if(['rect','ellipse','select'].includes(kind)){
    const sx=dx<0?-1:1,sy=dy<0?-1:1;
    const size=Math.min(Math.max(Math.abs(dx),Math.abs(dy)),sx>0?width-1-start.x:start.x,sy>0?height-1-start.y:start.y);
    dx=size*sx;dy=size*sy;
  }
  // Keep constrained diagonal lines at 45 degrees when approaching an edge.
  if((kind==='line'||kind==='gradient')&&dx&&dy){const size=Math.min(Math.abs(dx),dx>0?width-1-start.x:start.x,dy>0?height-1-start.y:start.y);dx=Math.sign(dx)*size;dy=Math.sign(dy)*size;}
  return {x:Math.max(0,Math.min(width-1,start.x+dx)),y:Math.max(0,Math.min(height-1,start.y+dy))};
}

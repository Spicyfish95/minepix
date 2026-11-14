import {assertProjectCapacity,celPixelCount,sourcePixelCount} from './project-capacity.js';
import {initFormLayout} from './form-layout.js';
import {showCelProperties} from './cel-property-popover.js';
import {showFrameFps} from './frame-fps-popover.js';
import {createHelp} from './help.js';
import {normalizeInlineControls,initToolbarControls,syncToolbarControls} from './toolbar-controls.js';
import {celPixels,celIndexPixels,celProperty,setCelProperty} from './cel-properties.js';
import {createShading} from './shading.js';
import {tiledPoint,tiledCopies,insideTiledCanvas} from './tiled-mode.js';
import {sliceHandlePoints,hitSliceHandle,dragSliceBounds,resizedSliceGeometry,sliceCursor} from './slice-controls.js';
import {imageAdjustmentDialog} from './image-adjustment-dialog.js';
import {paintGradient} from './gradient.js';
import {editSelectionDialog} from './selection-edit-dialog.js';
import {createStabilizer} from './stabilizer.js';
import {symmetryPoints} from './symmetry.js';
import {exportNormalMap} from './normal-map-export.js';
import {rasterImportDocument} from './image-import.js';
import {imageMime} from './pixel-repair.js';
import {installErrorDialog} from './error-dialog.js';
import {inputGuide} from './input-guide.js';
import {initI18n,persistLocale,applyLocale,locale,t,LOCALE_KEY} from './i18n.js';
import {initVisualWorkspace,syncVisualTimeline,syncVisualControls} from './visual-workspace.js';
import {initColorAdjustments} from './color-adjustments.js';
import {listPatternBrushes,patternBrushById,savePatternBrush,deletePatternBrush,MAX_BRUSH_PATTERN} from './brush-library.js';
import {listPaletteLibrary,paletteById,savePaletteToLibrary,deletePaletteFromLibrary,remapIndices} from './palette-library.js';
import {initWindowChrome} from './window-chrome.js';
import {uiGet,uiAll,uiQuery,uiActive,onUI,onUIWindow} from './ui-surfaces.js';
import {initWorkspaceLayout} from './workspace-layout.js';
import {applicationSettings,APP_SETTINGS_KEY,DEFAULT_APPLICATION} from './application-settings.js';
import {initContextUI,updateContextUI} from './context-ui.js';
import {validateImeAudit} from './ime-audit.js';
import {modeOf,indexColor,createMapper,grayPixel,convertColorMode,applyIndexedPalette} from './color-modes.js';
import {linkedMembers,linkCels,unlinkCels,hydrateLinks} from './cel-links.js';
import {isReference,isBackground,encodeReference,rasterReference,convertReference,convertBackground} from './layer-types.js';
import {PEN_KEY,DEFAULT_PEN,loadPen,validatePen,deviceTool,pressureOptions} from './pen-dynamics.js';
import {isGroup,layerState,ancestors,visibleLayerIndices,groupLayer,ungroupLayer,reparentLayer,removeLayerTree,duplicateLayerTree,moveLayerSibling} from './layer-tree.js';
import {BLEND_MODES} from './compositor.js';
import {FrameCache} from './renderer.js';
import {snapshotCel} from './history.js';
import {DocumentStore} from './document-manager.js';
import {INPUT_KEY,DEFAULT_INPUT,loadInput,validateInput,pointerTool,wheelIntent} from './input-preferences.js';
import {asepriteKeymap,selectionOperationFor,holdActionFor,KEYMAP_KEY,defaultKeymap,loadKeymap,resolveShortcut} from './keymap-manager.js';
import {validateSlices,sliceAtFrame,sliceKeys,setSliceKey,deleteSliceKey} from './slices.js';
import { atlasMetadata, drawAtlasFrame } from './formats/atlas.js';
import { exportLayerPlan } from './export-layers.js';
import { sheetManifestPlan } from './formats/sheet-manifest.js';
import { EXPORT_SETTINGS_KEY, BUILTIN_EXPORT_PRESETS, exportFamily, pickExportOptions, readExportSettings, restoredExportOptions, rememberExportOptions, saveExportPreset, deleteExportPreset } from './export-settings.js';
import { exportFormatsFor, formatLabel, encodeCanvas, encodeAnimatedWebp } from './export-formats.js';
import { DEFAULT_CANVAS_BACKGROUND, validateCanvasBackground, applyCanvasBackground } from './canvas-background.js';
import { blurAt } from './blur-tool.js';
import { sheetLayout } from './formats/sprite-sheet.js';
import { shapeSelection as baseShapeSelection, gridSelection as baseGridSelection, wandSelection as baseWandSelection, combineSelection, invertSelection, translateSelection, selectionFrom, transformSelectionRegion } from './selection-mask.js';
import { transformState, transformPoint, relocatePivot, transformHandles, hitTransform, dragTransform, transformCursor } from './transform-controls.js';
import { sortedFrames, frameMoveOrder, moveFrames, reverseFrames, duplicateFrames, deleteFrames, selectTimelineFrames, scopeFrames } from './timeline-commands.js';
import { decodeGif, animationIndices, animationTags } from './formats/animation.js';
import { sequencePlan, decodePngSequence } from './formats/png-sequence.js';
import { createPlayback } from './playback.js';
import { DEFAULT_ONION_SETTINGS, onionSources, onionPixels } from './onion-skin.js';
import { celRectangle, containsCel, celTargets, assertEditableCels, copyCels, clearCels, pasteCels, moveCels, celContentBounds, transformCels, flipCels } from './timeline-selection.js';
import { selectionContains } from './model.js';
import { pasteTarget } from './paste-target.js';
import { rasterCurve, rasterPolygon } from './path-tools.js';
import { brushFootprint, stampBrush, rasterShape, appendPixelPerfect, paintFill } from './brush-engine.js';
import { normalizeColor, rgba, fromRgba, parsePalette, extractPalette } from './colors.js';
import { formatPaletteClipboard, parsePaletteClipboard, insertPaletteColors } from './palette-clipboard.js';
import { paletteOutline, outlinePathData } from './palette-outline.js';
import { mergeDown, mergeVisible, flattenSprite } from './layer-commands.js';
import { reframe, resizeCanvas, contentBounds, flipSprite, spriteSize } from './canvas-commands.js';
import { loadPreviewSize, savePreviewSize, validatePreviewSize } from './preview-settings.js';
import { validateGrid, loadGrid, saveGrid, gridLines } from './grid-settings.js';
import { DEFAULT_TOLERANCE, replaceColorInDocument } from './color-replace.js';
import { isTileset, toTileset, toPixels, matchTiles, terrainZones } from './tilemap.js';
import {createPreviewTerrain, resizePreviewTerrain, setPreviewCell, resolvePreviewCells, tintPaintedCells, rasterizePreviewTiles, previewRenderError, assertPreviewRenderSize} from './terrain-preview.js';
import { initTilesetPanel, visibleBitTiles } from './tileset-panel.js';
import { clone, colorValue, createDocument, validateDocument, line, composite, addFrame, addLayer, copyRegion, clearRegion, pasteRegion, flipRegion, History, demoDocument } from './model.js';
import {BOARD_MIN, boardItemPixels, addReference, removeReference, moveReference, resizeReference, reorderReference, resetReferencePosition, boardBounds} from './reference-board.js';
import { iconMarkup, setButtonIcon, decorateInterface } from './icons.js';
import { initTheme,setTheme,getTheme,setAppearance,getAppearance } from './theme.js';
import {menuAvailability} from './menu-availability.js';
import { TOOLS, TOOL_GROUPS, shortcut, isTextTarget, pointerMode, cursorStyle, constrainPoint } from './interaction.js';
import { createWelcomeState } from './welcome.js';

const editorHost=window.desktop?await window.desktop.editorInfo():{id:0,detached:false};window.editorHost=editorHost;
const $=uiGet;
const canvas=$('canvas'),ctx=canvas.getContext('2d'),overlay=$('overlay'),octx=overlay.getContext('2d'),viewport=$('viewport'),wrap=$('canvas-wrap');
let colorIndex=0;
let colorAdjustments;
let doc=createDocument(DEFAULT_APPLICATION.width,DEFAULT_APPLICATION.height),fi=0,li=0,tool='pencil',color='#edb75b',brush=1,selection=null,clipboard=null,clipboardDocument=null,zoom=12,pan={x:0,y:0},gesture=null,space=false,spacePanned=false,playing=false,playTimer=null,previewFrame=0,dirty=false,saved='',busy=false;
const bootDocumentAudit={name:doc.name,layers:doc.layers.length,frames:doc.frames.length,layerIndex:li,transparent:doc.frames[0].cels[0].every(p=>p===0)};
const history=new History();
let boardRevision=0,savedBoardRevision=0;
let keymap=loadKeymap(localStorage);
let inputPreferences=loadInput(localStorage);
const tools=TOOLS, modifiers={alt:false,shift:false,grid:false};
let pointer=null,pendingTool=null,spaceUsed=false,shapeSession=null,lastStrokePoint=null;
let previousSelection=null,transformSession=null,selectionDash=0,selectionAnim=null,selectionAnimAt=0,selectionMenu=null;
let frameSelection=new Set([0]),frameAnchor=0,timelineDrag=null,playback=null;
let previewPlaying=false,previewPlayback=null,previewTimer=null,previewPlayFrame=0,previewZoom=0,previewPan={x:0,y:0},previewPanelSize={w:0,h:0},previewDrag=null;
let celRange=null,celAnchor={frame:0,layer:0},celGesture=null,celClipboard=null;
let onionSettings={...DEFAULT_ONION_SETTINGS},onionSession=null,onionCacheKey='';
const onionCache=new Map();
let penPreferences=loadPen(localStorage);
const frameCache=new FrameCache(),referenceCache=new FrameCache(32*1024*1024,{includeReference:true});
const invalidateFrame=(index,rect)=>{frameCache.invalidate(index,rect);referenceCache.invalidate(index,rect);};let filledCache=new WeakMap(),thumbCache=new WeakMap(),layerDomKey='',timelineDomKey='',timelineSelectionKey='',paletteDomKey='';let timelineDirtyCells=new Set(),timelineDocument=null;
let paletteEditing=false,paletteSelection=new Set(),paletteActive=null,paletteDrag=null,paletteColorInput=null,paletteColorTarget=null,contextMenu=null,paletteRemap=null,paletteLibraryId='';
// Aseprite 对齐：可配置网格独立于像素网格，设置保存在本机。
let gridSettings=loadGrid(localStorage),menuEnabledKey='',menuCheckedKey='';
let documentId=crypto.randomUUID(),filePath=null,closePending=false;
const documentTabs=new DocumentStore();
const closedDocuments=[];
let background='#171b2b',rightButtonMode='erase';
const MAX_BRUSH_SIZE=128,MAX_PATTERN_SIZE=Math.min(MAX_BRUSH_PATTERN,128);
const PAINTING_TOOLS=new Set(['pencil','eraser','line','rect','ellipse','fill','curve','polygon','contour','blur','gradient']);
let brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null,patternMode:'destination',fillTolerance:0,fillContiguous:true,stabilizer:false,stabilizerDistance:16,gradientType:'linear',gradientDither:'none'};
let toolBrushShapes={};
const palettePicking=()=>paletteEditing||brushSettings.ink==='shading';
let activeSliceId=null;
let tiledMode='none',tiledChecker=null,tiledCheckerKey='';
function tiledBackground(){const b=doc.canvasBackground||DEFAULT_CANVAS_BACKGROUND,key=JSON.stringify(b);if(key!==tiledCheckerKey){const c=document.createElement('canvas');c.width=c.height=b.size*2;const g=c.getContext('2d');g.fillStyle=b.color1;g.fillRect(0,0,c.width,c.height);g.fillStyle=b.color2;g.fillRect(0,0,b.size,b.size);g.fillRect(b.size,b.size,b.size,b.size);tiledChecker=octx.createPattern(c,'repeat');tiledCheckerKey=key;}return tiledChecker;}
$('tiled-mode').onchange=()=>{if(gesture||shapeSession)return;$('tiled-mode').blur();tiledMode=$('tiled-mode').value;draw();};
const shapeSelection=(doc,kind,points)=>baseShapeSelection(doc,kind,points,tiledMode);
const wandSelection=(doc,pixels,x,y,tolerance)=>baseWandSelection(doc,pixels,x,y,tolerance,tiledMode);
const gridSelection=(doc,g,a,b)=>tiledMode==='none'?baseGridSelection(doc,g,a,b):shapeSelection(doc,'rect',[{x:g.x+Math.floor((Math.min(a.x,b.x)-g.x)/g.w)*g.w,y:g.y+Math.floor((Math.min(a.y,b.y)-g.y)/g.h)*g.h},{x:g.x+(Math.floor((Math.max(a.x,b.x)-g.x)/g.w)+1)*g.w-1,y:g.y+(Math.floor((Math.max(a.y,b.y)-g.y)/g.h)+1)*g.h-1}]);
function constrainCanvasPoint(kind,start,end,shift){const x=tiledMode==='x'||tiledMode==='both'?doc.width:0,y=tiledMode==='y'||tiledMode==='both'?doc.height:0;if(!PAINTING_TOOLS.has(kind)&&kind!=='select')return constrainPoint(kind,start,end,shift,doc.width,doc.height);const p=constrainPoint(kind,{x:start.x+x,y:start.y+y},{x:end.x+x,y:end.y+y},shift,doc.width+2*x,doc.height+2*y);return{x:p.x-x,y:p.y-y};}

let previewFootprint=brushFootprint({size:1});
const symmetryHandles=['x','y'].map(axis=>{const handle=document.createElement('button');handle.type='button';handle.id='symmetry-axis-'+axis;handle.className='symmetry-handle';handle.textContent=axis==='x'?'↔':'↕';handle.setAttribute('aria-label',axis==='x'?'拖动左右对称轴':'拖动上下对称轴');viewport.append(handle);handle.hidden=true;
 handle.onpointerdown=event=>{event.preventDefault();event.stopPropagation();if(gesture||busy||playing||$('modal').open)return;gesture={kind:'symmetry',axis,before:clone(doc),pointerId:event.pointerId,oldSelection:selection};viewport.setPointerCapture(event.pointerId);};return handle;});
const visibleSlices=()=>doc.slices.map(s=>sliceAtFrame(s,fi)).filter(Boolean);
const symmetryOptions=()=>({horizontal:$('symmetry').checked,vertical:$('symmetry-vertical').checked,...(doc.symmetryAxes||{x:doc.width/2,y:doc.height/2})});
const brushPreview=document.createElement('div');brushPreview.id='brush-preview';viewport.append(brushPreview);
// Demo content is generated by our own code; no upstream art assets are used.
saved=history.revision;

function message(text){$('status').textContent=text;}
const showError=installErrorDialog(window,document,message);
function setDirty(value=true){dirty=value;window.desktop?.setDirty(value||documentTabs.items.some(item=>item.id!==documentId&&item.state.dirty));$('dirty-mark').textContent=value?'●':'';document.title=`${value?'● ':''}${documentTabs.items.length?doc.name:'MinePix'} — MinePix`;}
function changed(){const entry=history.undoStack.at(-1);if(entry?.kind==='delta')for(const change of entry.changes){const cel=doc.frames[change.f]?.cels[change.l];if(cel){filledCache.delete(cel);thumbCache.delete(cel);const property=doc.frames[change.f].celProperties?.[doc.layers[change.l].id];if(property)thumbCache.delete(property);timelineDirtyCells?.add(change.f+':'+change.l);}}else{filledCache=new WeakMap();thumbCache=new WeakMap();timelineDirtyCells=null;}onionCache.clear();frameCache.clear();referenceCache.clear();setDirty(history.revision!==saved||boardDirty());scheduleRecovery();}
function pixels(){return celPixels(doc,fi,li);}
function editable(){if(playing){message('请先暂停播放再编辑');return false;}if(isReference(doc.layers[li])){message('参考层只读，请使用参考设置移动或转为普通层');return false;}if(isGroup(doc.layers[li])){message('请选择组内的像素图层');return false;}if(layerState(doc,li).locked){message('当前图层已锁定');return false;}if(!layerState(doc,li).visible){message('请先显示当前图层');return false;}return true;}
function stop(){playing=false;clearTimeout(playTimer);playback=null;setButtonIcon($('play'),'play','播放');previewFrame=fi;highlightTimeline();syncInteraction();}
function mutate(fn,text='已更新',options={}){if(gesture||shapeSession||celGesture||busy)return;stop();const before=clone(doc),paletteBefore=capturePaletteUI(),frames=[...doc.frames],layers=[...doc.layers];try{fn();if(doc.frames.some((frame,i)=>frame!==frames[i])||doc.frames.length!==frames.length||doc.layers.some((layer,i)=>layer!==layers[i])||doc.layers.length!==layers.length)resetCelSelection();if(history.push(before,doc,options))history.undoStack.at(-1).paletteUI={before:paletteBefore,after:capturePaletteUI()};changed();render();message(text);}catch(error){doc=before;normalize();render();showError(error.message);}}
function normalize(){fi=Math.max(0,Math.min(fi,doc.frames.length-1));li=Math.max(0,Math.min(li,doc.layers.length-1));selection=null;frameSelection=new Set([fi]);frameAnchor=fi;resetCelSelection();}
function setTool(value){if(value.startsWith('selection-')){$('selection-kind').value=value.slice(10);value='select';}if(!tools.some(t=>t[0]===value))return;if(value!==tool&&textSession)commitTextSession();if(shapeSession)cancelShapeSession();if(gesture){pendingTool=value;message('松开鼠标后切换到'+tools.find(t=>t[0]===value)[2]);return;}if(PAINTING_TOOLS.has(tool))toolBrushShapes[tool]=brushSettings.shape;tool=value;if(PAINTING_TOOLS.has(tool))brushSettings.shape=toolBrushShapes[tool]||'square';syncToolSlots(value);saveBrushSettings();syncInteraction();}
function altEyedropper(){return modifiers.alt&&!(keymap.profile==='aseprite'&&tool==='select'&&modifiers.shift);}
function activeSelectionKind(){return modifiers.grid&&tool==='select'?'grid':$('selection-kind').value;}
function currentMode(button=0){return pointerMode({tool:deviceTool(pointer,pointerTool(tool,inputPreferences,brushSettings.ink==='shading'&&button===2?0:button),penPreferences),rightButtonMode:brushSettings.ink==='shading'?'background':rightButtonMode,space,alt:altEyedropper(),gesture:gesture||shapeSession,button,busy,playing,locked:layerState(doc,li).locked,visible:layerState(doc,li).visible,selectionKind:activeSelectionKind()});}
let tilesetPanel=null;
// 图集栏位按需出现：存在 tileset 图层时插入栏位，否则整体隐藏。
function syncTilesetPanel(){
  const visible=documentTabs.items.length>0&&doc.layers.some(isTileset);
  window.workspaceLayout?.setPanelVisible('tileset',visible,{auto:true});
  if(visible)tilesetPanel?.render();
  syncCommandStates();
}
async function toTilesetDialog(){
  const layer=doc.layers[li];
  if(isTileset(layer))return message('当前图层已是图集图层');
  const values=await modal('转为图集图层','<label>图块宽度 <input name="w" type="number" min="1" max="4096" value="'+gridSettings.w+'" required></label><label>图块高度 <input name="h" type="number" min="1" max="4096" value="'+gridSettings.h+'" required></label><label>切块帧 <input name="frame" type="number" min="1" max="'+doc.frames.length+'" value="'+(fi+1)+'" required></label><p>按图块尺寸切分所选帧，完全相同的图块合并、全透明图块跳过，图集写回该图层所有帧。切分后可用图集栏位配置地形。</p>',null,v=>{if(+v.w<1||+v.h<1)throw new Error('图块尺寸需大于 0');});
  if(!values)return;
  mutate(()=>{toTileset(doc,li,{w:+values.w,h:+values.h,frame:+values.frame-1});},'已转为图集图层，图集栏位已打开');
}
// 命令可用性：替换颜色需要可编辑的像素层；图像大小在播放时不可用；网格设置始终可用。
function commandStates(){
  const layer=doc.layers[li],canEdit=!playing&&!busy,canEditPixels=canEdit&&!isGroup(layer)&&!isReference(layer)&&!layerState(doc,li).locked&&layerState(doc,li).visible;
  return {...menuAvailability({hasDocument:documentTabs.items.length>0,canEdit,canEditPixels,hasSelection:!!selection,hasPreviousSelection:!!previousSelection,hasCelRange:!!celRange,hasCelClipboard:!!celClipboard,hasClipboard:!!clipboard,hasClosed:closedDocuments.length>0,canUndo:history.undoStack.length>0,canRedo:history.redoStack.length>0,frameCount:doc.frames.length,frameIndex:fi,layerCount:doc.layers.length,layerIndex:li,hasTags:!!doc.tags?.length,hasSavedPath:!!filePath}),'delete-active-slice':documentTabs.items.length>0&&canEdit&&visibleSlices().some(slice=>slice.id===activeSliceId),'clear-slices':documentTabs.items.length>0&&canEdit&&doc.slices.length>0};
}
// 合并按钮按当前图层类型切换文案与行为：像素层转为图集，图集层转回像素。
function syncTilesetToggle(){
  const button=uiQuery('[data-action="tileset-toggle"]');if(!button)return;
  const back=isTileset(doc.layers[li]),label=back?'转为普通图层':'转为图集';
  // 图标由 decorateInterface 注入，改文案只写 span，否则会把 <svg> 一起抹掉（右键菜单里就只剩文字）。
  const text=button.querySelector('span');
  if(text){if(text.textContent!==label)text.textContent=label;}
  else if(button.textContent!==label)button.textContent=label;
  button.title=back?'把图集图层还原为普通像素层':'按图块尺寸切分当前图层像素，生成图集（Godot 图块来源）';
}
function syncCommandStates(){
  const states=commandStates();
  for(const [action,enabled] of Object.entries(states)){const button=uiQuery('[data-action="'+action+'"]');if(button)button.disabled=!enabled;}
  syncTilesetToggle();
  const key=JSON.stringify(states);
  if(key!==menuEnabledKey){menuEnabledKey=key;window.desktop?.setMenuEnabled(states);}
  syncMenuChecked();
}
// 视图菜单的勾选态跟着面板显隐与网格/洋葱皮开关走；窗口菜单本身由主进程按上报值打勾。
function syncMenuChecked(){
  const layout=window.workspaceLayout;if(!layout)return;
  const checked={};
  for(const id of ['tools','colors','preview','layers','timeline','reference','tileset','terrain-preview'])checked['panel-'+id]=layout.panelPresent(id);
  checked.grid=$('grid').checked;checked.onion=$('onion').checked;checked['toggle-bottom']=!layout.state().collapsed;
  const key=JSON.stringify(checked);
  if(key===menuCheckedKey)return;
  menuCheckedKey=key;window.desktop?.setMenuChecked(checked);
}
window.addEventListener('panels-changed',()=>syncMenuChecked());
// 网格开关文案随状态切换：未勾选「显示像素网格」，勾选后「隐藏像素网格」。
let gridLabelState=null;
function togglePixelGrid(){$('grid').checked=!$('grid').checked;syncGridLabel();drawOverlay();drawPreviewCanvas();}
function syncGridLabel(){
  const label=$('grid').checked?'隐藏像素网格':'显示像素网格';
  if(gridLabelState===label)return;gridLabelState=label;
  for(const node of $('grid').closest('label').childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent=' '+label;
  window.desktop?.setMenuLabels({grid:label});
}
// 参考网格（网格设置的「显示网格」）与像素网格相互独立，开关放在画布右上角。
let gridGuideLabelState=null;
function syncGridGuideLabel(){
  const label=gridSettings.visible?'隐藏网格':'显示网格';
  if(gridGuideLabelState===label)return;gridGuideLabelState=label;
  const button=uiQuery('[data-action="toggle-grid-guide"]');
  if(!button)return;
  button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(gridSettings.visible));
 window.desktop?.setMenuLabels({'grid-toggle':label});
}
function toggleGridGuide(){
  gridSettings=validateGrid({...gridSettings,visible:!gridSettings.visible});
  saveGrid(localStorage,gridSettings);syncGridGuideLabel();drawOverlay();
  message(gridSettings.visible?'已显示网格':'已隐藏网格');
}
function syncInteraction(){
  const mode=currentMode();if(viewport.dataset.tool!==mode.tool)$('tool-indicator').innerHTML=iconMarkup(mode.tool);viewport.style.cursor=cursorStyle(mode.cursor);viewport.dataset.cursor=mode.cursor;viewport.dataset.tool=mode.tool;
  if(tool==='slice'&&pointer&&!transformSession){const p=transformEventPoint(pointer),selected=visibleSlices().find(s=>s.id===activeSliceId),handle=gesture?.kind==='slice'?gesture.handle:selected&&hitSliceHandle(selected.bounds,p,zoom);viewport.style.cursor=sliceCursor(handle||(visibleSlices().some(s=>p.x>=s.bounds.x&&p.y>=s.bounds.y&&p.x<s.bounds.x+s.bounds.w&&p.y<s.bounds.y+s.bounds.h)?'move':'create'));}
  const effective=tools.find(t=>t[0]===mode.tool)||tools.find(t=>t[0]===tool);
  uiAll('#tools [data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===(tool==='select'?selectionToolId():tool));b.classList.toggle('temporary',mode.tool!==tool&&b.dataset.tool===mode.tool);b.setAttribute('aria-pressed',String(b.dataset.tool===(tool==='select'?selectionToolId():tool)));});
  $('tool-name').textContent=tool==='select'&&modifiers.grid?'网格选取 · 临时':effective[2]+(mode.tool!==tool?' · 临时':'');
  const hints={slice:'拖动建立切片 · 拖动内部移动 · 拖动边角缩放 · 双击属性 · Delete 删除',pencil:`左键绘画 · 右键${({erase:'擦除',background:'背景色',pan:'平移',eyedropper:'吸色'})[rightButtonMode]} · [ ] 笔刷大小`,eraser:'拖动擦除 · [ ] 笔刷大小',blur:'拖动以 3 × 3 邻域柔化像素 · 使用当前笔形和尺寸',text:'点击画布直接输入 · 拖动可拉出定宽文本框并自动换行 · Esc 取消 · Ctrl+Enter 或点击外部提交',gradient:'拖动定义前景色到背景色渐变 · 右键反向 · Shift 约束方向',fill:'点击填充连通区域 · 右键清空区域',eyedropper:'点击吸取合成后的可见颜色',line:'拖动绘制直线 · Shift 约束 45°',rect:'拖动绘制矩形 · Shift 绘制正方形',ellipse:'拖动绘制椭圆 · Shift 绘制圆形',curve:'拖出起终点，再移动鼠标调弯曲 · 点击 / Enter 确认 · Esc 取消',polygon:'逐点点击 · 双击 / Enter 闭合 · Esc 取消',contour:'自由拖出闭合轮廓 · 可选填充形状',select:'工具栏切换选区形状，上方切换集合操作 · 多边形 Enter 确认 · 方向键移动',move:'拖动移动像素 · Shift 锁定轴 · 方向键微调',hand:'拖动画布 · 松开临时按键后恢复原工具',zoom:modifiers.alt?'点击缩小 · 松开 Alt 恢复放大':'点击放大 · 按住 Alt 点击缩小'};
  $('tool-hint').textContent=mode.blocked?(busy?'正在处理文件…':playing?'动画播放中 · 空格暂停后编辑':doc.layers[li].locked?'图层已锁定 · 解锁后编辑':'图层已隐藏 · 显示后编辑'):tool==='select'&&modifiers.grid?`网格选取：点击选中整格 · 拖动选择多格 · 松开 ${(keymap.bindings['grid-select']||['G'])[0]} 恢复自由矩形`:hints[mode.tool];
  syncBrushControls();syncCommandStates();updateBrushPreview(mode);
  if(transformSession){viewport.dataset.cursor='transform';viewport.style.cursor=transformCursor(transformSession.state,transformSession.drag?.handle||transformSession.hover,!!transformSession.drag);}
  if(onionSession){viewport.dataset.cursor='default';viewport.style.cursor='default';}
  syncBoardCursor();
}
function updateBrushPreview(mode=currentMode()){
  const show=(pointer?.inside||!!gesture)&&mode.brush&&!mode.blocked&&!space&&!$('modal').open;
  if(!show){brushPreview.hidden=true;return;}
  const p=point(pointer,false);if(!insideTiledCanvas(doc,p,tiledMode)){brushPreview.hidden=true;return;}
  const footprint=(gesture||shapeSession)?.options?.footprint||previewFootprint;if(!footprint.length){brushPreview.hidden=true;return;}
  const xs=footprint.map(p=>p.x),ys=footprint.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys);brushPreview.hidden=false;brushPreview.classList.toggle('erasing',!!mode.erasing);brushPreview.style.borderRadius=brushSettings.shape==='circle'?'50%':'0';
  Object.assign(brushPreview.style,{left:(pan.x+(p.x+left)*zoom)+'px',top:(pan.y+(p.y+top)*zoom)+'px',width:(Math.max(...xs)-left+1)*zoom+'px',height:(Math.max(...ys)-top+1)*zoom+'px'});
}
function setBrush(value){brush=Math.max(1,Math.min(MAX_BRUSH_SIZE,Math.round(+value)||1));$('brush').value=brush;saveBrushSettings();syncInteraction();}
function saveBrushSettings(){
  if(PAINTING_TOOLS.has(tool))toolBrushShapes[tool]=brushSettings.shape;
  previewFootprint=brushFootprint({...brushSettings,size:brush});
  localStorage.setItem('pixel-studio-brush',JSON.stringify({size:brush,...brushSettings}));
  localStorage.setItem('pixel-studio-tool-brush-shapes',JSON.stringify(toolBrushShapes));
}
function syncContextUI(){syncVisualControls();updateContextUI({tool,shape:brushSettings.shape,selection,layer:doc.layers[li],layerCount:doc.layers.length,selectedFrames:frameSelection.size,linked:!!doc.frames[fi].links?.[doc.layers[li].id]});syncCommandStates();syncToolbarControls();}
function syncBrushControls(){
  const painting=['pencil','eraser','line','rect','ellipse','fill','curve','polygon','contour','blur','gradient'].includes(tool),toolbarOptions=['pencil','eraser','line','rect','ellipse','curve','polygon','contour','blur'].includes(tool),drawing=uiQuery('.drawing-options'),toolbar=uiQuery('.options');
  drawing.hidden=tool==='select'||tool==='move'||tool==='text'||tool==='slice';drawing.classList.toggle('options-empty',!painting&&tool!=='select'&&tool!=='move'&&tool!=='text');
  $('slice-controls').hidden=tool!=='slice';$('shading-controls').hidden=!painting||brushSettings.ink!=='shading';
  $('selection-options').hidden=tool!=='select';$('text-options').hidden=tool!=='text';
  // 笔刷预设与视图菜单在界面装饰阶段才创建，首次同步可能早于它们出现。
  const presetsButton=uiQuery('[data-action=brush-presets]'),viewTrigger=$('view-menu-trigger');if(presetsButton)presetsButton.hidden=!painting;if(viewTrigger)viewTrigger.hidden=!toolbarOptions;
  $('brush').closest('label').hidden=!toolbarOptions;$('symmetry').closest('label').hidden=!toolbarOptions;
  $('symmetry-vertical').closest('label').hidden=!toolbarOptions;$('symmetry-reset').hidden=!toolbarOptions;
  $('brush-shape').value=brushSettings.shape;
  for(const id of ['brush-shape','paint-opacity','ink-mode','pattern-mode','pattern-library','pixel-perfect','shape-filled'])$(id).disabled=!painting;
  $('brush-angle').disabled=!painting||brushSettings.shape!=='line';
  $('stabilizer-controls').hidden=!['pencil','eraser','contour','blur'].includes(tool);$('stabilizer-enabled').checked=!!brushSettings.stabilizer;$('stabilizer-distance').value=brushSettings.stabilizerDistance??16;$('stabilizer-distance').disabled=!brushSettings.stabilizer;
  $('gradient-controls').hidden=tool!=='gradient';$('gradient-type').value=brushSettings.gradientType||'linear';$('gradient-dither').value=brushSettings.gradientDither||'none';
  $('fill-controls').hidden=tool!=='fill';
  $('fill-tolerance').value=brushSettings.fillTolerance||0;$('fill-contiguous').checked=brushSettings.fillContiguous!==false;
  $('pattern-controls').hidden=brushSettings.shape!=='pattern';
  $('shape-filled').disabled=!['rect','ellipse','polygon','contour'].includes(tool);
  $('pixel-perfect').disabled=!['pencil','eraser'].includes(tool)||brush!==1||brushSettings.shape==='pattern';
  syncContextUI();
}
function updateBrushControls(){
  $('brush').value=brush;$('brush-shape').value=brushSettings.shape;$('brush-angle').value=brushSettings.angle;$('paint-opacity').value=brushSettings.opacity;$('ink-mode').value=brushSettings.ink;$('pattern-mode').value=brushSettings.patternMode||'destination';$('pixel-perfect').checked=brushSettings.pixelPerfect;$('shape-filled').checked=brushSettings.filled;
  refreshPatternLibrary($('pattern-library').value);
  saveBrushSettings();syncInteraction();
}
function refreshPatternLibrary(selectedId=''){
  const select=$('pattern-library');if(!select)return;
  const brushes=listPatternBrushes();
  select.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent=brushes.length?'选择本机笔刷':'本机笔刷库为空';select.append(empty);
  for(const entry of brushes){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option);}
  select.value=brushes.some(entry=>entry.id===selectedId)?selectedId:'';
}
function applyPatternBrush(id){
  const entry=patternBrushById(id);if(!entry)return;
  brushSettings={...brushSettings,shape:'pattern',pattern:{...entry.pattern},patternMode:entry.patternMode,opacity:entry.opacity,ink:entry.ink};
  brush=Math.min(MAX_BRUSH_SIZE,Math.max(1,Math.round(entry.size||Math.max(entry.pattern.w,entry.pattern.h))));
  updateBrushControls();message('已载入图案笔刷：'+entry.name);
}
async function savePatternBrushToLibrary(){
  if(brushSettings.shape!=='pattern'||!brushSettings.pattern)return message('先从选区建立图案笔刷');
  const values=await modal('保存图案笔刷','<label>名称 <input name="name" type="text" maxlength="40" value="我的图案笔刷" required></label><p>把当前图案笔刷（图案像素、对齐方式、透明度与墨水）保存到本机笔刷库，不写入作品。</p>');
  if(!values)return;
  const entry=savePatternBrush(values.name,{size:brush,pattern:brushSettings.pattern,patternMode:brushSettings.patternMode,opacity:brushSettings.opacity,ink:brushSettings.ink});
  refreshPatternLibrary(entry.id);message('已保存图案笔刷：'+entry.name);
}
function deletePatternBrushFromLibrary(){
  const id=$('pattern-library').value;if(!id)return message('请先在本机笔刷库里选择要删除的图案笔刷');
  const entry=patternBrushById(id);deletePatternBrush(id);refreshPatternLibrary();message('已删除图案笔刷：'+(entry?.name||''));
}
function captureBrush(){
  if(!selection?.w||!selection?.h)return message('请先建立非空选区选择笔刷图案');
  if(selection.w>MAX_PATTERN_SIZE||selection.h>MAX_PATTERN_SIZE)return message('自定义笔刷选区最大为 '+MAX_PATTERN_SIZE+' × '+MAX_PATTERN_SIZE);
  if(!commandStates()['capture-brush'])return;
  const pattern=copyRegion(doc,pixels(),selection);
  if(!pattern.data.some(p=>p&255))return message('选区没有可见像素');
  setTool('pencil');brushSettings.pattern={w:pattern.w,h:pattern.h,data:pattern.data,origin:{x:selection.x,y:selection.y}};brushSettings.shape='pattern';brushSettings.patternMode='destination';brush=Math.min(MAX_BRUSH_SIZE,Math.max(pattern.w,pattern.h));selection=null;toolBrushShapes.pencil='pattern';updateBrushControls();syncContextUI();drawOverlay();message('已从选区建立彩色笔刷');
}
function brushPresets(){const trigger=uiQuery('[data-action=brush-presets]');$('brush-presets-menu').togglePopover({source:trigger});}
function applyBrushPreset(preset){
 const {name,size,...settings}=clone(preset);brush=Math.min(MAX_BRUSH_SIZE,Math.max(1,Math.round(size)||1));brushSettings={...brushSettings,...settings,patternMode:settings.patternMode||'destination'};updateBrushControls();message('已应用笔刷预设：'+name);
}
function setBusy(value){busy=value;syncInteraction();}
function rememberPointer(event){pointer={clientX:event.clientX,clientY:event.clientY,inside:true,pointerType:event.pointerType,pressure:event.pressure,button:event.button,buttons:event.buttons};modifiers.alt=event.altKey;modifiers.shift=event.shiftKey;}
function resetModifiers(){space=false;spacePanned=false;spaceUsed=false;modifiers.alt=false;modifiers.shift=false;modifiers.grid=false;pointer=null;}
function saveColorPreferences(){inputPreferences.right=rightButtonMode;localStorage.setItem(INPUT_KEY,JSON.stringify(inputPreferences));localStorage.setItem('pixel-studio-colors',JSON.stringify({foreground:color,background,rightButtonMode}));}
function renderColors(){
  const target=paletteTargetColor();
  $('color').value=color.slice(0,7);$('background-color').value=background.slice(0,7);$('hex').value=target.toUpperCase();
  $('color').title='前景色 '+color.toUpperCase();$('background-color').title='背景色 '+background.toUpperCase();
  $('color-role').textContent='右键：'+(({erase:'擦除',background:'背景色',pan:'平移',eyedropper:'吸色'})[rightButtonMode]);
  colorAdjustments?.update(target);renderPalette();syncInteraction();
}
function paletteTargetIndex(){
  return paletteEditing&&paletteActive!==null&&paletteSelection.has(paletteActive)&&doc.palette[paletteActive]?paletteActive:null;
}
function paletteTargetColor(){const index=paletteTargetIndex();return index===null?color:doc.palette[index];}
function syncPalettePanel(){const value=paletteTargetColor();$('hex').value=value.toUpperCase();colorAdjustments?.update(value);}
function useForegroundForPattern(){if(brushSettings.shape!=='pattern'||brushSettings.patternMode==='brush')return;brushSettings.patternMode='brush';updateBrushControls();message('图案笔刷已切换为单色（前景色）；改回源对齐或落点对齐可恢复图案原色');}
function setColor(value,index=null){if(modeOf(doc)==='indexed'){colorIndex=index??createMapper(doc,doc.layers[li])(colorValue(normalizeColor(value))).index;}else if(modeOf(doc)==='grayscale')value='#'+grayPixel(colorValue(normalizeColor(value))).toString(16).padStart(8,'0');const next=normalizeColor(value);if(next!==color)useForegroundForPattern();color=next;saveColorPreferences();renderColors();}
function setBackground(value){const next=normalizeColor(value);if(next!==background)useForegroundForPattern();background=next;saveColorPreferences();renderColors();}
function renderPalette(){
 const key=JSON.stringify(doc.palette)+color+colorIndex+modeOf(doc)+doc.transparentIndex;
 if(key===paletteDomKey)return;
 paletteDomKey=key;
 paletteSelection=new Set([...paletteSelection].filter(index=>index<doc.palette.length));
 if(paletteActive!==null&&!paletteSelection.has(paletteActive))paletteActive=null;
 const el=$('palette');el.replaceChildren();el.classList.toggle('editing',paletteEditing);
 doc.palette.forEach((c,index)=>{
  const b=document.createElement('button');b.type='button';b.className='swatch';b.dataset.index=index;b.style.background=c;
  if(modeOf(doc)==='indexed'?index===colorIndex&&colorValue(c)===colorValue(color):c.toLowerCase()===color)b.classList.add('selected');
  if(palettePicking()&&paletteSelection.has(index))b.classList.add('edit-selected');
  b.title=paletteEditing?'拖动经过即累积选择 · '+c:(modeOf(doc)==='indexed'?'索引 '+index+(index===doc.transparentIndex?'（透明槽）':'')+' · ':'')+c+' · 点击取色';
  b.setAttribute('aria-label',c);b.setAttribute('aria-pressed',String(palettePicking()&&paletteSelection.has(index)));
  b.onclick=()=>{if(!palettePicking())setColor(c,index);};
  el.append(b);
 });
 const outline=document.createElementNS('http://www.w3.org/2000/svg','svg');outline.setAttribute('class','palette-outline');outline.setAttribute('aria-hidden','true');el.append(outline);
 // 拖动与删除贴在选中高亮描边的右上/右下角，跟着选中范围走；操作行里不再保留这两个图标。
 if(!el.querySelector('.palette-edit-actions'))el.append(paletteEditActions());
 syncPaletteSelection();
 syncPaletteEditActions();
}
// 编辑态的拖动与删除固定在色板下方的一行里，不跟着当前选中格跳位。
function paletteEditActions(){
 const bar=document.createElement('span');bar.className='palette-edit-actions';bar.hidden=true;bar.dataset.paletteBar='true';
 const handle=document.createElement('button');handle.type='button';handle.className='palette-action';handle.dataset.paletteAction='reorder';handle.title='拖动排序';handle.setAttribute('aria-label','拖动排序');setButtonIcon(handle,'move');
 handle.onpointerdown=e=>{e.preventDefault();startPaletteReorder(e);};
 const remove=document.createElement('button');remove.type='button';remove.className='palette-action';remove.dataset.paletteAction='delete';remove.title='删除颜色';remove.setAttribute('aria-label','删除颜色');setButtonIcon(remove,'close');
 remove.onclick=e=>{e.stopPropagation();removeSelectedPaletteColors();};
 bar.append(handle,remove);
 return bar;
}
function syncPaletteEditActions(){
 const bar=document.querySelector('.palette-edit-actions');if(!bar)return;
 const idle=!paletteEditing||!paletteSelection.size;
 const handle=bar.querySelector('[data-palette-action="reorder"]'),remove=bar.querySelector('[data-palette-action="delete"]');
 if(handle)handle.disabled=idle;
 if(remove)remove.disabled=idle||paletteActive===null;
 const edges=paletteEditing?paletteSelectionEdgePoints($('palette')):null;
 bar.hidden=!edges;
 if(!edges)return;
 const size=18,half=size/2;
 if(remove){remove.style.left=(edges.firstRight-half)+'px';remove.style.top=(edges.firstTop-half)+'px';}
 if(handle){handle.style.left=(edges.lastRight-half)+'px';handle.style.top=(edges.lastBottom-half)+'px';}
}
// 多选时图标贴在「每行最右一格的勾选框」上：删除贴首行右上角，拖动贴末行右下角。L 形选区不会被拉成外接矩形的角。
function paletteSelectionEdgePoints(el){
 if(!el)return null;
 const nodes=[...el.children].filter(node=>node.classList.contains('swatch')&&paletteSelection.has(Number(node.dataset.index)));
 if(!nodes.length)return null;
 const base=el.getBoundingClientRect(),rows=[];
 for(const node of nodes){
  const r=node.getBoundingClientRect(),top=r.top-base.top+el.scrollTop,right=r.right-base.left+el.scrollLeft,bottom=r.bottom-base.top+el.scrollTop;
  const row=rows.find(item=>Math.abs(item.top-top)<2);
  if(row){row.right=Math.max(row.right,right);row.bottom=Math.max(row.bottom,bottom);}
  else rows.push({top,right,bottom});
 }
 rows.sort((a,b)=>a.top-b.top);
 const first=rows[0],last=rows[rows.length-1];
 return {firstRight:first.right,firstTop:first.top,lastRight:last.right,lastBottom:last.bottom};
}
// 色板库：内置色板与用户保存在本机的命名色板不是项目数据，切换项目不受影响。
function capturePaletteUI(){return{id:paletteLibraryId,remap:paletteRemap?clone(paletteRemap):null};}
function restorePaletteUI(state){paletteLibraryId=state.id;paletteRemap=state.remap?clone(state.remap):null;$('palette-library').value=paletteLibraryId;syncPaletteLibraryButtons();syncRemapButton();}
function renderPaletteLibrary(){
 const select=$('palette-library');if(!select)return;
 const previous=select.value,entries=listPaletteLibrary();
 select.replaceChildren();
 const head=document.createElement('option');head.value='';head.textContent='（未选择色板）';select.append(head);
 for(const [label,user] of [['内置色板',false],['我的色板',true]]){
  const list=entries.filter(entry=>!!entry.user===user);
  if(!list.length)continue;
  const group=document.createElement('optgroup');group.label=label;
  for(const entry of list){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;group.append(option);}
  select.append(group);
 }
 if(previous&&entries.some(entry=>entry.id===previous))select.value=previous;
 syncPaletteLibraryButtons();
}
// 内置色板与「未选择」没有可删条目，按钮直接置灰，避免点了只弹一句提示。
function syncPaletteLibraryButtons(){
 const select=$('palette-library'),button=document.querySelector('[data-action="delete-palette"]');
 if(!select||!button)return;
 const entry=paletteById(select.value);
 button.disabled=!entry||!entry.user;
 button.title=!entry?'先在色板库选择一个色板':(entry.user?'从本机色板库删除选中的用户色板':'内置色板不能删除');
}
function libraryPaletteColors(entry){
 const colors=entry.colors.map(value=>value.length===7?value+'ff':value);
 if(modeOf(doc)==='indexed'&&Number.isInteger(doc.transparentIndex)&&doc.transparentIndex<colors.length)colors[doc.transparentIndex]='#00000000';
 return colors;
}
// 索引像素的颜色值必须等于 palette[下标]，换色板后按原下标重算一遍才算合法文档。
function repaintIndexedPixels(){
 for(const frame of doc.frames)for(const [index,pixels]of frame.cels.entries()){
  const layer=doc.layers[index],indices=frame.indices?.[index];
  if(!indices||!pixels)continue;
  for(let i=0;i<pixels.length;i++)pixels[i]=indexColor(doc,indices[i],layer);
 }
 for(const layer of doc.layers)if(isBackground(layer)&&Number.isInteger(layer.clearIndex)&&layer.clearIndex>=0&&layer.clearIndex<doc.palette.length)layer.clearColor=indexColor(doc,layer.clearIndex,layer);
}
function syncRemapButton(){
 const button=$('remap-indices');if(!button)return;
 button.hidden=!(paletteRemap&&modeOf(doc)==='indexed');
}
function applyPaletteLibrary(id){
 const entry=paletteById(id);if(!entry)return;
 if(!documentTabs.items.length){message('请先打开或新建项目');return;}
 const indexed=modeOf(doc)==='indexed',previous=indexed?doc.palette.slice():null,sources=indexed?paletteRemapSources():null;
 mutate(()=>{
  paletteLibraryId=id;doc.palette=libraryPaletteColors(entry);
  if(indexed){paletteRemap={oldPalette:previous,newPalette:doc.palette.slice(),sources};repaintIndexedPixels();paletteRemap.applied=paletteRemapSources();}
 },'已应用色板 '+entry.name);
 renderPaletteLibrary();syncRemapButton();renderColors();
}
function paletteRemapSources(){return doc.frames.map(frame=>frame.cels.map((pixels,index)=>frame.indices?.[index]?pixels.slice():null));}
function pendingRemapSources(){return paletteRemapSources().map((layers,f)=>layers.map((pixels,l)=>pixels?.map((value,i)=>value===paletteRemap.applied?.[f]?.[l]?.[i]?paletteRemap.sources[f][l][i]:value)));}
function editIndexedPalette(doc,colors,origins){
 const pending=modeOf(doc)==='indexed'?(paletteRemap?{...paletteRemap,sources:pendingRemapSources()}:{oldPalette:doc.palette.slice(),sources:paletteRemapSources()}):null;
 applyIndexedPalette(doc,colors,origins);
 if(pending){paletteRemap={...pending,newPalette:doc.palette.slice(),applied:paletteRemapSources()};syncRemapButton();}
}
function remapPaletteIndices(){
 if(!paletteRemap||modeOf(doc)!=='indexed'){message('切换色板后才能在索引模式下重映射');return;}
 const {oldPalette,newPalette}=paletteRemap,sources=pendingRemapSources();
 mutate(()=>{
  for(const [f,frame]of doc.frames.entries())for(const [index,pixels]of frame.cels.entries()){
   const layer=doc.layers[index],indices=frame.indices?.[index];
   if(!indices||!pixels)continue;
   const mapper=createMapper(doc,layer),source=sources?.[f]?.[index];
   const mapped=source?{indices:source.map(value=>mapper(value).index)}:remapIndices(oldPalette,newPalette,indices);
   for(let i=0;i<indices.length;i++){indices[i]=mapped.indices[i];pixels[i]=indexColor(doc,indices[i],layer);}
  }
  paletteRemap=null;
 },'已按旧色板重映射索引像素',{colorsReady:true});
 syncRemapButton();
}
async function savePaletteLibraryEntry(){
 if(!documentTabs.items.length){message('请先打开或新建项目');return;}
 const values=await modal('存为色板','<label>色板名称<input name="name" maxlength="60" required></label><p class="note">把当前色板的 '+doc.palette.length+' 个颜色保存到本机色板库；同名会覆盖。</p>',form=>{form.elements.name.value=doc.name+' 色板';});
 if(!values)return;
 try{const entry=savePaletteToLibrary(values.name,doc.palette);renderPaletteLibrary();$('palette-library').value=entry.id;paletteLibraryId=entry.id;syncPaletteLibraryButtons();message('已把色板存为 '+entry.name);}catch(error){showError(error.message);}
}
function deletePaletteLibraryEntry(){
 const select=$('palette-library'),id=select?select.value:'';
 if(!id){message('先在色板库选择一个色板');return;}
 const entry=paletteById(id);
 if(!entry)return;
 if(!entry.user){message('内置色板不能删除');return;}
 deletePaletteFromLibrary(id);renderPaletteLibrary();message('已从色板库删除 '+entry.name);
}
function syncPaletteEditorButton(){
  const button=document.querySelector('[data-action="palette-editor"]');
  if(!button)return;
  button.classList.toggle('active',paletteEditing);
  button.setAttribute('aria-pressed',String(paletteEditing));
  button.title=paletteEditing?'退出色板编辑模式':'编辑、排序和删除色板颜色';
}
function syncPaletteSelection(){
  const el=$('palette');if(!el)return;
  for(const b of el.children){
    if(!b.classList.contains('swatch'))continue;
    const index=Number(b.dataset.index),selected=palettePicking()&&paletteSelection.has(index);
    b.classList.toggle('edit-selected',selected);
    b.classList.toggle('edit-active',selected&&paletteActive===index);
    b.setAttribute('aria-pressed',String(selected));
  }
  const outline=el.querySelector('.palette-outline'),path=outlinePathData(paletteSelectionOutline(el),4);
  if(!outline){syncPaletteEditActions();return;}
  outline.replaceChildren();
  if(!path){syncPaletteEditActions();return;}
  // viewBox 和轮廓坐标都取自同一个矩形，避免 SVG 实际尺寸与 viewBox 不一致时整条轮廓被缩放。
  const rect=paletteOutlineBox(el);
  outline.style.width=rect.width+'px';outline.style.height=rect.height+'px';
  outline.setAttribute('width',rect.width);outline.setAttribute('height',rect.height);
  outline.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);
  for(const name of ['palette-outline-halo','palette-outline-line']){
    const stroke=document.createElementNS('http://www.w3.org/2000/svg','path');stroke.setAttribute('class',name);stroke.setAttribute('d',path);outline.append(stroke);
  }
  syncPaletteEditActions();
}
function paletteOutlineBox(el){
  const rect=el.getBoundingClientRect();
  return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
}
// Grid coordinates of every selected swatch, so palette-outline.js can trace the union boundary
// of the selection (steps, holes and disconnected groups included) instead of one box per run.
function paletteSelectionOutline(el){
  const swatches=[...el.children].filter(node=>node.classList.contains('swatch'));
  if(!swatches.length)return [];
  // 行/列取自整块色板而不是只取选中格：只取选中格时，跨行区间（例如第 3 格到第 9 格）
  // 的列集合中间会缺列，补出的“相邻列”间距被算成几格的宽度，轮廓就会拉成一条斜线。
  const base=paletteOutlineBox(el);
  const boxes=swatches.map(node=>{const r=node.getBoundingClientRect();return{node,left:r.left-base.left,top:r.top-base.top,width:r.width,height:r.height};});
  const cellWidth=boxes[0].width,cellHeight=boxes[0].height;
  const near=(a,b,tolerance)=>Math.abs(a-b)<=tolerance;
  const columns=[];for(const box of boxes)if(!columns.some(value=>near(value,box.left,cellWidth/2)))columns.push(box.left);
  columns.sort((a,b)=>a-b);
  const rows=[];for(const box of boxes)if(!rows.some(value=>near(value,box.top,cellHeight/2)))rows.push(box.top);
  rows.sort((a,b)=>a-b);
  const cells=boxes.filter(box=>box.node.classList.contains('edit-selected')).map(box=>({
    col:columns.findIndex(value=>near(value,box.left,cellWidth/2)),
    row:rows.findIndex(value=>near(value,box.top,cellHeight/2))
  }));
  if(!cells.length)return [];
  return paletteOutline(cells,{
    cellWidth,cellHeight,
    gapX:columns.length>1?columns[1]-columns[0]-cellWidth:0,
    gapY:rows.length>1?rows[1]-rows[0]-cellHeight:0,
    originX:columns[0],originY:rows[0]
  });
}
function cancelPaletteDrag(){
  const drag=paletteDrag;paletteDrag=null;
  const el=$('palette');
  for(const b of el.children){delete b.dataset.drop;b.classList.remove('dragging');}
  if(drag)try{el.releasePointerCapture(drag.pointerId);}catch{}
}
function setPaletteEditing(value){
  if(paletteEditing===value)return;
  paletteEditing=value;
  cancelPaletteDrag();closeContextMenu();
  if(value){
    const match=modeOf(doc)==='indexed'?colorIndex:doc.palette.findIndex(c=>c.toLowerCase()===color.toLowerCase());
    paletteActive=match>=0&&match<doc.palette.length?match:(doc.palette.length?0:null);
    paletteSelection=new Set(paletteActive===null?[]:[paletteActive]);
  }else{paletteSelection.clear();paletteActive=null;}
  paletteDomKey='';renderPalette();syncPaletteEditorButton();syncPalettePanel();
  message(value?'色板编辑：按下拖动累积选择，右下角手柄排序，右上角图标删除，右键更多':'已退出色板编辑模式，点击色块取色');
}
function togglePaletteEditor(){setPaletteEditing(!paletteEditing);}
function openPaletteColor(index){
  index=index??paletteTargetIndex();
  if(index===null||!doc.palette[index])return;
  if(!paletteSelection.has(index)){paletteSelection=new Set([index]);paletteActive=index;syncPaletteSelection();syncPalettePanel();}
  if(!paletteColorInput){
    paletteColorInput=document.createElement('input');paletteColorInput.type='color';paletteColorInput.id='palette-color-input';paletteColorInput.setAttribute('aria-label','选择色板颜色');
    Object.assign(paletteColorInput.style,{position:'fixed',left:'-9999px',top:'0',width:'1px',height:'1px',opacity:'0'});
    document.body.append(paletteColorInput);
    paletteColorInput.addEventListener('change',()=>{
      const target=paletteColorTarget;paletteColorTarget=null;
      if(target!==null)setPaletteColor(target,paletteColorInput.value,{preserveAlpha:true});
    });
  }
  paletteColorTarget=index;
  paletteColorInput.value=doc.palette[index].slice(0,7);
  paletteColorInput.click();
}
function previewPaletteColor(index,value){
  const color=normalizeColor(value),swatch=$('palette').children[index];
  if(swatch)swatch.style.background=color;
  $('hex').value=color.toUpperCase();
}
function setPaletteColor(index,value,{preserveAlpha=false}={}){
  const old=doc.palette[index];if(old===undefined)return;
  let next=normalizeColor(value);
  if(preserveAlpha)next=normalizeColor(next.slice(0,7)+(old.length===9?old.slice(7):'ff'));
  if(modeOf(doc)==='grayscale')next='#'+grayPixel(colorValue(next)).toString(16).padStart(8,'0');
  if(next===old)return;
  mutate(()=>{const colors=[...doc.palette];colors[index]=next;applyIndexedPalette(doc,colors,colors.map((_,i)=>i));},'已修改色板颜色',{colorsReady:true});
}
function insertPaletteColor(index,value=doc.palette[index]){
  if(doc.palette.length>=256)return message('色板最多 256 色');
  let next=normalizeColor(value);
  if(modeOf(doc)==='grayscale')next='#'+grayPixel(colorValue(next)).toString(16).padStart(8,'0');
  const colors=[...doc.palette],origins=colors.map((_,i)=>i);
  colors.splice(index+1,0,next);origins.splice(index+1,0,null);
  paletteSelection=new Set([index+1]);paletteActive=index+1;
  mutate(()=>editIndexedPalette(doc,colors,origins),'已在右侧插入颜色',{colorsReady:true});
}
async function copySelectedPaletteColor(){
  if(paletteActive===null||!paletteSelection.has(paletteActive)||!doc.palette[paletteActive])return message('请先选择要复制的色块');
  const colors=[...paletteSelection].sort((a,b)=>a-b).map(index=>doc.palette[index]);
  try{await navigator.clipboard.writeText(formatPaletteClipboard(colors));message(colors.length>1?`已复制 ${colors.length} 个颜色`:'已复制颜色值');}catch(error){showError('复制失败：'+error.message);}
}
async function pastePaletteColorAfterSelection(){
  const index=paletteActive;
  if(index===null||!paletteSelection.has(index)||!doc.palette[index])return message('请先选择要粘贴位置的色块');
  try{const {colors,skipped}=parsePaletteClipboard(await navigator.clipboard.readText());if(!colors.length)return message('剪贴板没有可用的 HEX 颜色');insertPaletteColorsAfter(index,colors,skipped);}catch(error){showError('粘贴失败：'+error.message);}
}
function insertPaletteColorsAfter(index,colors,skipped=0){
  const normalized=modeOf(doc)==='grayscale'?colors.map(value=>'#'+grayPixel(colorValue(value)).toString(16).padStart(8,'0')):colors;
  const {palette:next,inserted,dropped}=insertPaletteColors(doc.palette,index,normalized);
  if(!inserted.length)return message('色板最多 256 色');
  const origins=doc.palette.map((_,i)=>i);
  const placed=[...origins.slice(0,index+1),...inserted.map(()=>null),...origins.slice(index+1)];
  paletteSelection=new Set(inserted.map((_,offset)=>index+1+offset));paletteActive=index+inserted.length;
  mutate(()=>editIndexedPalette(doc,next,placed),'已粘贴颜色',{colorsReady:true});
  const skippedNote=skipped?`，跳过 ${skipped} 行无法解析的内容`:'';
  message(`已粘贴 ${inserted.length} 个颜色${dropped?`，超出 256 色上限丢弃 ${dropped} 个`:''}${skippedNote}`);
}
async function copyPaletteValue(index){
  try{await navigator.clipboard.writeText(doc.palette[index].toUpperCase());message('已复制颜色值');}catch(error){showError('复制失败：'+error.message);}
}
async function pastePaletteValue(index){
  try{const text=(await navigator.clipboard.readText()).trim();setPaletteColor(index,text);message('已粘贴颜色值');}catch(error){showError('粘贴失败：'+error.message);}
}
function closeContextMenu(){
  const menu=contextMenu;if(!menu)return;
  contextMenu=null;
  menu.node.remove();
  menu.view.removeEventListener('pointerdown',menu.onDown,true);
  menu.view.removeEventListener('keydown',menu.onKey,true);
  menu.view.removeEventListener('blur',menu.onBlur);
}
function openContextMenu(x,y,label,entries,className='context-menu',anchor=null){
  closeContextMenu();
  const el=anchor||$('palette'),owner=el.ownerDocument,view=owner.defaultView,node=owner.createElement('div');
  node.className=className;node.setAttribute('role','menu');node.setAttribute('aria-label',label);
  for(const [name,run] of entries){
    const button=owner.createElement('button');button.type='button';button.dataset.menuAction=name;button.textContent=name;
    button.onclick=()=>{closeContextMenu();run();};
    node.append(button);
  }
  owner.body.append(node);
  const rect=node.getBoundingClientRect();
  node.style.left=Math.max(8,Math.min(x,view.innerWidth-rect.width-8))+'px';
  node.style.top=Math.max(8,Math.min(y,view.innerHeight-rect.height-8))+'px';
  const onDown=event=>{if(!node.contains(event.target))closeContextMenu();};
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeContextMenu();}};
  const onBlur=()=>closeContextMenu();
  view.addEventListener('pointerdown',onDown,true);
  view.addEventListener('keydown',onKey,true);
  view.addEventListener('blur',onBlur);
  contextMenu={node,view,onDown,onKey,onBlur};
}
function openPaletteMenu(x,y,index){
  closeContextMenu();
  openContextMenu(x,y,'颜色操作',[['修改颜色',()=>openPaletteColor(index)],['复制色值',()=>void copyPaletteValue(index)],['粘贴色值',()=>void pastePaletteValue(index)],['在右侧插入颜色',()=>insertPaletteColor(index)],['删除颜色',()=>{paletteSelection=new Set([index]);paletteActive=index;removeSelectedPaletteColors();}]],'palette-context-menu');
}
function applyPaletteReorder(targetIndex,after){
  const selected=[...paletteSelection].sort((a,b)=>a-b);if(!selected.length)return;
  const slot=targetIndex+(after?1:0);
  const items=doc.palette.map((pixelColor,index)=>({pixelColor,origin:index}));
  const remaining=items.filter((_,index)=>!paletteSelection.has(index));
  const moved=items.filter((_,index)=>paletteSelection.has(index));
  const insertAt=remaining.filter(item=>item.origin<slot).length;
  const next=[...remaining.slice(0,insertAt),...moved,...remaining.slice(insertAt)];
  if(next.every((item,index)=>item.origin===index))return;
  const origins=next.map(item=>item.origin);
  paletteSelection=new Set(moved.map((_,index)=>insertAt+index));paletteActive=insertAt;
  mutate(()=>editIndexedPalette(doc,next.map(item=>item.pixelColor),origins),'已重新排序色板',{colorsReady:true});
  const mapped=origins.indexOf(colorIndex);colorIndex=mapped>=0?mapped:(doc.transparentIndex===0?1:0);
  renderColors();
}
function removeSelectedPaletteColors(){
  const selected=[...paletteSelection].sort((a,b)=>a-b);
  if(!selected.length)return message('请先选择要删除的色块');
  if(doc.palette.length<=1)return message('色板至少保留一种颜色');
  if(modeOf(doc)==='indexed'&&selected.includes(doc.transparentIndex))return message('索引模式的透明槽不能删除');
  const colors=[],origins=[];
  doc.palette.forEach((pixelColor,index)=>{if(!paletteSelection.has(index)){colors.push(pixelColor);origins.push(index);}});
  if(!colors.length)return message('色板至少保留一种颜色');
  paletteActive=Math.min(selected[0],colors.length-1);paletteSelection=new Set([paletteActive]);
  mutate(()=>editIndexedPalette(doc,colors,origins),'已删除色板颜色',{colorsReady:true});
  const mapped=origins.indexOf(colorIndex);colorIndex=mapped>=0?mapped:(doc.transparentIndex===0?1:0);
  renderColors();
}
function paletteIndexAt(x,y){
  const el=$('palette'),swatch=el.ownerDocument.elementFromPoint(x,y)?.closest?.('.swatch');
  return swatch&&el.contains(swatch)?Number(swatch.dataset.index):null;
}
function startPaletteReorder(e){
  const index=paletteActive;
  if(index===null||!paletteSelection.has(index))return;
  paletteDrag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,mode:'reorder',moved:false,target:null};
  const el=$('palette');
  for(const b of el.children)if(paletteSelection.has(Number(b.dataset.index)))b.classList.add('dragging');
  try{el.setPointerCapture(e.pointerId);}catch{}
}
function palettePointerDown(e){
  if(!palettePicking()||e.button!==0)return;
  const el=$('palette'),swatch=e.target.closest?.('.swatch');
  if(!swatch||!el.contains(swatch))return;
  const index=Number(swatch.dataset.index);
  paletteSelection=e.ctrlKey||e.metaKey?new Set([...paletteSelection,index]):new Set([index]);paletteActive=index;
  syncPaletteSelection();syncPalettePanel();
  paletteDrag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,mode:'select',moved:false,anchor:index,target:null};
  try{el.setPointerCapture(e.pointerId);}catch{}
}
function palettePointerMove(e){
  const drag=paletteDrag;if(!drag||drag.pointerId!==e.pointerId)return;
  if(!drag.moved){
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4)return;
    drag.moved=true;
  }
  if(drag.mode==='select'){
    const hit=paletteIndexAt(e.clientX,e.clientY);
    if(hit!==null){
      const from=drag.anchor,to=hit;
      paletteSelection=new Set();
      for(let i=Math.min(from,to);i<=Math.max(from,to);i++)paletteSelection.add(i);
      if(paletteActive!==hit){paletteActive=hit;syncPaletteSelection();syncPalettePanel();}
    }
  }else if(drag.mode==='reorder'){
    const target=paletteIndexAt(e.clientX,e.clientY);
    for(const b of $('palette').children)delete b.dataset.drop;
    drag.target=null;
    if(target!==null&&!paletteSelection.has(target)){
      const node=[...$('palette').children].find(b=>Number(b.dataset.index)===target),box=node.getBoundingClientRect(),after=e.clientX>box.left+box.width/2;
      node.dataset.drop=after?'after':'before';drag.target={index:target,after};
    }
  }
}
function palettePointerUp(e){
  const drag=paletteDrag;if(!drag||drag.pointerId!==e.pointerId)return;
  const target=drag.target,moved=drag.moved,mode=drag.mode;
  cancelPaletteDrag();
  if(moved&&mode==='reorder'&&target)applyPaletteReorder(target.index,target.after);
}
function palettePointerCancel(e){
  if(!paletteDrag||paletteDrag.pointerId!==e.pointerId)return;
  cancelPaletteDrag();
}
function paletteContextMenu(e){
  e.preventDefault();
  if(!paletteEditing)return;
  const swatch=e.target.closest?.('.swatch');
  const actionBar=()=>document.querySelector('.palette-edit-actions');
  if(!swatch||!$('palette').contains(swatch))return;
  const index=Number(swatch.dataset.index);
  paletteSelection=new Set([index]);paletteActive=index;
  syncPaletteSelection();syncPalettePanel();
  openPaletteMenu(e.clientX,e.clientY,index);
}
function initPaletteEditing(){
  const el=$('palette');
  el.addEventListener('pointerdown',palettePointerDown);el.addEventListener('pointermove',palettePointerMove);
  el.addEventListener('pointerup',palettePointerUp);el.addEventListener('pointercancel',palettePointerCancel);
  el.addEventListener('contextmenu',paletteContextMenu);
  // 栏位拖动改宽或滚动后重新对齐轮廓，否则描边会停留在旧几何上。
  const resize=new ResizeObserver(()=>{if(paletteEditing)syncPaletteSelection();});
  resize.observe(el);
  el.parentElement?.addEventListener('scroll',()=>{if(paletteEditing)syncPaletteSelection();},{passive:true});
}
// 色板尺寸：一个图标按钮弹出三档气泡，当前档打勾；尺寸只影响色块高度，列数保持 6 列。
const PALETTE_SIZE_KEY='pixpix-palette-size-v1';
const PALETTE_SIZES=[['small','小型'],['medium','中型'],['large','大型']];
let paletteSize=(()=>{const saved=localStorage.getItem(PALETTE_SIZE_KEY);return PALETTE_SIZES.some(item=>item[0]===saved)?saved:'medium';})();
function applyPaletteSize(){
 const el=$('palette');
 if(el)for(const [id] of PALETTE_SIZES)el.classList.toggle('size-'+id,id===paletteSize);
 const label=(PALETTE_SIZES.find(item=>item[0]===paletteSize)||PALETTE_SIZES[1])[1];
 const trigger=document.querySelector('[data-action="palette-size"]');
 if(trigger){trigger.title='色板尺寸：'+label;trigger.setAttribute('aria-label',trigger.title);}
 syncPaletteSizeMenu();
}
function syncPaletteSizeMenu(){
 const menu=document.getElementById('palette-size-menu');if(!menu)return;
 for(const [id] of PALETTE_SIZES){const item=menu.querySelector('[data-size="'+id+'"]');if(item)item.setAttribute('aria-checked',String(id===paletteSize));}
}
function initPaletteSizeMenu(){
 const trigger=document.querySelector('[data-action="palette-size"]');if(!trigger)return;
 setButtonIcon(trigger,'grid');
 trigger.setAttribute('popovertarget','palette-size-menu');trigger.setAttribute('aria-haspopup','dialog');
 const panel=document.createElement('div');panel.id='palette-size-menu';panel.className='context-popover palette-size-menu';panel.popover='auto';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','色板尺寸');
 for(const [id,label] of PALETTE_SIZES){
  const item=document.createElement('button');item.type='button';item.dataset.size=id;item.textContent=label;
  item.onclick=()=>{paletteSize=id;localStorage.setItem(PALETTE_SIZE_KEY,id);applyPaletteSize();panel.hidePopover();message('色板尺寸已切换为'+label);};
  panel.append(item);
 }
 document.body.append(panel);
 panel.addEventListener('beforetoggle',event=>{
  if(event.newState!=='open')return;
  requestAnimationFrame(()=>{const r=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,window.innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+5,window.innerHeight-panel.offsetHeight-8))+'px';});
 });
 applyPaletteSize();
}
async function colorModeDialog(){const values=await modal('颜色模式与量化','<label>模式<select name="mode"><option value="rgba">RGBA</option><option value="indexed">8位索引色</option><option value="grayscale">灰度 + Alpha</option></select></label><label>索引色板<select name="palette"><option value="adaptive">从全部帧自适应生成</option><option value="current">使用当前色板</option></select></label><label>最多色数（含透明槽）<input name="colors" type="number" min="2" max="256" value="256" required></label><label>4×4有序抖动<input name="dither" type="checkbox"></label><p>影响全部帧和像素图层，参考图保持原色。索引模式使用真实调色板索引，绘画 / 合并按色板映射；透明槽保留。重复颜色槽可独立改色。模式转换可撤销；灰度使用亮度加权并保留Alpha。</p>',form=>{form.elements.mode.value=modeOf(doc);const update=()=>{for(const key of ['palette','colors','dither'])form.elements[key].disabled=form.elements.mode.value!=='indexed';};form.elements.mode.onchange=update;update();});if(!values)return;mutate(()=>{convertColorMode(doc,values.mode,{palette:values.palette,colors:+values.colors||256,dither:$('modal-form').elements.dither.checked});if(values.mode==='indexed')colorIndex=createMapper(doc,doc.layers[li])(colorValue(color)).index;},'已转换颜色模式',{colorsReady:true});renderColors();}
async function importPalette(){
  if(!window.desktop)return message('请在桌面应用中导入色板');
  try{const text=await window.desktop.openPalette();if(text!==null){const palette=parsePalette(text);mutate(()=>editIndexedPalette(doc,palette),modeOf(doc)==='indexed'?'已导入色板并重新映射索引像素':'已导入色板',{colorsReady:true});}}catch(error){showError('色板导入失败：'+error.message);}
}
async function exportPalette(){try{if(await saveData(JSON.stringify({format:'pixel-studio-palette',version:1,colors:doc.palette},null,2),'json',doc.name+'-palette'))message('色板已导出');}catch(error){showError('色板导出失败：'+error.message);}}
function imageCanvas(data,w=doc.width,h=doc.height){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;}
function frameCanvas(index,includeReference=false){const hasReferences=doc.layers.some(isReference);frameCache.budget=(hasReferences?32:64)*1024*1024;const cache=includeReference&&hasReferences?referenceCache:frameCache,entry=cache.get(doc,index);if(!entry.canvas){entry.canvas=document.createElement('canvas');entry.canvas.width=doc.width;entry.canvas.height=doc.height;}if(entry.canvasRevision!==entry.revision){const ctx=entry.canvas.getContext('2d'),image=new ImageData(entry.rgba,doc.width,doc.height),r=entry.canvasRevision&&entry.updated;ctx.putImageData(image,0,0,...(r?[r.x,r.y,r.w,r.h]:[]));entry.canvasRevision=entry.revision;}return entry.canvas;}
function pixelsCanvas(data){const rgba=new Uint8ClampedArray(doc.width*doc.height*4);data.forEach((p,i)=>{rgba[i*4]=p>>>24;rgba[i*4+1]=p>>>16&255;rgba[i*4+2]=p>>>8&255;rgba[i*4+3]=p&255;});return imageCanvas(rgba);}
function place(){applyCanvasBackground(wrap,doc.canvasBackground||DEFAULT_CANVAS_BACKGROUND,zoom);wrap.style.left=pan.x+'px';wrap.style.top=pan.y+'px';wrap.style.width=doc.width*zoom+'px';wrap.style.height=doc.height*zoom+'px';canvas.style.width=doc.width*zoom+'px';canvas.style.height=doc.height*zoom+'px';$('zoom-label').textContent=Math.round(zoom*100)+'%';updateBrushPreview();}
function fit(){const r=viewport.getBoundingClientRect();zoom=Math.max(.25,Math.min(24,Math.floor(Math.min((r.width-90)/doc.width,(r.height-65)/doc.height)*4)/4));pan={x:Math.round((r.width-doc.width*zoom)/2),y:Math.round((r.height-doc.height*zoom)/2)};place();draw();}
function scale(factor,anchor=null){const old=zoom;zoom=Math.max(.25,Math.min(48,zoom*factor));const r=viewport.getBoundingClientRect();const p=anchor||{x:r.width/2,y:r.height/2};pan={x:p.x-(p.x-pan.x)*zoom/old,y:p.y-(p.y-pan.y)*zoom/old};place();drawOverlay();}
function draw(){
  if(canvas.width!==doc.width||canvas.height!==doc.height){canvas.width=doc.width;canvas.height=doc.height;}
  ctx.clearRect(0,0,doc.width,doc.height);
  if(onionSettings.position==='behind')drawOnionSkin();
  ctx.drawImage(frameCanvas(playing?previewFrame:fi,!playing),0,0);
  if(onionSettings.position==='front')drawOnionSkin();
  updateOnionIndicator();drawOverlay();drawPreview();
}
function drawOnionSkin(){
  if(!$('onion').checked||playing)return;
  const key=JSON.stringify([onionSettings.mode,onionSettings.previousColor,onionSettings.nextColor,onionSettings.layers,onionSettings.layers==='current'?li:-1]);
  if(onionCacheKey!==key){onionCache.clear();frameCache.clear();referenceCache.clear();onionCacheKey=key;}
  const range=onionSettings.limitRange?scopeFrames(doc,$('play-range').value,frameSelection):null;
  ctx.save();
  for(const source of onionSources(doc.frames.length,fi,onionSettings,range)){
    const cacheKey=source.index+':'+(onionSettings.mode==='original'?'original':source.side);
    if(!onionCache.has(cacheKey))onionCache.set(cacheKey,imageCanvas(onionPixels(doc,source.index,li,onionSettings,source.side)));
    ctx.globalAlpha=source.alpha;ctx.drawImage(onionCache.get(cacheKey),0,0);
  }
  ctx.restore();
}
function updateOnionIndicator(){
  const button=$('onion-settings');button.classList.toggle('active',$('onion').checked);button.setAttribute('aria-pressed',String($('onion').checked));button.title=`洋葱皮设置 · 前 ${onionSettings.before} / 后 ${onionSettings.after} 帧 · ${onionSettings.opacity}% · 播放时隐藏`;
}
function saveOnionPreferences(){localStorage.setItem('pixel-studio-onion',JSON.stringify({...onionSettings,enabled:$('onion').checked}));}
function toggleOnion(){ $('onion').checked=!$('onion').checked;saveOnionPreferences();draw(); }
async function onionSettingsDialog(){
  if(onionSession||$('modal').open)return;
  onionSession={settings:{...onionSettings},enabled:$('onion').checked};
  setPreviewUI(true);$('modal').classList.add('transform-dialog','onion-dialog');$('onion').checked=true;
  const apply=form=>{
    if(!form.checkValidity())return;
    for(const key of ['before','after','opacity','falloff'])onionSettings[key]=+form.elements[key].value;
    for(const key of ['mode','layers','position','previousColor','nextColor'])onionSettings[key]=form.elements[key].value;
    for(const key of ['wrap','limitRange'])onionSettings[key]=form.elements[key].checked;
    $('onion').checked=form.elements.enabled.checked;form.elements.previousColor.disabled=form.elements.nextColor.disabled=onionSettings.mode==='original';draw();
  };
  const pending=modal('洋葱皮设置','<label>启用参考 <input type="checkbox" name="enabled" checked></label><div class="onion-pair"><label>前帧 <input name="before" type="number" min="0" max="8" required></label><label>后帧 <input name="after" type="number" min="0" max="8" required></label></div><label>透明度 % <input name="opacity" type="number" min="0" max="100" required></label><label>逐帧保留 % <input name="falloff" type="number" min="0" max="100" required></label><label>颜色 <select name="mode"><option value="tinted">前红后蓝（可改色）</option><option value="original">原色</option></select></label><div class="onion-pair onion-colors"><label>前帧色 <input type="color" name="previousColor"></label><label>后帧色 <input type="color" name="nextColor"></label></div><label>参考图层 <select name="layers"><option value="visible">全部可见图层</option><option value="current">当前图层</option></select></label><label>叠放位置 <select name="position"><option value="behind">当前帧下方</option><option value="front">当前帧上方</option></select></label><label>边界循环取帧 <input type="checkbox" name="wrap"></label><label>限播放范围 <input type="checkbox" name="limitRange"></label><p>远帧先画，透明度逐帧乘以保留比例。循环短范围不重复取帧，同距离优先前帧色。播放时隐藏；不进入项目、吸色、预览和导出。滚轮可缩放视图，Enter 保存设置，Esc 取消。</p>',form=>{
    for(const [key,value]of Object.entries(onionSettings)){if(form.elements[key].type==='checkbox')form.elements[key].checked=value;else form.elements[key].value=value;}
    form.oninput=()=>apply(form);
  },null,{modeless:true});
  apply($('modal-form'));
  const values=await pending;
  if(values){apply($('modal-form'));saveOnionPreferences();}
  else{onionSettings=onionSession.settings;$('onion').checked=onionSession.enabled;}
  $('modal-form').oninput=null;$('modal').classList.remove('transform-dialog','onion-dialog');onionSession=null;setPreviewUI(false);draw();message(values?'已保存本机洋葱皮设置':'已取消洋葱皮设置');
}
function selectionColors(){const styles=getComputedStyle(document.documentElement);return{line:styles.getPropertyValue('--selection-line').trim()||'#1d4ed8',alt:styles.getPropertyValue('--selection-line-alt').trim()||'#93b4ff',handleFill:styles.getPropertyValue('--surface').trim()||'#1c2129'};}
function selectionHandlePoints(){
  const x=pan.x+selection.x*zoom,y=pan.y+selection.y*zoom,w=selection.w*zoom,h=selection.h*zoom;
  return [[x,y],[x+w/2,y],[x+w,y],[x+w,y+h/2],[x+w,y+h],[x+w/2,y+h],[x,y+h],[x,y+h/2]];
}
function drawSelectionOutline(){
  const {line,alt,handleFill}=selectionColors();
  octx.save();octx.lineWidth=1;octx.beginPath();
  if(!selection.mask)octx.rect(pan.x+selection.x*zoom+.5,pan.y+selection.y*zoom+.5,Math.max(0,selection.w*zoom-1),Math.max(0,selection.h*zoom-1));
  else{
    const left=Math.max(selection.x,Math.floor(-pan.x/zoom)-1),top=Math.max(selection.y,Math.floor(-pan.y/zoom)-1),right=Math.min(selection.x+selection.w,Math.ceil((viewport.clientWidth-pan.x)/zoom)+1),bottom=Math.min(selection.y+selection.h,Math.ceil((viewport.clientHeight-pan.y)/zoom)+1);
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(selectionContains(selection,x,y)){
      const px=pan.x+x*zoom+.5,py=pan.y+y*zoom+.5;
      for(const [dx,dy,x1,y1,x2,y2]of[[-1,0,px,py,px,py+zoom],[1,0,px+zoom,py,px+zoom,py+zoom],[0,-1,px,py,px+zoom,py],[0,1,px,py+zoom,px+zoom,py+zoom]])if(!selectionContains(selection,x+dx,y+dy)){octx.moveTo(x1,y1);octx.lineTo(x2,y2);}
    }
  }
  octx.setLineDash([4,4]);octx.strokeStyle=line;octx.lineDashOffset=-selectionDash;octx.stroke();
  octx.strokeStyle=alt;octx.lineDashOffset=4-selectionDash;octx.stroke();
  octx.setLineDash([]);octx.lineDashOffset=0;octx.strokeStyle=line;octx.fillStyle=handleFill;
  for(const [x,y] of selectionHandlePoints()){const left=Math.round(x)-2,top=Math.round(y)-2;octx.fillRect(left,top,5,5);octx.strokeRect(left+.5,top+.5,4,4);}
  octx.restore();
}
function syncSelectionAnimation(){
  const active=!!selection&&!playing;
  if(active&&selectionAnim===null)selectionAnim=requestAnimationFrame(advanceSelectionAnts);
  else if(!active&&selectionAnim!==null){cancelAnimationFrame(selectionAnim);selectionAnim=null;}
}
function advanceSelectionAnts(now){
  selectionAnim=null;
  if(!selection||playing)return;
  if(now-selectionAnimAt>=90){selectionAnimAt=now;selectionDash=(selectionDash+1)%8;drawOverlay();}
  else selectionAnim=requestAnimationFrame(advanceSelectionAnts);
}
function closeSelectionMenu(){
  if(!selectionMenu)return;
  const menu=selectionMenu;
  menu.view.removeEventListener('pointerdown',menu.onDown,true);
  menu.view.removeEventListener('keydown',menu.onKey,true);
  menu.view.removeEventListener('wheel',menu.onWheel,true);
  menu.view.removeEventListener('blur',menu.onBlur);
  menu.node.remove();selectionMenu=null;
}
function openSelectionMenu(x,y){
  closeSelectionMenu();
  const owner=viewport.ownerDocument,view=owner.defaultView,node=owner.createElement('div');
  node.className='selection-context-menu';node.setAttribute('role','menu');node.setAttribute('aria-label','选区操作');
  for(const [label,name] of [['剪切','cut'],['复制','copy'],['粘贴','paste'],['清除选区内像素','clear'],['反选','invert-selection'],['取消选区','deselect']]){
    const button=owner.createElement('button');button.type='button';button.textContent=label;button.dataset.selectionAction=name;
    button.onclick=()=>{closeSelectionMenu();void dispatch(name);};
    node.append(button);
  }
  owner.body.append(node);
  const rect=node.getBoundingClientRect();
  node.style.left=Math.max(8,Math.min(x,view.innerWidth-rect.width-8))+'px';
  node.style.top=Math.max(8,Math.min(y,view.innerHeight-rect.height-8))+'px';
  const onDown=event=>{if(!node.contains(event.target))closeSelectionMenu();};
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSelectionMenu();}};
  const onWheel=()=>closeSelectionMenu();
  const onBlur=()=>closeSelectionMenu();
  view.addEventListener('pointerdown',onDown,true);
  view.addEventListener('keydown',onKey,true);
  view.addEventListener('wheel',onWheel,true);
  view.addEventListener('blur',onBlur);
  selectionMenu={node,view,onDown,onKey,onWheel,onBlur};
}
function openSelectionMenuAt(event){
  const p=point(event,false);
  if(!selection||p.x<0||p.y<0||p.x>=doc.width||p.y>=doc.height||!selectionContains(selection,p.x,p.y)){closeSelectionMenu();return;}
  openSelectionMenu(event.clientX,event.clientY);
}
function beginSlicePointer(event){
 const raw=transformEventPoint(event),selected=visibleSlices().find(s=>s.id===activeSliceId),handle=selected&&hitSliceHandle(selected.bounds,raw,zoom),hit=handle?selected:visibleSlices().reverse().find(s=>{const b=s.bounds;return raw.x>=b.x&&raw.y>=b.y&&raw.x<b.x+b.w&&raw.y<b.y+b.h;});
 if(!hit&&(raw.x<0||raw.y<0||raw.x>=doc.width||raw.y>=doc.height))return;
 const before=clone(doc),start=point(event);let slice=hit;
 if(!slice){slice={id:crypto.randomUUID(),name:'切片 '+(doc.slices.length+1),bounds:{x:start.x,y:start.y,w:1,h:1}};doc.slices.push(setSliceKey(slice,fi,slice));doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'slices',...(fi?['slice-keyframes']:[])])];}
 activeSliceId=slice.id;gesture={kind:'slice',sliceId:slice.id,handle:hit?(handle||'move'):'create',original:clone(slice),start,rawStart:raw,before,oldSelection:selection,pointerId:event.pointerId};viewport.setPointerCapture(event.pointerId);drawOverlay();
}
function drawOverlay(){
  syncSelectionAnimation();
  syncVisualControls();
  const w=viewport.clientWidth,h=viewport.clientHeight,dpr=window.devicePixelRatio;
  const physicalW=Math.round(w*dpr),physicalH=Math.round(h*dpr);
  if(overlay.width!==physicalW||overlay.height!==physicalH){overlay.width=physicalW;overlay.height=physicalH;}
  overlay.style.width=w+'px';overlay.style.height=h+'px';
  octx.setTransform(dpr,0,0,dpr,0,0);octx.clearRect(0,0,w,h);
  octx.imageSmoothingEnabled=false;
  for(const offset of tiledCopies(tiledMode)){if(!offset.x&&!offset.y)continue;const x=pan.x+offset.x*doc.width*zoom,y=pan.y+offset.y*doc.height*zoom,tw=doc.width*zoom,th=doc.height*zoom;if(x>w||y>h||x+tw<0||y+th<0)continue;octx.fillStyle=tiledBackground();octx.fillRect(x,y,tw,th);octx.drawImage(canvas,x,y,tw,th);octx.strokeStyle='#80808066';octx.strokeRect(x+.5,y+.5,tw-1,th-1);}
  if($('grid').checked&&zoom>=5){
    const left=Math.max(0,pan.x),top=Math.max(0,pan.y),right=Math.min(w,pan.x+doc.width*zoom),bottom=Math.min(h,pan.y+doc.height*zoom);
    if(left<right&&top<bottom){
      octx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();octx.lineWidth=1;octx.beginPath();
      const firstX=Math.max(0,Math.ceil(-pan.x/zoom)),lastX=Math.min(doc.width,Math.floor((w-pan.x)/zoom));
      const firstY=Math.max(0,Math.ceil(-pan.y/zoom)),lastY=Math.min(doc.height,Math.floor((h-pan.y)/zoom));
      for(let x=firstX;x<=lastX;x++){const px=Math.round(pan.x+x*zoom)+.5;octx.moveTo(px,top);octx.lineTo(px,bottom);}
      for(let y=firstY;y<=lastY;y++){const py=Math.round(pan.y+y*zoom)+.5;octx.moveTo(left,py);octx.lineTo(right,py);}
      octx.stroke();
    }
  }
  if(gridSettings.visible){
    const lines=gridLines(gridSettings,doc.width,doc.height);
    const left=Math.max(0,pan.x),top=Math.max(0,pan.y),right=Math.min(w,pan.x+doc.width*zoom),bottom=Math.min(h,pan.y+doc.height*zoom);
    if(lines.xs.length&&lines.ys.length&&left<right&&top<bottom){
      octx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent-line').trim();octx.lineWidth=1;octx.setLineDash([]);octx.beginPath();
      // 画布右 / 下边界补一条线，避免最后一列的网格看起来被截断。
      for(const x of [...lines.xs,doc.width]){const px=Math.round(pan.x+x*zoom)+.5;if(px<left-1||px>right+1)continue;octx.moveTo(px,top);octx.lineTo(px,bottom);}
      for(const y of [...lines.ys,doc.height]){const py=Math.round(pan.y+y*zoom)+.5;if(py<top-1||py>bottom+1)continue;octx.moveTo(left,py);octx.lineTo(right,py);}
      octx.stroke();
    }
  }
  if(!playing){octx.save();octx.setLineDash([3,3]);for(const slice of visibleSlices()){const b=slice.bounds;octx.strokeStyle=slice.id===activeSliceId?'#edb75b':'#69cfc3';octx.strokeRect(pan.x+b.x*zoom+.5,pan.y+b.y*zoom+.5,b.w*zoom-1,b.h*zoom-1);if(tool==='slice'&&slice.id===activeSliceId){octx.setLineDash([]);octx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--surface');for(const p of sliceHandlePoints(b)){const x=pan.x+p.x*zoom,y=pan.y+p.y*zoom;octx.fillRect(x-3,y-3,6,6);octx.strokeRect(x-3,y-3,6,6);}octx.setLineDash([3,3]);}}octx.restore();}
  if(gesture?.stabilizer&&pointer){const start=gesture.stabilizer.position(),end=point(pointer);octx.save();octx.strokeStyle='#b590eb';octx.lineWidth=1;octx.setLineDash([3,3]);octx.beginPath();octx.moveTo(pan.x+(start.x+.5)*zoom,pan.y+(start.y+.5)*zoom);octx.lineTo(pan.x+(end.x+.5)*zoom,pan.y+(end.y+.5)*zoom);octx.stroke();octx.restore();}
  const axes=symmetryOptions(),showAxes=!playing&&['pencil','eraser','line','rect','ellipse','curve','polygon','contour'].includes(tool);
  octx.save();octx.strokeStyle='#e9b456';octx.lineWidth=1;octx.setLineDash([5,4]);
  for(const [i,axis]of ['x','y'].entries()){const handle=symmetryHandles[i],visible=showAxes&&(axis==='x'?axes.horizontal:axes.vertical);handle.hidden=!visible;if(!visible)continue;const value=(axis==='x'?pan.x:pan.y)+axes[axis]*zoom;octx.beginPath();if(axis==='x'){octx.moveTo(value,Math.max(0,pan.y));octx.lineTo(value,Math.min(h,pan.y+doc.height*zoom));handle.style.left=value+'px';handle.style.top=Math.max(12,Math.min(h-12,pan.y+12))+'px';}else{octx.moveTo(Math.max(0,pan.x),value);octx.lineTo(Math.min(w,pan.x+doc.width*zoom),value);handle.style.left=Math.max(12,Math.min(w-12,pan.x+12))+'px';handle.style.top=value+'px';}octx.stroke();}
  octx.restore();
  drawStraightStrokePreview();
  if(selection)for(const offset of tiledCopies(tiledMode)){octx.save();octx.translate(offset.x*doc.width*zoom,offset.y*doc.height*zoom);drawSelectionOutline();octx.restore();}
  $('selection-info').textContent=selection?`选区 ${selection.w} × ${selection.h}`:'';
  if(transformSession)drawTransformControls();
  if(textSession){positionTextEditor();drawTextOverlay();}
  syncInteraction();
}
function straightStrokeOrigin(){const previous=lastStrokePoint;return modifiers.shift&&!gesture&&pointer?.inside&&['pencil','eraser'].includes(tool)&&previous?.documentId===documentId&&previous.frame===fi&&previous.layer===li&&previous.tool===tool?previous.point:null;}
function drawStraightStrokePreview(){
  const start=straightStrokeOrigin();if(!start)return;
  const end=point(pointer,false);if(end.x<0||end.y<0||end.x>=doc.width||end.y>=doc.height)return;
  const points=[];line(start.x,start.y,end.x,end.y,(x,y)=>{if(brushSettings.pixelPerfect&&brush===1)appendPixelPerfect(points,{x,y});else points.push({x,y});});
  const footprint=previewFootprint;octx.save();octx.fillStyle=tool==='eraser'?'#ff6b6b':color;octx.globalAlpha=tool==='eraser'?.45:Math.max(.25,brushSettings.opacity/100*.65);
  for(const center of points)for(const offset of footprint)for(const {x,y}of symmetryPoints(center.x+offset.x,center.y+offset.y,doc.width,doc.height,symmetryOptions())){if(x<0||y<0||x>=doc.width||y>=doc.height||selection&&!selectionContains(selection,x,y))continue;octx.fillRect(pan.x+x*zoom,pan.y+y*zoom,Math.max(1,zoom),Math.max(1,zoom));}
  octx.restore();
}
function transformEventPoint(event){const r=viewport.getBoundingClientRect();return{x:(event.clientX-r.left-pan.x)/zoom,y:(event.clientY-r.top-pan.y)/zoom};}
function drawTransformControls(){
  const state=transformSession.state,handles=transformHandles(state,zoom),screen=p=>({x:pan.x+p.x*zoom,y:pan.y+p.y*zoom});
  const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>screen(transformPoint(state,u,v)));
  const styles=getComputedStyle(document.documentElement),line=styles.getPropertyValue('--selection-line').trim()||'#1d4ed8';
  octx.strokeStyle=line;octx.fillStyle=styles.getPropertyValue('--surface').trim();octx.lineWidth=1.5;octx.setLineDash([]);
  octx.beginPath();corners.forEach((p,i)=>i?octx.lineTo(p.x,p.y):octx.moveTo(p.x,p.y));octx.closePath();octx.stroke();
  const top=screen(transformPoint(state,.5,0)),rotation=screen(handles.find(p=>p.id==='rotate'));
  octx.beginPath();octx.moveTo(top.x,top.y);octx.lineTo(rotation.x,rotation.y);octx.stroke();
  for(const handle of handles){const p=screen(handle);octx.beginPath();if(handle.id==='pivot'||handle.id==='rotate')octx.arc(p.x,p.y,handle.id==='pivot'?6:5,0,Math.PI*2);else octx.rect(p.x-3.5,p.y-3.5,7,7);octx.fill();octx.stroke();if(handle.id==='pivot'){octx.beginPath();octx.moveTo(p.x-9,p.y);octx.lineTo(p.x+9,p.y);octx.moveTo(p.x,p.y-9);octx.lineTo(p.x,p.y+9);octx.stroke();}}
}
function finishTransformDrag(cancel=false){
  const session=transformSession,drag=session?.drag;if(!drag)return;
  session.drag=null;if(cancel){session.state=drag.state;session.sync();session.preview();}
  if(viewport.hasPointerCapture(drag.pointerId))viewport.releasePointerCapture(drag.pointerId);
  syncInteraction();
}
function setPreviewUI(active){
  document.body.classList.toggle('previewing',active);
  uiAll('header,.document-bar,.options,.drawing-options,nav,aside,.dock-slot,.dock-panel,.canvas-label,.workspace-bottom,.timeline,footer').forEach(el=>el.inert=active);
}
window.addEventListener('panel-moved',event=>{if(event.detail.id==='preview'){previewZoom=0;drawPreview();}if(event.detail.id==='reference')renderReferenceBoard(true);if(event.detail.id==='terrain-preview')renderTerrainPreview();});
const previewArea=$('preview').parentElement,previewControls=document.createElement('div');previewControls.className='preview-controls';
for(const [id,icon,title] of [['preview-fit','fit','适应内容'],['preview-play','play','播放预览']]){const button=document.createElement('button');button.id=id;button.type='button';button.className='icon-button visual-button';button.title=title;button.setAttribute('aria-label',title);button.innerHTML=iconMarkup(icon);previewControls.append(button);}
previewArea.append(previewControls);
function stopPreview(){previewPlaying=false;previewPlayback=null;clearTimeout(previewTimer);setButtonIcon($('preview-play'),'play','播放预览');drawPreview();}
function fitPreview(){const r=previewArea.getBoundingClientRect();previewZoom=Math.max(.05,Math.min(32,Math.min((r.width-16)/doc.width,(r.height-16)/doc.height)));previewPan={x:(r.width-doc.width*previewZoom)/2,y:(r.height-doc.height*previewZoom)/2};previewPanelSize={w:r.width,h:r.height};drawPreview();}
function zoomPreview(factor,anchor){const old=previewZoom;previewZoom=Math.max(.05,Math.min(64,previewZoom*factor));previewPan={x:anchor.x-(anchor.x-previewPan.x)*previewZoom/old,y:anchor.y-(anchor.y-previewPan.y)*previewZoom/old};drawPreview();}
function drawPreview(){const c=$('preview'),pc=c.getContext('2d'),r=previewArea.getBoundingClientRect();if(!previewZoom||r.width!==previewPanelSize.w||r.height!==previewPanelSize.h||c.width!==doc.width||c.height!==doc.height){previewZoom=Math.max(.05,Math.min(32,Math.min((r.width-16)/doc.width,(r.height-16)/doc.height)));previewPan={x:(r.width-doc.width*previewZoom)/2,y:(r.height-doc.height*previewZoom)/2};previewPanelSize={w:r.width,h:r.height};}const index=previewPlaying?previewPlayFrame:fi;if(c.width!==doc.width||c.height!==doc.height){c.width=doc.width;c.height=doc.height;}Object.assign(c.style,{width:doc.width*previewZoom+'px',height:doc.height*previewZoom+'px',left:previewPan.x+'px',top:previewPan.y+'px'});pc.clearRect(0,0,c.width,c.height);pc.drawImage(frameCanvas(index),0,0);$('preview-frame').textContent=`${index+1} / ${doc.frames.length}`;$('preview-time').textContent=`${doc.frames[index].duration} ms`;$('preview-play').hidden=doc.frames.length<2;if(previewPlaying&&doc.frames.length<2)stopPreview();}
$('preview-fit').onclick=fitPreview;
$('preview-play').onclick=()=>{if(previewPlaying){stopPreview();return;}const scope=$('play-range').value,tag=doc.tags.find(item=>item.id===scope),direction=$('play-direction').value;previewPlayback=createPlayback(doc,scopeFrames(doc,scope,frameSelection),direction==='tag'?tag?.direction||'forward':direction,!$('play-once').checked,fi,performance.now());previewPlaying=true;setButtonIcon($('preview-play'),'pause','暂停预览');const tick=()=>{previewPlayFrame=previewPlayback.advance(performance.now());drawPreview();if(previewPlayback.finished){stopPreview();return;}previewTimer=setTimeout(tick,Math.max(1,previewPlayback.nextAt-performance.now()));};tick();};
previewArea.addEventListener('wheel',event=>{event.preventDefault();const r=previewArea.getBoundingClientRect();zoomPreview(event.deltaY<0?1.25:.8,{x:event.clientX-r.left,y:event.clientY-r.top});},{passive:false});
previewArea.addEventListener('pointerdown',event=>{if(event.target.closest('button')||event.button!==0&&event.button!==1)return;event.preventDefault();previewDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,pan:{...previewPan}};previewArea.setPointerCapture(event.pointerId);});
previewArea.addEventListener('pointermove',event=>{if(previewDrag?.pointerId!==event.pointerId)return;previewPan={x:previewDrag.pan.x+event.clientX-previewDrag.x,y:previewDrag.pan.y+event.clientY-previewDrag.y};drawPreview();});
for(const type of ['pointerup','pointercancel'])previewArea.addEventListener(type,event=>{if(previewDrag?.pointerId!==event.pointerId)return;previewDrag=null;if(previewArea.hasPointerCapture(event.pointerId))previewArea.releasePointerCapture(event.pointerId);});
function layerThumbnail(index){if(isReference(doc.layers[index])){const ref=doc.layers[index].reference;if(!thumbCache.has(ref)){const mini=pixelsCanvas(rasterReference(doc,index,fi));mini.className='mini';thumbCache.set(ref,mini);}return thumbCache.get(ref);}if(isGroup(doc.layers[index])){const key=doc.layers[index];if(!thumbCache.has(key)){const mini=document.createElement('span');mini.className='mini group-icon';mini.innerHTML=iconMarkup('layers');thumbCache.set(key,mini);}return thumbCache.get(key);}const cel=doc.frames[fi].celProperties?.[doc.layers[index].id]||doc.frames[fi].cels[index];if(!thumbCache.has(cel)){const mini=pixelsCanvas(celPixels(doc,fi,index));mini.className='mini';thumbCache.set(cel,mini);}return thumbCache.get(cel);}
function navigateLayer(event,index){
  if(event.target!==event.currentTarget||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return;
  const keys=['ArrowUp','ArrowDown','Home','End','ArrowLeft','ArrowRight','Enter',' '];
  if(!keys.includes(event.key))return;
  event.preventDefault();event.stopPropagation();if(gesture||shapeSession)return;
  const shown=visibleLayerIndices(doc),at=shown.indexOf(index),layer=doc.layers[index];let next=index;
  if(event.key==='ArrowUp')next=shown[Math.max(0,at-1)];
  else if(event.key==='ArrowDown')next=shown[Math.min(shown.length-1,at+1)];
  else if(event.key==='Home')next=shown[0];
  else if(event.key==='End')next=shown.at(-1);
  else if(event.key==='ArrowLeft'){
    if(isGroup(layer)&&!layer.collapsed)mutate(()=>layer.collapsed=true,'已折叠图层组');
    else next=ancestors(doc,index)[0]??index;
  }else if(event.key==='ArrowRight'&&isGroup(layer)){
    if(layer.collapsed)mutate(()=>layer.collapsed=false,'已展开图层组');
    else next=shown.find(i=>doc.layers[i].parentId===layer.id)??index;
  }
  stop();li=next;render();$('layers').querySelector(`[data-index="${li}"]`).focus({preventScroll:true});
}
async function renameLayer(index=li){const values=await modal('重命名图层','<label>名称 <input name="name" type="text" maxlength="80" required></label>',form=>{form.elements.name.value=doc.layers[index].name;});if(values)mutate(()=>doc.layers[index].name=values.name.trim()||doc.layers[index].name);}
function renderLayers(){
  const focused=uiActive(),focusedRow=focused.closest?.('.layer'),focusedId=focusedRow?.dataset.layerId,focusedControl=['group-fold','layer-visibility','layer-lock'].find(name=>focused.classList.contains(name));
  const shown=visibleLayerIndices(doc),key=documentId+JSON.stringify(doc.layers);if(key===layerDomKey&&$('layers').children.length===shown.length){[...$('layers').children].forEach((row,i)=>{const index=shown[i];row.classList.toggle('selected',index===li);row.tabIndex=index===li?0:-1;row.setAttribute('aria-selected',String(index===li));const mini=layerThumbnail(index);if(row.querySelector('.mini')!==mini)row.querySelector('.mini').replaceWith(mini);});$('layer-continuous').checked=!!doc.layers[li].continuous;$('layer-continuous').disabled=isGroup(doc.layers[li])||isReference(doc.layers[li]);$('group-mode-label').hidden=!isGroup(doc.layers[li]);$('group-mode').value=doc.layers[li].passThrough?'pass':'isolated';$('opacity').disabled=$('layer-blend').disabled=!!doc.layers[li].passThrough||isBackground(doc.layers[li]);$('layer-blend').value=doc.layers[li].blendMode||'normal';$('opacity').value=doc.layers[li].opacity;$('opacity-label').textContent=doc.layers[li].opacity+'%';return;}layerDomKey=key;
  $('layers').replaceChildren();
  shown.forEach(index=>{const layer=doc.layers[index],row=document.createElement('div');row.className='layer'+(index===li?' selected':'');row.dataset.index=index;row.dataset.layerId=layer.id;row.setAttribute('role','treeitem');row.setAttribute('aria-label',layer.name);row.setAttribute('aria-level',String(ancestors(doc,index).length+1));row.setAttribute('aria-selected',String(index===li));row.tabIndex=index===li?0:-1;if(isGroup(layer))row.setAttribute('aria-expanded',String(!layer.collapsed));row.onkeydown=e=>navigateLayer(e,index);row.oncontextmenu=e=>{e.preventDefault();if(gesture||shapeSession)return;stop();li=index;render();const menu=$('layer-menu');e.currentTarget.ownerDocument.body.append(menu);const bounds=e.currentTarget.getBoundingClientRect();menu.contextPoint={left:e.clientX||bounds.left+12,bottom:e.clientY||bounds.bottom};menu.showPopover();};row.style.paddingLeft=(6+ancestors(doc,index).length*14)+'px';if(isGroup(layer)){const fold=document.createElement('button');fold.className='icon-button group-fold';setButtonIcon(fold,'chevron');fold.style.transform=layer.collapsed?'rotate(-90deg)':'';fold.title=layer.collapsed?'展开图层组':'折叠图层组';fold.setAttribute('aria-label',fold.title);fold.onclick=e=>{e.stopPropagation();mutate(()=>{layer.collapsed=!layer.collapsed;if(layer.collapsed&&ancestors(doc,li).includes(index))li=index;},'已切换组显示');};row.append(fold);}
    const eye=document.createElement('button');setButtonIcon(eye,layer.visible?'eye':'eye-off');eye.className='layer-visibility icon-button';eye.setAttribute('aria-label',layer.visible?'隐藏图层':'显示图层');eye.title=layer.visible?'隐藏图层':'显示图层';eye.onclick=()=>mutate(()=>doc.layers[index].visible=!doc.layers[index].visible);
    const mini=layerThumbnail(index);
    const name=document.createElement('span');name.className='layer-name';name.textContent=(isReference(layer)?'参考 · ':isBackground(layer)?'背景 · ':'')+layer.name;name.ondblclick=()=>renameLayer(index);
    const lock=document.createElement('button');setButtonIcon(lock,layer.locked?'lock':'unlock');lock.className='layer-lock icon-button';lock.setAttribute('aria-label',layer.locked?'解锁图层':'锁定图层');lock.title=layer.locked?'解锁图层':'锁定图层';lock.onclick=()=>mutate(()=>doc.layers[index].locked=!doc.layers[index].locked);
    row.onclick=e=>{if(eye.contains(e.target)||lock.contains(e.target))return;if(gesture||shapeSession)return;stop();li=index;render();};row.append(eye,mini,name,lock);$('layers').append(row);
  });if(focusedId){const row=$('layers').querySelector(`[data-layer-id="${focusedId}"]`);(focusedControl?row?.querySelector('.'+focusedControl):row)?.focus({preventScroll:true});}
  $('layer-continuous').checked=!!doc.layers[li].continuous;$('layer-continuous').disabled=isGroup(doc.layers[li])||isReference(doc.layers[li]);$('group-mode-label').hidden=!isGroup(doc.layers[li]);$('group-mode').value=doc.layers[li].passThrough?'pass':'isolated';$('opacity').disabled=$('layer-blend').disabled=!!doc.layers[li].passThrough||isBackground(doc.layers[li]);$('layer-blend').value=doc.layers[li].blendMode||'normal';$('opacity').value=doc.layers[li].opacity;$('opacity-label').textContent=doc.layers[li].opacity+'%';
}
function syncCelFrames(){frameSelection=new Set(Array.from({length:celRange.toFrame-celRange.fromFrame+1},(_,i)=>celRange.fromFrame+i));}
function resetCelSelection(){celRange=$('timeline-mode').value==='cels'?celRectangle({frame:fi,layer:li}):null;celAnchor={frame:fi,layer:li};if(celRange)syncCelFrames();}
function adoptCelRange(range,active={frame:range.fromFrame,layer:range.toLayer}){celRange=range;celAnchor={frame:range.fromFrame,layer:range.toLayer};fi=active.frame;li=active.layer;syncCelFrames();frameAnchor=fi;}
function selectCelAt(frame,layer,extend=false,redraw=true){
  if(!extend)celAnchor={frame,layer};celRange=celRectangle(celAnchor,{frame,layer});fi=frame;li=layer;syncCelFrames();frameAnchor=celAnchor.frame;
  if(redraw)render(true);else{syncTimelineSelection();$('duration').value=doc.frames[fi].duration;renderLayers();draw();}
}
function beginCelSelection(event,frame,layer){
  if($('timeline-mode').value!=='cels'||event.button!==0||busy||gesture||shapeSession||celGesture||$('modal').open)return;
  event.preventDefault();stop();
  celGesture={pointerId:event.pointerId,range:celRange,anchor:celAnchor,fi,li,frames:frameSelection,frameAnchor};
  $('timeline-grid').focus({preventScroll:true});selectCelAt(frame,layer,event.shiftKey,false);$('timeline-grid').setPointerCapture(event.pointerId);
}
function finishCelSelection(cancel=false){
  if(!celGesture)return;const pending=celGesture;celGesture=null;
  if(cancel){celRange=pending.range;celAnchor=pending.anchor;fi=pending.fi;li=pending.li;frameSelection=pending.frames;frameAnchor=pending.frameAnchor;}
  if($('timeline-grid').hasPointerCapture(pending.pointerId))$('timeline-grid').releasePointerCapture(pending.pointerId);render();
}
function highlightTimeline(){
  uiAll('.frame-head').forEach((b,i)=>{b.classList.toggle('selected',frameSelection.has(i));b.setAttribute('aria-pressed',String(frameSelection.has(i)));b.classList.toggle('current',i===(playing?previewFrame:fi));});
}
// A tag counts as selected only when the frame selection is exactly its complete range.
function selectedTag(){
  const last=doc.frames.length-1;
  return doc.tags.find(tag=>{
    const to=Math.min(tag.to,last);
    if(to-tag.from+1!==frameSelection.size)return false;
    for(let frame=tag.from;frame<=to;frame++)if(!frameSelection.has(frame))return false;
    return true;
  })||null;
}
function syncTimelineSelection(){
  syncVisualControls();syncVisualTimeline($('timeline-mode').value);
  $('timeline-grid').dataset.mode=$('timeline-mode').value;
  const activeTag=selectedTag();
  highlightTimeline();uiAll('.timeline-tag-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tag===activeTag?.id));const selectionKey=documentId+':'+fi+':'+li+':'+[...frameSelection].join(',')+':'+JSON.stringify(celRange)+':'+$('timeline-mode').value;if(selectionKey!==timelineSelectionKey){timelineSelectionKey=selectionKey;uiAll('.cel').forEach(cell=>{const f=+cell.dataset.frame,l=+cell.dataset.layer;cell.classList.toggle('selected',celRange?containsCel(celRange,f,l):frameSelection.has(f)&&l===li);cell.classList.toggle('current-cel',f===fi&&l===li);cell.setAttribute('aria-pressed',String(cell.classList.contains('selected')));});}
  $('frame-actions').hidden=!!celRange;$('cel-actions').hidden=!celRange;
  $('frame-selection-info').textContent=celRange?`${celRange.toFrame-celRange.fromFrame+1} 帧 × ${celRange.toLayer-celRange.fromLayer+1} 层`:`已选 ${frameSelection.size} 帧`;$('duration-scope').textContent=frameSelection.size>1?'批量时长':'帧时长';
  $('edit-tag').disabled=!activeTag;$('delete-tag').disabled=!activeTag;
}
function timelineClick(index,event,layer=li){
  if(gesture||shapeSession||celGesture||busy||$('modal').open)return;
  stop();$('timeline-mode').value='frames';celRange=null;li=layer;frameSelection=selectTimelineFrames(frameSelection,frameAnchor,index,event);
  if(!event.shiftKey)frameAnchor=index;fi=frameSelection.has(index)?index:sortedFrames(frameSelection)[0];render();
}
function reorderSelected(target){
  const order=frameMoveOrder(doc.frames.length,frameSelection,target);if(order.every((source,i)=>source===i))return;
  const current=doc.frames[fi];mutate(()=>{frameSelection=new Set(moveFrames(doc,frameSelection,target));fi=doc.frames.indexOf(current);frameAnchor=fi;selection=null;},'已重排选中帧（全部图层）');
}
function celFilled(cel){if(!filledCache.has(cel))filledCache.set(cel,cel.some(p=>p&255));return filledCache.get(cel);}
function renderTimeline(){
  const key=documentId+JSON.stringify({layers:doc.layers,frames:doc.frames.map(f=>[f.duration,f.links]),tags:doc.tags,mode:$('timeline-mode').value});if(timelineDocument!==doc){timelineDirtyCells=null;timelineDocument=doc;}if(key===timelineDomKey){syncTimelineSelection();const cells=timelineDirtyCells?[...timelineDirtyCells].map(key=>{const [frame,layer]=key.split(':');return $('timeline-grid').querySelector(`.cel[data-frame="${frame}"][data-layer="${layer}"]`);}).filter(Boolean):$('timeline-grid').querySelectorAll('.cel');for(const cell of cells){const frame=doc.frames[+cell.dataset.frame],layer=+cell.dataset.layer;cell.querySelector('.dot').classList.toggle('filled',celFilled(frame.cels[layer]));}timelineDirtyCells=new Set();return;}timelineDomKey=key;timelineSelectionKey='';timelineDirtyCells=new Set();
  const grid=$('timeline-grid');grid.replaceChildren();const head=document.createElement('div');head.className='timeline-row';const label=document.createElement('div');label.className='timeline-label';label.textContent=`${doc.layers.length} 图层 · ${doc.frames.length} 帧`;head.append(label);
  const frameCount=doc.frames.length,tabLaneEnds=[],placedTags=[];
  [...doc.tags].sort((a,b)=>a.from-b.from||a.to-b.to).forEach(tag=>{
    const to=Math.min(tag.to,frameCount-1);
    let lane=0;while(lane<tabLaneEnds.length&&tabLaneEnds[lane].some(([from,end])=>tag.from<=end&&to>=from))lane++;
    if(lane===tabLaneEnds.length)tabLaneEnds.push([]);
    tabLaneEnds[lane].push([tag.from,to]);placedTags.push({tag,to,lane});
  });
  grid.style.setProperty('--tl-frames',frameCount);grid.style.setProperty('--tl-lanes',tabLaneEnds.length);
  doc.frames.forEach((frame,i)=>{
    const b=document.createElement('button');b.className='frame-head';b.dataset.frame=i;b.textContent=String(i+1).padStart(2,'0');b.title=frame.duration+' ms · Shift 范围 / Ctrl 多选 · 拖动重排';b.setAttribute('aria-label',`帧 ${i+1}`);b.draggable=true;b.onclick=e=>timelineClick(i,e);
    b.ondragstart=e=>{if(gesture||shapeSession||busy||$('modal').open){e.preventDefault();return;}stop();if(!frameSelection.has(i)){frameSelection=new Set([i]);fi=i;frameAnchor=i;syncTimelineSelection();draw();}timelineDrag=sortedFrames(frameSelection);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','像素工坊帧');};
    b.ondragover=e=>{if(!timelineDrag)return;e.preventDefault();e.dataTransfer.dropEffect='move';b.dataset.drop=e.clientX<b.getBoundingClientRect().left+b.offsetWidth/2?'before':'after';};
    b.ondragleave=()=>delete b.dataset.drop;
    b.ondrop=e=>{if(!timelineDrag)return;e.preventDefault();const after=e.clientX>=b.getBoundingClientRect().left+b.offsetWidth/2;frameSelection=new Set(timelineDrag);timelineDrag=null;delete b.dataset.drop;reorderSelected(i+(after?1:0));};
    b.ondragend=()=>{timelineDrag=null;uiAll('.frame-head[data-drop]').forEach(el=>delete el.dataset.drop);render();};head.append(b);
  });grid.append(head);
  const visibleRows=visibleLayerIndices(doc);visibleRows.forEach(index=>{const row=document.createElement('div');row.className='timeline-row';const label=document.createElement('div');label.className='timeline-label';label.textContent=doc.layers[index].name;row.append(label);doc.frames.forEach((frame,i)=>{const b=document.createElement('button');b.dataset.frame=i;b.dataset.layer=index;b.disabled=isGroup(doc.layers[index])||isReference(doc.layers[index]);b.className='cel'+(frameSelection.has(i)&&index===li?' selected':'');const dot=document.createElement('span');dot.className='dot'+(celFilled(frame.cels[index])?' filled':'');b.append(dot);b.title=`${doc.layers[index].name} · 帧 ${i+1}`;const count=linkedMembers(doc,i,index).length;if(count>1){b.classList.add('linked');b.title+=' · 共享图像 '+count+' 帧';}b.title+=' · cel 模式可拖动 / Shift 选择矩形';b.onpointerdown=e=>beginCelSelection(e,i,index);b.ondblclick=()=>void celPropertiesDialog();b.onclick=e=>{if($('timeline-mode').value==='cels'){stop();selectCelAt(i,index,e.shiftKey);}else timelineClick(i,e,index);};row.append(b);});grid.append(row);});
  grid.style.setProperty('--tl-rows',visibleRows.length+1);
  const outline=document.createElement('div');outline.className='timeline-frame-outline';outline.setAttribute('aria-hidden','true');grid.append(outline);
  if(placedTags.length){const strip=document.createElement('div');strip.className='timeline-tag-strip';
    for(const {tag,to,lane} of placedTags){
      const arrow=tag.direction==='reverse'?'←':tag.direction==='pingpong'?'↔':'→';
      const tab=document.createElement('button');tab.type='button';tab.className='timeline-tag-tab';tab.dataset.tag=tag.id;tab.style.setProperty('--tag-color',tag.color);tab.style.setProperty('--lane',lane);tab.style.setProperty('--from',tag.from);tab.style.setProperty('--span',to-tag.from+1);
      tab.title=`${tag.name} · 帧 ${tag.from+1}–${to+1} · ${arrow} · 单击切换范围 · 双击编辑`;tab.setAttribute('aria-label',tab.title);
      const arrowEl=document.createElement('span');arrowEl.className='timeline-tag-arrow';arrowEl.textContent=arrow;const nameEl=document.createElement('span');nameEl.className='timeline-tag-name';nameEl.textContent=tag.name;tab.append(arrowEl,nameEl);
      tab.onclick=e=>{e.stopPropagation();activateTag(tag.id,true);};tab.ondblclick=e=>{e.stopPropagation();tagEditor(tag.id);};tab.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();if(gesture||shapeSession||busy||$('modal').open)return;activateTag(tag.id,true);openTagMenu(tag,e.clientX,e.clientY,tab);};strip.append(tab);
    }
    grid.append(strip);
  }
  const range=$('play-range'),old=range.value;range.replaceChildren(new Option('全部帧','all'),new Option('选中帧','selected'),...doc.tags.map(tag=>new Option(tag.name,tag.id)));range.value=[...range.options].some(o=>o.value===old)?old:'all';
  syncTimelineSelection();
}

function render(preserveTimeline=false){if(!documentTabs.items.length){renderEmptyDocument();return;}normalizeIndices();colorAdjustments?.update(paletteTargetColor());$('doc-color-mode').dataset.mode=modeOf(doc)==='indexed'?'INDEXED 8':modeOf(doc)==='grayscale'?'GRAY 16':'RGBA';if(modeOf(doc)==='indexed'){colorIndex=Math.min(colorIndex,doc.palette.length-1);renderColors();}else if(modeOf(doc)==='grayscale'){color=normalizeColor('#'+grayPixel(colorValue(color)).toString(16).padStart(8,'0'));renderColors();}renderDocumentTabs();$('doc-name').textContent=doc.name+'.pix';$('doc-name').title=filePath||'尚未保存到文件';$('doc-meta').textContent=`${doc.width} × ${doc.height} px　/　${doc.frames.length}`;$('canvas-label').textContent=`${doc.name} · ${doc.width} × ${doc.height}`;$('duration').value=doc.frames[fi].duration;renderPalette();renderLayers();if(preserveTimeline)syncTimelineSelection();else renderTimeline();syncContextUI();place();draw();renderReferenceBoard();syncTilesetPanel();}
function normalizeIndices(){fi=Math.min(fi,doc.frames.length-1);li=Math.min(li,doc.layers.length-1);if(celRange){if(celRange.toFrame>=doc.frames.length||celRange.toLayer>=doc.layers.length||!containsCel(celRange,fi,li))resetCelSelection();else syncCelFrames();}frameSelection=new Set([...frameSelection].filter(i=>i<doc.frames.length));if(!frameSelection.has(fi))frameSelection=new Set([fi]);frameAnchor=Math.min(frameAnchor,doc.frames.length-1);}
function selectFrame(index){if(gesture||shapeSession)return;stop();fi=(index+doc.frames.length)%doc.frames.length;frameSelection=new Set([fi]);frameAnchor=fi;resetCelSelection();render();}
function activateTag(id,preserveTimeline=false){if(gesture||shapeSession||busy||$('modal').open)return;stop();$('timeline-mode').value='frames';celRange=null;const tag=doc.tags.find(tag=>tag.id===id);$('play-range').value=id;fi=tag.from;frameSelection=new Set(scopeFrames(doc,id,frameSelection));frameAnchor=fi;render(preserveTimeline);}
function setPlayRange(value){const range=$('play-range');range.value=value;range.dispatchEvent(new Event('change',{bubbles:true}));}
function openTagMenu(tag,x,y,anchor){openContextMenu(x,y,'标签操作',[['编辑标签',()=>tagEditor(tag.id)],['设置播放范围',()=>setPlayRange(tag.id)],['清除播放范围',()=>setPlayRange('all')],['删除标签',()=>dispatch('delete-tag')]],'context-menu',anchor);}
function play(){
  if(gesture)return;
  if(playing){fi=previewFrame;frameSelection=new Set([fi]);frameAnchor=fi;stop();render();return;}
  const scope=$('play-range').value,tag=doc.tags.find(tag=>tag.id===scope),direction=$('play-direction').value;
  playback=createPlayback(doc,scopeFrames(doc,scope,frameSelection),direction==='tag'?tag?.direction||'forward':direction,!$('play-once').checked,fi,performance.now());
  playing=true;selection=null;previewFrame=playback.frame;setButtonIcon($('play'),'pause','暂停');
  const tick=()=>{
    previewFrame=playback.advance(performance.now());
    if(playback.finished){fi=previewFrame;frameSelection=new Set([fi]);frameAnchor=fi;stop();render();message('单次播放结束');return;}
    draw();highlightTimeline();playTimer=setTimeout(tick,Math.max(1,playback.nextAt-performance.now()));
  };tick();
}

function point(event,clamp=true){const r=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-r.left)/zoom),y=Math.floor((event.clientY-r.top)/zoom);if(clamp&&tiledMode!=='none'&&(PAINTING_TOOLS.has(gesture?.kind||shapeSession?.kind||tool)||tool==='select')){const horizontal=tiledMode==='x'||tiledMode==='both',vertical=tiledMode==='y'||tiledMode==='both';return{x:Math.max(horizontal?-doc.width:0,Math.min(doc.width*(horizontal?2:1)-1,x)),y:Math.max(vertical?-doc.height:0,Math.min(doc.height*(vertical?2:1)-1,y))};}return clamp?{x:Math.max(0,Math.min(doc.width-1,x)),y:Math.max(0,Math.min(doc.height-1,y))}:{x,y};}
function rect(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x)+1,h:Math.abs(a.y-b.y)+1};}
function brushAt(x,y,c){const session=gesture||shapeSession,options=pressureOptions(session.options,['pencil','eraser'].includes(session.kind)?session.pointerType:'mouse',session.pressure,session.dynamics||penPreferences,session.footprints);stampBrush(doc,pixels(),x,y,c,options,selection,symmetryOptions());const radius=options.size||brush;if(options.tiledMode!=='none')invalidateFrame(fi);for(const p of symmetryPoints(x,y,doc.width,doc.height,symmetryOptions()))invalidateFrame(fi,{x:p.x-radius,y:p.y-radius,w:radius*2+1,h:radius*2+1});filledCache.delete(pixels());thumbCache.delete(pixels());timelineDirtyCells?.add(fi+':'+li);}
function blurAtPoint(x,y){blurAt(doc,pixels(),x,y,(gesture||shapeSession)?.options?.footprint||previewFootprint,selection,tiledMode);if(tiledMode!=='none')invalidateFrame(fi);invalidateFrame(fi,{x:x-brush-1,y:y-brush-1,w:brush*2+3,h:brush*2+3});filledCache.delete(pixels());thumbCache.delete(pixels());timelineDirtyCells?.add(fi+':'+li);}
const TEXT_KEY = 'pixel-studio-text';
const TEXT_DEFAULTS = {family: 'sans-serif', size: 16, bold: false, italic: false, antialias: true, ligatures: true, align: 'left', fill: true, stroke: false, strokeWidth: 1};
let textSession = null;
let textOptions = (() => {try{return {...TEXT_DEFAULTS, ...(JSON.parse(localStorage.getItem(TEXT_KEY) || 'null') || {})};}catch{return {...TEXT_DEFAULTS};}})();

function saveTextOptions() {
  localStorage.setItem(TEXT_KEY, JSON.stringify(textOptions));
}

function syncTextControls() {
  $('text-family').value = textOptions.family;
  $('text-size').value = textOptions.size;
  $('text-bold').checked = textOptions.bold;
  $('text-italic').checked = textOptions.italic;
  $('text-antialias').checked = textOptions.antialias;
  $('text-ligatures').checked = textOptions.ligatures;
  $('text-align').value = textOptions.align;
  $('text-fill').checked = textOptions.fill;
  $('text-stroke').checked = textOptions.stroke;
  $('text-stroke-width').value = textOptions.strokeWidth;
  $('text-stroke-width').disabled = !textOptions.stroke;
}

function readTextControls() {
  textOptions = {
    family: $('text-family').value.trim() || TEXT_DEFAULTS.family,
    size: Math.max(1, Math.min(512, Math.round(+$('text-size').value) || TEXT_DEFAULTS.size)),
    bold: $('text-bold').checked,
    italic: $('text-italic').checked,
    antialias: $('text-antialias').checked,
    ligatures: $('text-ligatures').checked,
    align: ['left', 'center', 'right'].includes($('text-align').value) ? $('text-align').value : 'left',
    fill: $('text-fill').checked,
    stroke: $('text-stroke').checked,
    strokeWidth: Math.max(1, Math.min(64, Math.round(+$('text-stroke-width').value) || 1))
  };
  if (!textOptions.fill && !textOptions.stroke) {
    textOptions.fill = true;
    $('text-fill').checked = true;
  }
  $('text-size').value = textOptions.size;
  $('text-stroke-width').value = textOptions.strokeWidth;
  $('text-stroke-width').disabled = !textOptions.stroke;
  saveTextOptions();
  if (textSession) {
    textSession.options = {...textOptions};
    positionTextEditor();
    drawOverlay();
  }
}

function textFont(options, scale = 1) {
  return `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}${Math.max(1, options.size * scale)}px ${options.family}`;
}

function textContext(options, scale = 1) {
  const context = document.createElement('canvas').getContext('2d');
  context.font = textFont(options, scale);
  return context;
}

// 按文档坐标排布文字：无文本框时只按换行符分行；有文本框时按宽度自动换行。
function layoutText(value, options, boxWidth) {
  const context = textContext(options), lineHeight = Math.ceil(options.size * 1.2), lines = [];
  let offset = 0;
  for (const paragraph of value.split('\n')) {
    if (!boxWidth) {
      lines.push({text: paragraph, start: offset, width: context.measureText(paragraph).width});
      offset += paragraph.length + 1;
      continue;
    }
    let consumed = 0, line = '', lineStart = 0;
    const flush = () => {
      lines.push({text: line, start: offset + lineStart, width: context.measureText(line).width});
      lineStart = consumed;
      line = '';
    };
    for (const token of paragraph.match(/\s+|[^\s]+/g) || []) {
      if (line && context.measureText(line + token).width > boxWidth) flush();
      if (context.measureText(token).width > boxWidth) {
        for (const character of token) {
          if (line && context.measureText(line + character).width > boxWidth) flush();
          line += character;
          consumed += 1;
        }
      } else {
        line += token;
        consumed += token.length;
      }
    }
    lines.push({text: line, start: offset + lineStart, width: context.measureText(line).width});
    offset += paragraph.length + 1;
  }
  return {lines, lineHeight};
}

function textLineOffset(line, session) {
  if (!session.box || session.options.align === 'left') return 0;
  return session.options.align === 'center' ? (session.box.w - line.width) / 2 : session.box.w - line.width;
}

function textCaret(session, layout) {
  const caret = Math.max(0, Math.min(session.value.length, session.caret ?? 0));
  let target = layout.lines[0], lineIndex = 0;
  for (const [index, line] of layout.lines.entries()) {
    if (caret >= line.start && caret <= line.start + line.text.length) {
      target = line;
      lineIndex = index;
    }
  }
  const prefix = target.text.slice(0, Math.max(0, Math.min(target.text.length, caret - target.start)));
  return {line: lineIndex, x: textLineOffset(target, session) + textContext(session.options).measureText(prefix).width};
}

function positionTextEditor() {
  const session = textSession, editor = session?.editor;
  if (!editor) return;
  const size = session.options.size, lineHeight = Math.ceil(size * 1.2);
  const box = session.box;
  Object.assign(editor.style, {
    left: (pan.x + session.anchor.x * zoom) + 'px',
    top: (pan.y + session.anchor.y * zoom) + 'px',
    width: (box ? box.w * zoom : Math.max(48, (doc.width - session.anchor.x) * zoom + zoom * 8)) + 'px',
    height: (box ? box.h * zoom : Math.max(48, (doc.height - session.anchor.y) * zoom + zoom * 8)) + 'px',
    fontSize: (size * zoom) + 'px',
    lineHeight: (lineHeight * zoom) + 'px',
    fontFamily: session.options.family,
    fontWeight: session.options.bold ? '700' : '400',
    fontStyle: session.options.italic ? 'italic' : 'normal',
    textAlign: session.options.align,
    whiteSpace: box ? 'pre-wrap' : 'pre'
  });
  editor.hidden = !!session.drag;
}

function textBoxFromDrag(drag, current) {
  const left = Math.max(0, Math.min(doc.width - 1, Math.min(drag.start.x, current.x)));
  const top = Math.max(0, Math.min(doc.height - 1, Math.min(drag.start.y, current.y)));
  const right = Math.max(0, Math.min(doc.width, Math.max(drag.start.x, current.x) + 1));
  const bottom = Math.max(0, Math.min(doc.height, Math.max(drag.start.y, current.y) + 1));
  return {x: left, y: top, w: right - left, h: bottom - top};
}

function drawTextOverlay() {
  const session = textSession;
  if (!session) return;
  const layout = layoutText(session.value, session.options, session.box?.w ?? null);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b97d23';
  octx.save();
  if (session.box) {
    octx.strokeStyle = accent;
    octx.lineWidth = 1;
    octx.setLineDash([4, 3]);
    octx.strokeRect(pan.x + session.box.x * zoom + .5, pan.y + session.box.y * zoom + .5, Math.max(0, session.box.w * zoom - 1), Math.max(0, session.box.h * zoom - 1));
  }
  octx.setLineDash([]);
  octx.font = textFont(session.options, zoom);
  octx.textBaseline = 'top';
  octx.fontKerning = session.options.ligatures ? 'auto' : 'none';
  octx.lineJoin = 'round';
  octx.lineWidth = session.options.strokeWidth * zoom;
  octx.fillStyle = color;
  octx.strokeStyle = background;
  for (const [index, line] of layout.lines.entries()) {
    if (!line.text) continue;
    const x = pan.x + (session.anchor.x + textLineOffset(line, session)) * zoom;
    const y = pan.y + (session.anchor.y + index * layout.lineHeight) * zoom;
    if (session.options.stroke) octx.strokeText(line.text, x, y);
    if (session.options.fill) octx.fillText(line.text, x, y);
  }
  if (!session.drag) {
    const caret = textCaret(session, layout);
    octx.fillStyle = accent;
    octx.fillRect(pan.x + (session.anchor.x + caret.x) * zoom, pan.y + (session.anchor.y + caret.line * layout.lineHeight) * zoom, Math.max(1, zoom / 4), Math.max(2, layout.lineHeight * zoom));
  }
  octx.restore();
}

function startTextSession(start) {
  const editor = document.createElement('textarea');
  editor.className = 'text-editor';
  editor.spellcheck = false;
  editor.maxLength = 2000;
  editor.setAttribute('aria-label', '文字编辑器');
  viewport.append(editor);
  textSession = {anchor: {...start}, box: null, value: '', caret: 0, options: {...textOptions}, editor, drag: null};
  editor.addEventListener('input', () => {
    if (!textSession || textSession.editor !== editor) return;
    textSession.value = editor.value;
    textSession.caret = editor.selectionStart;
    drawOverlay();
  });
  editor.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTextSession();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commitTextSession();
    }
  });
  for (const type of ['keyup', 'click', 'select']) editor.addEventListener(type, () => {
    if (!textSession || textSession.editor !== editor) return;
    textSession.caret = editor.selectionStart;
    drawOverlay();
  });
  positionTextEditor();
  drawOverlay();
}

function finishTextDrag() {
  const session = textSession;
  if (!session?.drag) return;
  session.drag = null;
  session.editor.hidden = false;
  positionTextEditor();
  session.editor.focus({preventScroll: true});
  drawOverlay();
}

function rasterizeText(session, layout) {
  const mask = document.createElement('canvas'), output = document.createElement('canvas');
  mask.width = output.width = doc.width;
  mask.height = output.height = doc.height;
  const context = mask.getContext('2d', {willReadFrequently: true}), result = output.getContext('2d', {willReadFrequently: true});
  context.font = textFont(session.options);
  context.textBaseline = 'top';
  context.fontKerning = session.options.ligatures ? 'auto' : 'none';
  context.lineJoin = 'round';
  context.lineWidth = session.options.strokeWidth;
  context.fillStyle = color;
  context.strokeStyle = background;
  for (const [index, line] of layout.lines.entries()) {
    if (!line.text) continue;
    const x = session.anchor.x + textLineOffset(line, session), y = session.anchor.y + index * layout.lineHeight;
    if (session.options.stroke) context.strokeText(line.text, x, y);
    if (session.options.fill) context.fillText(line.text, x, y);
  }
  if (!session.options.antialias) {
    const image = context.getImageData(0, 0, doc.width, doc.height);
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= 128 ? 255 : 0;
    context.putImageData(image, 0, 0);
  }
  const base = new Uint8ClampedArray(pixels().length * 4);
  for (let i = 0, p = 0; i < pixels().length; i++, p += 4) {
    const value = pixels()[i];
    base[p] = value >>> 24;
    base[p + 1] = value >>> 16 & 255;
    base[p + 2] = value >>> 8 & 255;
    base[p + 3] = value & 255;
  }
  result.drawImage(imageCanvas(base), 0, 0);
  result.drawImage(mask, 0, 0);
  const image = result.getImageData(0, 0, doc.width, doc.height), ink = context.getImageData(0, 0, doc.width, doc.height).data;
  for (let i = 0, p = 0; i < pixels().length; i++, p += 4) {
    if (ink[p + 3] && selectionContains(selection, i % doc.width, Math.floor(i / doc.width))) {
      const value = ((image.data[p] << 24) | (image.data[p + 1] << 16) | (image.data[p + 2] << 8) | image.data[p + 3]) >>> 0;
      pixels()[i] = modeOf(doc) === 'grayscale' ? grayPixel(value) : value;
    }
  }
  invalidateFrame(fi);
  filledCache.delete(pixels());
  thumbCache.delete(pixels());
}

function commitTextSession() {
  const session = textSession;
  if (!session) return;
  textSession = null;
  session.editor.remove();
  const value = session.value.replace(/\r?\n/g, '\n');
  if (value.trim()) {
    if (!editable()) {
      drawOverlay();
      return;
    }
    const layout = layoutText(value, session.options, session.box?.w ?? null);
    mutate(() => rasterizeText(session, layout), '已添加文字');
  }
  drawOverlay();
  message(value.trim() ? '已添加文字' : '已取消文字');
}

function cancelTextSession() {
  const session = textSession;
  if (!session) return;
  textSession = null;
  session.editor.remove();
  drawOverlay();
  message('已取消文字');
}

function restoreStroke(g){let left=doc.width,top=doc.height,right=-1,bottom=-1;for(const i of g.options.touched){pixels()[i]=g.base[i];if(g.baseIndices)celIndexPixels(doc,fi,li)[i]=g.baseIndices[i];const x=i%doc.width,y=Math.floor(i/doc.width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}if(right>=left)invalidateFrame(fi,{x:left,y:top,w:right-left+1,h:bottom-top+1});g.options.touched.clear();}
function strokeLine(g,end){line(g.last.x,g.last.y,end.x,end.y,(x,y)=>{if(g.options.pixelPerfect&&g.options.size===1){appendPixelPerfect(g.points,{x,y});}else brushAt(x,y,g.color);});if(g.options.pixelPerfect&&g.options.size===1){restoreStroke(g);for(const p of g.points)brushAt(p.x,p.y,g.color);}g.last=end;}
function renderShapeSession(point){
  const session=shapeSession;
  if(session.kind==='select'){selection=combineSelection(doc,session.oldSelection,shapeSelection(doc,'polygon',[...session.vertices,point]),session.operation);session.hover=point;drawOverlay();return;}
  restoreStroke(session);
  if(session.kind==='curve')rasterCurve(session.start,session.end,point,(x,y)=>brushAt(x,y,session.color));
  else rasterPolygon([...session.vertices,point],session.options.filled,(x,y)=>brushAt(x,y,session.color));
  session.hover=point;draw();
}
function commitShapeSession(){
  if(!shapeSession)return;
  if(shapeSession.kind==='select'){
    if(shapeSession.vertices.length<3)return message('多边形选区至少需要三个顶点');
    const session=shapeSession;selection=combineSelection(doc,session.oldSelection,shapeSelection(doc,'polygon',session.vertices),session.operation);previousSelection=session.oldSelection;shapeSession=null;render();message('已完成多边形选区');return;
  }
  if(shapeSession.kind==='polygon'&&shapeSession.vertices.length<3)return message('多边形至少需要三个顶点');
  const session=shapeSession;
  if(session.kind==='polygon'){restoreStroke(session);rasterPolygon(session.vertices,session.options.filled,(x,y)=>brushAt(x,y,session.color));}
  shapeSession=null;history.push(session.before,doc);changed();render();message('已完成'+tools.find(t=>t[0]===session.kind)[2]);
}
function cancelShapeSession(){if(!shapeSession)return;if(shapeSession.kind==='select')selection=shapeSession.oldSelection;else doc=shapeSession.before;shapeSession=null;render();message('已取消未完成的形状');}
viewport.addEventListener('pointerdown',event=>{
  if(textSession?.editor===event.target)return;
  if(onionSession){event.preventDefault();return;}
  if(transformSession){
    event.preventDefault();if(event.button!==0||transformSession.drag)return;
    const p=transformEventPoint(event),handle=hitTransform(transformSession.state,p,zoom);if(!handle)return;
    viewport.focus({preventScroll:true});transformSession.drag={handle,start:p,state:{...transformSession.state},pointerId:event.pointerId};viewport.setPointerCapture(event.pointerId);syncInteraction();return;
  }
  if(busy||gesture||![0,1,2,...(event.pointerType==='pen'?[5]:[])].includes(event.button)||event.button===1&&!inputPreferences.middlePan)return;
  viewport.focus({preventScroll:true});rememberPointer(event);const mode=currentMode(event.button),raw=point(event,false);event.preventDefault();
  // 有选区时右键专用于选区菜单；不改变选区，也不进入擦除/背景色/平移。
  if(event.button===2&&selection&&!shapeSession&&brushSettings.ink!=='shading')return;
  if(mode.tool==='hand'){if(space)spacePanned=true;gesture={kind:'pan',client:{x:event.clientX,y:event.clientY},pan:{...pan},pointerId:event.pointerId};viewport.setPointerCapture(event.pointerId);syncInteraction();return;}
  if(mode.tool==='zoom'){const r=viewport.getBoundingClientRect();gesture={kind:'zoom',pointerId:event.pointerId,client:{x:event.clientX,y:event.clientY},anchor:{x:event.clientX-r.left,y:event.clientY-r.top},startZoom:zoom,startPan:{...pan},direction:event.altKey||event.button===2?-1:1,moved:false};viewport.setPointerCapture(event.pointerId);syncInteraction();return;}
  if(mode.tool==='slice'){if(!mode.blocked)beginSlicePointer(event);return;}
  if(!(PAINTING_TOOLS.has(mode.tool)||['select','eyedropper'].includes(mode.tool)?insideTiledCanvas(doc,raw,tiledMode):raw.x>=0&&raw.y>=0&&raw.x<doc.width&&raw.y<doc.height))return;
  if(mode.blocked){editable();syncInteraction();return;}
  const p=point(event),active=mode.tool;
  if(shapeSession){
    if(event.button===2){cancelShapeSession();return;}
    if(shapeSession.kind==='curve'){renderShapeSession(p);commitShapeSession();}
    else{const last=shapeSession.vertices.at(-1);if(last.x!==p.x||last.y!==p.y)shapeSession.vertices.push(p);renderShapeSession(p);}
    return;
  }
  if(active==='eyedropper'){Object.assign(p,tiledPoint(doc,raw.x,raw.y,tiledMode));const c=composite(doc,fi),i=(p.y*doc.width+p.x)*4;if(c[i+3])setColor(fromRgba({r:c[i],g:c[i+1],b:c[i+2],a:c[i+3]}));return;}
  if(active==='text'){
    if(modeOf(doc)==='indexed')return message('索引颜色模式下不能使用文字工具');
    if(event.button!==0)return;
    if(!editable())return;
    if(textSession)commitTextSession();
    startTextSession(p);
    textSession.drag={start:{...p},pointerId:event.pointerId};
    if(event.isTrusted)viewport.setPointerCapture(event.pointerId);
    return;
  }
  if(active==='select'){
    previousSelection=selection;
    const kind=activeSelectionKind(),operation=selectionOperationFor(keymap.profile,event,$('selection-operation').value);
    if(kind==='wand'){selection=combineSelection(doc,selection,wandSelection(doc,pixels(),p.x,p.y,+$('wand-tolerance').value),operation);drawOverlay();return;}
    gesture={kind:'select',selectionKind:kind,operation,start:p,points:[p],oldSelection:selection};
    if(kind==='polygon'){shapeSession={...gesture,vertices:[p]};gesture=null;renderShapeSession(p);message('逐点点击建立多边形选区，Enter / 双击确认');return;}
    selection=combineSelection(doc,gesture.oldSelection,kind==='grid'?gridSelection(doc,gridSettings,p,p):shapeSelection(doc,kind,[p,p]),operation);
  }
  else{
    if(!editable())return;if(brushSettings.ink==='shading'&&PAINTING_TOOLS.has(active)&&active!=='eraser'&&paletteSelection.size<2)return message('请在色板中拖选至少两种明暗颜色');if(active==='blur'&&modeOf(doc)==='indexed')return message('索引颜色模式下不能使用模糊工具');const before=snapshotCel(doc,fi,li);let c=active==='eraser'||event.button===2&&rightButtonMode==='erase'?0:colorValue(event.button===2?background:color);
    gesture={pointerType:event.pointerType,pressure:event.pressure,dynamics:clone(penPreferences),footprints:new Map(),kind:active,start:p,last:p,before,color:c,base:[...pixels()],baseIndices:celIndexPixels(doc,fi,li)?.slice(),oldSelection:selection?{...selection}:null,erasing:active==='eraser'||event.button===2&&rightButtonMode==='erase',points:[p]};
    gesture.options={...clone(brushSettings),tiledMode,size:brush,opacity:brushSettings.opacity/100,base:gesture.base,erasing:gesture.erasing,touched:new Set(),footprint:previewFootprint,patternAnchor:brushSettings.shape==='pattern'&&brushSettings.pattern?(brushSettings.patternMode==='source'?(brushSettings.pattern.origin?{...brushSettings.pattern.origin}:{x:0,y:0}):{x:p.x,y:p.y}):null};if(isBackground(doc.layers[li])){gesture.options.ink='over';gesture.options.erasing=false;if(gesture.erasing)c=gesture.color=doc.layers[li].clearColor;}if(modeOf(doc)==='indexed'){const map=createMapper(doc,doc.layers[li]),preferred=gesture.erasing?(isBackground(doc.layers[li])?doc.layers[li].clearIndex:doc.transparentIndex):event.button===2?map(colorValue(background)).index:colorIndex;if(!gesture.erasing){c=gesture.color=indexColor(doc,preferred,doc.layers[li]);if(!isBackground(doc.layers[li])&&(gesture.options.ink==='over'||preferred===doc.transparentIndex))gesture.options.ink='copy';}const session=gesture;gesture.options.quantize=(value,i,source)=>{const result=map(value,i%doc.width,Math.floor(i/doc.width),source===session.color?preferred:-1);celIndexPixels(doc,fi,li)[i]=result.index;return result.color;};}else if(modeOf(doc)==='grayscale')gesture.options.quantize=value=>grayPixel(value);if(event.pointerType==='pen'&&penPreferences.mode!=='none'){gesture.options.pixelPerfect=false;gesture.options.coverageMap=new Float32Array(pixels().length);}
    if(brushSettings.ink==='shading'&&active!=='eraser'&&active!=='blur'){
     gesture.erasing=gesture.options.erasing=false;gesture.options.ink='shading';const shade=createShading(doc.palette,[...paletteSelection],event.button===2?1:-1),indices=gesture.baseIndices;gesture.options.shade=(pixel,i)=>{const next=shade(pixel,indices?.[i]);if(indices)celIndexPixels(doc,fi,li)[i]=next.index;return modeOf(doc)==='grayscale'?grayPixel(next.color):next.color;};
    }
    if(active==='gradient'){gesture.options.erasing=false;gesture.gradientColors=[colorValue(event.button===2?background:color),colorValue(event.button===2?color:background)];}
    if(gesture.options.stabilizer&&['pencil','eraser','contour','blur'].includes(active))gesture.stabilizer=createStabilizer(p,gesture.options.stabilizerDistance??16);
    if(active==='polygon'){shapeSession={...gesture,vertices:[p],hover:p};gesture=null;renderShapeSession(p);message('逐点点击添加顶点，双击或 Enter 确认，Esc 取消');return;}
    if(active==='curve'){gesture.end=p;rasterCurve(p,p,p,(x,y)=>brushAt(x,y,c));}
    else if(active==='contour')brushAt(p.x,p.y,c);
    else if(active==='move'){gesture.region=copyRegion(doc,pixels(),selection);}
    else if(active==='fill'){invalidateFrame(fi);filledCache.delete(pixels());thumbCache.delete(pixels());for(const q of symmetryPoints(p.x,p.y,doc.width,doc.height,symmetryOptions()))paintFill(doc,pixels(),q.x,q.y,c,(gesture||shapeSession).options,selection);}
    else if(active==='gradient'){}
    else if(active==='blur')blurAtPoint(p.x,p.y);
    else if(active==='pencil'||active==='eraser'){
      const previous=lastStrokePoint;
      if(event.shiftKey&&previous?.documentId===documentId&&previous.frame===fi&&previous.layer===li&&previous.tool===active){gesture.last=previous.point;gesture.points=[previous.point];strokeLine(gesture,p);}
      else brushAt(p.x,p.y,c);
    }
    else rasterShape(active,p,p,brushSettings.filled,(x,y)=>brushAt(x,y,c));
  }
  gesture.pointerId=event.pointerId;viewport.setPointerCapture(event.pointerId);draw();
});
viewport.addEventListener('pointermove',event=>{
  if(textSession?.drag){
    if(textSession.drag.pointerId!==event.pointerId)return;
    const box=textBoxFromDrag(textSession.drag,point(event));
    textSession.box=box.w>=2&&box.h>=2?box:null;
    textSession.anchor=textSession.box?{x:box.x,y:box.y}:{...textSession.drag.start};
    drawOverlay();
    return;
  }
  if(onionSession)return;
  if(transformSession){
    const session=transformSession,p=transformEventPoint(event),drag=session.drag;
    if(drag&&drag.pointerId===event.pointerId){session.state=dragTransform(drag.state,drag.handle,drag.start,p,event.shiftKey);session.sync();session.preview();}
    else{session.hover=hitTransform(session.state,p,zoom);syncInteraction();}return;
  }
  rememberPointer(event);const p=gesture?constrainCanvasPoint(gesture.kind,gesture.start||point(event),point(event),event.shiftKey&&!(gesture.kind==='select'&&(gesture.selectionKind==='lasso'||gesture.selectionKind==='grid'||keymap.profile==='aseprite')),doc.width,doc.height):point(event);$('coordinates').textContent=`X ${p.x}　Y ${p.y}`;if(shapeSession&&!gesture){renderShapeSession(p);return;}if(!gesture){if(modifiers.shift)drawOverlay();else syncInteraction();return;}if(gesture.pointerId!==event.pointerId)return;
  const g=gesture;
  if(g.kind==='slice'){const index=doc.slices.findIndex(s=>s.id===g.sliceId),bounds=g.handle==='create'?rect(g.start,p):dragSliceBounds(g.original.bounds,g.handle,g.rawStart,transformEventPoint(event),doc.width,doc.height);doc.slices[index]=setSliceKey(doc.slices[index],fi,g.handle==='move'?{...g.original,bounds}:resizedSliceGeometry(g.original,bounds));doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'slice-keyframes'])];drawOverlay();return;}
  if(g.kind==='symmetry'){const r=viewport.getBoundingClientRect(),axes=doc.symmetryAxes||{x:doc.width/2,y:doc.height/2},value=g.axis==='x'?(event.clientX-r.left-pan.x)/zoom:(event.clientY-r.top-pan.y)/zoom;doc.symmetryAxes={...axes,[g.axis]:Math.max(0,Math.min(g.axis==='x'?doc.width:doc.height,Math.round(value*2)/2))};drawOverlay();return;}
  if(g.kind==='pan'){pan={x:g.pan.x+event.clientX-g.client.x,y:g.pan.y+event.clientY-g.client.y};place();drawOverlay();return;}
  if(g.kind==='zoom'){const distance=(event.clientX-g.client.x)-(event.clientY-g.client.y);if(Math.abs(distance)<3)return;g.moved=true;zoom=g.startZoom;pan={...g.startPan};scale(Math.exp(g.direction*distance/180),g.anchor);return;}
  if(g.kind==='select'){const last=g.points.at(-1);if(last.x!==p.x||last.y!==p.y)g.points.push(p);const shape=g.selectionKind==='grid'?gridSelection(doc,gridSettings,g.start,p):shapeSelection(doc,g.selectionKind,g.selectionKind==='lasso'?g.points:[g.start,p]);selection=combineSelection(doc,g.oldSelection,shape,g.operation);drawOverlay();return;}
  if(g.kind==='pencil'||g.kind==='eraser'){const samples=event.getCoalescedEvents?.()||[];for(const sample of samples.length?samples:[event]){g.pressure=sample.pressure;const next=g.stabilizer?g.stabilizer.move(point(sample)):point(sample);if(next)strokeLine(g,next);}}
  else if(g.kind==='gradient'){restoreStroke(g);paintGradient(doc,pixels(),g.start,p,...g.gradientColors,g.options,selection);invalidateFrame(fi);filledCache.delete(pixels());thumbCache.delete(pixels());}
  else if(g.kind==='blur'){const next=g.stabilizer?g.stabilizer.move(p):p;if(next){line(g.last.x,g.last.y,next.x,next.y,(x,y)=>blurAtPoint(x,y));g.last=next;}}
  else if(g.kind==='curve'){g.end=p;restoreStroke(g);rasterCurve(g.start,p,{x:(g.start.x+p.x)/2,y:(g.start.y+p.y)/2},(x,y)=>brushAt(x,y,g.color));}
  else if(g.kind==='contour'){const next=g.stabilizer?g.stabilizer.move(p):p;if(next){line(g.last.x,g.last.y,next.x,next.y,(x,y)=>g.points.push({x,y}));g.last=next;}restoreStroke(g);rasterPolygon(g.points,g.options.filled,(x,y)=>brushAt(x,y,g.color));}
  else if(['line','rect','ellipse'].includes(g.kind)){restoreStroke(g);rasterShape(g.kind,g.start,p,g.options.filled,(x,y)=>brushAt(x,y,g.color));}
  else if(g.kind==='move'){doc.frames[fi].cels[li]=g.before.frames[fi].cels[li].slice();doc.frames[fi].celProperties=structuredClone(g.before.frames[fi].celProperties);if(g.baseIndices)doc.frames[fi].indices[li]=g.before.frames[fi].indices[li].slice();const dx=p.x-g.start.x,dy=p.y-g.start.y;clearRegion(doc,pixels(),g.oldSelection);pasteRegion(doc,pixels(),g.region,g.region.x+dx,g.region.y+dy,null,true);if(g.oldSelection)selection=translateSelection(doc,g.oldSelection,dx,dy);}
  draw();
});
function finishGesture(cancel=false){if(!gesture)return;const g=gesture;gesture=null;if(cancel){if(g.before)doc=g.before;if(g.kind==='pan')pan=g.pan;else if(g.kind==='zoom'){zoom=g.startZoom;pan=g.startPan;}else selection=g.oldSelection;}else if(g.kind==='zoom'&&!g.moved)scale(g.direction<0?.8:1.25,g.anchor);else if(g.before&&history.push(g.before,doc)){if(g.kind==='pencil'||g.kind==='eraser')lastStrokePoint={documentId,frame:fi,layer:li,tool:g.kind,point:g.last};changed();message('已绘制 · '+(tools.find(t=>t[0]===g.kind)?.[2]??(g.kind==='symmetry'?'对称轴':g.kind==='slice'?'切片':g.kind)));}if(g.pointerId!==undefined&&viewport.hasPointerCapture(g.pointerId))viewport.releasePointerCapture(g.pointerId);if(pendingTool){const value=pendingTool;pendingTool=null;setTool(value);}render();}
viewport.addEventListener('pointerup',e=>{
  if(transformSession){if(transformSession.drag?.pointerId===e.pointerId)finishTransformDrag();return;}
  if(textSession?.drag){if(textSession.drag.pointerId===e.pointerId)finishTextDrag();return;}
  rememberPointer(e);
  if(gesture?.pointerId===e.pointerId){
    if(gesture.kind==='curve'){
      const session=gesture;gesture=null;shapeSession=session;
      if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
      renderShapeSession({x:(session.start.x+session.end.x)/2,y:(session.start.y+session.end.y)/2});message('移动鼠标调整曲线，点击或 Enter 确认，Esc 取消');
    }else finishGesture();
  }
  syncInteraction();
});
viewport.addEventListener('dblclick',()=>{if(tool==='slice'&&activeSliceId){void sliceDialog();return;}if(['polygon','select'].includes(shapeSession?.kind))commitShapeSession();});
function interruptPointer(reason,includeShape=false){const active=!!(gesture||transformSession?.drag||(includeShape&&shapeSession));finishTransformDrag(true);finishGesture(true);if(includeShape)cancelShapeSession();if(active)message(reason+'：本次拖动或未完成形状已取消，已恢复原状态');syncInteraction();}
viewport.addEventListener('pointercancel',()=>{if(textSession?.drag){cancelTextSession();return;}interruptPointer('指针操作中断',true);});
document.addEventListener('pointerdown',event=>{if(!textSession)return;const target=event.target;if(target===textSession.editor||target.closest?.('#text-options')||target.closest?.('#viewport'))return;commitTextSession();},true);viewport.addEventListener('lostpointercapture',()=>interruptPointer('鼠标捕获丢失'));viewport.addEventListener('contextmenu',e=>{e.preventDefault();if(brushSettings.ink==='shading'||busy||playing||gesture||shapeSession||$('modal').open)return;openSelectionMenuAt(e);});
viewport.addEventListener('pointerenter',e=>{rememberPointer(e);drawOverlay();});viewport.addEventListener('pointerleave',()=>{if(pointer)pointer.inside=false;updateBrushPreview();drawOverlay();});
viewport.addEventListener('wheel',e=>{e.preventDefault();if(gesture||shapeSession||busy||transformSession?.drag||$('modal').open&&!transformSession&&!onionSession)return;rememberPointer(e);const intent=wheelIntent(e,inputPreferences);if(!intent.delta)return;const r=viewport.getBoundingClientRect();if(intent.action==='zoom')scale(intent.delta<0?inputPreferences.zoomStep:1/inputPreferences.zoomStep,{x:e.clientX-r.left,y:e.clientY-r.top});else if(intent.action==='pan'){pan[intent.horizontal?'x':'y']-=intent.delta*inputPreferences.panSpeed;place();drawOverlay();}else if(!$('modal').open&&intent.action==='frames')dispatch(intent.delta<0?'previous':'next');else if(!$('modal').open&&intent.action==='brush')setBrush(brush+(intent.delta<0?1:-1));syncInteraction();},{passive:false});

function adjustImageDialog(type){const original=doc;return imageAdjustmentDialog(type,{source:clone(doc),foreground:color,frame:fi,layer:li,selection,modal,$,preview:next=>{doc=next;render();},restore:()=>{doc=original;render();},commit:next=>mutate(()=>{doc=next;},type==='outline'?'已应用图像描边':'已应用图像颜色调整',{colorsReady:true})});}
function selectionEditDialog(kind){return editSelectionDialog(kind,{doc,pixels:pixels(),foreground:color,modal,$,getSelection:()=>selection,setSelection:value=>{selection=value;drawOverlay();},rememberSelection:value=>{previousSelection=value;}});}
function modal(title,html,setup=null,validate=null,options={}){
  if($('modal').open)return Promise.resolve(null);$('modal-submit').disabled=false;window.focus();resetModifiers();stop();$('modal-title').textContent=title;$('modal-content').innerHTML=html+'<p class="error" id="modal-error" role="alert"></p>';const form=$('modal-form');setup?.(form);normalizeInlineControls($('modal-content'));uiAll('#modal-content input[type=checkbox]').forEach(input=>input.setAttribute('role','switch'));
  setButtonIcon($('modal-submit'),'check',options.confirm||'确定');
  let discard;
  if(options.discard){discard=document.createElement('button');discard.type='button';discard.textContent='不保存';discard.onclick=()=>$('modal').close('discard');$('modal-submit').before(discard);}
  $('modal').returnValue='';
  return new Promise(resolve=>{const submit=event=>{if(event.submitter?.value==='cancel')return;const values=Object.fromEntries(new FormData(form));try{validate?.(values);}catch(error){event.preventDefault();$('modal-error').textContent=error.message;}};form.addEventListener('submit',submit);$('modal').addEventListener('close',()=>{form.removeEventListener('submit',submit);discard?.remove();resolve($('modal').returnValue==='discard'?{discard:true}:$('modal').returnValue==='ok'?Object.fromEntries(new FormData(form)):null);},{once:true});if(options.modeless)$('modal').show();else $('modal').showModal();syncInteraction();});
}
async function confirmDiscard(closing=false){
  if(!dirty)return true;
  const answer=await modal('保存当前项目？',`<p>当前项目有未保存的更改。可以保存后${closing?'关闭':'继续'}、不保存，或取消操作。</p>`,null,null,{confirm:closing?'保存后关闭':'保存后继续',discard:true});
  if(!answer)return false;
  if(answer.discard){if(filePath)await window.desktop?.discardRecovery(filePath);setDirty(false);return true;}
  return await saveProject();
}
function captureDocumentState(){return{documentId,doc,fi,li,selection,previousSelection,zoom,pan:{...pan},dirty,saved,boardRevision,savedBoardRevision,filePath,historyState:history.capture(),paletteUI:capturePaletteUI(),frameSelection:new Set(frameSelection),frameAnchor,celRange,celAnchor:{...celAnchor},view:{viewport:{w:viewport.clientWidth,h:viewport.clientHeight},grid:$('grid').checked,onion:$('onion').checked,range:$('play-range').value,direction:$('play-direction').value,once:$('play-once').checked,timeline:$('timeline-mode').value}};}
let documentOverflowObserver,lastDocumentTabActive;
function renderDocumentTabs(){
 documentTabs.save(captureDocumentState());renderWelcome();const host=$('document-tabs');let overflow=host.querySelector('.document-overflow'),menu=host.querySelector('.document-overflow-menu');
 if(!overflow){overflow=document.createElement('button');overflow.type='button';overflow.className='document-overflow';overflow.title='更多文档标签';overflow.setAttribute('aria-label',overflow.title);overflow.innerHTML=iconMarkup('chevron');menu=document.createElement('div');menu.className='document-overflow-menu';menu.popover='auto';menu.setAttribute('role','menu');menu.addEventListener('dragover',handleDocumentDragOver);menu.addEventListener('drop',handleDocumentDrop);overflow.onclick=()=>menu.matches(':popover-open')?menu.hidePopover():menu.showPopover();menu.addEventListener('beforetoggle',event=>{if(event.newState==='open'){const r=overflow.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-menu.offsetHeight-8))+'px';}});}
 const existing=new Map([...host.querySelectorAll('.document-tab')].map(tab=>[tab.dataset.documentId,tab])),tabs=documentTabs.items.map(item=>{
  let tab=existing.get(item.id);if(!tab){tab=document.createElement('div');tab.dataset.documentId=item.id;const button=document.createElement('button'),close=document.createElement('button');button.setAttribute('role','tab');button.draggable=true;button.ondragstart=event=>startDocumentDrag(event,tab.dataset.documentId);button.ondragend=event=>finishDocumentDrag(event,tab.dataset.documentId);button.onclick=()=>switchDocument(tab.dataset.documentId);setButtonIcon(close,'tab-close');close.setAttribute('aria-label','关闭文档');close.title='关闭文档';close.onclick=()=>void closeDocumentTab(tab.dataset.documentId);tab.append(button,close);}
  const button=tab.querySelector('[role=tab]');tab.className='document-tab'+(item.id===documentId?' active':'');button.textContent=item.state.doc.name+(item.state.dirty?' ●':'');button.title=item.state.filePath||'未保存';button.setAttribute('aria-selected',String(item.id===documentId));return tab;
 });
 const structureChanged=host.querySelectorAll('.document-tab').length!==tabs.length||tabs.some((tab,index)=>host.children[index]!==tab),activeWasHidden=existing.get(documentId)?.hidden??false;if(structureChanged){host.replaceChildren(...tabs,overflow,menu);overflow.hidden=true;menu.replaceChildren();}
 const fit=()=>{for(const tab of tabs)tab.hidden=false;overflow.hidden=false;const available=host.clientWidth;let used=0;for(const tab of tabs)used+=tab.offsetWidth;if(used<=available){overflow.hidden=true;return;}const reserve=overflow.offsetWidth;let remaining=available-reserve,visible=new Set();for(const tab of tabs){if(remaining>=tab.offsetWidth){visible.add(tab);remaining-=tab.offsetWidth;}}const active=tabs.find(tab=>tab.dataset.documentId===documentId);if(active&&!visible.has(active)){const width=active.offsetWidth;while(remaining<width&&visible.size){const last=[...visible].at(-1);visible.delete(last);remaining+=last.offsetWidth;}if(remaining>=width)visible.add(active);}for(const tab of tabs)tab.hidden=!visible.has(tab);const hidden=tabs.filter(tab=>tab.hidden);overflow.hidden=!hidden.length;menu.replaceChildren(...hidden.map(tab=>{const item=document.createElement('button');item.type='button';item.dataset.documentId=tab.dataset.documentId;item.draggable=true;item.setAttribute('role','menuitem');item.textContent=tab.querySelector('[role=tab]').textContent;item.ondragstart=event=>startDocumentDrag(event,item.dataset.documentId);item.ondragend=event=>finishDocumentDrag(event,item.dataset.documentId);item.onclick=()=>{menu.hidePopover();switchDocument(item.dataset.documentId);};return item;}));};
 const needsFit=structureChanged||documentId!==lastDocumentTabActive&&activeWasHidden||!lastDocumentTabActive;lastDocumentTabActive=documentId;if(needsFit)requestAnimationFrame(fit);else menu.replaceChildren(...tabs.filter(tab=>tab.hidden).map(tab=>{const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent=tab.querySelector('[role=tab]').textContent;item.onclick=()=>{menu.hidePopover();switchDocument(tab.dataset.documentId);};return item;}));documentOverflowObserver?.disconnect();documentOverflowObserver=new ResizeObserver(fit);documentOverflowObserver.observe(host);
}
let welcomeEntries=[],welcomeRecentKey='',welcomeRecentLoading=false,welcomeThumbs=new Map();
function thumbCanvas(thumb){
 const canvas=document.createElement('canvas');canvas.width=thumb.size;canvas.height=thumb.size;canvas.className='welcome-recent-thumb';
 const bytes=Uint8Array.from(atob(thumb.pixels),character=>character.charCodeAt(0));
 canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes.buffer),thumb.size,thumb.size),0,0);
 return canvas;
}
function recentThumb(thumb){const canvas=thumbCanvas(thumb);canvas.className='welcome-recent-thumb recent-thumb';return canvas;}
function loadRecentThumbs(){
 if(!window.desktop?.recentThumbs)return;
 window.desktop.recentThumbs().then(list=>{welcomeThumbs=new Map(list.map(item=>[item.path,item]));welcomeRecentKey='';if(!documentTabs.items.length)renderWelcomeRecent();},()=>{});
}
function renderWelcomeRecent(){
 const state=createWelcomeState(welcomeEntries),key=JSON.stringify(state.recent)+'|'+welcomeThumbs.size;
 if(key===welcomeRecentKey)return;
 welcomeRecentKey=key;
 const list=$('welcome-recent');
 if(state.recent.length){list.replaceChildren(...state.recent.map(entry=>{const row=document.createElement('div');row.className='welcome-recent-row';const button=document.createElement('button');button.type='button';button.className='welcome-recent-item';button.title=entry.path;const thumb=welcomeThumbs.get(entry.path);if(thumb)button.append(thumbCanvas(thumb));const label=document.createElement('span');label.textContent=entry.name;button.append(label);button.onclick=()=>void openWelcomeRecent(entry.path).catch(showError);const remove=document.createElement('button');remove.type='button';remove.className='welcome-recent-remove icon-button';remove.title='从最近文件移除';remove.setAttribute('aria-label','从最近文件移除');setButtonIcon(remove,'clear');remove.onclick=()=>void removeWelcomeRecent(entry.path).catch(showError);row.append(button,remove);return row;}));return;}
 const empty=document.createElement('p');empty.className='welcome-recent-empty';empty.textContent='还没有最近打开的项目';list.replaceChildren(empty);
}
function renderWelcome(){
 const empty=!documentTabs.items.length;
 $('welcome').hidden=!empty;document.body.classList.toggle('welcome-open',empty);
 if(!empty)return;
 renderWelcomeRecent();
 if(welcomeRecentLoading||!window.desktop?.recentFiles)return;
 welcomeRecentLoading=true;
 window.desktop.recentFiles().then(entries=>{welcomeEntries=entries;welcomeRecentLoading=false;loadRecentThumbs();if(!documentTabs.items.length){welcomeRecentKey='';renderWelcomeRecent();}},()=>{welcomeRecentLoading=false;});
}
async function removeWelcomeRecent(path){welcomeEntries=await window.desktop.removeRecent(path);welcomeThumbs.delete(path);welcomeRecentKey='';renderWelcomeRecent();}
async function openWelcomeRecent(path){
 const index=welcomeEntries.findIndex(entry=>entry.path===path);
 if(index<0)return;
 await importFile(await window.desktop.openRecent(index),true);
}
function renderEmptyDocument(){
 renderDocumentTabs();
 $('doc-name').textContent='未打开项目';$('doc-name').title='';$('dirty-mark').textContent='';$('doc-meta').textContent='';$('canvas-label').textContent='画布';
 $('preview-frame').textContent='';$('preview-time').textContent='';
 ctx.clearRect(0,0,canvas.width,canvas.height);octx.clearRect(0,0,overlay.width,overlay.height);
 $('preview').getContext('2d').clearRect(0,0,$('preview').width,$('preview').height);
 paletteDomKey=layerDomKey=timelineDomKey='';
 $('palette').replaceChildren();$('layers').replaceChildren();$('timeline-grid').replaceChildren();
 syncTilesetPanel();
}
function enterEmptyState(){
 stop();onionCache.clear();frameCache.clear();referenceCache.clear();
 documentTabs.items=[];documentTabs.active=null;
 documentId=crypto.randomUUID();filePath=null;dirty=false;selection=null;previousSelection=null;
 history.reset();saved=history.revision;boardRevision=0;savedBoardRevision=0;
 window.desktop?.activateDocument(null);
 render();
}
function restoreDocumentState(state){activeSliceId=null;stopPreview();stop();onionCache.clear();frameCache.clear();referenceCache.clear();({documentId,doc,fi,li,selection,previousSelection,zoom,pan,dirty,saved,boardRevision,savedBoardRevision,filePath,frameSelection,frameAnchor,celRange,celAnchor}=state);if(state.view.viewport)pan={x:pan.x+(viewport.clientWidth-state.view.viewport.w)/2,y:pan.y+(viewport.clientHeight-state.view.viewport.h)/2};history.restore(state.historyState);restorePaletteUI(state.paletteUI);documentTabs.active=documentId;window.desktop?.activateDocument(filePath);$('grid').checked=state.view.grid;$('onion').checked=state.view.onion;$('timeline-mode').value=state.view.timeline;setDirty(dirty);render();$('play-range').value=state.view.range;$('play-direction').value=state.view.direction;$('play-once').checked=state.view.once;place();draw();}
function switchDocument(id){if(id===documentId)return;if(busy||gesture||shapeSession||celGesture||$('modal').open){message('请先完成当前操作');return;}documentTabs.save(captureDocumentState());if(dirty)void flushRecovery();restoreDocumentState(documentTabs.get(id));}
async function closeDocumentTab(id=documentId){if(busy||gesture||shapeSession||$('modal').open)return;switchDocument(id);if(!await confirmDiscard(true))return;await flushRecovery();closedDocuments.push(captureDocumentState());if(closedDocuments.length>10)closedDocuments.shift();const next=documentTabs.remove(id);if(next)restoreDocumentState(next);else enterEmptyState();}
function reopenDocument(){const state=closedDocuments.pop();if(!state)return message('没有可重开的文档');documentTabs.save(captureDocumentState());documentTabs.add(state);restoreDocumentState(state);message('已重开关闭文档');}
async function recentDialog(){
 if(!window.desktop)return message('最近文件请使用桌面版');
 const entries=await window.desktop.recentFiles();
 const values=await modal('最近文件','<div class="recent-file-controls"><label>文件<select name="index" aria-label="最近文件路径"></select></label><button type="button" id="clear-recent">清空记录</button></div><div id="recent-preview" class="recent-preview"></div><p>读取文件不会覆盖现有标签。不存在的文件会显示打开失败，原文档保持。</p>',form=>{
  const paths=form.elements.index,clear=$('clear-recent'),preview=$('recent-preview'),submit=$('modal-submit'),thumbs=new Map();
  const syncPreview=()=>{
   preview.replaceChildren();const entry=entries[+paths.value],thumb=entry&&thumbs.get(entry.path);
   if(!thumb){const note=document.createElement('span');note.textContent=entries.length?'没有可用的缩略图':'暂无最近文件';preview.append(note);return;}
   const size=document.createElement('span');size.textContent=thumb.width+' × '+thumb.height;preview.append(recentThumb(thumb),size);
  };
  const syncEntries=()=>{
   paths.replaceChildren(...(entries.length?entries.map((entry,i)=>new Option(entry.path,String(i))):[new Option('暂无最近文件','')]));
   paths.disabled=clear.disabled=submit.disabled=!entries.length;syncPreview();
  };
  paths.onchange=syncPreview;syncEntries();
  window.desktop.recentThumbs().then(list=>{for(const item of list)thumbs.set(item.path,item);syncPreview();},syncPreview);
  clear.onclick=async()=>{await window.desktop.clearRecent();entries.length=0;syncEntries();welcomeEntries=[];welcomeThumbs.clear();welcomeRecentKey='';renderWelcomeRecent();};
 });
 if(values&&entries.length){const file=await window.desktop.openRecent(+values.index);await importFile(file,true);}
}
async function newDocument(){const defaults={...DEFAULT_APPLICATION,...JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)||'{}')};const values=await modal('新建像素项目','<label>项目名称 <input type="text" name="name" value="未命名" maxlength="100" required></label><label>宽度 <input type="number" name="width" value="'+defaults.width+'" min="1" required></label><label>高度 <input type="number" name="height" value="'+defaults.height+'" min="1" required></label><p>宽高不设固定上限；所有图层与帧的总像素最多 32M。</p>');if(values){const next=createDocument(+values.width,+values.height,values.name);next.frames[0].duration=defaults.duration;next.canvasBackground=validateCanvasBackground(defaults.canvasBackground||DEFAULT_CANVAS_BACKGROUND);replaceDocument(next,false,null,crypto.randomUUID(),true);}}
function replaceDocument(value,isSaved=true,nextPath=null,id=crypto.randomUUID(),newTab=false){
  activeSliceId=null;
  if(textSession)cancelTextSession();
  if(newTab)documentTabs.save(captureDocumentState());
  if(dirty)void flushRecovery();
  stopPreview();stop();onionCache.clear();frameCache.clear();referenceCache.clear();restorePaletteUI({id:'',remap:null});doc=value;documentId=id;filePath=nextPath;window.desktop?.activateDocument(filePath);fi=0;li=doc.layers.length-1;selection=null;previousSelection=null;frameSelection=new Set([0]);frameAnchor=0;celRange=null;celAnchor={frame:0,layer:li};$('timeline-mode').value='frames';$('play-range').value='all';$('play-direction').value='tag';$('play-once').checked=false;history.reset();boardRevision=0;savedBoardRevision=0;saved=isSaved?history.revision:-1;setDirty(!isSaved);if(newTab)documentTabs.add(captureDocumentState());else documentTabs.replace(captureDocumentState());render();fit();scheduleRecovery();
}
async function requestClose(closeWindow=true){
  if(closePending)return;
  if(busy||gesture||shapeSession||celGesture||$('modal').open){message('请先完成当前操作再关闭');return;}
  closePending=true;
  try{documentTabs.save(captureDocumentState());for(const item of [...documentTabs.items]){if(!item.state.dirty)continue;switchDocument(item.id);if(!await confirmDiscard(true))return false;await flushRecovery();}if(closeWindow)window.desktop.closeConfirmed();return true;}finally{closePending=false;}
}
async function openDocument(mode=null){try{if(window.desktop){const file=await window.desktop.open(mode);if(file)await importFile(file,true);}else{if((mode?.startsWith('sequence')||mode==='sheet-manifest')){message('PNG 序列和精灵表 JSON 导入请使用桌面应用');return;}$('file-input').accept=mode==='gif'?'.gif':'.pix,.json,.png,.jpg,.jpeg,.webp,.bmp,.gif';$('file-input').click();}}catch(error){showError('打开失败：'+error.message);}}
async function importPngSequence(source,newTab=false){
  sequencePlan(source);
  const values=await modal('导入 PNG 序列','<p id="sequence-info"></p><label>项目名称 <input name="name" maxlength="120" required></label><label>排序 <select name="order"><option value="natural">文件名自然排序</option><option value="selected">文件选择器顺序</option><option value="reverse">文件名自然倒序</option></select></label><label>默认帧时长 (ms) <input name="duration" type="number" min="20" max="10000" value="100" required></label><div id="sequence-metadata"><label><input name="useTiming" type="checkbox" checked>读取清单时长</label><label><input name="useTags" type="checkbox" checked>读取清单标签</label></div><div style="max-height:200px;overflow:auto"><table><thead><tr><th>帧</th><th>文件</th><th>时长 (ms)</th></tr></thead><tbody id="sequence-preview"></tbody></table></div>',form=>{
    form.elements.name.value=source.name.slice(0,120);form.elements.order.disabled=!!source.manifest;$('sequence-metadata').hidden=!source.manifest;
    const update=()=>{
      form.elements.duration.disabled=!!source.manifest&&form.elements.useTiming.checked;
      try{const plan=sequencePlan(source,sequenceOptions(form));$('sequence-info').textContent=`${plan.width} × ${plan.height} px · ${plan.frames.length} 帧 · ${plan.tags.length} 个标签`;$('sequence-preview').replaceChildren(...plan.frames.map((frame,i)=>{const row=document.createElement('tr');for(const value of [i+1,frame.name,frame.duration]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));$('modal-error').textContent='';}catch(error){$('modal-error').textContent=error.message;}
    };form.oninput=update;update();
  },()=>sequencePlan(source,sequenceOptions($('modal-form'))));
  const options=sequenceOptions($('modal-form'));$('modal-form').oninput=null;if(!values)return;
  setBusy(true);stop();try{const next=await decodePngSequence(sequencePlan(source,options),(done,total)=>message(`正在导入 PNG · ${done}/${total}`));replaceDocument(next,false,null,crypto.randomUUID(),newTab);message(`已导入 PNG 序列 · ${next.frames.length} 帧`);}finally{setBusy(false);}
}
function sequenceOptions(form){return{name:form.elements.name.value,order:form.elements.order.value,duration:+form.elements.duration.value,useTiming:form.elements.useTiming.checked,useTags:form.elements.useTags.checked};}
async function importSheetManifest(file,newTab=false){
  const plan=sheetManifestPlan(file.metadata),image=new Image();
  setBusy(true);stop();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('精灵表 PNG 无法解码'));image.src='data:image/png;base64,'+file.data;});if(image.naturalWidth!==plan.sheetWidth||image.naturalHeight!==plan.sheetHeight)throw new Error('解码后的 PNG 尺寸与 JSON 不一致');}finally{setBusy(false);}
  const values=await modal('导入精灵表 JSON','<label>项目名称<input name="name" type="text" maxlength="120" required></label><p id="sheet-json-info"></p><canvas id="sheet-import-preview"></canvas><div class="sheet-json-frames" id="sheet-json-frames"></div><p>按 JSON 数组顺序导入，恢复每帧时长与标签。生成新的单图层项目。</p>',form=>{
    form.elements.name.value=file.name.slice(0,120);$('sheet-json-info').textContent=`${plan.width} × ${plan.height} px · ${plan.frames.length} 帧 · ${plan.tags.length} 个标签`;
    const preview=$('sheet-import-preview'),ratio=Math.min(360/plan.sheetWidth,160/plan.sheetHeight);preview.width=Math.ceil(plan.sheetWidth*ratio);preview.height=Math.ceil(plan.sheetHeight*ratio);const ctx=preview.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,preview.width,preview.height);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--accent');for(const {frame:r}of plan.frames)ctx.strokeRect(r.x*ratio+.5,r.y*ratio+.5,Math.max(1,r.w*ratio-1),Math.max(1,r.h*ratio-1));$('sheet-json-frames').textContent=plan.frames.map((f,i)=>`#${i+1}: ${f.duration} ms`).join(' · ');
  },v=>{if(!v.name.trim())throw new Error('请输入项目名称');});
  if(!values)return;setBusy(true);try{const next=createDocument(plan.width,plan.height,values.name.trim()),canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});next.frames=[];next.tags=plan.tags;next.slices=plan.slices;
    for(const item of plan.frames){const {frame:r,duration}=item;ctx.clearRect(0,0,canvas.width,canvas.height);if(!item.empty)ctx.drawImage(image,r.x,r.y,r.w,r.h,item.offsetX||0,item.offsetY||0,r.w,r.h);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,pixels=[];for(let i=0;i<data.length;i+=4)pixels.push(((data[i]<<24)|(data[i+1]<<16)|(data[i+2]<<8)|data[i+3])>>>0);next.frames.push({duration,cels:[pixels]});}
    replaceDocument(next,false,null,crypto.randomUUID(),newTab);message(`已导入精灵表 JSON · ${next.frames.length} 帧`);
  }finally{setBusy(false);}
}
async function importFile(file,newTab=false){
  if(file.type==='aseprite'){const next=validateDocument(file.doc);const answer=await modal('导入 Aseprite · '+(next.colorMode||'rgba').toUpperCase(),'<p>保留已支持的颜色模式、图层、完整帧、时长、标签和静态切片。</p><p id="ase-warnings"></p>',()=>{$('ase-warnings').textContent=file.warnings.length?file.warnings.join('；'):'未发现未保留的扩展元数据';});if(answer){replaceDocument(next,false,null,crypto.randomUUID(),newTab);message('已导入 Aseprite '+(next.colorMode||'rgba').toUpperCase()+' 子集');}return;}
  if(file.type==='sheet-manifest')return importSheetManifest(file,newTab);
  if(file.type==='sequence')return importPngSequence(file,newTab);
  if(file.type==='project'){const next=validateDocument(file.document??JSON.parse(file.data));const existing=newTab&&file.filePath&&documentTabs.items.find(item=>item.state.filePath===file.filePath);if(existing){switchDocument(existing.id);return;}replaceDocument(next,true,file.filePath||null,crypto.randomUUID(),newTab);message('项目已打开');const copy=file.filePath&&await window.desktop?.recoveryForPath(file.filePath);if(copy){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const answer=await modal('恢复未保存内容？',`<p>${file.name} 有意外关闭时留下的未保存副本。是否恢复？</p>`,null,null,{confirm:'恢复'});if(answer){const restored=await window.desktop.loadRecovery(copy.id);replaceDocument(validateDocument(JSON.parse(restored.data)),false,restored.filePath,restored.id);message('已恢复未保存内容');}else await window.desktop.discardRecovery(file.filePath);}return;}
  if(file.type==='gif'){
    setBusy(true);stop();
    try{
      const result=await decodeGif(Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)),file.name);setBusy(false);
      const answer=await modal('导入 GIF',`<p>${result.doc.width} × ${result.doc.height} px，共 ${result.doc.frames.length} 帧。解码后的完整帧将成为单图层动画。</p><p>${result.adjusted} 帧的时长已归一到 20–10000 ms。GIF 循环信息不写入项目；可在时间轴选择循环或单次播放。</p>`);
      if(answer){replaceDocument(result.doc,false,null,crypto.randomUUID(),newTab);message(`已导入 GIF · ${result.doc.frames.length} 帧`);}
    }finally{setBusy(false);}return;
  }
  const next=await rasterImportDocument(file,{modal,$,showError});if(next){replaceDocument(next,false,null,crypto.randomUUID(),newTab);message(`已导入 ${next.frames.length} 帧`);}
}
async function saveData(data,kind,name,binary=['bmp','gif','ico','jpeg','jpg','png','webp'].includes(kind)){if(window.desktop)return window.desktop.save(data,kind,name,binary);const blob=new Blob([binary?Uint8Array.from(atob(data),c=>c.charCodeAt(0)):data]);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'.'+(kind==='project'?'pix':kind);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
async function saveProject(saveAs=false){
  if(busy||gesture)return false;setBusy(true);stop();
  try{
    const result=window.desktop?await window.desktop.saveProject(doc,doc.name,saveAs):await saveData(JSON.stringify(doc),'project',doc.name);
    if(!result){message('已取消保存');return false;}
    if(window.desktop){filePath=result.filePath;doc.name=result.name;}
    saved=history.revision;savedBoardRevision=boardRevision;changed();render();await flushRecovery();message('项目已保存');return true;
  }catch(error){showError('保存失败：'+error.message);return false;}finally{setBusy(false);}
}
// ── 参考面板：独立于绘制内容的图片参考板（不进合成 / 导出 / 历史栈）──
// canvas 缓存按所属 document 分桶：面板被拖成独立窗口后不会复用另一个窗口的节点。
const BOARD_CANVASES=new WeakMap();
// 板面视图状态（缩放 / 平移）按文档保存，停靠与独立窗口共用，切换窗口不丢视图。
const BOARD_VIEWS=new Map();
let boardKey='';
// 地形预览使用独立面板与视图，仅作参考，不写图层像素、不进合成与导出。
const PREVIEW_VIEWS=new Map();
// 地形预览面板的 DOM（面板可拖成独立窗口，节点统一用 panel.ownerDocument 创建）。
let previewUI=null;
const boardItems=()=>doc.references||[];
const boardCacheKey=item=>item.id+'|'+item.width+'x'+item.height+'|'+item.data.length;
const boardPanel=()=>$('reference-panel');
function boardCanvasCache(dom){let cache=BOARD_CANVASES.get(dom);if(!cache){cache=new Map();BOARD_CANVASES.set(dom,cache);}return cache;}
function boardForget(item){for(const dom of [document,boardPanel()?.ownerDocument])if(dom)boardCanvasCache(dom).delete(boardCacheKey(item));}
function boardDirty(){return boardRevision!==savedBoardRevision;}
function boardView(){let view=BOARD_VIEWS.get(documentId);if(!view){view={zoom:1,x:0,y:0};BOARD_VIEWS.set(documentId,view);}return view;}
function boardMessage(text){
  const panel=boardPanel(),status=panel?.querySelector('.reference-status');
  if(status)status.textContent=text;
  if(panel?.ownerDocument===document)message(text);
}
function boardChanged(text){boardRevision++;renderReferenceBoard(true);setDirty(history.revision!==saved||boardDirty());scheduleRecovery();if(text)boardMessage(text);}
function boardCanvas(dom,item){
  const win=dom.defaultView,pixels=boardItemPixels(item),rgba=new Uint8ClampedArray(item.width*item.height*4);
  for(let i=0;i<pixels.length;i++){const pixel=pixels[i];rgba[i*4]=pixel>>>24;rgba[i*4+1]=pixel>>>16&255;rgba[i*4+2]=pixel>>>8&255;rgba[i*4+3]=pixel&255;}
  const canvas=dom.createElement('canvas');canvas.width=item.width;canvas.height=item.height;
  canvas.getContext('2d').putImageData(new win.ImageData(rgba,item.width,item.height),0,0);
  boardCanvasCache(dom).set(boardCacheKey(item),canvas);
  return canvas;
}
function boardCachedCanvas(dom,item){
  const cached=boardCanvasCache(dom).get(boardCacheKey(item));
  return cached&&cached.ownerDocument===dom?cached:boardCanvas(dom,item);
}
function boardPlace(node,item,view){node.style.left=(view.x+item.x*view.zoom)+'px';node.style.top=(view.y+item.y*view.zoom)+'px';node.style.width=(item.width*item.scale*view.zoom)+'px';node.style.height=(item.height*item.scale*view.zoom)+'px';}
function boardSurface(board,items,view){
  let right=BOARD_MIN,bottom=BOARD_MIN;
  for(const item of items){right=Math.max(right,Math.ceil(item.x+item.width*item.scale)+24);bottom=Math.max(bottom,Math.ceil(item.y+item.height*item.scale)+24);}
  board.style.width=Math.max(1,Math.ceil(right*view.zoom+Math.max(0,view.x)))+'px';
  board.style.height=Math.max(1,Math.ceil(bottom*view.zoom+Math.max(0,view.y)))+'px';
}
function boardApplyView(){
  const panel=boardPanel(),board=panel?.querySelector('.reference-board');if(!board)return;
  const items=boardItems(),view=boardView();
  boardSurface(board,items,view);
  for(const node of board.querySelectorAll('[data-reference-id]')){
    const item=items.find(reference=>reference.id===node.dataset.referenceId);
    if(item)boardPlace(node,item,view);
  }
}
function boardItemNodes(dom,item,view){
  const canvas=boardCachedCanvas(dom,item);
  canvas.className='reference-image';canvas.tabIndex=0;canvas.dataset.referenceId=item.id;
  canvas.setAttribute('aria-label','参考图 '+item.name);
  canvas.title=item.name+' · '+item.width+' × '+item.height+' · '+Math.round(item.scale*100)+'%';
  canvas.onpointerdown=event=>startBoardPointer(event,item,'move');
  canvas.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();openBoardMenu(event.clientX,event.clientY,item.id);};
  canvas.onkeydown=event=>{if(!['Delete','Backspace'].includes(event.key))return;event.preventDefault();event.stopPropagation();void deleteBoardItem(item.id,false);};
  boardPlace(canvas,item,view);
  const frame=dom.createElement('div');frame.className='reference-frame';frame.dataset.referenceId=item.id;boardPlace(frame,item,view);
  const remove=dom.createElement('button');remove.type='button';remove.className='reference-delete';remove.innerHTML=iconMarkup('close');remove.title='删除参考图';remove.setAttribute('aria-label',remove.title);
  remove.onclick=event=>{event.stopPropagation();void deleteBoardItem(item.id,true);};
  frame.append(remove);
  for(const corner of ['nw','ne','sw','se']){
    const handle=dom.createElement('button');handle.type='button';handle.className='reference-handle reference-'+corner;handle.dataset.handle=corner;
    handle.title='拖动四角等比缩放';handle.setAttribute('aria-label','拖动四角等比缩放参考图');handle.onpointerdown=event=>startBoardPointer(event,item,'resize',corner);
    frame.append(handle);
  }
  return[canvas,frame];
}
function renderReferenceBoard(force=false){
  const panel=boardPanel();if(!panel||!panel.querySelector('.reference-board'))return;
  const items=boardItems(),view=boardView();
  panel.querySelector('[data-reference-clear]').disabled=!items.length;
  const key=documentId+'|'+view.zoom+':'+view.x+':'+view.y+'|'+items.map(item=>item.id+':'+item.x+':'+item.y+':'+item.scale).join(',');
  if(key!==boardKey||force){
    boardKey=key;
    const dom=panel.ownerDocument,board=panel.querySelector('.reference-board');
    boardSurface(board,items,view);
    board.replaceChildren();
    for(const item of items)board.append(...boardItemNodes(dom,item,view));
    panel.classList.toggle('empty',!items.length);
    syncBoardCursor();
  }
  renderTerrainPreview();
}
function setBoardView(next){BOARD_VIEWS.set(documentId,next);boardKey='';renderReferenceBoard(true);}
function setBoardZoom(zoom){
  const panel=boardPanel(),viewport=panel?.querySelector('.reference-viewport');if(!viewport)return;
  const view=boardView(),next=Math.max(.125,Math.min(16,zoom)),cx=viewport.clientWidth/2,cy=viewport.clientHeight/2;
  const bx=(cx+viewport.scrollLeft-view.x)/view.zoom,by=(cy+viewport.scrollTop-view.y)/view.zoom;
  setBoardView({zoom:next,x:cx-bx*next,y:cy-by*next});
}
function startBoardPan(event){
  const panel=boardPanel(),board=panel.querySelector('.reference-board'),node=event.currentTarget,view=boardView();
  event.preventDefault();event.stopPropagation();
  spaceUsed=true;
  const start={x:event.clientX,y:event.clientY,view:{...view}};
  node.setPointerCapture(event.pointerId);
  node.onpointermove=moveEvent=>{
    if(moveEvent.pointerId!==event.pointerId)return;
    BOARD_VIEWS.set(documentId,{zoom:start.view.zoom,x:start.view.x+moveEvent.clientX-start.x,y:start.view.y+moveEvent.clientY-start.y});
    boardApplyView();
  };
  const finish=()=>{
    node.onpointermove=null;node.onpointerup=null;node.onpointercancel=null;
    if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);
    boardKey='';
  };
  node.onpointerup=finish;node.onpointercancel=finish;
}
function pickBoardColor(event,item){
  event.preventDefault();event.stopPropagation();
  const rect=event.currentTarget.getBoundingClientRect(),scale=item.scale*boardView().zoom;
  const x=Math.floor((event.clientX-rect.left)/scale),y=Math.floor((event.clientY-rect.top)/scale);
  if(x<0||y<0||x>=item.width||y>=item.height)return;
  const pixel=boardItemPixels(item)[y*item.width+x];
  if(!(pixel&255))return boardMessage('该位置是透明像素，未取色');
  setColor(fromRgba({r:pixel>>>24,g:pixel>>>16&255,b:pixel>>>8&255,a:pixel&255}));
  boardMessage('已从参考图取色 '+color.toUpperCase());
}
function boardEyedropper(){return tool==='eyedropper'||modifiers.alt;}
// 参考面板光标跟随当前工具与 Alt 临时吸管；面板可 detach，节点取所属 document。
function syncBoardCursor(){
  const panel=boardPanel();if(!panel)return;
  const cursor=boardEyedropper()?cursorStyle('eyedropper'):'';
  for(const canvas of panel.querySelectorAll('.reference-image'))if(canvas.style.cursor!==cursor)canvas.style.cursor=cursor;
}
function startBoardPointer(event,item,kind,corner){
  const panel=boardPanel(),board=panel.querySelector('.reference-board');
  if(event.button===1||space){startBoardPan(event);return;}
  if(event.button!==0)return;
  if(tool==='eyedropper'||modifiers.alt&&kind==='move'){pickBoardColor(event,item);return;}
  event.preventDefault();event.stopPropagation();
  const node=event.currentTarget,view=boardView(),start={x:item.x,y:item.y,scale:item.scale,clientX:event.clientX,clientY:event.clientY},direction=corner==='nw'||corner==='sw'?-1:1;
  node.setPointerCapture(event.pointerId);
  node.onpointermove=moveEvent=>{
    if(moveEvent.pointerId!==event.pointerId)return;
    const dx=(moveEvent.clientX-start.clientX)/view.zoom;
    if(kind==='move')moveReference(doc,item.id,Math.max(0,Math.round(start.x+dx)),Math.max(0,Math.round(start.y+(moveEvent.clientY-start.clientY)/view.zoom)));
    else resizeReference(doc,item.id,Math.min(16,Math.max(.125,Math.round((start.scale+direction*dx/Math.max(1,item.width))*8)/8)));
    boardApplyView();
  };
  const finish=cancel=>{
    node.onpointermove=null;node.onpointerup=null;node.onpointercancel=null;
    if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);
    if(cancel){moveReference(doc,item.id,start.x,start.y);resizeReference(doc,item.id,start.scale);renderReferenceBoard(true);return;}
    boardChanged(kind==='move'?'已移动参考图':'已缩放参考图');
    if(kind==='move')node.focus({preventScroll:true});
  };
  node.onpointerup=()=>finish(false);
  node.onpointercancel=()=>finish(true);
}
// ── 地形预览页签：按格子刷地形做显示参考，解析图块复用 tilemap.js 的匹配规则 ──
// 已存预览使用作品自己的格子数；本机默认值只用于尚未创建的预览。
let previewSize=loadPreviewSize(localStorage);
const previewEntries=()=>doc.layers.flatMap((layer,index)=>isTileset(layer)?[{layer,index}]:[]);
function previewEntry(){
  const entries=previewEntries();if(!entries.length)return null;
  const wanted=previewUI?.layerSelect.value?+previewUI.layerSelect.value:doc.previewTerrain?.layerId;
  return entries.find(entry=>entry.layer.id===wanted)??entries[0];
}
// 读取预览不修改作品；只有用户明确调整尺寸时才重采样。
function findPreview(entry){
  const preview=doc.previewTerrain;
  if(!preview||preview.layerId!==entry.layer.id)return null;
  return preview;
}
function ensurePreview(entry){
  const preview=findPreview(entry);
  if(preview!==doc.previewTerrain)doc.previewTerrain=preview??createPreviewTerrain(entry.layer.id,previewSize.cols,previewSize.rows);
  return doc.previewTerrain;
}
// 预览的像素尺寸由「格子数 × 图块尺寸」决定，跟项目画布无关。
function previewMetrics(){
  const entry=previewEntry();if(!entry)return null;
  const preview=findPreview(entry),{w:tileW,h:tileH}=entry.layer.tileset;
  const cols=preview?.w??previewSize.cols,rows=preview?.h??previewSize.rows;
  return{entry,tileW,tileH,cols,rows,width:cols*tileW,height:rows*tileH};
}
function previewDirty(){boardRevision++;setDirty(true);scheduleRecovery();}
function drawPreviewCanvas(){
  const ui=previewUI;if(!ui)return;
  const metrics=previewMetrics();
  const error=metrics?previewRenderError(metrics.width,metrics.height):'';
  ui.limit.textContent=error;ui.limit.hidden=!error;
  ui.node.style.visibility=error?'hidden':'';
  if(!metrics||error){ui.canvas.width=0;ui.canvas.height=0;return;}
  const {entry,tileW,tileH,cols,rows,width,height}=metrics,tileset=entry.layer.tileset,atlasCols=Math.floor(doc.width/tileW);
  if(ui.canvas.width!==width||ui.canvas.height!==height){ui.canvas.width=width;ui.canvas.height=height;}
  const preview=findPreview(entry),painted=!!preview&&preview.cells.some(id=>id>=0);
  const resolved=painted?resolvePreviewCells(tileset,cols,rows,preview.cells):[];
  let pixels=painted?rasterizePreviewTiles({width,height,atlasWidth:doc.width,atlas:doc.frames[0].cels[entry.index],tileW,tileH,atlasCols,cols,tiles:resolved.map(cell=>cell.id)}):new Array(width*height).fill(0);
  if(painted)pixels=tintPaintedCells(pixels,{width,height,tileW,tileH,cols,cells:preview.cells,exact:resolved.map(cell=>cell.exact),terrains:tileset.terrains});
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<pixels.length;i++){const pixel=pixels[i];data[i*4]=pixel>>>24;data[i*4+1]=pixel>>>16&255;data[i*4+2]=pixel>>>8&255;data[i*4+3]=pixel&255;}
  const ctx=ui.canvas.getContext('2d');
  ctx.putImageData(new ui.canvas.ownerDocument.defaultView.ImageData(data,width,height),0,0);
  // 规则里没有对应图块的格子画一圈虚线：让「这块地形配不出来」看得见，而不是只显示一小块碎片。
  ctx.setLineDash([3,3]);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,120,120,.9)';
  for(let i=0;i<resolved.length;i++){
    if(resolved[i].id<0||resolved[i].exact)continue;
    const cx=i%cols,cy=Math.floor(i/cols);
    ctx.strokeRect(cx*tileW+.5,cy*tileH+.5,Math.max(0,tileW-1),Math.max(0,tileH-1));
  }
  ctx.setLineDash([]);
}

// 地形预览网格画在屏幕空间的覆盖层上：线宽固定 1 物理像素，视图放大后也不会被抗锯齿摊成两像素糊掉。
// 线条只画在板面矩形内（板面 = 格子数×图块尺寸，随视图缩放平移），颜色与图集栏位的网格同为 --accent-line。
function drawPreviewGrid(){
  const ui=previewUI;if(!ui?.grid)return;
  if(!ui.limit.hidden){ui.grid.width=0;ui.grid.height=0;return;}
  const canvas=ui.grid,ownerDoc=canvas.ownerDocument,dpr=ownerDoc.defaultView.devicePixelRatio||1;
  const cssWidth=ui.viewport.clientWidth,cssHeight=ui.viewport.clientHeight;
  const width=Math.max(1,Math.round(cssWidth*dpr)),height=Math.max(1,Math.round(cssHeight*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
  const metrics=previewMetrics();
  if(!metrics)return;
  const view=previewView(),{tileW,tileH,cols,rows,width:boardW,height:boardH}=metrics,stepX=tileW*view.zoom,stepY=tileH*view.zoom;
  if(!(stepX>0)||!(stepY>0))return;
  const ox=view.x-ui.viewport.scrollLeft,oy=view.y-ui.viewport.scrollTop;
  const left=ox*dpr,top=oy*dpr,right=(ox+boardW*view.zoom)*dpr,bottom=(oy+boardH*view.zoom)*dpr;
  ctx.strokeStyle=ownerDoc.defaultView.getComputedStyle(ownerDoc.documentElement).getPropertyValue('--accent-line').trim()||'#8e6c3c';
  ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=cols;x++){const px=Math.round(left+x*stepX*dpr)+.5;ctx.moveTo(px,top);ctx.lineTo(px,bottom);}
  for(let y=0;y<=rows;y++){const py=Math.round(top+y*stepY*dpr)+.5;ctx.moveTo(left,py);ctx.lineTo(right,py);}
  ctx.stroke();
}
function placePreviewNode(){
  const ui=previewUI;if(!ui)return;
  const metrics=previewMetrics();
  if(!metrics){drawPreviewGrid();return;}
  if(!ui.limit.hidden){ui.node.style.width='0px';ui.node.style.height='0px';drawPreviewGrid();return;}
  const view=previewView();
  ui.node.style.left=view.x+'px';ui.node.style.top=view.y+'px';
  ui.node.style.width=metrics.width+'px';ui.node.style.height=metrics.height+'px';
  ui.node.style.transform='scale('+view.zoom+')';
  drawPreviewGrid();
}
function previewPoint(event){
  const ui=previewUI,entry=previewEntry();if(!ui||!entry)return null;
  const rect=ui.canvas.getBoundingClientRect(),view=previewView(),{w,h}=entry.layer.tileset;
  return{cx:Math.floor((event.clientX-rect.left)/view.zoom/w),cy:Math.floor((event.clientY-rect.top)/view.zoom/h)};
}
function paintPreviewAt(event,erase){
  const ui=previewUI,entry=previewEntry(),point=previewPoint(event);
  if(!entry||!point||!ui.limit.hidden||(!erase&&ui.terrainSelect.value===''))return;
  if(!setPreviewCell(ensurePreview(entry),point.cx,point.cy,erase?-1:+ui.terrainSelect.value))return;
  previewDirty();drawPreviewCanvas();
}
function startPreviewPointer(event){
  if(event.button===1||space){startPreviewPan(event);return;}
  if(event.button!==0&&event.button!==2)return;
  event.preventDefault();event.stopPropagation();
  const erase=event.button===2,node=event.currentTarget;
  paintPreviewAt(event,erase);
  node.setPointerCapture(event.pointerId);
  node.onpointermove=moveEvent=>{if(moveEvent.pointerId===event.pointerId)paintPreviewAt(moveEvent,erase);};
  const finish=()=>{node.onpointermove=null;node.onpointerup=null;node.onpointercancel=null;if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);};
  node.onpointerup=finish;node.onpointercancel=finish;
}
function clearPreview(){
  const entry=previewEntry();if(!entry)return;
  const preview=doc.previewTerrain;
  if(!preview||preview.layerId!==entry.layer.id||!preview.cells.some(id=>id>=0))return message('地形预览还是空的');
  preview.cells.fill(-1);previewDirty();drawPreviewCanvas();message('已清空地形预览');
}
// 地形预览初次显示或尺寸改变时适应独立面板的可视区。
function fitPreviewView(){
  const metrics=previewMetrics(),viewport=previewUI?.viewport;
  if(!metrics||!viewport)return;
  const zoom=Math.max(.125,Math.min(1,(viewport.clientWidth-24)/metrics.width,(viewport.clientHeight-24)/metrics.height));
  setPreviewView({zoom,x:12,y:12});
}
function syncPreviewControls(){
  const ui=previewUI;if(!ui)return;
  const win=ui.node.ownerDocument.defaultView,entries=previewEntries(),entry=previewEntry();
  const layerKey=entries.map(item=>item.layer.id+':'+item.layer.name).join(',');
  if(layerKey!==ui.layerKey){ui.layerKey=layerKey;ui.layerSelect.replaceChildren(...entries.map(item=>new win.Option(item.layer.name,String(item.layer.id))));}
  ui.layerSelect.value=String(entry?.layer.id??'');
  const terrains=entry?.layer.tileset.terrains??[],terrainKey=terrains.map(item=>item.id+':'+item.name).join(',');
  if(terrainKey!==ui.terrainKey){ui.terrainKey=terrainKey;ui.terrainSelect.replaceChildren(...terrains.map(item=>new win.Option(item.name,String(item.id))));}
  ui.terrainSelect.disabled=!terrains.length;
  ui.clearButton.disabled=!entry;
  const preview=entry&&findPreview(entry),cols=preview?.w??previewSize.cols,rows=preview?.h??previewSize.rows;
  if(ui.colsInput&&ui.colsInput.value!==String(cols))ui.colsInput.value=String(cols);
  if(ui.rowsInput&&ui.rowsInput.value!==String(rows))ui.rowsInput.value=String(rows);
}
// 独立地形预览面板的画布尺寸设置：改完按比例重采样已画地形，并写回本机设置。
function applyPreviewSize(colsValue,rowsValue){
  const ui=previewUI,entry=previewEntry();
  let next;
  try{next=validatePreviewSize({cols:colsValue,rows:rowsValue});if(entry)assertPreviewRenderSize(next.cols*entry.layer.tileset.w,next.rows*entry.layer.tileset.h);}
  catch(error){showError(error.message);syncPreviewControls();return;}
  const preview=entry&&findPreview(entry);
  if(next.cols===(preview?.w??previewSize.cols)&&next.rows===(preview?.h??previewSize.rows)){syncPreviewControls();return;}
  previewSize=next;savePreviewSize(localStorage,previewSize);
  if(preview){
    doc.previewTerrain=resizePreviewTerrain(preview,previewSize.cols,previewSize.rows);previewDirty();
  }
  boardKey='';renderReferenceBoard(true);fitPreviewView();
  message('地形预览画布改为 '+previewSize.cols+' × '+previewSize.rows+' 格');
}
function renderTerrainPreview(){
  const ui=previewUI;if(!ui)return;
  const entries=previewEntries();
  window.workspaceLayout?.setPanelVisible('terrain-preview',!!documentTabs.items.length&&!!entries.length,{auto:true});
  syncPreviewControls();drawPreviewCanvas();placePreviewNode();
  updatePreviewLayout();
}
function updatePreviewLayout(){
 const ui=previewUI,metrics=previewMetrics();if(!ui||!metrics||!ui.viewport.clientWidth)return;
 const key=documentId+'|'+metrics.entry.layer.id+'|'+metrics.width+'x'+metrics.height;
 if(ui.fitKey!==key){ui.fitKey=key;fitPreviewView();}else placePreviewNode();
}
function boardConfirm(panel,title,text){
  const dom=panel.ownerDocument,dlg=dom.createElement('dialog'),form=dom.createElement('form'),heading=dom.createElement('h2'),body=dom.createElement('p'),actions=dom.createElement('div'),cancel=dom.createElement('button'),ok=dom.createElement('button');
  dlg.className='reference-dialog';form.method='dialog';heading.textContent=title;body.textContent=text;
  actions.className='reference-dialog-actions';cancel.type='submit';cancel.value='cancel';cancel.textContent='取消';ok.type='submit';ok.value='ok';ok.className='primary';ok.textContent='确定';
  actions.append(cancel,ok);form.append(heading,body,actions);dlg.append(form);dom.body.append(dlg);
  return new Promise(resolve=>{
    dlg.addEventListener('close',()=>{const accepted=dlg.returnValue==='ok';dlg.remove();resolve(accepted);},{once:true});
    dlg.showModal();
  });
}
async function deleteBoardItem(id,confirm=true){
  const panel=boardPanel(),item=boardItems().find(reference=>reference.id===id);
  if(!panel||!item)return;
  if(confirm&&!await boardConfirm(panel,'删除参考图','将从参考面板移除「'+item.name+'」。参考图不参与合成与导出，作品像素不受影响。'))return;
  boardForget(removeReference(doc,id));
  boardChanged('已删除参考图 '+item.name);
}
function reorderBoardItem(id,direction){reorderReference(doc,id,direction);boardChanged('已调整参考图层次');}
function resetBoardItem(id){resetReferencePosition(doc,id);boardChanged('已重置参考图位置与缩放');}
function openBoardMenu(x,y,id){
  const panel=boardPanel();if(!panel)return;
  openContextMenu(x,y,'参考图操作',[
    ['适应内容',()=>fitBoardContent()],
    ['缩放到 100%',()=>setBoardZoom(1)],
    ['重置位置与缩放',()=>resetBoardItem(id)],
    ['置于顶层',()=>reorderBoardItem(id,'front')],
    ['上移一层',()=>reorderBoardItem(id,'up')],
    ['下移一层',()=>reorderBoardItem(id,'down')],
    ['置于底层',()=>reorderBoardItem(id,'back')],
    ['删除',()=>void deleteBoardItem(id)]
  ],'context-menu',panel);
}
async function decodeBoardPng(base64,mime='image/png'){
  const panel=boardPanel(),dom=panel.ownerDocument,win=dom.defaultView,image=new win.Image();
  image.src='data:'+(mime||'image/png')+';base64,'+base64;
  await image.decode();
  const canvas=dom.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d');context.drawImage(image,0,0);
  return{width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data};
}
async function addBoardImage(base64,name,mime){
  const image=await decodeBoardPng(base64,mime),items=boardItems(),reference=encodeReference(image.width,image.height,image.data);
  const x=items.length?Math.ceil(Math.max(...items.map(item=>item.x+item.width*item.scale)))+16:16;
  const item=addReference(doc,{...reference,id:crypto.randomUUID(),name:String(name||'参考图').slice(0,120),x,y:16});
  boardChanged('已导入参考图 '+item.name);
  return item;
}
async function referenceBoardImport(){
  if(!window.desktop)return boardMessage('参考图片导入请使用桌面版');
  try{const files=await window.desktop.open('reference');if(!files?.length)return;for(const file of files)await addBoardImage(file.data,file.name,file.mime);boardMessage(files.length>1?'已导入 '+files.length+' 张参考图':'已导入参考图 '+files[0].name);}catch(error){boardMessage('参考图片导入失败：'+error.message);}
}
async function dropReferenceFiles(files){
  const win=boardPanel().ownerDocument.defaultView;
  for(const file of files)try{
    const base64=await new Promise((resolve,reject)=>{const reader=new win.FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取图片文件'));reader.readAsDataURL(file);});
    await addBoardImage(base64,file.name,file.type);
  }catch(error){boardMessage('参考图片导入失败：'+error.message);}
}
function fitBoardContent(){
  const panel=boardPanel(),viewport=panel?.querySelector('.reference-viewport');if(!viewport)return;
  const items=boardItems(),bounds=items.length?boardBounds(items):{x:0,y:0,w:BOARD_MIN,h:BOARD_MIN};
  const zoom=Math.max(.125,Math.min(16,Math.floor(Math.min((viewport.clientWidth-32)/bounds.w,(viewport.clientHeight-32)/bounds.h)*100)/100));
  setBoardView({zoom,x:16-bounds.x*zoom,y:16-bounds.y*zoom});
  viewport.scrollTo(0,0);
  boardMessage('已适应内容 '+Math.round(zoom*100)+'%');
}
async function clearBoard(){
  const panel=boardPanel();if(!panel)return;
  if(!boardItems().length)return boardMessage('参考面板没有图片');
  if(!await boardConfirm(panel,'清空参考面板','将移除面板中的全部参考图片。参考图不参与合成与导出，作品像素不受影响。'))return;
  for(const item of boardItems())boardForget(item);
  doc.references=[];
  boardChanged('已清空参考面板');
}
function previewView(){let view=PREVIEW_VIEWS.get(documentId);if(!view){view={zoom:1,x:12,y:12};PREVIEW_VIEWS.set(documentId,view);}return view;}
function setPreviewView(view){PREVIEW_VIEWS.set(documentId,view);placePreviewNode();}
function startPreviewPan(event){
 event.preventDefault();event.stopPropagation();spaceUsed=true;
 const node=event.currentTarget,view={...previewView()},x=event.clientX,y=event.clientY;
 node.setPointerCapture(event.pointerId);
 node.onpointermove=move=>{if(move.pointerId===event.pointerId)setPreviewView({...view,x:view.x+move.clientX-x,y:view.y+move.clientY-y});};
 const finish=()=>{node.onpointermove=node.onpointerup=node.onpointercancel=null;if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);};
 node.onpointerup=finish;node.onpointercancel=finish;
}
function initTerrainPreview(){
 const panel=$('terrain-preview-panel'),dom=panel.ownerDocument;
  const bar=dom.createElement('div');bar.className='terrain-preview-bar';
  const layerSelect=dom.createElement('select');layerSelect.className='terrain-preview-layer-select';layerSelect.setAttribute('aria-label','预览的图集图层');layerSelect.onchange=()=>{renderTerrainPreview();placePreviewNode();};
  const terrainSelect=dom.createElement('select');terrainSelect.className='terrain-preview-terrain';terrainSelect.setAttribute('aria-label','预览地形');
  const clearButton=dom.createElement('button');clearButton.type='button';clearButton.className='terrain-preview-clear';clearButton.textContent='清空';clearButton.title='清空地形预览';clearButton.onclick=clearPreview;
  const sizeLabel=dom.createElement('label');sizeLabel.className='terrain-preview-size';sizeLabel.title='地形预览画布的格子数（1–64）';
  const colsInput=dom.createElement('input');colsInput.type='number';colsInput.min='1';colsInput.max='64';colsInput.className='terrain-preview-cols';colsInput.setAttribute('aria-label','预览列数');
  const rowsInput=dom.createElement('input');rowsInput.type='number';rowsInput.min='1';rowsInput.max='64';rowsInput.className='terrain-preview-rows';rowsInput.setAttribute('aria-label','预览行数');
  const sizeTimes=dom.createElement('span');sizeTimes.textContent='×';
  colsInput.onchange=()=>applyPreviewSize(colsInput.value,rowsInput.value);
  rowsInput.onchange=()=>applyPreviewSize(colsInput.value,rowsInput.value);
  sizeLabel.append(colsInput,sizeTimes,rowsInput);
  bar.append(layerSelect,terrainSelect,clearButton,sizeLabel);
  const previewNode=dom.createElement('div');previewNode.className='terrain-preview-layer';
  const previewCanvas=dom.createElement('canvas');previewCanvas.className='terrain-preview-canvas';previewCanvas.setAttribute('role','img');previewCanvas.setAttribute('aria-label','地形预览画布');
  previewCanvas.onpointerdown=event=>startPreviewPointer(event);
  previewCanvas.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();};
  previewNode.append(previewCanvas);
  previewUI={node:previewNode,canvas:previewCanvas,layerSelect,terrainSelect,clearButton,colsInput,rowsInput,bar,layerKey:'',terrainKey:''};
 const viewportWrap=dom.createElement('div');viewportWrap.className='reference-viewport-wrap';
 const viewport=dom.createElement('div');viewport.className='reference-viewport terrain-preview-viewport';
 const tools=dom.createElement('div');tools.className='board-canvas-tools';
 const fit=dom.createElement('button');fit.type='button';fit.className='terrain-preview-fit';fit.innerHTML=iconMarkup('fit');fit.title='适应内容';fit.setAttribute('aria-label','适应内容');fit.onclick=fitPreviewView;tools.append(fit);
 const grid=dom.createElement('canvas');grid.className='terrain-preview-grid-overlay';grid.setAttribute('aria-hidden','true');
 const limit=dom.createElement('p');limit.className='terrain-preview-limit';limit.setAttribute('role','status');limit.hidden=true;
 viewport.append(previewNode);viewportWrap.append(viewport,grid,tools,limit);panel.append(bar,viewportWrap);
 previewUI.viewport=viewport;previewUI.grid=grid;previewUI.limit=limit;
 viewport.onwheel=event=>{
  event.preventDefault();event.stopPropagation();const view=previewView(),rect=viewport.getBoundingClientRect(),zoom=Math.max(.125,Math.min(16,view.zoom*(event.deltaY<0?1.25:1/1.25)));
  const x=event.clientX-rect.left+viewport.scrollLeft,y=event.clientY-rect.top+viewport.scrollTop;
  setPreviewView({zoom,x:x-(x-view.x)/view.zoom*zoom,y:y-(y-view.y)/view.zoom*zoom});
 };
 viewport.onpointerdown=event=>{if(event.button===1||space)startPreviewPan(event);};
 viewport.onscroll=drawPreviewGrid;
 dom.defaultView.addEventListener('resize',updatePreviewLayout);
}
function initReferenceBoard(){
 const panel=boardPanel();if(!panel||panel.dataset.ready)return;panel.dataset.ready='1';
 const dom=panel.ownerDocument,viewportWrap=dom.createElement('div');viewportWrap.className='reference-viewport-wrap';
 const canvasTools=dom.createElement('div');canvasTools.className='board-canvas-tools';
 const addButton=(icon,label,onclick,className='')=>{const button=dom.createElement('button');button.type='button';button.className=className;button.innerHTML=iconMarkup(icon);button.title=label;button.setAttribute('aria-label',label);button.onclick=onclick;canvasTools.append(button);return button;};
 addButton('image','导入图片',()=>void referenceBoardImport());
 addButton('clear','清空参考图',()=>void clearBoard()).dataset.referenceClear='';
 addButton('fit','适应内容',fitBoardContent,'board-fit');
 const viewport=dom.createElement('div');viewport.className='reference-viewport';
 const board=dom.createElement('div');board.className='reference-board';board.setAttribute('role','group');board.setAttribute('aria-label','参考图片');
 viewport.append(board);viewportWrap.append(viewport,canvasTools);
 const status=dom.createElement('span');status.className='reference-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 viewportWrap.append(status);
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();event.stopPropagation();
    const view=boardView(),rect=viewport.getBoundingClientRect(),next=Math.max(.125,Math.min(16,view.zoom*(event.deltaY<0?1.25:1/1.25)));
    if(next===view.zoom)return;
    const px=event.clientX-rect.left+viewport.scrollLeft,py=event.clientY-rect.top+viewport.scrollTop;
    const bx=(px-view.x)/view.zoom,by=(py-view.y)/view.zoom;
    setBoardView({zoom:next,x:px-bx*next,y:py-by*next});
  },{passive:false});
  viewport.addEventListener('scroll',()=>drawPreviewGrid());
  viewport.addEventListener('pointerdown',event=>{if(event.button===1||space)startBoardPan(event);});
  viewport.addEventListener('contextmenu',event=>{
    event.preventDefault();
    openContextMenu(event.clientX,event.clientY,'参考面板',[
      ['适应内容',()=>fitBoardContent()],
      ['缩放到 100%',()=>setBoardZoom(1)],
      ['清空参考面板',()=>void clearBoard()]
    ],'context-menu',panel);
  });
  viewport.addEventListener('dragover',event=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';});
  viewport.addEventListener('drop',event=>{
    const files=[...(event.dataTransfer?.files||[])].filter(file=>/\.(png|jpe?g|webp|gif)$/i.test(file.name)||/^image\//.test(file.type));
    if(!files.length)return;event.preventDefault();event.stopPropagation();void dropReferenceFiles(files);
  });
 panel.append(viewportWrap);initTerrainPreview();renderReferenceBoard(true);
}
function sheetOptions(form){return{margin:+form.elements.margin.value,gapX:+form.elements.gapX.value,gapY:+form.elements.gapY.value,order:form.elements.order.value,trim:form.elements.trim.checked,pack:form.elements.pack.checked,extrude:+form.elements.extrude.value};}
async function normalMapDialog(){try{await exportNormalMap(frameCanvas(fi),{modal,$,showError,saveData,name:doc.name,message});}catch(error){showError('法线贴图导出失败：'+error.message);}}
async function exportDialog(defaultMode='png'){
  const form=$('modal-form');let settings=readExportSettings(localStorage);
  const writeSettings=next=>{settings=next;localStorage.setItem(EXPORT_SETTINGS_KEY,JSON.stringify(settings));};
  const readOptions=(mode=form.elements.mode.value)=>{const options={mode};for(const key of ['scale','columns','margin','gapX','gapY','colors','threshold','extrude'])options[key]=+form.elements[key].value;for(const key of ['format','order','direction','repeat','alphaMode','matte','engineFormat'])options[key]=form.elements[key].value;options.trim=form.elements.trim.checked;options.pack=form.elements.pack.checked;return pickExportOptions(options);};
  const applyOptions=options=>{for(const [key,value]of Object.entries(options)){if(form.elements[key].type==='checkbox')form.elements[key].checked=value;else form.elements[key].value=value;}};
  const remember=()=>writeSettings(rememberExportOptions(settings,readOptions()));
  const layerPlan=()=>exportLayerPlan(doc,form.elements.layerScope.value,li,[...$('export-layer-list').querySelectorAll('input:checked')].map(input=>+input.value));
  const values=await modal('导出作品','<div class="export-presets"><label>导出预设<select name="preset"><option value="">当前设置</option></select></label><div><input name="presetName" placeholder="预设名称" maxlength="40" aria-label="预设名称"><button type="button" id="save-export-preset">保存预设</button><button type="button" id="delete-export-preset">删除</button></div><p id="export-preset-status"></p></div><label>导出内容 <select name="mode"><option value="png">单一图像</option><option value="gif">动画</option><option value="sheet">动画精灵表</option><option value="metadata">精灵表帧信息 JSON</option><option value="sheet-pair">精灵表图像 + JSON</option><option value="sequence">PNG 序列 + 时长清单</option><option value="normal-map">导出法线贴图</option></select></label><label id="export-format">文件格式 <select name="format"></select></label><label id="export-scope">帧范围 <select name="scope"></select></label><label>放大倍数 <input type="number" name="scale" value="1" min="1" max="8" required></label><label id="export-columns">精灵表列数 <input type="number" name="columns" value="'+Math.min(8,doc.frames.length)+'" min="1" max="256" required></label><label id="engine-format">引擎格式<select name="engineFormat"><option value="native">MinePix JSON</option><option value="phaser">Phaser 3 图集 + 动画</option><option value="godot">Godot 4 SpriteFrames</option></select></label><div id="export-layers"><label>图层范围<select name="layerScope"><option value="visible">全部可见图层</option><option value="current">当前图层（包括隐藏）</option><option value="custom">指定图层（包括隐藏）</option></select></label><div id="export-layer-list"></div><p id="export-layer-info"></p></div><div id="sheet-options" class="sheet-fields"><label>四边边距<input name="margin" type="number" min="0" max="512" value="0" required></label><label>水平间距<input name="gapX" type="number" min="0" max="512" value="0" required></label><label>垂直间距<input name="gapY" type="number" min="0" max="512" value="0" required></label><label>排列方向<select name="order"><option value="rows">逐行</option><option value="columns">逐列</option></select></label></div><div id="atlas-options" class="sheet-fields"><label>自动裁边<input name="trim" type="checkbox"></label><label>紧密打包<input name="pack" type="checkbox"></label><label>边缘挤出 (px)<input name="extrude" type="number" min="0" max="16" value="0" required></label></div><div id="gif-options"><label>方向 <select name="direction"><option value="tag">标签默认 / 正向</option><option value="timeline">时间轴顺序</option><option value="reverse">反向</option><option value="pingpong">往返</option></select></label><label>播放 <select name="repeat"><option value="loop">无限循环</option><option value="once">单次</option></select></label><label>颜色数 <input name="colors" type="number" min="2" max="256" value="256" required></label><label>透明处理 <select name="alphaMode"><option value="threshold">透明阈值</option><option value="matte">合成到背景色</option></select></label><label>透明阈值 <input name="threshold" type="number" min="0" max="255" value="127" required></label><label>背景色 <input name="matte" type="color" value="#ffffff"></label><p>GIF 每帧最多 256 色；WebP 保留 RGBA。时长按毫秒写入，往返不重复端点。</p></div><p id="export-note"></p>',()=>{
    const syncScopeControl=()=>{const current=form.elements.scope.value,selected=frameSelection.size;form.elements.scope.replaceChildren(new Option('全部帧','all'),...(selected?[new Option('选中帧','selected')]:[]),...doc.tags.map(tag=>new Option(tag.name,tag.id)));form.elements.scope.value=[...form.elements.scope.options].some(option=>option.value===current)?current:'all';};form.elements.mode.value=defaultMode;syncScopeControl();const playRange=$('play-range').value;if([...form.elements.scope.options].some(option=>option.value===playRange))form.elements.scope.value=playRange;
    for(const index of [...doc.layers.keys()].reverse()){const layer=doc.layers[index],label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');input.type='checkbox';input.value=index;input.checked=layer.visible;name.textContent=layer.name+(!layer.visible?' · 隐藏':'')+(layer.locked?' · 锁定':'')+` · ${layer.opacity}%`;label.append(input,name);$('export-layer-list').append(label);}
    const updateLayers=()=>{const custom=form.elements.layerScope.value==='custom';$('export-layer-list').hidden=!custom;for(const input of $('export-layer-list').querySelectorAll('input'))input.disabled=!custom||$('export-layers').hidden;try{const plan=layerPlan();$('export-layer-info').textContent=`将合成 ${plan.indices.length} 个图层；保留层序与不透明度。锁定不影响导出。`;}catch(error){$('export-layer-info').textContent=error.message;}};
    form.elements.layerScope.onchange=updateLayers;$('export-layer-list').onchange=updateLayers;
    const update=()=>{const mode=form.elements.mode.value,scopeHidden=mode==='png';$('export-scope').hidden=scopeHidden;form.elements.scope.disabled=scopeHidden;if(!scopeHidden)syncScopeControl();const gif=mode==='gif',sheet=['sheet','metadata','sheet-pair'].includes(mode),formatVisible=!['metadata','sheet-pair','sequence'].includes(mode),previous=form.elements.format.value,formats=exportFormatsFor(mode);form.elements.format.replaceChildren(...formats.map(format=>new Option(formatLabel(format),format)));form.elements.format.value=formats.includes(previous)?previous:(mode==='gif'?'gif':'png');$('export-format').hidden=!formatVisible;form.elements.format.disabled=!formatVisible;$('engine-format').hidden=mode!=='sheet-pair';form.elements.engineFormat.disabled=mode!=='sheet-pair';$('export-layers').hidden=!sheet;form.elements.layerScope.disabled=!sheet;updateLayers();$('sheet-options').hidden=!sheet;$('atlas-options').hidden=!sheet;for(const element of $('atlas-options').querySelectorAll('input'))element.disabled=!sheet;for(const element of $('sheet-options').querySelectorAll('input,select'))element.disabled=!sheet;$('gif-options').hidden=!gif;$('export-columns').hidden=!sheet;form.elements.columns.disabled=!sheet;for(const element of $('gif-options').querySelectorAll('input,select'))element.disabled=!gif;form.elements.threshold.disabled=!gif||form.elements.format.value!=='gif'||form.elements.alphaMode.value!=='threshold';form.elements.matte.disabled=!gif||form.elements.format.value!=='gif'||form.elements.alphaMode.value!=='matte';$('export-note').textContent=mode==='sequence'?'按时间轴顺序导出 PNG 和 animation.json（文件名、源帧、时长、标签）。选择父目录后创建新文件夹，已有同名目录自动编号，不覆盖。':gif?'按范围及方向导出；GIF 与 WebP 最多 256 个输出帧。': '单一图像导出当前帧；精灵表按时间轴顺序输出。CSS 与 SVG 保留像素边缘，JPEG/JPG 与 BMP 将透明区域合成到白色。';};
    const initialOptions=restoredExportOptions(settings,defaultMode,doc.frames.length);applyOptions(initialOptions);
    const drafts={},refreshPresets=()=>{form.elements.preset.replaceChildren(new Option('当前设置',''),...BUILTIN_EXPORT_PRESETS.map(p=>new Option(p.name,p.id)),...settings.presets.map(p=>new Option(p.name,p.id)));$('delete-export-preset').disabled=true;};
    let activeFamily=exportFamily(defaultMode);
    form.elements.mode.onchange=()=>{const mode=form.elements.mode.value;if(mode==='normal-map'){$('modal').close('normal-map');return;}drafts[activeFamily]=readOptions(activeFamily==='sheet'?'sheet-pair':activeFamily);activeFamily=exportFamily(mode);applyOptions({...restoredExportOptions(settings,mode,doc.frames.length),...drafts[activeFamily],mode});form.elements.preset.value='';$('delete-export-preset').disabled=true;update();};
    form.elements.alphaMode.onchange=update;
    form.elements.format.onchange=update;
    form.elements.preset.onchange=()=>{const preset=[...BUILTIN_EXPORT_PRESETS,...settings.presets].find(p=>p.id===form.elements.preset.value);if(!preset)return;applyOptions(preset.options);activeFamily=exportFamily(preset.options.mode);form.elements.presetName.value=settings.presets.includes(preset)?preset.name:'';$('delete-export-preset').disabled=!settings.presets.includes(preset);$('export-preset-status').textContent='预设已应用；帧范围保持当前选择';update();};
    $('save-export-preset').onclick=()=>{try{if(!form.reportValidity())return;const next=saveExportPreset(settings,form.elements.presetName.value,readOptions(),crypto.randomUUID());writeSettings(next);refreshPresets();const preset=settings.presets.find(p=>p.name===form.elements.presetName.value.trim());form.elements.preset.value=preset.id;$('delete-export-preset').disabled=false;$('export-preset-status').textContent='预设已保存到本机（同名会更新）';}catch(error){$('export-preset-status').textContent=error.message;}};
    $('delete-export-preset').onclick=()=>{writeSettings(deleteExportPreset(settings,form.elements.preset.value));refreshPresets();form.elements.presetName.value='';$('export-preset-status').textContent='预设已删除，当前参数保留';};
    refreshPresets();update();if(exportFormatsFor(defaultMode).includes(initialOptions.format))form.elements.format.value=initialOptions.format;update();
  },v=>{
    const animated=['gif','sequence'].includes(v.mode),indices=v.mode==='gif'?animationIndices(doc,v.scope,frameSelection,v.direction):scopeFrames(doc,v.scope,frameSelection),cols=Math.min(+v.columns||1,indices.length),rows=Math.ceil(indices.length/cols),scale=+v.scale;
    if(['sheet','metadata','sheet-pair'].includes(v.mode))layerPlan();
    const layout=['sheet','metadata','sheet-pair'].includes(v.mode)?(()=>{const m=atlasMetadata(layerPlan().document,indices,{columns:cols,scale,...sheetOptions(form)});return{width:m.size.w,height:m.size.h};})():{width:doc.width*scale,height:doc.height*scale};const w=layout.width,h=layout.height,pixels=w*h*(animated?indices.length:1);
    if(animated&&indices.length>256)throw new Error('动画输出最多 256 帧，请缩小范围或使用非往返方向');if(pixels>32*1024*1024||w>16384||h>16384)throw new Error('导出图像过大，请减少放大倍数或调整范围');
  });
  if(!values){if($('modal').returnValue==='normal-map')await normalMapDialog();return;}setBusy(true);
  try{
    const {mode}=values,scale=+values.scale,indices=mode==='gif'?animationIndices(doc,values.scope,frameSelection,values.direction):scopeFrames(doc,values.scope,frameSelection),cols=Math.min(+values.columns||1,indices.length);let ok;
    if(['gif','sequence'].includes(mode)){
      if(!window.desktop)throw new Error('动画导出请使用 桌面版');
      const format=mode==='gif'?values.format:mode,output=document.createElement('canvas');output.width=doc.width*scale;output.height=doc.height*scale;const context=output.getContext('2d',{willReadFrequently:format==='gif'});context.imageSmoothingEnabled=false;const frames=[];
      for(const sourceIndex of indices){context.clearRect(0,0,output.width,output.height);context.drawImage(frameCanvas(sourceIndex),0,0,output.width,output.height);frames.push({duration:doc.frames[sourceIndex].duration,sourceIndex,...(format==='gif'?{rgba:context.getImageData(0,0,output.width,output.height).data}:format==='webp'?{webp:output.toDataURL('image/webp',1).split(',')[1]}:{png:output.toDataURL('image/png').split(',')[1]})});await new Promise(resolve=>setTimeout(resolve,0));}
      if(format==='webp'){const data=encodeAnimatedWebp(frames,output.width,output.height,form.elements.repeat.value==='loop'),result=await saveData(data,'webp',doc.name,true);if(result)remember();message(result?'导出完成':'已取消导出');return;}
      const result=await window.desktop.exportAnimation({format,name:doc.name,width:output.width,height:output.height,frames,tags:animationTags(doc,indices),colors:+form.elements.colors.value,threshold:+form.elements.threshold.value,alphaMode:form.elements.alphaMode.value,matte:form.elements.matte.value,loop:form.elements.repeat.value==='loop'});
      if(result)remember();message(result?'导出完成 · '+(result.folder||result.filePath):'已取消导出');return;
    }
    const isSheet=['sheet','metadata','sheet-pair'].includes(mode),layers=isSheet?layerPlan():null,metadata=isSheet?{...atlasMetadata(layers.document,indices,{columns:cols,scale,...sheetOptions(form)}),layerScope:values.layerScope,sourceLayers:layers.sourceLayers}:null;
    {const c=document.createElement('canvas');c.width=metadata?.size.w||doc.width*scale;c.height=metadata?.size.h||doc.height*scale;const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=false;if(isSheet)metadata.frames.forEach(item=>drawAtlasFrame(cx,imageCanvas(composite(layers.document,item.sourceIndex)),item,scale,metadata.extrude));else cx.drawImage(frameCanvas(fi),0,0,c.width,c.height);const png=c.toDataURL('image/png').split(',')[1],format=values.format||'png';
      if(mode==='metadata'){if(!window.desktop)throw new Error('关联 PNG 元数据导出请使用桌面应用');ok=await window.desktop.exportSheetMetadata({name:doc.name,png,metadata});}
      else if(mode==='sheet-pair'){if(!window.desktop)throw new Error('配对导出请使用桌面应用');const result=await window.desktop.exportSheet({name:doc.name,png,metadata,engineFormat:values.engineFormat});if(result)remember();message(result?'导出完成 · '+result.folder:'已取消导出');return;}
      else if(format==='gif'){const rgba=cx.getImageData(0,0,c.width,c.height).data,result=await window.desktop.exportAnimation({format:'gif',name:doc.name+(isSheet?'-sheet':''),width:c.width,height:c.height,frames:[{duration:doc.frames[fi].duration,sourceIndex:fi,rgba}],tags:[],colors:+form.elements.colors.value||256,threshold:+form.elements.threshold.value||127,alphaMode:form.elements.alphaMode.value||'threshold',matte:form.elements.matte.value||'#ffffff',loop:false});ok=!!result;}
      else {const encoded=encodeCanvas(c,format);ok=await saveData(encoded.data,format,doc.name+(isSheet?'-sheet':''),encoded.binary);}}
    if(ok)remember();message(ok?'导出完成':'已取消导出');
  }catch(error){showError('导出失败：'+error.message);}finally{setBusy(false);}
}

function canvasEdit(fn,text){mutate(()=>{fn();selection=null;},text);fit();}
async function tagEditor(id=null){
  if(!id&&doc.tags.length>=256)return message('最多 256 个动画标签');
  const tag=doc.tags.find(tag=>tag.id===id),indices=sortedFrames(frameSelection);
  const values=await modal(tag?'编辑动画标签':'新建动画标签','<label>名称 <input name="name" type="text" maxlength="80" required></label><label>颜色 <input name="color" type="color"></label><label>起始帧 <input name="from" type="number" min="1" max="'+doc.frames.length+'" required></label><label>结束帧 <input name="to" type="number" min="1" max="'+doc.frames.length+'" required></label><label>默认方向 <select name="direction"><option value="forward">正向</option><option value="reverse">反向</option><option value="pingpong">往返</option></select></label><p>标签使用连续帧范围。重排后跟随原成员的最小至最大位置，可能包含中间的其他帧；删除全部成员时自动移除标签。</p>',form=>{
    form.elements.name.value=tag?.name||`动画 ${doc.tags.length+1}`;form.elements.color.value=tag?.color||'#edb75b';form.elements.from.value=(tag?.from??indices[0])+1;form.elements.to.value=(tag?.to??indices.at(-1))+1;form.elements.direction.value=tag?.direction||'forward';
  },v=>{if(!v.name.trim())throw new Error('请输入标签名称');if(+v.from>+v.to)throw new Error('起始帧不能晚于结束帧');});
  if(!values)return;
  const next={id:tag?.id||crypto.randomUUID(),name:values.name.trim(),color:values.color,from:+values.from-1,to:+values.to-1,direction:values.direction};
  mutate(()=>{if(tag)doc.tags[doc.tags.findIndex(t=>t.id===id)]=next;else doc.tags.push(next);},tag?'已更新动画标签':'已新建动画标签');
  activateTag(next.id);
}
function editCels(fn,text){
  if(!celRange)return message('请先选择 cel 矩形范围');
  if(playing)return message('请先暂停播放再编辑 cel');
  const before=clone(doc);
  try{fn();if(history.push(before,doc))changed();render();message(text);}
  catch(error){doc=before;render();showError(error.message);}
}
async function celMoveDialog(){
  if(!celRange)return message('请先选择 cel 矩形范围');if(playing)return message('请先暂停播放再编辑 cel');
  const range={...celRange};
  const values=await modal('移动 cel 范围','<label>帧偏移 <input name="frames" type="number" min="'+(-range.fromFrame)+'" max="'+(doc.frames.length-1-range.toFrame)+'" value="0" required></label><label>图层偏移 <input name="layers" type="number" min="'+(-range.fromLayer)+'" max="'+(doc.layers.length-1-range.toLayer)+'" value="0" required></label><p>正帧偏移向右，正图层偏移向上。整组覆盖目标 cel（含透明像素），保留帧时长、标签和图层属性；重叠移动先保存源内容。锁定 / 隐藏来源或目标整组拒绝，越界不裁剪。</p>');
  if(values)editCels(()=>{const active={frame:fi+ +values.frames,layer:li+ +values.layers};adoptCelRange(moveCels(doc,range,+values.frames,+values.layers),active);},'已移动 cel 范围');
}
function flipCelRange(axis){
  if(!celRange)return message('请先选择 cel 矩形范围');const bounds=celContentBounds(doc,celRange);if(!bounds)return message('所选 cel 没有可见像素');
  editCels(()=>flipCels(doc,celRange,bounds,axis),'已按共同内容边界翻转 cel 范围');
}
async function transformSelection(bulk=false){
  if(transformSession)return;
  let range=null,bounds=null;
  if(bulk){
    if(!celRange)return message('请先选择 cel 矩形范围');if(playing)return message('请先暂停播放再编辑 cel');
    range={...celRange};try{assertEditableCels(doc,range);}catch(error){return showError(error.message);}
    bounds=celContentBounds(doc,range);if(!bounds)return message('所选 cel 没有可见像素');
  }else{if(!editable())return;if(!selection?.w||!selection?.h)return message('请先建立非空选区');}
  const before=clone(doc),oldSelection=selection,region=bulk?bounds:copyRegion(doc,pixels(),selection);
  const session={before,state:{...transformState(region),algorithm:localStorage.getItem('pixel-studio-rotation-algorithm')||'fast'}};if(bulk)session.regions=new Map(celTargets(range).map(({frame,layer})=>[frame+':'+layer,copyRegion(before,celPixels(before,frame,layer),bounds)]));transformSession=session;
  setPreviewUI(true);
  $('modal').classList.add('transform-dialog');
  session.preview=()=>{
    if(bulk){
      for(const {frame,layer}of celTargets(range)){doc.frames[frame].celProperties=structuredClone(before.frames[frame].celProperties);doc.frames[frame].cels[layer]=[...before.frames[frame].cels[layer]];if(before.frames[frame].indices)doc.frames[frame].indices[layer]=before.frames[frame].indices[layer].slice();}
      transformCels(doc,range,bounds,session.state,session.regions);onionCache.clear();frameCache.clear();referenceCache.clear();selection=null;
    }else{
      doc.frames[fi].celProperties=structuredClone(before.frames[fi].celProperties);doc.frames[fi].cels[li]=[...before.frames[fi].cels[li]];if(before.frames[fi].indices)doc.frames[fi].indices[li]=before.frames[fi].indices[li].slice();
      const transformed=transformSelectionRegion(region,session.state);clearRegion(doc,pixels(),oldSelection);pasteRegion(doc,pixels(),transformed,transformed.x,transformed.y,null,true);selection=selectionFrom(doc,(x,y)=>selectionContains(transformed,x,y));
    }draw();
  };
  const read=form=>{
    if(!form.checkValidity())return;
    if(['pivotX','pivotY'].includes(session.inputName))session.state=relocatePivot(session.state,{x:+form.elements.pivotX.value,y:+form.elements.pivotY.value});
    else for(const key of ['width','height','angle','x','y'])session.state[key]=+form.elements[key].value;
    session.state.algorithm=form.elements.algorithm.value;session.sync();session.preview();
  };
  const pending=modal(bulk?`批量变换 ${celTargets(range).length} 个 cel`:'缩放 / 旋转选区','<label>旋转算法<select name="algorithm"><option value="fast">快速旋转</option><option value="rotsprite">RotSprite</option></select></label><label>宽度 <input name="width" type="number" min="1" required></label><label>高度 <input name="height" type="number" min="1" required></label><label>角度 <input name="angle" type="number" min="-360" max="360" step="any" required>°</label><label>未旋转框 X <input name="x" type="number" step="any" required></label><label>未旋转框 Y <input name="y" type="number" step="any" required></label><label>旋转中心 X <input name="pivotX" type="number" step="any" required></label><label>旋转中心 Y <input name="pivotY" type="number" step="any" required></label><p>'+(bulk?'以所有选中 cel 的共同内容边界变换，忽略画布像素选区；不改时长或标签，画布外像素裁剪。':'')+'拖动边角缩放、框内移动、框外圆柄旋转、十字圆心改旋转中心。Shift：角柄保持比例，旋转吸附 15°。中心移动保持图像位置；像素按网格取整。Enter 确定，Esc 取消。</p>',form=>{
    session.sync=()=>{
      const pivot=transformPoint(session.state,session.state.u,session.state.v);
      for(const key of ['width','height','angle','x','y'])form.elements[key].value=Number(session.state[key].toFixed(4));
      form.elements.algorithm.value=session.state.algorithm;form.elements.pivotX.value=Number(pivot.x.toFixed(4));form.elements.pivotY.value=Number(pivot.y.toFixed(4));
    };
    session.sync();form.oninput=event=>{session.inputName=event.target.name;read(form);};
  },null,{modeless:true});
  session.preview();const values=await pending;
  finishTransformDrag();
  if(values){session.inputName=null;read($('modal-form'));}
  $('modal-form').oninput=null;$('modal').classList.remove('transform-dialog');setPreviewUI(false);transformSession=null;
  if(values){localStorage.setItem('pixel-studio-rotation-algorithm',session.state.algorithm);if(bulk)selection=oldSelection;if(history.push(before,doc))changed();render();message(bulk?'已批量变换 cel':'已变换选区');}
  else{doc=before;selection=oldSelection;onionCache.clear();frameCache.clear();referenceCache.clear();render();message('已取消变换');}
}
async function canvasSizeDialog(){
  const values=await modal('调整画布','<label>宽度 <input name="width" type="number" min="1" required></label><label>高度 <input name="height" type="number" min="1" required></label><label>锚点 <select name="anchor"><option value="top-left">左上</option><option value="top">上</option><option value="top-right">右上</option><option value="left">左</option><option value="center" selected>中心</option><option value="right">右</option><option value="bottom-left">左下</option><option value="bottom">下</option><option value="bottom-right">右下</option></select></label><p>调整所有图层与帧，不缩放像素。扩展部分透明；缩小会裁剪边缘，可撤销。</p>',form=>{form.elements.width.value=doc.width;form.elements.height.value=doc.height;});
  if(values)canvasEdit(()=>resizeCanvas(doc,+values.width,+values.height,values.anchor),'已调整全部帧的画布尺寸');
}
// 替换颜色：对应 Aseprite 编辑→替换颜色（Shift+R），容差 0-255 单值滑杆。
async function replaceColorDialog(){
  if(!editable())return;
  const values=await modal('替换颜色','<div class="sheet-fields"><label>原颜色 <input name="from" type="color" required></label><label>新颜色 <input name="to" type="color" required></label><label>容差 <input name="tolerance" type="number" min="0" max="255" value="'+DEFAULT_TOLERANCE+'" required></label><label>范围 <select name="scope"><option value="cel">当前 cel</option><option value="layer">当前层全部帧</option><option value="sprite">整个精灵</option></select></label></div><p>容差 0 表示必须完全相等，255 命中任意颜色，按 RGBA 四通道最大差值判定。索引色缺少目标色时自动加入色板（最多 256 色）。可撤销。</p>',form=>{form.elements.from.value=color.slice(0,7);form.elements.to.value=background.slice(0,7);},v=>{if(+v.tolerance<0||+v.tolerance>255)throw new Error('容差需在 0-255 之间');});
  if(!values)return;
  const options={from:values.from,to:values.to,tolerance:+values.tolerance,scope:values.scope,frame:fi,layer:li,selection};
  const count=replaceColorInDocument(clone(doc),options);
  if(!count)return message('没有匹配的颜色');
  mutate(()=>replaceColorInDocument(doc,options),'已替换 '+count+' 个像素');
}
// 图像大小：缩放全部图层与帧（Aseprite 精灵→图像大小，Ctrl+Alt+I），与只改画布的「画布」命令语义不同。
async function spriteSizeDialog(){
  if(busy||playing)return message('请先暂停播放再缩放精灵');
  const ratio=doc.width/doc.height;
  const values=await modal('图像大小','<div class="sheet-fields"><label>宽度 px <input name="width" type="number" min="1" required></label><label>高度 px <input name="height" type="number" min="1" required></label><label>宽度 % <input name="widthPerc" type="number" min="0.01" step="any" required></label><label>高度 % <input name="heightPerc" type="number" min="0.01" step="any" required></label><label>锁定比例 <input name="lockRatio" type="checkbox" role="switch" checked></label><label>插值 <select name="method"><option value="nearest">最近邻（像素画）</option><option value="bilinear">双线性</option></select></label></div><p>缩放所有图层与帧的像素，画布尺寸随内容一起变化；「画布」命令只改画布、不缩放内容。最近邻保持硬边，双线性适合缩放的平滑素材。可撤销。</p>',form=>{
    const w=form.elements.width,h=form.elements.height,wp=form.elements.widthPerc,hp=form.elements.heightPerc,lock=form.elements.lockRatio;
    w.value=doc.width;h.value=doc.height;wp.value=100;hp.value=100;
    const syncPerc=()=>{wp.value=+(+w.value/doc.width*100).toFixed(4);hp.value=+(+h.value/doc.height*100).toFixed(4);};
    const syncHeight=()=>{if(!lock.checked||!+w.value)return;h.value=Math.max(1,Math.round(+w.value/ratio));};
    w.oninput=()=>{syncHeight();syncPerc();};h.oninput=syncPerc;
    wp.oninput=()=>{if(+wp.value>0)w.value=Math.max(1,Math.round(doc.width*+wp.value/100));syncHeight();hp.value=+(+h.value/doc.height*100).toFixed(4);};
    hp.oninput=()=>{if(+hp.value>0)h.value=Math.max(1,Math.round(doc.height*+hp.value/100));};
    lock.onchange=syncHeight;
  },v=>{assertProjectCapacity(doc,{width:+v.width,height:+v.height,pixels:+v.width*+v.height*doc.layers.length*doc.frames.length});if(+v.width===doc.width&&+v.height===doc.height)throw new Error('精灵尺寸未改变');});
  if(!values)return;
  const width=+values.width,height=+values.height;
  canvasEdit(()=>spriteSize(doc,width,height,values.method),'已缩放精灵为 '+width+' × '+height);
}
// 网格设置：Aseprite 视图→网格→网格设置，仅菜单入口、无默认快捷键。
async function gridSettingsDialog(){
  const values=await modal('网格设置','<div class="sheet-fields"><label>偏移 X <input name="x" type="number" min="-4096" max="4096" required></label><label>偏移 Y <input name="y" type="number" min="-4096" max="4096" required></label><label>宽度 <input name="w" type="number" min="1" required></label><label>高度 <input name="h" type="number" min="1" required></label></div><p>网格从偏移处开始按宽高铺满画布，与像素网格相互独立；显示开关在画布右上角。只作编辑参考，不写入项目、预览或导出。</p>',form=>{for(const key of ['x','y','w','h'])form.elements[key].value=gridSettings[key];},v=>{validateGrid({x:+v.x,y:+v.y,w:+v.w,h:+v.h});});
  if(!values)return;
  gridSettings=validateGrid({x:+values.x,y:+values.y,w:+values.w,h:+values.h,visible:gridSettings.visible});
  saveGrid(localStorage,gridSettings);syncGridGuideLabel();drawOverlay();message('已更新网格设置');
}
function trimCanvas(){const bounds=contentBounds(doc);if(!bounds)return message('所有图层与帧都没有非透明像素');if(bounds.w===doc.width&&bounds.h===doc.height)return message('画布已无透明边缘');canvasEdit(()=>reframe(doc,bounds),'已按所有图层与帧的内容裁边');}
async function settingsDialog(){const local={...DEFAULT_APPLICATION,...JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)||'{}')},defaultCanvas=validateCanvasBackground(local.canvasBackground||DEFAULT_CANVAS_BACKGROUND),currentCanvas=validateCanvasBackground(doc.canvasBackground||defaultCanvas);await applicationSettings({modal,state:{appearance:{...local,grid:$('grid').checked,symmetry:$('symmetry').checked},canvasBackground:{defaultSize:defaultCanvas.size,defaultColor1:defaultCanvas.color1,defaultColor2:defaultCanvas.color2,currentSize:currentCanvas.size,currentColor1:currentCanvas.color1,currentColor2:currentCanvas.color2},visual:{theme:getTheme(),...getAppearance()},input:inputPreferences,pen:penPreferences,brush:{size:brush,...brushSettings},onion:{...onionSettings,enabled:$('onion').checked},keys:keymap,exportState:readExportSettings(localStorage),frameCount:doc.frames.length},apply:settings=>{
 inputPreferences=settings.input;rightButtonMode=inputPreferences.right;penPreferences=settings.pen;keymap=settings.keys;const {size,...brushValue}=settings.brush;brush=size;brushSettings=brushValue;const {enabled,...onionValue}=settings.onion;onionSettings=onionValue;$('onion').checked=enabled;saveOnionPreferences();
 const {grid,symmetry,width,height,duration,language}=settings.appearance,nextDefault=validateCanvasBackground({size:settings.canvasBackground.defaultSize,color1:settings.canvasBackground.defaultColor1,color2:settings.canvasBackground.defaultColor2}),nextCurrent=validateCanvasBackground({size:settings.canvasBackground.currentSize,color1:settings.canvasBackground.currentColor1,color2:settings.canvasBackground.currentColor2});if(JSON.stringify(nextCurrent)!==JSON.stringify(doc.canvasBackground||defaultCanvas))mutate(()=>{doc.canvasBackground=nextCurrent;},'已更新当前项目透明背景');setTheme(settings.visual.theme);setAppearance(settings.visual);$('grid').checked=grid;syncGridLabel();$('symmetry').checked=symmetry;localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify({width,height,duration,grid,symmetry,language,canvasBackground:nextDefault}));persistLocale(language);localStorage.setItem(INPUT_KEY,JSON.stringify(inputPreferences));localStorage.setItem(PEN_KEY,JSON.stringify(penPreferences));localStorage.setItem(KEYMAP_KEY,JSON.stringify(keymap));localStorage.setItem(EXPORT_SETTINGS_KEY,JSON.stringify({...settings.exportState,last:settings.exports}));saveColorPreferences();updateBrushControls();refreshKeymapLabels();onionCache.clear();render();message('软件设置已保存到本机');
 },dispatch});}
async function penDialog(){const values=await modal('数位笔与触控','<label>笔压控制<select name="mode"><option value="none">关闭</option><option value="size">笔刷大小</option><option value="opacity">绘画透明度</option><option value="both">大小与透明度</option></select></label><label>压力曲线<input name="gamma" type="number" min=".25" max="4" step=".05" required></label><label>最小笔刷比例<input name="minSize" type="number" min=".01" max="1" step=".01" required></label><label>启用笔尾橡皮<input name="eraser" type="checkbox"></label><label>单指触控<select name="touch"><option value="pan">平移画布</option><option value="draw">当前工具绘画</option></select></label><p>笔压仅影响自由铅笔 / 橡皮；鼠标保持固定笔刷。压感笔画期间暂停像素完美转角处理；同笔画按最高覆盖强度沉积，不反复累加或因减压变淡。曲线小于 1 更灵敏，大于 1 需更大压力。支持浏览器合并采样。</p>',form=>{for(const [key,value]of Object.entries(penPreferences)){if(key==='eraser')form.elements[key].checked=value;else form.elements[key].value=value;}},v=>validatePen({...v,gamma:+v.gamma,minSize:+v.minSize,eraser:$('modal-form').elements.eraser.checked}));if(values){penPreferences=validatePen({...values,gamma:+values.gamma,minSize:+values.minSize,eraser:$('modal-form').elements.eraser.checked});localStorage.setItem(PEN_KEY,JSON.stringify(penPreferences));message('数位笔设置已保存到本机');}}
async function inputDialog(){const values=await modal('鼠标与滚轮','<label>左键<select name="left"><option value="tool">当前工具</option><option value="pan">平移</option><option value="eyedropper">吸色</option></select></label><label>右键<select name="right"><option value="erase">擦除</option><option value="background">背景色</option><option value="pan">平移</option><option value="eyedropper">吸色</option></select></label><label>滚轮<select name="wheel"><option value="zoom">缩放</option><option value="pan">平移</option><option value="frames">切帧</option><option value="brush">笔刷大小</option></select></label><label>反向滚动<input type="checkbox" name="invert"></label><label>中键平移<input type="checkbox" name="middlePan"></label><label>缩放步长<input name="zoomStep" type="number" min="1.05" max="2" step=".05" required></label><label>平移速度<input name="panSpeed" type="number" min=".25" max="4" step=".25" required></label><p>Ctrl / Cmd + 滚轮始终缩放；滚轮平移时 Shift 改为水平。按住空格仍可临时平移。绘画中的输入设置不会改变已开始的笔画。</p>',form=>{for(const [key,value]of Object.entries(inputPreferences)){if(form.elements[key].type==='checkbox')form.elements[key].checked=value;else form.elements[key].value=value;}},v=>validateInput({...v,invert:$('modal-form').elements.invert.checked,middlePan:$('modal-form').elements.middlePan.checked,zoomStep:+v.zoomStep,panSpeed:+v.panSpeed}));if(values){inputPreferences=validateInput({...values,invert:$('modal-form').elements.invert.checked,middlePan:$('modal-form').elements.middlePan.checked,zoomStep:+values.zoomStep,panSpeed:+values.panSpeed});rightButtonMode=inputPreferences.right;saveColorPreferences();renderColors();syncInteraction();message('鼠标设置已保存到本机');}}
function toolInfo(name){return tools.find(item=>item[0]===name);}
function toolKeys(name){return [...new Set([...(keymap.bindings['tool:'+name]||[]),...(keymap.bindings[name]||[])])];}
function setToolSlotContent(button,name){const [,icon,label]=toolInfo(name),keys=toolKeys(name);button.dataset.tool=name;button.innerHTML=iconMarkup(icon)+`<span class="tool-key">${keys[0]||'—'}</span>`+(button.dataset.groupSize>1?'<span class="tool-group-mark" aria-hidden="true">▸</span>':'');button.title=label+' ('+(keys.join(' / ')||'未绑定')+')';button.setAttribute('aria-label',label+(button.dataset.groupSize>1?'，点击选择同组工具':''));button.setAttribute('aria-keyshortcuts',keys.join(' '));}
function selectionToolId(){return $('selection-kind').value==='rect'?'select':'selection-'+$('selection-kind').value;}
function syncToolSlots(selected=tool){if(selected==='select')selected=selectionToolId();for(const button of uiAll('#tools [data-tool-group]')){const group=button.dataset.toolGroup.split(',');if(group.includes(selected))setToolSlotContent(button,selected);}}
function refreshKeymapLabels(){for(const button of uiAll('#tools [data-tool-group]'))setToolSlotContent(button,button.dataset.tool);for(const button of uiAll('.tool-group-menu [data-tool-option]')){const [,icon,label]=toolInfo(button.dataset.toolOption),keys=toolKeys(button.dataset.toolOption);button.innerHTML=iconMarkup(icon)+`<span>${label}</span><kbd>${keys[0]||'—'}</kbd>`;button.title=label+' ('+(keys.join(' / ')||'未绑定')+')';}for(const button of uiAll('[data-action]')){const keys=keymap.bindings[button.dataset.action];if(!keys)continue;button.title=(button.getAttribute('aria-label')||button.dataset.action)+' ('+(keys.join(' / ')||'未绑定')+')';const kbd=button.querySelector('kbd');if(kbd)kbd.textContent=keys[0]||'—';if(button.dataset.action==='shortcuts'&&!button.classList.contains('visual-button'))button.querySelector('span').textContent='快捷键 '+(keys[0]||'');}window.desktop?.setKeymapLabels(Object.fromEntries(Object.entries(keymap.bindings).map(([action,keys])=>[action,keys.join(' / ')])));}
async function keymapDialog(){
 const result=await inputGuide({modal,keys:keymap,input:inputPreferences,saveData,openKeymap:()=>window.desktop.openKeymap()});
 if(result){keymap=result.keys;inputPreferences=result.input;rightButtonMode=inputPreferences.right;localStorage.setItem(KEYMAP_KEY,JSON.stringify(keymap));saveColorPreferences();renderColors();refreshKeymapLabels();syncInteraction();message('快捷键与鼠标设置已保存到本机');}
}
async function exportAsepriteDialog(){
 const label=modeOf(doc)==='indexed'?'INDEXED 8':modeOf(doc)==='grayscale'?'GRAY 16':'RGBA',notes=['输出全部帧及像素 / 背景层，保留当前颜色模式、分组层级、混合、共享cel、连续层、时长、色板、标签与静态切片。图层透明度按原生8位精度保存。'];
 if(doc.layers.some(isReference))notes.push('参考层仅用于编辑，不写入此素材文件。');
 if(doc.layers.some(l=>isGroup(l)&&!l.passThrough))notes.push('Aseprite 1.3不应用隔离组透明度 / 混合。与该版本交换时，请改用穿透组，或在副本中扁平化以保留外观。');
 if(doc.layers.some(l=>isGroup(l)&&l.passThrough)&&doc.layers.some(l=>isGroup(l)&&!l.passThrough))return message('ASE不能混合保留隔离与穿透组，请先统一组模式');
 const answer=await modal('导出 Aseprite '+label,notes.map(text=>'<p>'+text+'</p>').join(''));if(!answer)return;if(!window.desktop)return message('原生格式导出请使用桌面版');setBusy(true);try{const output=await window.desktop.exportAseprite(doc);message(output?'已导出 Aseprite '+label:'已取消导出');}catch(error){showError('ASE导出失败：'+error.message);}finally{setBusy(false);}
}
async function celPropertiesDialog(){
 if(!editable()||isBackground(doc.layers[li])||isReference(doc.layers[li])||isGroup(doc.layers[li]))return message('请选择普通像素 cel');
 const target=doc,frame=fi,layer=li;
 showCelProperties({trigger:uiQuery('[data-action="cel-properties"]'),initial:celProperty(doc,fi,li),apply:values=>{
  if(doc===target)mutate(()=>setCelProperty(doc,frame,layer,values),'已修改 Cel 属性');
 }});
}
async function sliceDialog(){
 const slices=doc.slices||[],form=$('modal-form');let remove=false,removeKey=false;
 const read=()=>{const slice={id:form.elements.target.value||crypto.randomUUID(),name:form.elements.sliceName.value,bounds:Object.fromEntries(['x','y','w','h'].map(k=>[k,+form.elements[k].value]))};if(form.elements.pivot.checked)slice.pivot={x:+form.elements.px.value,y:+form.elements.py.value};if(form.elements.center.checked)slice.center={x:+form.elements.cx.value,y:+form.elements.cy.value,w:+form.elements.cw.value,h:+form.elements.ch.value};const original=slices.find(s=>s.id===slice.id);return setSliceKey(original?{...original,name:slice.name}:slice,fi,validateSlices([slice],doc.width,doc.height)[0]);};
 const values=await modal('切片区域','<label>切片<select name="target"></select></label><label>名称<input name="sliceName" maxlength="80" required></label><div class="sheet-fields">'+[['x','X'],['y','Y'],['w','宽'],['h','高']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" min="${['w','h'].includes(key)?1:0}" required></label>`).join('')+'<div class="form-option-row slice-pivot-row"><label>Pivot<input name="pivot" type="checkbox"></label>'+[['px','Pivot X'],['py','Pivot Y']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" value="0" min="-65536" max="65536" required></label>`).join('')+'</div><div class="form-option-row slice-center-row"><label>九宫格<input name="center" type="checkbox"></label>'+[['cx','中心 X'],['cy','中心 Y'],['cw','中心宽'],['ch','中心高']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" value="0" min="-65536" max="65536" required></label>`).join('')+'</div></div><p id="slice-key-info"></p><button type="button" id="delete-slice-key">删除当前关键帧</button><button type="button" id="delete-slice">删除选中切片</button><p>Pivot 和九宫格坐标相对切片左上。画布裁剪会裁切区域，完全越界的切片会移除；可撤销。</p>',()=>{
 form.elements.target.replaceChildren(new Option('新区域',''),...slices.map(slice=>new Option(slice.name,slice.id)));
 const load=()=>{const original=slices.find(s=>s.id===form.elements.target.value),slice=original&&(sliceAtFrame(original,fi)||original),b=slice?.bounds||selection||{x:0,y:0,w:doc.width,h:doc.height};form.elements.sliceName.value=slice?.name||'切片 '+(slices.length+1);for(const k of ['x','y','w','h'])form.elements[k].value=b[k];form.elements.pivot.checked=!!slice?.pivot;form.elements.center.checked=!!slice?.center;for(const [key,value]of Object.entries({px:slice?.pivot?.x||0,py:slice?.pivot?.y||0,cx:slice?.center?.x||0,cy:slice?.center?.y||0,cw:slice?.center?.w||b.w,ch:slice?.center?.h||b.h}))form.elements[key].value=value;$('delete-slice').disabled=!slice;$('delete-slice-key').disabled=!original||!sliceKeys(original).some(k=>k.frame===fi);$('slice-key-info').textContent=t('当前帧')+' '+(fi+1)+' · '+t('修改会在当前帧建立切片关键帧');};form.elements.target.onchange=load;$('delete-slice-key').onclick=()=>{removeKey=true;$('modal').close('ok');};$('delete-slice').onclick=()=>{remove=true;$('modal').close('ok');};form.elements.target.value=slices.some(s=>s.id===activeSliceId)?activeSliceId:'';load();
 },()=>{if(!remove&&!removeKey)read();});
 if(!values)return;const next=remove?null:removeKey?deleteSliceKey(slices.find(s=>s.id===values.target),fi):read();mutate(()=>{doc.slices=validateSlices(remove||!next?slices.filter(s=>s.id!==values.target):values.target?slices.map(s=>s.id===values.target?next:s):[...slices,next],doc.width,doc.height,doc.frames.length);doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'slices',...(doc.slices.some(s=>s.keys)?['slice-keyframes']:[])])];},remove?'切片已删除':'切片已保存');
}
const help=createHelp({desktop:window.desktop,modal,message,report:error=>showError(error.message)});
const actions={
 'help-guide':()=>help.guide(),'about':()=>help.about(),'check-updates':()=>help.check(),
  'close-document':()=>closeDocumentTab(),'reopen-document':reopenDocument,'recent-files':recentDialog,
  ...Object.fromEntries(['ellipse','lasso','polygon','wand'].map(kind=>['selection-'+kind,()=>{$('selection-kind').value=kind;setTool('select');}])),
  ...Object.fromEntries(['tools','colors','preview','layers','timeline','reference','tileset','terrain-preview'].map(id=>['panel-'+id,()=>window.workspaceLayout.togglePanel(id)])),'toggle-bottom':()=>window.workspaceLayout.toggleBottom(),'rename-layer':()=>renameLayer(),settings:settingsDialog,'reset-layout':()=>window.workspaceLayout?.reset(), 'pen-settings':penDialog,input:inputDialog,keymap:keymapDialog,slices:sliceDialog,'export-aseprite':exportAsepriteDialog,
  'copy-cels':()=>{if(!celRange)return message('请先选择 cel 矩形范围');celClipboard=copyCels(doc,celRange);syncCommandStates();message('已复制 cel 范围（独立于像素剪贴板）');},
  'cut-cels':()=>editCels(()=>{const clip=copyCels(doc,celRange);clearCels(doc,celRange);celClipboard=clip;},'已剪切 cel 范围'),
  'paste-cels':()=>{if(!celClipboard)return message('请先复制 cel 范围');editCels(()=>adoptCelRange(pasteCels(doc,celClipboard,celRange.fromFrame,celRange.toLayer)),'已覆盖粘贴 cel 范围');},
  'clear-cels':()=>editCels(()=>clearCels(doc,celRange),'已清除 cel 像素，保留帧与图层'),
  'move-cels':celMoveDialog,'transform-cels':()=>transformSelection(true),'flip-cels-x':()=>flipCelRange('x'),'flip-cels-y':()=>flipCelRange('y'),
  'deselect-cels':()=>{resetCelSelection();render(true);},
  'frame-fps':()=>{const target=doc,frames=[...frameSelection];showFrameFps({trigger:uiQuery('[data-action=frame-fps]'),initial:Number((1000/doc.frames[fi].duration).toFixed(3)),apply:fps=>{if(doc===target)mutate(()=>{for(const i of frames)doc.frames[i].duration=Math.round(1000/fps);},'已按 FPS 更新选中帧');}});},
  'frame-left':()=>reorderSelected(Math.max(0,Math.min(...frameSelection)-1)),
  'frame-right':()=>reorderSelected(Math.min(doc.frames.length,Math.max(...frameSelection)+2)),
  'reverse-frames':()=>{if(frameSelection.size<2)return;const current=doc.frames[fi];mutate(()=>{reverseFrames(doc,frameSelection);fi=doc.frames.indexOf(current);frameAnchor=fi;},'已倒序选中帧');},
  'add-tag':()=>tagEditor(),'edit-tag':()=>{const tag=selectedTag();if(tag)return tagEditor(tag.id);message('请选中某个动画标签的全部帧');},
  'delete-tag':async()=>{const tag=selectedTag();if(!tag)return;if(await modal('删除动画标签？','<p>只删除标签，保留所有帧与像素。</p>'))mutate(()=>doc.tags=doc.tags.filter(item=>item.id!==tag.id),'已删除动画标签');},
  'transform-selection':transformSelection,
  'invert-selection':()=>{previousSelection=selection;selection=invertSelection(doc,selection);drawOverlay();},
  reselect:()=>{if(previousSelection){const last=previousSelection;previousSelection=selection;selection=selectionFrom(doc,(x,y)=>selectionContains(last,x,y));drawOverlay();}},
  'select-content':()=>{previousSelection=selection;const visible=composite(doc,fi);selection=selectionFrom(doc,(x,y)=>visible[(y*doc.width+x)*4+3]>0);drawOverlay();},
  'capture-brush':captureBrush,'brush-presets':brushPresets,'save-pattern-brush':savePatternBrushToLibrary,'delete-pattern-brush':deletePatternBrushFromLibrary,
  'palette-editor':togglePaletteEditor,'import-palette':importPalette,'export-palette':exportPalette,
  'save-palette':savePaletteLibraryEntry,'delete-palette':deletePaletteLibraryEntry,'remap-indices':remapPaletteIndices,
  'extract-palette':()=>{const palette=extractPalette(composite(doc,fi));if(!palette.length)return message('当前帧没有可提取的颜色');mutate(()=>editIndexedPalette(doc,palette),'已按使用频率提取当前帧颜色',{colorsReady:true});},
  'swap-colors':()=>{[color,background]=[background,color];saveColorPreferences();renderColors();},
  flatten:async()=>{if(await modal('扁平化全部图层？','<p>将所有帧的可见内容合成为一个透明图层，同时移除隐藏图层。可以撤销。</p>'))mutate(()=>{li=flattenSprite(doc);},'已扁平化全部帧');},
  'merge-down':()=>mutate(()=>{li=mergeDown(doc,li);},'已向下合并所有帧'),
  'merge-visible':()=>mutate(()=>{li=mergeVisible(doc);},'已合并全部可见图层，隐藏图层保持独立'),
  'canvas-size':canvasSizeDialog,'trim-canvas':trimCanvas,'sprite-size':spriteSizeDialog,'replace-color':replaceColorDialog,'grid-settings':gridSettingsDialog,'toggle-grid-guide':toggleGridGuide,
  'crop-selection':()=>{if(!selection)return message('请先建立矩形选区');const bounds={...selection};canvasEdit(()=>reframe(doc,bounds),'已按选区裁剪全部帧');},
  'flip-sprite-x':()=>canvasEdit(()=>flipSprite(doc,'x'),'已翻转所有图层与帧'),
  'flip-sprite-y':()=>canvasEdit(()=>flipSprite(doc,'y'),'已翻转所有图层与帧'),
  new:newDocument,open:openDocument,'import-gif':()=>openDocument('gif'),'import-sequence':()=>openDocument('sequence'),'import-sequence-manifest':()=>openDocument('sequence-manifest'),'import-sheet-json':()=>openDocument('sheet-manifest'),'import-aseprite':()=>openDocument('aseprite'),'normal-map':normalMapDialog,gif:()=>exportDialog('gif'),sequence:()=>exportDialog('sequence'),save:()=>saveProject(),'save-as':()=>saveProject(true),recover:()=>recover(false),export:()=>exportDialog(),png:()=>exportDialog(),sheet:()=>exportDialog('sheet'),'sheet-pair':()=>exportDialog('sheet-pair'),
  shortcuts:keymapDialog,
  'cel-properties':celPropertiesDialog,
  'slice-properties':()=>sliceDialog(),'delete-active-slice':()=>{if(activeSliceId)mutate(()=>{doc.slices=doc.slices.filter(s=>s.id!==activeSliceId);activeSliceId=null;},'切片已删除');},'clear-slices':()=>{if(!doc.slices.length)return;mutate(()=>{doc.slices=[];activeSliceId=null;},'已清除所有切片');},
  'image-outline':()=>adjustImageDialog('outline'),
  'image-hsv':()=>adjustImageDialog('hsv'),'image-brightness':()=>adjustImageDialog('brightness'),'image-invert':()=>adjustImageDialog('invert'),
  'select-color-range':()=>selectionEditDialog('color-range'),'expand-selection':()=>selectionEditDialog('expand'),'contract-selection':()=>selectionEditDialog('contract'),'border-selection':()=>selectionEditDialog('border'),
  'select-all':()=>{selection={x:0,y:0,w:doc.width,h:doc.height};drawOverlay();},
  'actual-size':()=>scale(1/zoom),
  grid:togglePixelGrid,'grid-toggle':toggleGridGuide,
  onion:toggleOnion,'onion-settings':onionSettingsDialog,
  undo:()=>{if(gesture)return;stop();const paletteUI=history.undoStack.at(-1)?.paletteUI;const previous=history.undo(doc);if(previous){const name=doc.name;doc=previous;doc.name=name;if(paletteUI)restorePaletteUI(paletteUI.before);normalize();changed();render();message('已撤销');}},
  redo:()=>{if(gesture)return;stop();const paletteUI=history.redoStack.at(-1)?.paletteUI;const next=history.redo(doc);if(next){const name=doc.name;doc=next;doc.name=name;if(paletteUI)restorePaletteUI(paletteUI.after);normalize();changed();render();message('已重做');}},
  fit, 'zoom-in':()=>scale(1.25),'zoom-out':()=>scale(.8), play, previous:()=>selectFrame(fi-1),next:()=>selectFrame(fi+1),
  'add-frame':()=>mutate(()=>{const position=$('frame-insert').value==='before'?Math.min(...frameSelection):Math.max(...frameSelection)+1;addFrame(doc,position-1);fi=position;frameSelection=new Set([fi]);frameAnchor=fi;selection=null;},'已新建空白帧'),
  'duplicate-frame':()=>mutate(()=>{const position=$('frame-insert').value==='before'?Math.min(...frameSelection):Math.max(...frameSelection)+1;frameSelection=new Set(duplicateFrames(doc,frameSelection,position));fi=Math.min(...frameSelection);frameAnchor=fi;selection=null;},'已复制选中帧（全部图层）'),
  'delete-frame':()=>mutate(()=>{fi=deleteFrames(doc,frameSelection);normalize();},'已删除选中帧'),
  'add-layer':()=>mutate(()=>{li=addLayer(doc,li);},'已新建图层'),
  'color-mode':colorModeDialog,
  'link-cels':()=>{if(editable())mutate(()=>linkCels(doc,li,[...frameSelection],fi),'已链接当前层所选帧，图像共享编辑');},
  'unlink-cels':()=>{if(editable())mutate(()=>unlinkCels(doc,li,[...frameSelection]),'已取消当前层所选帧链接，像素保留');},
  'reference-import':importReferenceImage,'reference-settings':referenceSettings,
  'toggle-reference':()=>mutate(()=>convertReference(doc,li),'已切换参考 / 普通图层'),
  'toggle-background':()=>mutate(()=>{li=convertBackground(doc,li,colorValue(background));},'已切换背景 / 普通图层'),
  'group-layer':()=>mutate(()=>{li=groupLayer(doc,li);},'已将当前层或组编入新组'),
  'ungroup-layer':()=>mutate(()=>{li=ungroupLayer(doc,li);},'已取消编组；组级属性已移除'),
  'layer-parent':layerParentDialog,
  'duplicate-layer':()=>mutate(()=>{li=duplicateLayerTree(doc,li);},'已复制图层'),
  'delete-layer':async()=>{if(doc.layers.length===1)return message('至少保留一个图层');const index=li;if(!await modal('删除图层？','<p>将删除此图层在所有帧中的内容。可以通过撤销恢复。</p>'))return;mutate(()=>{li=removeLayerTree(doc,index);normalize();},'已删除图层');},
  'tileset-toggle':()=>{
    if(!isTileset(doc.layers[li]))return toTilesetDialog();
    const layerId=doc.layers[li].id,dropPreview=doc.previewTerrain?.layerId===layerId;
    // 图集图层退回像素后它的图块规则已经不存在，地形预览的数据也一起清掉，避免页签里留着旧图层的地形。
    mutate(()=>{toPixels(doc,li);if(dropPreview)delete doc.previewTerrain;},'已把图集图层转回普通图层');
    if(dropPreview){if(previewUI){previewUI.layerKey='';previewUI.terrainKey='';}renderTerrainPreview();boardKey='';renderReferenceBoard(true);}
  },
  'layer-up':()=>reorderLayer(1),'layer-down':()=>reorderLayer(-1),
  copy:()=>{clipboard=copyRegion(doc,pixels(),selection);clipboardDocument=documentId;syncCommandStates();message('已复制当前图层的像素');},
  cut:()=>{if(editable()){clipboard=copyRegion(doc,pixels(),selection);clipboardDocument=documentId;mutate(()=>clearRegion(doc,pixels(),selection),'已剪切当前图层的像素');}},
  paste:()=>{if(!clipboard)return message('请先复制像素');if(!editable())return;const target=pasteTarget(doc,clipboard,selection,clipboardDocument===documentId);mutate(()=>{pasteRegion(doc,pixels(),clipboard,target.x,target.y,null);selection=selectionFrom(doc,(x,y)=>selectionContains({...clipboard,x:target.x,y:target.y},x,y));},'已粘贴，可拖动新内容定位');},
  clear:()=>{if(editable())mutate(()=>clearRegion(doc,pixels(),selection),'已清除像素');},
  'flip-x':()=>{if(editable())mutate(()=>{selection=flipRegion(doc,pixels(),selection,'x');},'已水平翻转');},
  'flip-y':()=>{if(editable())mutate(()=>{selection=flipRegion(doc,pixels(),selection,'y');},'已垂直翻转');},
  deselect:()=>{if(selection)previousSelection=selection;selection=null;drawOverlay();syncCommandStates();}
};
async function importReferenceImage(){if(!window.desktop)return message('参考图片导入请使用桌面版');try{const [file]=await window.desktop.open('reference');if(!file)return;const image=new Image();image.src='data:'+(file.mime||'image/png')+';base64,'+file.data;await image.decode();const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const context=source.getContext('2d');context.drawImage(image,0,0);const reference=encodeReference(source.width,source.height,context.getImageData(0,0,source.width,source.height).data);assertProjectCapacity(doc,{layers:doc.layers.length+1,pixels:celPixelCount(doc)+doc.width*doc.height*doc.frames.length,sources:sourcePixelCount(doc)+source.width*source.height});mutate(()=>{li=addLayer(doc,li);doc.layers[li].name=file.name;doc.layers[li].type='reference';doc.layers[li].reference=reference;doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'layer-types'])];},'已导入参考图片（仅编辑视图显示）');}catch(error){showError('参考图片导入失败：'+error.message);}}
async function referenceSettings(){if(!isReference(doc.layers[li]))return message('请先选择参考图层');const ref=doc.layers[li].reference,values=await modal('参考图层位置','<label>X<input name="x" type="number" min="-16384" max="16384" step=".125" required></label><label>Y<input name="y" type="number" min="-16384" max="16384" step=".125" required></label><label>显示倍率<input name="scale" type="number" min=".125" max="16" step=".125" required></label><p>参考仅在暂停编辑视图显示；预览、洋葱皮、PNG / 动画 / ASE 不含参考。原始图像保存在项目内；转普通层按当前画布栅格化，超出部分会裁剪。</p>',form=>{for(const key of ['x','y','scale'])form.elements[key].value=ref[key];});if(values)mutate(()=>{doc.layers[li].reference={...ref,x:+values.x,y:+values.y,scale:+values.scale};},'已调整参考图层位置');}
async function layerParentDialog(){const current=doc.layers[li],values=await modal('移动到图层组','<label>目标组<select name="parent"></select></label><p>将当前图层或整组移动到目标组顶端。</p>',form=>{form.elements.parent.replaceChildren(new Option('最外层',''),...doc.layers.filter(layer=>isGroup(layer)&&layer.id!==current.id).map(layer=>new Option(layer.name,String(layer.id))));form.elements.parent.value=current.parentId||'';});if(values)mutate(()=>{li=reparentLayer(doc,li,values.parent?+values.parent:undefined);},'已移动图层组归属');}
function reorderLayer(delta){mutate(()=>{li=moveLayerSibling(doc,li,delta);});}
function nudge(direction,step){
  if(!editable()||gesture||busy)return;const [dx,dy]={left:[-step,0],right:[step,0],up:[0,-step],down:[0,step]}[direction];
  const region=copyRegion(doc,pixels(),selection);
  // Keep keyboard moves inside the canvas; dragging can still intentionally crop.
  const moveX=Math.max(-region.x,Math.min(doc.width-region.x-region.w,dx)),moveY=Math.max(-region.y,Math.min(doc.height-region.y-region.h,dy));
  // With no selection, move the cel within the canvas, allowing edge pixels to crop.
  const x=selection?moveX:dx,y=selection?moveY:dy;if(!x&&!y)return;
  mutate(()=>{clearRegion(doc,pixels(),selection);pasteRegion(doc,pixels(),region,region.x+x,region.y+y,null,true);if(selection)selection={...selection,x:selection.x+x,y:selection.y+y};},`已移动 ${Math.abs(x||y)} px`);
}
async function dispatch(action){if(busy||gesture||shapeSession||celGesture||$('modal').open)return;try{await actions[action]?.();}catch(error){showError('操作失败：'+error.message);}}
onUI('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)dispatch(button.dataset.action);});
uiAll('#modal button[value="cancel"]').forEach(button=>button.onclick=()=>$('modal').close('cancel'));
for(const group of TOOL_GROUPS){
  const button=document.createElement('button');button.type='button';button.dataset.toolGroup=group.join(',');button.dataset.groupSize=group.length;setToolSlotContent(button,group[0]);
  if(group.length===1)button.onclick=()=>setTool(button.dataset.tool);
  else{
    const menu=document.createElement('div');menu.className='tool-group-menu';menu.popover='auto';menu.setAttribute('role','menu');
    for(const name of group){const option=document.createElement('button');option.type='button';option.dataset.toolOption=name;option.setAttribute('role','menuitem');option.onclick=()=>{if(name==='select')$('selection-kind').value='rect';setTool(name);menu.hidePopover();};menu.append(option);}
    button.onclick=()=>{if((tool==='select'?selectionToolId():tool)!==button.dataset.tool){setTool(button.dataset.tool);return;}const owner=button.ownerDocument;owner.body.append(menu);const rect=button.getBoundingClientRect();Object.assign(menu.style,{left:Math.round(rect.right+5)+'px',top:Math.round(rect.top)+'px'});menu.showPopover();refreshKeymapLabels();};
  }
  $('tools').append(button);
}
$('timeline-mode').onchange=()=>{if(gesture||shapeSession||$('modal').open)return;stop();resetCelSelection();render(true);$('timeline-grid').focus({preventScroll:true});};
$('timeline-grid').addEventListener('pointermove',e=>{if(!celGesture||celGesture.pointerId!==e.pointerId)return;const cell=e.target.ownerDocument.elementFromPoint(e.clientX,e.clientY)?.closest('.cel');if(cell)selectCelAt(+cell.dataset.frame,+cell.dataset.layer,true,false);});
$('timeline-grid').addEventListener('pointerup',e=>{if(celGesture?.pointerId===e.pointerId)finishCelSelection();});
function interruptCelSelection(reason){const active=!!celGesture;finishCelSelection(true);if(active)message(reason+'：已取消 cel 范围拖动并恢复原选择');}
$('timeline-grid').addEventListener('pointercancel',()=>interruptCelSelection('指针操作中断'));$('timeline-grid').addEventListener('lostpointercapture',()=>interruptCelSelection('鼠标捕获丢失'));
$('color').oninput=e=>setColor(e.target.value+(color.length===9?color.slice(7):''));
$('background-color').oninput=e=>setBackground(e.target.value+(background.length===9?background.slice(7):''));
$('color').closest('.color-swatches').onclick=()=>actions['swap-colors']();
$('hex').onchange=e=>{try{const index=paletteTargetIndex();if(index!==null)setPaletteColor(index,e.target.value);else setColor(e.target.value);}catch(error){e.target.value=paletteTargetColor().toUpperCase();showError(error.message);}};$('brush').onchange=e=>setBrush(e.target.value);
for(const [id,key]of [['brush-shape','shape'],['brush-angle','angle'],['paint-opacity','opacity'],['ink-mode','ink'],['pattern-mode','patternMode'],['pixel-perfect','pixelPerfect'],['shape-filled','filled'],['fill-tolerance','fillTolerance'],['fill-contiguous','fillContiguous'],['stabilizer-enabled','stabilizer'],['stabilizer-distance','stabilizerDistance'],['gradient-type','gradientType'],['gradient-dither','gradientDither']])$(id).onchange=e=>{
  if(key==='shape'&&e.target.value==='pattern'&&!brushSettings.pattern){e.target.value=brushSettings.shape;return message('先从选区建立自定义笔刷');}
  brushSettings[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Math.max(0,Math.min(key==='stabilizerDistance'?64:key==='fillTolerance'?255:key==='opacity'?100:360,+e.target.value)):e.target.value;if(e.target.type==='number')e.target.value=brushSettings[key];saveBrushSettings();syncPaletteSelection();syncInteraction();
};
$('pattern-library').onchange=e=>{if(e.target.value)applyPatternBrush(e.target.value);};
for(const id of ['text-family','text-size','text-bold','text-italic','text-antialias','text-ligatures','text-align','text-fill','text-stroke','text-stroke-width'])$(id).onchange=()=>readTextControls();
$('wand-tolerance').onchange=e=>{e.target.value=Math.max(0,Math.min(255,Math.round(+e.target.value)));};
$('symmetry').onchange=$('symmetry-vertical').onchange=()=>{drawOverlay();};$('symmetry-reset').onclick=()=>mutate(()=>{doc.symmetryAxes={x:doc.width/2,y:doc.height/2};},'已重置对称轴');
$('grid').onchange=()=>{syncGridLabel();drawOverlay();};$('onion').onchange=()=>{saveOnionPreferences();draw();};
$('add-color').onclick=()=>{if(doc.palette.includes(color))return message('此颜色已在色板中');if(doc.palette.length>=256)return message('色板最多 256 色');mutate(()=>editIndexedPalette(doc,[...doc.palette,color],doc.palette.map((_,i)=>i).concat(null)),'已添加颜色',{colorsReady:true});};
$('play-range').onchange=()=>{stop();const tag=doc.tags.find(tag=>tag.id===$('play-range').value);if(tag)activateTag(tag.id);else{renderTimeline();draw();}};
$('play-direction').onchange=$('play-once').onchange=()=>{stop();draw();};
$('duration').onchange=e=>{const duration=Math.max(20,Math.min(10000,Math.round(+e.target.value)||100));mutate(()=>{for(const i of frameSelection)doc.frames[i].duration=duration;},'已调整选中帧时长');};
$('opacity').oninput=e=>{$('opacity-label').textContent=e.target.value+'%';};$('opacity').onchange=e=>{const index=li,value=+e.target.value;mutate(()=>doc.layers[index].opacity=value,'已调整图层透明度');};
$('file-input').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>512*1024*1024)throw new Error('文件超过512 MiB');if(/\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(file.name)){const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});await importFile({type:/\.gif$/i.test(file.name)?'gif':'image',data,name:file.name,mime:imageMime(file.name)},true);}else await importFile({type:'project',data:await file.text(),name:file.name},true);}catch(error){showError('打开失败：'+error.message);}};
window.desktop?.onCommand(action=>{
  if(action==='request-close'){void requestClose();return;}
  if(isTextTarget(uiActive())&&['undo','redo','copy','cut','paste','select-all'].includes(action)){
    uiActive().ownerDocument.execCommand({'select-all':'selectAll'}[action]||action);return;
  }
  dispatch(celRange&&$('timeline-grid').contains(uiActive())?({copy:'copy-cels',cut:'cut-cels',paste:'paste-cels',clear:'clear-cels'}[action]||action):action);
});
onUI('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(tool==='slice'&&e.key==='Delete'&&!$('modal').open&&!isTextTarget(e.target)){e.preventDefault();void actions['delete-active-slice']();return;}
  if(uiQuery('.context-popover:popover-open,.toolbar-popover:popover-open,.app-menu:popover-open'))return;
  if(e.target.closest?.('button')&&['Enter',' '].includes(e.key))return;
  if(celGesture){if(e.key==='Escape')finishCelSelection(true);e.preventDefault();return;}
  if(onionSession&&!e.isComposing&&e.keyCode!==229){if(e.key==='Escape'){e.preventDefault();$('modal').close('cancel');}else if(e.key==='Enter'){e.preventDefault();$('modal-form').requestSubmit($('modal-submit'));}return;}
  if(timelineDrag){if(e.key==='Escape'){timelineDrag=null;uiAll('.frame-head[data-drop]').forEach(el=>delete el.dataset.drop);}e.preventDefault();return;}
  if(transformSession&&!e.isComposing&&e.keyCode!==229){
    if(e.key==='Escape'){e.preventDefault();finishTransformDrag(true);$('modal').close('cancel');}
    else if(e.key==='Enter'){e.preventDefault();finishTransformDrag();$('modal-form').requestSubmit($('modal-submit'));}
    return;
  }
  if(!$('modal').open&&isTextTarget(e.target)&&['Escape','Enter'].includes(e.key)&&e.target.tagName==='INPUT'){e.preventDefault();e.target.blur();viewport.focus({preventScroll:true});return;}
  if($('modal').open||isTextTarget(e.target)||e.isComposing||e.keyCode===229)return;
  if(paletteEditing&&!paletteDrag?.moved&&e.key==='Escape'){e.preventDefault();setPaletteEditing(false);return;}
  if(paletteEditing){
    const key=e.key.toLowerCase(),command=(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey?{c:'copy',v:'paste'}[key]:null;
    if(command==='copy'){e.preventDefault();copySelectedPaletteColor();return;}
    if(command==='paste'){e.preventDefault();void pastePaletteColorAfterSelection();return;}
    if(['Delete','Backspace'].includes(e.key)){e.preventDefault();removeSelectedPaletteColors();return;}
  }
  if(celRange&&$('timeline-grid').contains(uiActive())){
    const key=e.key.toLowerCase(),command=(e.ctrlKey||e.metaKey)&&!e.altKey?{c:'copy-cels',x:'cut-cels',v:'paste-cels'}[key]:null;
    if(command){e.preventDefault();dispatch(command);return;}
    if(['Delete','Backspace'].includes(e.key)){e.preventDefault();dispatch('clear-cels');return;}
    if(e.key==='Escape'){e.preventDefault();resetCelSelection();render(true);return;}
    if(e.key.startsWith('Arrow')){e.preventDefault();const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];stop();selectCelAt(Math.max(0,Math.min(doc.frames.length-1,fi+delta[0])),Math.max(0,Math.min(doc.layers.length-1,li+delta[1])),e.shiftKey);return;}
  }
  if(e.key==='Enter'&&shapeSession){e.preventDefault();commitShapeSession();return;}
  if(e.key==='Alt')e.preventDefault();
  modifiers.alt=e.altKey;modifiers.shift=e.shiftKey;
  if(holdActionFor(e,keymap)==='grid-select'&&tool==='select'){e.preventDefault();modifiers.grid=true;syncInteraction();return;}
  const match=resolveShortcut(e,keymap);if(!match){if(e.key==='Shift')drawOverlay();else syncInteraction();return;}e.preventDefault();
  if(busy)return;
  if(space&&match.action!=='space')spaceUsed=true;
  if(match.action==='space'){if(!e.repeat){space=true;spacePanned=!!gesture;spaceUsed=!!gesture;}syncInteraction();return;}
  if(match.action==='cancel'){const selecting=gesture?.kind==='select'||shapeSession?.kind==='select';spaceUsed=true;pendingTool=null;finishGesture(true);cancelShapeSession();if(!selecting){if(selection)previousSelection=selection;selection=null;}stop();render();return;}
  if(match.action==='tool'){if(!e.repeat){if(keymap.profile==='aseprite'&&match.tool==='select')$('selection-kind').value='rect';setTool(match.tool);}return;}
  if(gesture)return;
  if(match.action==='brush'){setBrush(brush+match.delta);return;}
  if(match.action==='arrow'){
    if(selection||tool==='move')nudge(match.direction,e.shiftKey?10:1);
    else if(['left','right'].includes(match.direction))dispatch(match.direction==='left'?'previous':'next');
    return;
  }
  const repeatable=['zoom-in','zoom-out','previous','next','undo','redo'];
  if(!e.repeat||repeatable.includes(match.action))dispatch(match.action);
});
onUI('keyup',e=>{
  if(e.key==='Alt'&&!isTextTarget(e.target)&&!$('modal').open)e.preventDefault();
  modifiers.alt=e.altKey;modifiers.shift=e.shiftKey;
  if(holdActionFor(e,keymap)==='grid-select')modifiers.grid=false;
  if(e.code==='Space'||e.key===' '){const tap=space&&!spacePanned&&!spaceUsed;space=false;if(tap&&keymap.profile!=='aseprite'&&!$('modal').open&&!isTextTarget(e.target))dispatch('play');}
  if(e.key==='Shift')drawOverlay();else syncInteraction();
});
function resetInteraction(reason='操作焦点已切换'){const active=!!(gesture||shapeSession||transformSession?.drag||celGesture||timelineDrag);finishCelSelection(true);cancelPaletteDrag();timelineDrag=null;uiAll('.frame-head[data-drop]').forEach(el=>delete el.dataset.drop);resetModifiers();pendingTool=null;finishTransformDrag(true);finishGesture(true);cancelShapeSession();syncInteraction();if(active)message(reason+'：本次拖动或未完成形状已取消，已恢复原状态');}
onUIWindow('blur',()=>{resetInteraction('窗口失焦');uiAll('.context-popover:popover-open,.toolbar-popover:popover-open').forEach(node=>node.hidePopover());});
onUI('visibilitychange',event=>{if(event.target.hidden)resetInteraction('窗口已隐藏');});
onUI('focusin',e=>{if(isTextTarget(e.target))resetInteraction();});
let recoveryTimer;
function scheduleRecovery(){clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{if(gesture||shapeSession||transformSession)scheduleRecovery();else void flushRecovery();},700);}
async function flushRecovery(){
  clearTimeout(recoveryTimer);
  const snapshot=transformSession?.before||gesture?.before||shapeSession?.before||doc;
  const record={id:documentId,filePath,dirty,...(filePath&&dirty?{data:JSON.stringify(snapshot),name:snapshot.name}:{})};
  try{
    if(window.desktop)await window.desktop.saveRecovery(record);
    else if(filePath&&dirty)localStorage.setItem('pixel-studio-recovery',JSON.stringify({doc:snapshot,filePath,dirty}));
    else localStorage.removeItem('pixel-studio-recovery');
    return true;
  }catch(error){showError('恢复副本写入失败：'+error.message);return false;}
}
window.addEventListener('beforeunload',e=>{if(!window.desktop&&dirty){e.preventDefault();e.returnValue='';}});
function watchDisplayScale(){const query=matchMedia('(resolution: '+devicePixelRatio+'dppx)');query.addEventListener('change',()=>{place();drawOverlay();watchDisplayScale();},{once:true});}
watchDisplayScale();
let viewportSize=null;
new ResizeObserver(()=>{
  const next={w:viewport.clientWidth,h:viewport.clientHeight};
  if(viewportSize){pan.x+=(next.w-viewportSize.w)/2;pan.y+=(next.h-viewportSize.h)/2;place();drawOverlay();}
  else fit();
  viewportSize=next;
}).observe(viewport);
const {enabled:onionEnabled=false,...savedOnion}=JSON.parse(localStorage.getItem('pixel-studio-onion')||'{}');onionSettings={...DEFAULT_ONION_SETTINGS,...savedOnion};$('onion').checked=onionEnabled;
const colorPreferences=JSON.parse(localStorage.getItem('pixel-studio-colors')||'null');
if(colorPreferences){color=colorPreferences.foreground;background=colorPreferences.background;rightButtonMode=colorPreferences.rightButtonMode;}if(localStorage.getItem(INPUT_KEY))rightButtonMode=inputPreferences.right;else inputPreferences.right=rightButtonMode;
const savedBrush=JSON.parse(localStorage.getItem('pixel-studio-brush')||'null');
if(savedBrush){const {size,...settings}=savedBrush;brush=Math.min(MAX_BRUSH_SIZE,Math.max(1,Math.round(size)||1));brushSettings={...brushSettings,...settings,patternMode:settings.patternMode||'destination'};}
toolBrushShapes=JSON.parse(localStorage.getItem('pixel-studio-tool-brush-shapes')||'null')||{pencil:brushSettings.shape};
$('layer-continuous').onchange=()=>{const value=$('layer-continuous').checked;mutate(()=>{if(value){doc.layers[li].continuous=true;doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'linked-cels'])];}else delete doc.layers[li].continuous;},'已更新连续图层；已有链接保持');};
$('group-mode').onchange=()=>{const pass=$('group-mode').value==='pass';mutate(()=>{if(pass){doc.layers[li].passThrough=true;doc.layers[li].opacity=100;delete doc.layers[li].blendMode;}else delete doc.layers[li].passThrough;},'已切换图层组模式');};
$('layer-blend').replaceChildren(...BLEND_MODES.map(([id,name])=>new Option(name,id)));$('palette-library').onchange=event=>{if(event.target.value)applyPaletteLibrary(event.target.value);else{paletteLibraryId='';syncRemapButton();}syncPaletteLibraryButtons();};
$('layer-blend').onchange=()=>{const value=$('layer-blend').value;mutate(()=>{if(value==='normal')delete doc.layers[li].blendMode;else{doc.layers[li].blendMode=value;doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'layer-blending'])];}},'已更改图层混合模式');};
initI18n();initContextUI();renderPaletteLibrary();syncRemapButton();colorAdjustments=initColorAdjustments({onPreview:value=>{const index=paletteTargetIndex();if(index!==null)previewPaletteColor(index,value);else setColor(value);},onCommit:value=>{const index=paletteTargetIndex();if(index!==null)setPaletteColor(index,value);else setColor(value);}});uiAll('input[type=checkbox]').forEach(input=>input.setAttribute('role','switch'));window.chromeReady=initWindowChrome();void help.start();for(const key of ['grid','symmetry'])$(key).checked=!!JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)||'{}')[key];$('selection-kind').addEventListener('change',()=>{syncToolSlots();syncContextUI();syncInteraction();});decorateInterface();initVisualWorkspace();initToolbarControls({getBrush:()=>({size:brush,...clone(brushSettings)}),applyBrush:applyBrushPreset});syncGridLabel();syncGridGuideLabel();initPaletteEditing();initPaletteSizeMenu();refreshKeymapLabels();initTheme();window.workspaceLayout=initWorkspaceLayout();initReferenceBoard();tilesetPanel=initTilesetPanel({panel:$('tileset-panel'),getDocument:()=>doc,mutate,message});updateBrushControls();syncTextControls();renderColors();$('theme-toggle').addEventListener('click',drawOverlay);setTool('pencil');enterEmptyState();fit();initFormLayout();
async function recover(){
  if(!filePath)return message('请先打开项目');
  const copy=await window.desktop?.recoveryForPath(filePath);
  if(!copy)return message('当前项目没有可恢复的未保存内容');
  const answer=await modal('恢复未保存内容？','<p>是否恢复当前项目意外关闭时留下的未保存副本？</p>',null,null,{confirm:'恢复'});
  if(!answer)return;
  const record=await window.desktop.loadRecovery(copy.id);
  replaceDocument(validateDocument(JSON.parse(record.data)),false,record.filePath,record.id);
}
function wireDocumentState(state){return{...state,frameSelection:[...state.frameSelection]};}
window.desktop?.onDocumentRequest(async(operation,data)=>{
 if(operation==='take-all'){if($('modal').open){$('modal').close('cancel');await new Promise(resolve=>setTimeout(resolve,0));}resetInteraction('关闭独立窗口');}
 if(busy||gesture||shapeSession||celGesture||$('modal').open)throw new Error('请先完成文档中的当前操作');
 documentTabs.save(captureDocumentState());
 if(operation==='close-check')return requestClose(false);
 if(operation==='take')return wireDocumentState(documentTabs.get(data.id));
 if(operation==='take-all')return documentTabs.items.map(item=>wireDocumentState(item.state));
 if(operation==='adopt'){
  if(data.replace)documentTabs.items=[];
  for(const raw of data.states){const state=structuredClone(raw);state.frameSelection=new Set(state.frameSelection);hydrateLinks(state.doc);documentTabs.add(state);}
  const ids=data.states.map(state=>state.documentId);if(data.beforeId){const moved=documentTabs.items.filter(item=>ids.includes(item.id));documentTabs.items=documentTabs.items.filter(item=>!ids.includes(item.id));const at=documentTabs.items.findIndex(item=>item.id===data.beforeId);documentTabs.items.splice(at<0?documentTabs.items.length:at+(data.after?1:0),0,...moved);}
  restoreDocumentState(documentTabs.get(ids.at(-1)));return true;
 }
 if(operation==='remove'){
  const active=documentId===data.id,next=documentTabs.remove(data.id);if(!documentTabs.items.length){if(data.keepWindow)enterEmptyState();else setDirty(false);return{empty:true};}if(active)restoreDocumentState(next);else{renderDocumentTabs();setDirty(dirty);}return{empty:false};
 }
 throw new Error('未知文档传递操作');
});
window.desktop?.onEditorError(showError);
let documentDrag=null;
function startDocumentDrag(event,id){documentDrag={id,accepted:false,cancelled:false};event.dataTransfer.setData('application/x-pixel-document',JSON.stringify({owner:editorHost.id,id}));event.dataTransfer.effectAllowed='move';}
function finishDocumentDrag(event,id){const pending=documentDrag;documentDrag=null;uiAll('.document-tab[data-drop]').forEach(tab=>delete tab.dataset.drop);if(pending&&!pending.accepted&&!pending.cancelled&&event.dataTransfer.dropEffect==='none')void window.desktop.detachDocument(id).catch(error=>showError(error.message));}
function handleDocumentDragOver(event){if(!event.dataTransfer.types.includes('application/x-pixel-document'))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';uiAll('.document-tab[data-drop]').forEach(tab=>delete tab.dataset.drop);uiAll('.document-overflow-menu [data-drop]').forEach(item=>delete item.dataset.drop);const host=$('document-tabs'),target=event.target.closest('[data-document-id]');host.dataset.dropEnd=String(!target);if(target)target.dataset.drop=event.clientX<target.getBoundingClientRect().left+target.offsetWidth/2?'before':'after';}
function handleDocumentDrop(event){const value=event.dataTransfer.getData('application/x-pixel-document');if(!value)return;event.preventDefault();event.stopPropagation();const token=JSON.parse(value),target=event.target.closest('[data-document-id]'),beforeId=target?.dataset.documentId,after=!!target&&event.clientX>=target.getBoundingClientRect().left+target.offsetWidth/2;
 if(documentDrag)documentDrag.accepted=true;if(token.owner===editorHost.id){if(token.id!==beforeId){const at=documentTabs.items.findIndex(item=>item.id===token.id),[item]=documentTabs.items.splice(at,1),position=documentTabs.items.findIndex(entry=>entry.id===beforeId);documentTabs.items.splice(position<0?documentTabs.items.length:position+(after?1:0),0,item);renderDocumentTabs();}}else void window.desktop.moveDocument({...token,beforeId,after}).catch(error=>showError(error.message));
 uiAll('.document-tab[data-drop]').forEach(node=>delete node.dataset.drop);uiAll('.document-overflow-menu [data-drop]').forEach(node=>delete node.dataset.drop);delete $('document-tabs').dataset.dropEnd;
}
onUI('keydown',event=>{if(documentDrag&&event.key==='Escape')documentDrag.cancelled=true;});
$('document-tabs').parentElement.addEventListener('dragover',handleDocumentDragOver);$('document-tabs').parentElement.addEventListener('drop',handleDocumentDrop);
window.documentWindowAudit=()=>({id:documentId,host:editorHost,documents:documentTabs.items.map(item=>({id:item.id,name:item.state.doc.name})),name:doc.name,layerName:doc.layers[li].name,mode:modeOf(doc),indices:doc.frames[0].indices?.[0],linked:doc.frames.length>1&&doc.frames[0].cels[0]===doc.frames[1].cels[0]&&(!doc.frames[0].indices||doc.frames[0].indices[0]===doc.frames[1].indices[0]),dirty,busy,path:filePath,pixel:doc.frames[0].cels[0][0],undo:history.undoStack.length,redo:history.redoStack.length,zoom,pan,viewport:{w:viewport.clientWidth,h:viewport.clientHeight},selection:selection?.bounds||selection,controls:{tools:!!$('tools'),layers:!!$('layers'),timeline:!!$('timeline-grid'),settings:!!uiQuery('[data-top-menu="文件"]')}});
window.documentWindowUndo=()=>actions.undo();
if(!window.desktop?.testing&&!window.desktop?.secondary){void(async()=>{const files=await window.desktop?.startupFiles()||[];for(const file of files)try{if(file.type==='error')throw new Error(file.message);await importFile(file,true);}catch(error){showError('打开失败：'+error.message);}})();}
let incomingFileQueue=Promise.resolve();
window.desktop?.onOpenFile(file=>{incomingFileQueue=incomingFileQueue.then(()=>importFile(file,true)).catch(error=>showError('打开失败：'+error.message));});
onUI('dragover',event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
onUI('drop',event=>{if(!event.dataTransfer?.files.length)return;event.preventDefault();if(busy||gesture||shapeSession||$('modal').open)return;void(async()=>{for(const file of event.dataTransfer.files)try{if(!window.desktop)throw new Error('拖放请使用桌面版');const opened=await window.desktop.openDroppedFile(file);await importFile(opened,true);}catch(error){showError('打开失败：'+error.message);}})();});

window.startInputAudit=()=>{penPreferences={...DEFAULT_PEN,mode:'both'};inputPreferences={...DEFAULT_INPUT};replaceDocument(createDocument(96,48,'Wacom 实机测试'),true);brushSettings={shape:'circle',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=12;updateBrushControls();setTool('pencil');setColor('#edb75b');fit();const panel=document.createElement('section');panel.className='device-audit';panel.innerHTML='<strong>Wacom 实机验收</strong><p>在画布上从轻到重画几笔。若笔有橡皮端，请翻转擦除。画完点击“保存验收记录”。</p><output>等待真实数位笔事件…</output><button>保存验收记录</button>';document.body.append(panel);const state={trustedPenSamples:0,pressureMin:1,pressureMax:0,eraserSamples:0,strokes:0,cancels:0,types:[],samples:[]};let queued=false;const report=()=>({...state,pressureVaries:state.pressureMax-state.pressureMin>.1,historyEntries:history.undoStack.length,gestureActive:!!gesture,dpr:devicePixelRatio,zoom,overlay:{w:overlay.width,h:overlay.height},viewport:{w:viewport.clientWidth,h:viewport.clientHeight}});const save=async()=>{const result=await window.desktop.recordInputAudit(report());panel.querySelector('output').textContent=`笔采样 ${state.trustedPenSamples} · 压力 ${state.pressureMin.toFixed(3)}—${state.pressureMax.toFixed(3)} · ${result.ok?'压感检查通过':'仍需更多轻重笔触'} · 记录已保存`;};const listener=e=>{if(!e.isTrusted)return;if(!state.types.includes(e.pointerType))state.types.push(e.pointerType);if(e.pointerType==='pen'){if(e.type==='pointerup')state.strokes++;if(e.type==='pointercancel')state.cancels++;if(e.pressure>0&&e.buttons){state.trustedPenSamples++;state.pressureMin=Math.min(state.pressureMin,e.pressure);state.pressureMax=Math.max(state.pressureMax,e.pressure);if(e.button===5||e.buttons&32)state.eraserSamples++;if(state.samples.length<8192)state.samples.push({type:e.type,x:e.clientX,y:e.clientY,pressure:e.pressure,tiltX:e.tiltX,tiltY:e.tiltY,button:e.button,buttons:e.buttons,pointerType:e.pointerType,isTrusted:e.isTrusted});panel.querySelector('output').textContent=`笔采样 ${state.trustedPenSamples} · 压力 ${state.pressureMin.toFixed(3)}—${state.pressureMax.toFixed(3)} · 笔尾 ${state.eraserSamples}`;}}if(!queued){queued=true;setTimeout(()=>{queued=false;void window.desktop.recordInputAudit(report());},300);}};for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])viewport.addEventListener(type,listener,true);panel.querySelector('button').onclick=save;void window.desktop.recordInputAudit(report());message('Wacom 实机验收：请在画布上实际绘画');};
window.minepixLocale={get:locale,set:next=>persistLocale(next)};window.pixpixLocale=window.minepixLocale;
window.documentWindowSave=()=>saveProject();

if(import.meta.env.DEV){
async function runInteractionSmoke(check){
  replaceDocument(createDocument(16,16,'交互验收'),false);li=0;fit();
  const key=(type,value,code,extra={},target=document)=>target.dispatchEvent(new KeyboardEvent(type,{key:value,code,bubbles:true,cancelable:true,...extra}));
  const press=(value,code,extra={})=>{key('keydown',value,code,extra);key('keyup',value,code,extra);};
  const pointEvent=(type,x,y,extra={})=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:3,button:0,...extra}));};
  const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
    for(const [name,,,hotkey]of tools.filter(item=>item[3])){press(hotkey.toLowerCase(),'Key'+hotkey);check('快捷键工具切换 '+hotkey,tool===name&&$('tools').querySelector(`[data-tool="${name}"]`).getAttribute('aria-pressed')==='true');}
    setTool('pencil');setBrush(3);pointEvent('pointermove',4,4);check('笔刷范围跟随缩放',!brushPreview.hidden&&parseFloat(brushPreview.style.width)===3*zoom);setBrush(1);
    pixels()[4*16+4]=colorValue('#44766d');const oldHistory=history.undoStack.length;
    key('keydown','Alt','AltLeft',{altKey:true});check('Alt 显示临时吸管',viewport.dataset.cursor==='eyedropper'&&tool==='pencil');
    pointEvent('pointerdown',4,4,{altKey:true});key('keyup','Alt','AltLeft');check('吸色后恢复原工具',color==='#44766d'&&viewport.dataset.cursor==='pencil'&&history.undoStack.length===oldHistory);
    pointEvent('pointerdown',4,4,{button:2});check('右键擦除光标',viewport.dataset.cursor==='eraser');pointEvent('pointerup',4,4,{button:2});check('右键实际擦除并恢复',pixels()[4*16+4]===0&&viewport.dataset.cursor==='pencil');
    const oldPan={...pan};key('keydown',' ','Space');pointEvent('pointerdown',2,2);check('平移拖动显示抓手',viewport.dataset.cursor==='grabbing');pointEvent('pointermove',3,3);pointEvent('pointerup',3,3);key('keyup',' ','Space');check('空格平移不触发播放',!playing&&pan.x!==oldPan.x&&viewport.dataset.cursor==='pencil');
    press(' ','Space');check('单按空格播放并禁止绘画',playing&&viewport.dataset.cursor==='not-allowed');press(' ','Space');check('空格暂停恢复绘画',!playing&&viewport.dataset.cursor==='pencil');
    setTool('move');pointEvent('pointerdown',2,2,{button:1});pointEvent('pointermove',3,3,{button:1});pointEvent('pointerup',3,3,{button:1});check('中键平移恢复移动工具',tool==='move'&&viewport.dataset.cursor==='move');
    setTool('zoom');const oldZoom=zoom;key('keydown','Alt','AltLeft',{altKey:true});pointEvent('pointerdown',2,2,{altKey:true});key('keyup','Alt','AltLeft');check('缩放工具 Alt 缩小',Math.abs(zoom-oldZoom*.8)<.001&&viewport.dataset.cursor==='zoom-in');
    setTool('rect');pixels().fill(0);pointEvent('pointerdown',1,1,{shiftKey:true});pointEvent('pointermove',4,7,{shiftKey:true});pointEvent('pointerup',4,7);check('Shift 绘制正方形',pixels()[7*16+7]!==0&&pixels()[7*16+8]===0);
    setTool('pencil');pointEvent('pointerdown',0,0);const beforeWheel=zoom;viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,bubbles:true,cancelable:true}));press('e','KeyE');check('笔画中延迟切换且禁止缩放',tool==='pencil'&&pendingTool==='eraser'&&zoom===beforeWheel);pointEvent('pointerup',0,0);check('松开后切换到橡皮',tool==='eraser'&&viewport.dataset.cursor==='eraser');
    doc.layers[0].locked=true;syncInteraction();pointEvent('pointerdown',0,0);check('锁定图层禁止编辑',viewport.dataset.cursor==='not-allowed'&&gesture===null);doc.layers[0].locked=false;
    setTool('pencil');pointEvent('pointerdown',0,0);const beforeCancel=gesture.base[0];resetInteraction();check('失焦取消笔画并清理修饰键',gesture===null&&!space&&!modifiers.alt&&pixels()[0]===beforeCancel);
    $('brush').focus();key('keydown','v','KeyV',{},$('brush'));check('输入框不触发工具快捷键',tool==='pencil');viewport.focus();press('v','KeyV');check('回到画布恢复快捷键',tool==='move');
    selection={x:1,y:1,w:2,h:2};const originalFrame=fi;press('ArrowRight','ArrowRight');check('方向键移动选区不切帧',selection.x===2&&fi===originalFrame);press('ArrowDown','ArrowDown',{shiftKey:true});check('Shift 方向键移动十像素',selection.y===11);
    press('g','KeyG',{ctrlKey:true});check('网格快捷键',$('grid').checked);press('g','KeyG',{ctrlKey:true});
    const help=actions.shortcuts();check('快捷键帮助可打开',$('modal').open&&!!$('modal').querySelector('.shortcut-list'));$('modal').close('cancel');await help;
  }finally{viewport.setPointerCapture=capture;resetInteraction();setBrush(1);setColor('#edb75b');}
}

async function assertRecoveryRecord(check,name,assertion){
 await flushRecovery();
 if(filePath&&dirty)check(name,assertion(await window.desktop.loadRecovery(documentId)));
 else check('不符合恢复条件时不落盘：'+name,!(await window.desktop.listRecovery()).some(record=>record.id===documentId));
}

async function runFileSmoke(check){
  replaceDocument(createDocument(2,2,'文件验收'),false);
  check('首次保存记住路径',await saveProject()&&!!filePath&&!dirty);
  const originalPath=filePath;
  mutate(()=>pixels()[0]=colorValue('#edb75b'));
  check('再次保存沿用原路径',await saveProject()&&filePath===originalPath&&!dirty);
  check('另存为成功同步文档名称',await saveProject(true)&&doc.name==='文件验收');
  mutate(()=>pixels()[0]=colorValue('#44766d'));await flushRecovery();
  mutate(()=>pixels()[1]=colorValue('#44766d'));
  await flushRecovery();
  const record=await window.desktop.loadRecovery(documentId);
  const previous=await window.desktop.loadRecovery(documentId,true);
  check('落盘恢复保留最近及上一个版本',JSON.parse(record.data).frames[0].cels[0][1]!==0&&JSON.parse(previous.data).frames[0].cels[0][1]===0);
  const list=await window.desktop.listRecovery();check('恢复列表按项目独立保存',list.some(r=>r.id===documentId&&r.previous));
  const [reference]=await window.desktop.open('reference'),aseprite=await window.desktop.open('aseprite'),recent=await window.desktop.recentFiles();
check('参考图与 ASE 导入不进入最近文件',reference.type==='image'&&aseprite.type==='aseprite'&&recent.every(entry=>/\.(pix|pixel)$/i.test(entry.path))&&recent.some(entry=>entry.path===filePath));
  const thumbs=await window.desktop.recentThumbs();
  check('最近文件提供项目缩略图',thumbs.some(item=>item.path===filePath&&item.size===32&&item.pixels.length>0));
  const cancelled=confirmDiscard();$('modal').close('cancel');check('取消替换保留当前项目',!await cancelled&&dirty&&filePath===originalPath);
  check('恢复后继续编辑可再次保存',await saveProject()&&!dirty);
  replaceDocument(createDocument(2,2,'cancel-save'),false);
  check('取消保存保持未保存状态',!await saveProject()&&dirty&&filePath===null);
  const saveBeforeContinue=confirmDiscard();$('modal-form').requestSubmit($('modal-submit'));
  check('保存被取消时阻止继续',!await saveBeforeContinue&&dirty);
  replaceDocument(createDocument(2,2,'fail-save'),false);
  check('写入失败不丢失当前项目',!await saveProject()&&dirty&&filePath===null&&doc.name==='fail-save');
  replaceDocument(createDocument(2,2,'保存后继续'),false);
  const confirmed=confirmDiscard();$('modal-form').requestSubmit($('modal-submit'));
  check('保存后继续先完成文件写入',await confirmed&&!dirty&&!!filePath);
}

async function runBasicEditSmoke(check){
    replaceDocument(createDocument(4,4,'画布验收'),false);pixels()[5]=colorValue('#edb75b');
    const sizing=canvasSizeDialog();$('modal-form').elements.width.value=6;$('modal-form').elements.height.value=6;$('modal-form').requestSubmit($('modal-submit'));await sizing;
    check('画布锚点扩展通过界面更新',doc.width===6&&pixels()[14]===colorValue('#edb75b'));
    actions.undo();check('画布尺寸变更可撤销',doc.width===4&&pixels()[5]===colorValue('#edb75b'));
    selection={x:1,y:1,w:2,h:2};actions['crop-selection']();check('选区裁剪更新全部画布',doc.width===2&&pixels()[0]===colorValue('#edb75b'));
    actions['trim-canvas']();check('自动裁边保留像素',doc.width===1&&doc.height===1&&pixels()[0]===colorValue('#edb75b'));
    replaceDocument(createDocument(2,2,'合并验收'),false);pixels()[0]=colorValue('#edb75b');actions['add-layer']();pixels()[0]=colorValue('#44766d');doc.layers[1].opacity=50;actions['duplicate-frame']();
    const mergedPreview=[...composite(doc,0)];actions['merge-down']();check('向下合并保持全部帧合成结果',doc.layers.length===1&&doc.frames.every(f=>f.cels.length===1)&&JSON.stringify([...composite(doc,0)])===JSON.stringify(mergedPreview));
    actions.undo();check('图层合并可撤销',doc.layers.length===2&&doc.frames[0].cels.length===2);actions['merge-visible']();check('合并可见图层入口可用',doc.layers.length===1&&doc.layers[0].name==='合并可见图层');
    actions.undo();const flattening=actions.flatten();$('modal-form').requestSubmit($('modal-submit'));await flattening;check('扁平化通过确认后执行',doc.layers.length===1&&doc.layers[0].name==='扁平图层');
    actions.undo();const before=clone(doc);actions['flip-sprite-x']();actions['flip-sprite-y']();check('整体翻转作用于全部帧',doc.frames.every((frame,f)=>frame.cels.every((cel,l)=>cel.every((pixel,i)=>pixel===before.frames[f].cels[l][cel.length-1-i]))));actions.undo();actions.undo();check('整体翻转可撤销',JSON.stringify(doc)===JSON.stringify(before));
}

async function runColorSmoke(check){
  replaceDocument(createDocument(4,4,'颜色验收'),false);setTool('pencil');
  setColor('#00ff0080');rightButtonMode='background';saveColorPreferences();
  check('设置半透明前景色与右键模式',color==='#00ff0080'&&rightButtonMode==='background');
  setBackground('#ff0000');const r=canvas.getBoundingClientRect(),capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+zoom*1.5,clientY:r.top+zoom*1.5,pointerId:9,button:2}));}finally{viewport.setPointerCapture=capture;}
  check('右键背景色模式绘画',pixels()[5]===colorValue('#ff0000')&&viewport.dataset.cursor==='pencil');
  actions['swap-colors']();check('前背景色交换保留透明度',color==='#ff0000'&&background==='#00ff0080');
  $('hex').value='#aabbccdd';$('hex').dispatchEvent(new Event('change'));check('面板 HEX 输入可编辑',color==='#aabbccdd');
  doc.palette=['#ff0000','#00ff0080','#0000ff'];paletteDomKey='';renderColors();
  setPaletteEditing(true);
  setPaletteColor(1,'#abcd',{preserveAlpha:true});check('内联色板改色保留原透明度',doc.palette[1]==='#aabbcc80');
  paletteSelection=new Set([1]);applyPaletteReorder(2,true);check('内联色板拖动排序',doc.palette[0]==='#ff0000'&&doc.palette[2]==='#aabbcc80');
  paletteSelection=new Set([2]);removeSelectedPaletteColors();check('内联色板删除',doc.palette.length===2&&doc.palette[0]==='#ff0000');
  actions.undo();actions.undo();actions.undo();check('内联色板编辑可整步撤销',JSON.stringify(doc.palette)===JSON.stringify(['#ff0000','#00ff0080','#0000ff']));
  const clipboardText={value:'',writeText:async function(text){this.value=text;},readText:async function(){return this.value;}};
  const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  Object.defineProperty(navigator,'clipboard',{value:clipboardText,configurable:true});
  const multiBase=doc.palette.length,multiColors=[0,1,2].map(index=>doc.palette[index]);
  paletteSelection=new Set([0,1,2]);paletteActive=2;
  await copySelectedPaletteColor();
  check('色板多选复制保留全部颜色',clipboardText.value===multiColors.map(value=>value.toUpperCase()).join('\n'));
  paletteSelection=new Set([0]);paletteActive=0;
  await pastePaletteColorAfterSelection();
  check('色板多选粘贴得到全部颜色且顺序正确',doc.palette.length===multiBase+3&&multiColors.every((value,offset)=>doc.palette[1+offset]===normalizeColor(value))&&paletteSelection.size===3&&[1,2,3].every(index=>paletteSelection.has(index)));
  actions.undo();
  check('多色粘贴整步可撤销',doc.palette.length===multiBase);
  clipboardText.value='#123456';
  paletteSelection=new Set([0]);paletteActive=0;
  await pastePaletteColorAfterSelection();
  check('外部单行 HEX 粘贴仍只插入一色',doc.palette.length===multiBase+1&&doc.palette[1]==='#123456');
  actions.undo();
  clipboardText.value='#ff0000\n不是颜色\n#00ff00';
  paletteSelection=new Set([0]);paletteActive=0;
  await pastePaletteColorAfterSelection();
  check('无法解析的行跳过并提示',doc.palette.length===multiBase+2&&$('status').textContent.includes('跳过 1 行'));
  actions.undo();
  if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else delete navigator.clipboard;
  setPaletteEditing(false);
  if(window.desktop){await importPalette();check('原生导入色板保留 Alpha',doc.palette.length===2&&doc.palette[1]==='#00ff0080');await exportPalette();check('原生导出色板成功',$('status').textContent==='色板已导出');}
  pixels().fill(0);pixels()[0]=colorValue('#ff0000');pixels()[1]=colorValue('#ff0000');pixels()[2]=colorValue('#0000ff80');actions['extract-palette']();check('当前帧提色按频率并保留 Alpha',JSON.stringify(doc.palette)===JSON.stringify(['#ff0000','#0000ff80']));
  rightButtonMode='erase';setColor('#edb75b');setBackground('#171b2b');
}

async function runBrushSmoke(check){
  replaceDocument(createDocument(8,8,'笔刷验收'),false);setTool('pencil');setColor('#ff000080');
  const input=(id,value)=>{const element=$(id);if(element.type==='checkbox')element.checked=value;else element.value=value;element.dispatchEvent(new Event('change'));};
  const pointerEvent=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:12,button:0}));};
  const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
    pointerEvent('pointerdown',2,2);pointerEvent('pointermove',2,2);pointerEvent('pointermove',2,2);pointerEvent('pointerup',2,2);check('同一笔画透明度不重复累加',(pixels()[18]&255)===128);
    pointerEvent('pointerdown',2,2);pointerEvent('pointerup',2,2);check('第二次笔画正常 Alpha 叠色',(pixels()[18]&255)===192);
    pixels().fill(0);setTool('rect');input('shape-filled',true);pointerEvent('pointerdown',1,1);pointerEvent('pointermove',4,4);pointerEvent('pointerup',4,4);check('填充矩形绘制内部像素',(pixels()[2*8+3]&255)===128);
    pixels().fill(0);setTool('pencil');input('shape-filled',false);input('pixel-perfect',true);pointerEvent('pointerdown',0,0);pointerEvent('pointermove',1,0);pointerEvent('pointermove',1,1);pointerEvent('pointerup',1,1);check('像素完美笔触移除转角冗余像素',pixels()[1]===0&&!!pixels()[0]&&!!pixels()[9]);
    pixels().fill(0);input('pixel-perfect',false);input('brush-shape','circle');setBrush(5);pointerEvent('pointerdown',4,4);pointerEvent('pointerup',4,4);check('圆形笔刷形状适配',pixels()[2*8+2]===0&&!!pixels()[4*8+4]);
    input('brush-shape','square');setBrush(1);pixels()[0]=colorValue('#0000ff');input('ink-mode','simple');setColor('#ff0000');pointerEvent('pointerdown',0,0);pointerEvent('pointerup',0,0);check('简单墨水把不透明颜色直接画上',pixels()[0]===colorValue('#ff0000'));
    pixels()[1]=colorValue('#0000ff');setColor('#00000000');pointerEvent('pointerdown',1,0);pointerEvent('pointerup',1,0);check('简单墨水用透明色当橡皮',pixels()[1]===0);
    pixels()[2]=colorValue('#0000ff');setColor('#ff000080');input('ink-mode','over');pointerEvent('pointerdown',2,0);pointerEvent('pointerup',2,0);const alphaBlend=pixels()[2];input('paint-opacity',50);pixels()[3]=0;pointerEvent('pointerdown',3,0);pointerEvent('pointerup',3,0);check('Alpha 合成按笔刷透明度混合',(alphaBlend>>>24)>0&&(pixels()[3]&255)>0&&(pixels()[3]&255)<255,{blend:alphaBlend,alpha:pixels()[3]&255});
    input('paint-opacity',20);input('ink-mode','copy');setColor('#ff0000');pixels()[4]=colorValue('#0000ff');pointerEvent('pointerdown',4,0);pointerEvent('pointerup',4,0);check('复制 Alpha+颜色 墨水不乘笔刷透明度',pixels()[4]===colorValue('#ff0000'));
    input('paint-opacity',100);input('ink-mode','lock-alpha');pixels()[5]=colorValue('#0000ff80');setColor('#ff0000');pointerEvent('pointerdown',5,0);pointerEvent('pointerup',5,0);check('锁定 Alpha 整替 RGB 并保留目标透明度',pixels()[5]===colorValue('#ff000080'));
    pixels().fill(0);pixels()[0]=colorValue('#ff0000');pixels()[9]=colorValue('#0000ff80');selection={x:0,y:0,w:2,h:2};actions['capture-brush']();input('ink-mode','over');pointerEvent('pointerdown',4,4);pointerEvent('pointerup',4,4);check('选区图案笔刷保留颜色与透明孔洞',pixels()[4*8+4]===colorValue('#ff0000')&&pixels()[4*8+5]===0&&pixels()[5*8+5]===colorValue('#0000ff80'));
    pixels().fill(0);setColor('#00ff00');input('pattern-mode','brush');pointerEvent('pointerdown',2,2);pointerEvent('pointerup',2,2);check('图案对齐到「像普通笔刷」时改成前景色并保留孔洞',pixels()[2*8+2]===colorValue('#00ff00')&&pixels()[2*8+3]===0);
    pixels().fill(0);setColor('#ff0000');input('pattern-mode','destination');pointerEvent('pointerdown',6,6);pointerEvent('pointerup',6,6);check('图案对齐到落点时按落点平铺',pixels()[6*8+6]===colorValue('#ff0000')&&pixels()[7*8+7]===colorValue('#0000ff80'));
    pixels().fill(0);input('pattern-mode','source');pointerEvent('pointerdown',5,5);pointerEvent('pointerup',5,5);check('图案对齐到来源时按选区原位平铺',pixels()[5*8+5]===colorValue('#0000ff80')&&pixels()[6*8+6]===colorValue('#ff0000'));
    const libraryReading=()=>JSON.parse(localStorage.getItem('pixpix-brush-library-v1')||'[]');
    input('pattern-mode','destination');const savingPatternBrush=savePatternBrushToLibrary();const brushForm=$('modal-form');brushForm.elements.name.value='验收图案笔刷';brushForm.requestSubmit($('modal-submit'));await savingPatternBrush;check('图案笔刷可以存进本机笔刷库',libraryReading().some(entry=>entry.name==='验收图案笔刷'&&entry.pattern.data.length===4)&&!!$('pattern-library').value);
    pixels().fill(0);const savedPatternId=libraryReading().find(entry=>entry.name==='验收图案笔刷').id;brushSettings={...brushSettings,shape:'square',pattern:null,patternMode:'destination'};brush=1;updateBrushControls();$('pattern-library').value=savedPatternId;$('pattern-library').dispatchEvent(new Event('change'));check('从本机笔刷库载入恢复图案与对齐方式',brushSettings.shape==='pattern'&&brushSettings.patternMode==='destination'&&brushSettings.pattern?.data.length===4&&pixels().every(value=>value===0));
    deletePatternBrushFromLibrary();check('可以从本机笔刷库删除图案笔刷',!libraryReading().some(entry=>entry.name==='验收图案笔刷'));
    brushPresets();$('preset-name').value='验收图案笔刷';$('preset-save').click();$('brush-presets-menu').querySelector('[data-preset-index="'+(JSON.parse(localStorage.getItem('pixel-studio-brush-presets')).length-1)+'"]').click();$('brush-presets-menu').hidePopover();check('自定义笔刷预设保存与应用',brushSettings.shape==='pattern'&&brush===2&&JSON.parse(localStorage.getItem('pixel-studio-brush-presets')).some(p=>p.name==='验收图案笔刷'&&p.pattern.data.length===4));
  }finally{viewport.setPointerCapture=capture;brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null,patternMode:'destination'};brush=1;updateBrushControls();setColor('#edb75b');}
}

async function runPathSmoke(check){
  replaceDocument(createDocument(12,12,'路径工具验收'),false);setBrush(1);setColor('#edb75b');
  const event=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:13,button:0}));};
  const click=(x,y)=>{event('pointerdown',x,y);event('pointerup',x,y);};
  const key=value=>document.dispatchEvent(new KeyboardEvent('keydown',{key:value,code:value,bubbles:true}));
  const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
    setTool('curve');event('pointerdown',1,8);event('pointermove',9,8);event('pointerup',9,8);event('pointermove',5,0);
    check('曲线二阶段可实时调整弯曲',!!shapeSession&&!!pixels()[4*12+5]&&pixels()[8*12+5]===0);
    if(window.desktop){await assertRecoveryRecord(check,'恢复副本不包含未确认形状',record=>JSON.parse(record.data).frames[0].cels[0].every(p=>p===0));}
    click(5,0);check('曲线点击确认形成一次历史',!shapeSession&&history.undoStack.length===1);actions.undo();check('曲线可整步撤销',pixels().every(p=>p===0));
    event('pointerdown',1,8);event('pointermove',9,8);event('pointerup',9,8);key('Escape');check('Esc 取消曲线预览',!shapeSession&&pixels().every(p=>p===0));
    setTool('polygon');brushSettings.filled=true;updateBrushControls();click(1,1);click(9,1);click(5,9);key('Enter');check('多边形 Enter 闭合并填充',!shapeSession&&!!pixels()[4*12+5]);actions.undo();
    click(1,1);click(9,1);click(5,9);viewport.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));check('多边形支持双击完成',!shapeSession&&!!pixels()[4*12+5]);actions.undo();
    setTool('contour');event('pointerdown',1,1);for(const [x,y]of [[7,1],[7,7],[1,7]])event('pointermove',x,y);event('pointerup',1,7);check('自由轮廓闭合并填充',!!pixels()[4*12+4]);actions.undo();
    setTool('polygon');click(2,2);setTool('pencil');check('切换工具取消未完成多边形',!shapeSession&&pixels().every(p=>p===0));
  }finally{viewport.setPointerCapture=capture;cancelShapeSession();brushSettings.filled=false;updateBrushControls();setTool('pencil');}
}

async function runSelectionSmoke(check){
  replaceDocument(createDocument(12,12,'选区验收'),false);setTool('select');
  const event=(type,x,y,extra={})=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:14,button:0,...extra}));};
  const click=(x,y)=>{event('pointerdown',x,y);event('pointerup',x,y);};
  const drag=(a,b)=>{event('pointerdown',...a);event('pointermove',...b);event('pointerup',...b);};
  const key=key=>document.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true}));
  const capture=viewport.setPointerCapture,oldGrid=gridSettings;viewport.setPointerCapture=()=>{};
  try{
    check('选区工具切换专用选项栏',!$('selection-options').hidden&&uiQuery('.drawing-options').hidden);
    $('selection-kind').value='ellipse';drag([1,1],[5,5]);
    check('椭圆选区排除外框角落',!selectionContains(selection,1,1)&&selectionContains(selection,3,3));
    $('selection-operation').value='subtract';$('selection-kind').value='rect';drag([0,0],[11,11]);
    check('相减空选区保持为空',selection.w===0&&!selectionContains(selection,3,3));
    actions['invert-selection']();check('空选区反选得到全画布',selection.mask.every(v=>v===1)&&selection.w===12);
    actions.deselect();actions.reselect();check('取消后重选恢复遮罩',selection.w===12&&selection.mask.every(v=>v===1));
    $('selection-operation').value='replace';$('selection-kind').value='polygon';
    click(1,1);click(6,1);click(1,6);key('Enter');check('多边形套索确认只修改选区',!shapeSession&&selectionContains(selection,2,2)&&!selectionContains(selection,6,6)&&history.undoStack.length===0);
    const selected=selection;click(8,8);key('Escape');check('Esc 取消多边形恢复原选区',selection===selected&&!shapeSession);
    $('selection-kind').value='lasso';event('pointerdown',2,2);event('pointermove',6,2);event('pointermove',6,6);event('pointermove',2,6);event('pointerup',2,6);
    check('自由套索闭合选区',selectionContains(selection,4,4)&&!selectionContains(selection,1,1));
    pixels().fill(0);pixels()[0]=colorValue('#ff0000');pixels()[1]=colorValue('#ff0000');pixels()[13]=colorValue('#fe0000');$('selection-kind').value='wand';$('wand-tolerance').value=1;click(0,0);
    check('魔棒容差选择当前 cel 连通颜色',selection.mask.reduce((a,b)=>a+b,0)===3);
    actions.copy();check('不规则复制屏蔽外框内的孔洞',clipboard.mask[2]===0&&clipboard.data[2]===0);
    setTool('move');drag([0,0],[3,3]);check('移动保留魔棒遮罩形状',selectionContains(selection,3,3)&&!selectionContains(selection,3,4)&&pixels()[3*12+3]===colorValue('#ff0000'));
    actions['flip-x']();check('翻转同步翻转选区遮罩',!selectionContains(selection,4,4)&&selectionContains(selection,3,4));
    const original=[...pixels()],oldSelection=selection,historySize=history.undoStack.length;
    let pending=transformSelection(),form=$('modal-form');form.elements.width.value=4;form.dispatchEvent(new Event('input'));
    check('选区缩放数值实时预览',selection.w===4&&JSON.stringify(pixels())!==JSON.stringify(original));
    if(window.desktop){await assertRecoveryRecord(check,'恢复副本排除未确认变换',record=>JSON.stringify(JSON.parse(record.data).frames[0].cels[0])===JSON.stringify(original));}
    $('modal').close('cancel');await pending;check('取消变换恢复像素与选区且不增加历史',selection===oldSelection&&JSON.stringify(pixels())===JSON.stringify(original)&&history.undoStack.length===historySize);
    pending=transformSelection();form.elements.angle.value=90;form.dispatchEvent(new Event('input'));form.requestSubmit($('modal-submit'));await pending;
    check('确认旋转仅增加一次历史',history.undoStack.length===historySize+1&&JSON.stringify(pixels())!==JSON.stringify(original));
    actions.undo();check('选区旋转可整步撤销',JSON.stringify(pixels())===JSON.stringify(original));
    actions['select-content']();check('可见内容选区忽略透明像素',selection.mask.reduce((a,b)=>a+b,0)===3);
    const press=(value,code,extra={})=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:value,code,bubbles:true,cancelable:true,...extra}));document.dispatchEvent(new KeyboardEvent('keyup',{key:value,code,bubbles:true,cancelable:true,...extra}));};
    setTool('select');
    const cursors={};for(const kind of ['rect','ellipse','lasso','polygon','wand']){$('selection-kind').value=kind;$('selection-kind').dispatchEvent(new Event('change'));cursors[kind]=viewport.dataset.cursor;}
    check('五种选区模式共用一个选区绘制光标',new Set(Object.values(cursors)).size===5&&Object.entries(cursors).every(([kind,cursor])=>cursor==='select-'+kind)&&new Set(Object.values(cursors).map(cursorStyle)).size===1);
    $('selection-kind').value='rect';$('selection-kind').dispatchEvent(new Event('change'));
    const hold=(type,value)=>{document.dispatchEvent(new KeyboardEvent(type,{key:value,code:'KeyG',bubbles:true,cancelable:true}));};
    gridSettings={x:2,y:2,w:4,h:4,visible:false};
    hold('keydown','g');
    check('按住 G 进入网格选取光标',tool==='select'&&viewport.dataset.cursor==='select-grid'&&modifiers.grid&&$('tool-name').textContent==='网格选取 · 临时');
    click(4,4);
    check('网格点击选中整格',selection.x===2&&selection.y===2&&selection.w===4&&selection.h===4&&selection.mask.reduce((a,b)=>a+b,0)===16);
    drag([4,4],[8,8]);
    check('网格拖动覆盖相邻多格',selection.x===2&&selection.y===2&&selection.w===8&&selection.h===8&&selection.mask.reduce((a,b)=>a+b,0)===64);
    hold('keyup','g');
    check('松开 G 恢复自由矩形',!modifiers.grid&&viewport.dataset.cursor==='select-rect');
    click(4,4);
    check('松开后点击回到单像素矩形',selection.x===4&&selection.y===4&&selection.w===1&&selection.h===1);
    const gridKeymap=keymap;keymap=asepriteKeymap();refreshKeymapLabels();
    hold('keydown','g');click(4,4);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift',code:'ShiftLeft',shiftKey:true,bubbles:true,cancelable:true}));
    event('pointerdown',8,8,{shiftKey:true});event('pointerup',8,8,{shiftKey:true});
    check('网格选取保留 Aseprite Shift 相加',selection.w===8&&selection.h===8&&selection.mask.reduce((a,b)=>a+b,0)===32);
    document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',code:'ShiftLeft',bubbles:true,cancelable:true}));
    hold('keyup','g');keymap=gridKeymap;refreshKeymapLabels();
    mutate(()=>pixels()[0]=colorValue('#123456'),'准备吸色像素');
    const selectedBeforeAlt=selection,historyBeforeAlt=history.undoStack.length,pixelsBeforeAlt=[...pixels()];
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',code:'AltLeft',altKey:true,bubbles:true,cancelable:true}));
    check('选区存在时 Alt 显示临时吸管',viewport.dataset.cursor==='eyedropper'&&tool==='select');
    event('pointerdown',0,0,{altKey:true});event('pointerup',0,0);document.dispatchEvent(new KeyboardEvent('keyup',{key:'Alt',code:'AltLeft',bubbles:true,cancelable:true}));
    check('选区存在时 Alt 取色且不改选区与像素',color==='#123456'&&selection===selectedBeforeAlt&&JSON.stringify(pixels())===JSON.stringify(pixelsBeforeAlt)&&history.undoStack.length===historyBeforeAlt&&viewport.dataset.cursor==='select-rect');
    const keymapBefore=keymap;keymap=defaultKeymap();refreshKeymapLabels();
    press('t','KeyT',{ctrlKey:true});
    for(let wait=0;wait<40&&!transformSession;wait++)await new Promise(r=>setTimeout(r,10));
    check('Ctrl+T 打开选区缩放旋转面板',$('modal').open&&$('modal').classList.contains('transform-dialog')&&$('modal-title').textContent==='缩放 / 旋转选区'&&!!transformSession);
    $('modal').close('cancel');
    for(let wait=0;wait<100&&transformSession;wait++)await new Promise(r=>setTimeout(r,10));
    check('取消 Ctrl+T 变换恢复像素与选区且不改历史',!transformSession&&!$('modal').open&&selection===selectedBeforeAlt&&JSON.stringify(pixels())===JSON.stringify(pixelsBeforeAlt)&&history.undoStack.length===historyBeforeAlt);
    keymap=keymapBefore;refreshKeymapLabels();
  }finally{viewport.setPointerCapture=capture;gridSettings=oldGrid;modifiers.grid=false;cancelShapeSession();$('selection-kind').value='rect';$('selection-operation').value='replace';$('wand-tolerance').value=0;selection=null;setTool('pencil');}
}

async function runTransformSmoke(check){
  replaceDocument(createDocument(24,24,'变换手柄验收'),false);selection={x:5,y:5,w:6,h:4};
  for(let y=5;y<9;y++)for(let x=5;x<11;x++)pixels()[y*24+x]=colorValue((x+y)%2?'#ff000080':'#0000ff');
  const original=[...pixels()],oldSelection=selection;
  const event=(type,p,shift=false)=>{const r=viewport.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+pan.x+p.x*zoom,clientY:r.top+pan.y+p.y*zoom,pointerId:15,button:0,shiftKey:shift}));};
  const drag=(start,end,shift=false)=>{event('pointerdown',start);event('pointermove',end,shift);event('pointerup',end,shift);};
  const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
    let pending=transformSelection();
    check('变换面板允许画布交互并隔离其他编辑控件',$('modal').open&&!$('modal').matches(':modal')&&uiQuery('nav').inert);
    const oldZoom=zoom;viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));check('变换预览期间滚轮缩放视图',zoom<oldZoom&&!!transformSession);scale(oldZoom/zoom);
    const corner=transformPoint(transformSession.state,1,1);event('pointermove',corner);check('缩放手柄切换鼠标样式',viewport.style.cursor==='nwse-resize');
    drag(corner,{x:corner.x+3,y:corner.y+1},true);
    check('角柄 Shift 缩放保持比例并同步数值',transformSession.state.width===9&&transformSession.state.height===6&&+$('modal-form').elements.width.value===9);
    const beforePivot=JSON.stringify(pixels()),center=transformPoint(transformSession.state,.5,.5);drag(center,{x:4,y:4});
    check('拖动中心保持预览像素不变',JSON.stringify(pixels())===beforePivot&&+$('modal-form').elements.pivotX.value===4&&+$('modal-form').elements.pivotY.value===4);
    const pivot=transformPoint(transformSession.state,transformSession.state.u,transformSession.state.v),rotation=transformHandles(transformSession.state,zoom).find(h=>h.id==='rotate');
    drag(rotation,{x:pivot.x-(rotation.y-pivot.y),y:pivot.y+(rotation.x-pivot.x)},true);
    check('旋转手柄绕自定义中心吸附角度',transformSession.state.angle===90&&+$('modal-form').elements.angle.value===90);
    const beforeMove={...transformSession.state},inside=transformPoint(beforeMove,.25,.25);drag(inside,{x:inside.x+2,y:inside.y+3});
    check('旋转后框内移动同步图像与中心',Math.abs(transformSession.state.x-beforeMove.x-2)<1e-8&&Math.abs(transformSession.state.y-beforeMove.y-3)<1e-8);
    const stable=JSON.stringify(transformSession.state),edge=transformPoint(transformSession.state,1,.5);event('pointerdown',edge);event('pointermove',{x:edge.x+3,y:edge.y+2});viewport.dispatchEvent(new Event('lostpointercapture'));
    check('丢失捕获仅取消当前手柄拖动',!transformSession.drag&&JSON.stringify(transformSession.state)===stable);
    const form=$('modal-form'),oldCorners=[[0,0],[1,1]].map(([u,v])=>transformPoint(transformSession.state,u,v));
    form.elements.pivotX.value=1;form.elements.pivotX.dispatchEvent(new Event('input',{bubbles:true}));
    check('数值修改旋转中心不移动外框',oldCorners.every((p,i)=>{const q=transformPoint(transformSession.state,i,i);return Math.hypot(p.x-q.x,p.y-q.y)<1e-8;}));
    if(window.desktop){await assertRecoveryRecord(check,'手柄预览不写入恢复副本',record=>JSON.stringify(JSON.parse(record.data).frames[0].cels[0])===JSON.stringify(original));}
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));await pending;
    check('Esc 取消整次变换并恢复控件',!transformSession&&!$('modal').open&&!uiQuery('nav').inert&&selection===oldSelection&&JSON.stringify(pixels())===JSON.stringify(original)&&history.undoStack.length===0);
    pending=transformSelection();const se=transformPoint(transformSession.state,1,1);drag(se,{x:se.x+2,y:se.y+2});
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));await pending;
    check('Enter 提交手柄变换仅形成一次历史',!transformSession&&history.undoStack.length===1&&JSON.stringify(pixels())!==JSON.stringify(original));
    actions.undo();check('手柄变换撤销恢复 RGBA 像素',JSON.stringify(pixels())===JSON.stringify(original));
    selection=oldSelection;pending=transformSelection();$('modal-form').requestSubmit($('modal-submit'));await pending;
    check('未改变像素的确认不增加历史',history.undoStack.length===0);
  }finally{viewport.setPointerCapture=capture;if($('modal').open){$('modal').close('cancel');await new Promise(r=>setTimeout(r,0));}}
}

async function runTimelineSmoke(check){
  replaceDocument(createDocument(6,6,'timeline-test'),false);actions['add-layer']();
  for(let i=1;i<5;i++)actions['add-frame']();
  doc.frames.forEach((frame,i)=>{frame.duration=(i+1)*20;frame.cels[0][0]=colorValue('#ff0000')+i*256;frame.cels[1][1]=colorValue('#0000ff')+i*256;});render();
  const click=(index,options={})=>uiAll('.frame-head')[index].dispatchEvent(new MouseEvent('click',{bubbles:true,...options}));
  click(0);click(3,{shiftKey:true});check('Shift 点击建立连续帧多选',frameSelection.size===4&&fi===3);
  click(1,{ctrlKey:true});check('Ctrl 点击切换离散帧选择',frameSelection.size===3&&!frameSelection.has(1));
  const original=clone(doc.frames);actions['duplicate-frame']();check('多帧复制包含全部图层且独立',doc.frames.length===8&&frameSelection.size===3&&doc.frames[4].cels[1]!==doc.frames[0].cels[1]);actions.undo();
  click(1);click(3,{shiftKey:true});$('duration').value=200;$('duration').dispatchEvent(new Event('change'));
  check('时间轴时长应用到全部选中帧',doc.frames.slice(1,4).every(f=>f.duration===200)&&doc.frames[0].duration===20);
  actions['frame-fps']();const fpsForm=$('frame-fps-popover').querySelector('form');fpsForm.elements.fps.value=12.5;fpsForm.requestSubmit();
  check('FPS 设置批量转换为毫秒',doc.frames.slice(1,4).every(f=>f.duration===80));
  reorderSelected(0);check('重排保持跨层像素和活动帧',doc.frames[0].cels[0][0]===original[1].cels[0][0]&&doc.frames[2].cels[1][1]===original[3].cels[1][1]&&fi===2);
  actions['reverse-frames']();check('倒序选中帧保持帧内容完整',doc.frames[0].cels[1][1]===original[3].cels[1][1]);actions.undo();actions.undo();
  click(3);const moving=doc.frames[3],source=uiAll('.frame-head')[3],target=uiAll('.frame-head')[0],transfer=new DataTransfer(),bounds=target.getBoundingClientRect();
  source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:bounds.left+1}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:bounds.left+1}));
  check('帧头拖放事件重排全部图层',doc.frames[0]===moving&&fi===0&&!timelineDrag);actions.undo();
  click(1);click(3,{shiftKey:true});const creating=tagEditor();let form=$('modal-form');form.elements.name.value='行走';form.elements.color.value='#668fb7';form.elements.direction.value='reverse';form.requestSubmit($('modal-submit'));await creating;
  check('动画标签按帧范围显示单个 tab',doc.tags.length===1&&doc.tags[0].from===1&&doc.tags[0].to===3&&doc.tags[0].direction==='reverse'&&uiAll('.frame-head .frame-tag-badge').length===0&&uiAll('.timeline-tag-tab').length===1&&uiQuery('.timeline-tag-tab[data-tag="'+doc.tags[0].id+'"]'));
    const tagTab=uiQuery('.timeline-tag-tab');tagTab.click();tagTab.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));const editingTarget=tagTab.isConnected&&$('modal').open;$('modal').close('cancel');await new Promise(r=>setTimeout(r,0));check('标签点击保留双击编辑目标',editingTarget);
  const id=doc.tags[0].id,editing=tagEditor(id);form.elements.name.value='行走循环';form.requestSubmit($('modal-submit'));await editing;
  check('标签名称编辑同步播放范围',doc.tags[0].name==='行走循环'&&$('play-range').selectedOptions[0].textContent==='行走循环');
    let removing=actions['delete-tag']();$('modal').close('cancel');await removing;check('取消删除标签保持项目',doc.tags.length===1);
    removing=actions['delete-tag']();form.requestSubmit($('modal-submit'));await removing;const removed=doc.tags.length===0&&doc.frames.length===5;actions.undo();check('删除标签保留帧且可撤销',removed&&doc.tags.length===1);activateTag(id);
  if(window.desktop){
    await assertRecoveryRecord(check,'动画标签写入恢复并可校验重开',record=>{const recovered=validateDocument(JSON.parse(record.data));return recovered.tags[0].name==='行走循环'&&recovered.tags[0].to===3;});
    for(const mode of ['sheet','metadata']){const exporting=exportDialog(mode);form.elements.columns.value=1;form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await exporting;check('按标签导出 '+mode,$('status').textContent==='导出完成');}
  }
  $('play-once').checked=true;play();check('标签反向播放从范围末帧开始',playing&&previewFrame===3);await new Promise(r=>setTimeout(r,280));check('单次播放结束定位末显示帧',!playing&&fi===1&&previewFrame===1);
  activateTag(id);actions['delete-frame']();check('批量删除清理失去全部成员的标签',doc.frames.length===2&&doc.tags.length===0);actions.undo();check('批量删除与标签可一起撤销',doc.frames.length===5&&doc.tags.length===1);
  click(0);$('frame-insert').value='before';actions['add-frame']();check('指定位置插入空白帧更新标签范围',fi===0&&pixels().every(p=>p===0)&&doc.tags[0].from===2);
  $('frame-insert').value='after';$('play-once').checked=false;stop();
}

async function runOnionSmoke(check){
  const oldSettings={...onionSettings},oldEnabled=$('onion').checked,oldPreferences=localStorage.getItem('pixel-studio-onion');
  const pixel=(index,context=ctx)=>[...context.getImageData(index%doc.width,Math.floor(index/doc.width),1,1).data];
  const configure=values=>{Object.assign(onionSettings,values);draw();};
  try{
    replaceDocument(createDocument(4,2,'onion-test'),false);actions['add-layer']();actions['add-frame']();actions['add-frame']();li=0;
    doc.frames[0].cels[0][0]=colorValue('#11223380');doc.frames[0].cels[1][4]=colorValue('#ffff00');
    doc.frames[1].cels[0][1]=colorValue('#00ff00');doc.frames[2].cels[0][2]=colorValue('#00ffff');doc.frames[2].cels[1][6]=colorValue('#ff00ff');
    onionSettings={...DEFAULT_ONION_SETTINGS,opacity:100};$('onion').checked=true;selectFrame(1);
    check('洋葱皮前红后蓝并保留当前帧',JSON.stringify(pixel(4))===JSON.stringify([239,102,114,255])&&JSON.stringify(pixel(6))===JSON.stringify([91,159,232,255])&&pixel(1)[1]===255);
    check('导航和帧输出不包含洋葱皮',pixel(4,$('preview').getContext('2d'))[3]===0&&pixel(4,frameCanvas(fi).getContext('2d'))[3]===0);
    selectFrame(2);configure({before:2,after:0,opacity:40,falloff:50});
    check('多帧透明度按距离衰减',Math.abs(pixel(1)[3]-102)<=1&&Math.abs(pixel(4)[3]-51)<=1);
    configure({layers:'current'});check('当前图层参考排除其他图层',pixel(4)[3]===0&&Math.abs(pixel(1)[3]-102)<=1);
    selectFrame(1);configure({before:1,after:1,opacity:100,falloff:100,mode:'original',layers:'visible'});
    check('原色参考保留原始颜色',JSON.stringify(pixel(4))===JSON.stringify([255,255,0,255])&&JSON.stringify(pixel(6))===JSON.stringify([255,0,255,255]));
    doc.tags=[{id:'reference',name:'参考范围',from:0,to:1,color:'#edb75b',direction:'forward'}];render();$('play-range').value='reference';configure({limitRange:true});
    check('洋葱皮限制在标签播放范围',pixel(4)[3]===255&&pixel(6)[3]===0);
    selectFrame(0);configure({mode:'tinted',before:3,after:3,wrap:true});
    check('短范围循环不重复参考且优先前帧色',JSON.stringify(pixel(1))===JSON.stringify([239,102,114,255])&&pixel(6)[3]===0);
    selectFrame(2);check('当前帧在限定范围外不显示参考',pixel(1)[3]===0&&pixel(4)[3]===0);
    $('play-range').value='all';selectFrame(1);configure({before:1,after:0,mode:'original',wrap:false,limitRange:false,position:'behind'});
    mutate(()=>{doc.frames[0].cels[0][3]=colorValue('#ff0000');doc.frames[1].cels[0][3]=colorValue('#00ff00');},'叠放验收');
    check('下方洋葱皮被当前不透明像素遮挡',pixel(3)[1]===255&&pixel(3)[0]===0);
    configure({position:'front'});check('上方洋葱皮覆盖当前像素',pixel(3)[0]===255&&pixel(3)[1]===0);
    mutate(()=>doc.frames[0].cels[0][0]=colorValue('#aabbcc'),'缓存验收');check('参考帧修改后缓存刷新',JSON.stringify(pixel(0))===JSON.stringify([170,187,204,255]));
    actions.undo();check('撤销刷新参考缓存',pixel(0)[3]===128);
    const documentBefore=JSON.stringify(doc),historyBefore=history.undoStack.length,dirtyBefore=dirty,preferencesBefore=localStorage.getItem('pixel-studio-onion'),settingsBefore=JSON.stringify(onionSettings);
    $('onion').checked=false;draw();let pending=onionSettingsDialog(),form=$('modal-form');
    check('洋葱皮面板实时预览且隔离编辑',$('modal').open&&!$('modal').matches(':modal')&&uiQuery('nav').inert&&$('onion').checked);
    form.elements.before.value=3;form.elements.after.value=2;form.elements.opacity.value=70;form.dispatchEvent(new Event('input'));
    check('调整参数实时更新参考透明度',onionSettings.before===3&&Math.abs(pixel(0)[3]-90)<=1);
    const bounds=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:bounds.left+zoom*.5,clientY:bounds.top+zoom*.5,pointerId:17,button:0}));
    check('设置预览期间画布不写入像素',JSON.stringify(doc)===documentBefore&&!gesture);
    const zoomBefore=zoom,r=viewport.getBoundingClientRect();viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:100,clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));check('设置预览允许滚轮缩放',zoom<zoomBefore);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));await pending;
    check('取消设置恢复开关参数且不改项目',!$('onion').checked&&JSON.stringify(onionSettings)===settingsBefore&&localStorage.getItem('pixel-studio-onion')===preferencesBefore&&JSON.stringify(doc)===documentBefore&&history.undoStack.length===historyBefore&&dirty===dirtyBefore);
    pending=onionSettingsDialog();form.elements.before.value=2;form.elements.after.value=1;form.elements.opacity.value=55;form.elements.falloff.value=50;form.elements.mode.value='tinted';form.elements.layers.value='current';form.elements.previousColor.value='#e06655';form.elements.nextColor.value='#4488dd';form.elements.wrap.checked=true;form.dispatchEvent(new Event('input'));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));await pending;
    const stored=JSON.parse(localStorage.getItem('pixel-studio-onion'));
    check('确认仅保存本机视图偏好',stored.before===2&&stored.opacity===55&&stored.previousColor==='#e06655'&&stored.enabled&&!uiQuery('nav').inert&&JSON.stringify(doc)===documentBefore&&history.undoStack.length===historyBefore);
    pending=onionSettingsDialog();check('再次打开保留洋葱皮参数',+form.elements.before.value===2&&form.elements.nextColor.value==='#4488dd');$('modal').close('cancel');await pending;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'O',code:'KeyO',ctrlKey:true,shiftKey:true,bubbles:true}));check('洋葱皮快捷键同步开关偏好',!$('onion').checked&&!JSON.parse(localStorage.getItem('pixel-studio-onion')).enabled);
    $('onion').checked=true;configure({before:1,after:0,opacity:100,mode:'original',layers:'visible',position:'behind',wrap:false});
    play();check('播放时隐藏洋葱皮',playing&&pixel(0)[3]===0);play();check('暂停恢复参考且保留开关',!playing&&$('onion').checked&&pixel(0)[3]===128);
    if(window.desktop){
      const exporting=exportDialog('png');form.requestSubmit($('modal-submit'));await exporting;check('开启洋葱皮仍可导出当前帧',$('status').textContent==='导出完成');
      await assertRecoveryRecord(check,'恢复副本不写入洋葱皮视图',record=>record.data===documentBefore);
    }
  }finally{
    if(onionSession){$('modal').close('cancel');await new Promise(r=>setTimeout(r,0));}
    stop();onionSettings=oldSettings;$('onion').checked=oldEnabled;onionCache.clear();frameCache.clear();referenceCache.clear();if(oldPreferences===null)localStorage.removeItem('pixel-studio-onion');else localStorage.setItem('pixel-studio-onion',oldPreferences);draw();
  }
}

async function runCelSmoke(check){
  replaceDocument(createDocument(4,4,'cel-test'),false);actions['add-layer']();actions['add-layer']();for(let i=1;i<5;i++)actions['add-frame']();
  doc.frames.forEach((frame,f)=>frame.cels.forEach((pixels,l)=>{pixels[0]=((f*3+l+1)*256+128)>>>0;pixels[5]=((f*3+l+20)*256+255)>>>0;}));doc.frames[2].cels[2][15]=0xffffffff;render();
  const original=clone(doc),grid=$('timeline-grid'),capture=grid.setPointerCapture;grid.setPointerCapture=()=>{};
  const cell=(frame,layer)=>grid.querySelector(`.cel[data-frame="${frame}"][data-layer="${layer}"]`);
  const click=(frame,layer,shift=false)=>cell(frame,layer).dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:shift,detail:0}));
  const pointer=(type,element)=>{element.scrollIntoView({block:'nearest',inline:'nearest'});const r=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:18,button:0}));};
  const press=(key,extra={})=>document.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key,code:key.length===1?'Key'+key.toUpperCase():key,...extra}));
  try{
    $('timeline-mode').value='cels';$('timeline-mode').dispatchEvent(new Event('change'));grid.scrollTop=0;
    pointer('pointerdown',cell(0,2));pointer('pointermove',cell(1,1));pointer('pointerup',cell(1,1));
    check('拖动建立跨帧跨层 cel 矩形',celRange.fromFrame===0&&celRange.toFrame===1&&celRange.fromLayer===1&&celRange.toLayer===2&&grid.querySelectorAll('.cel.selected').length===4&&!celGesture);
    click(0,2);click(2,0,true);check('Shift 点击扩展双轴 cel 范围',grid.querySelectorAll('.cel.selected').length===9&&frameSelection.size===3);
    grid.focus();press('ArrowLeft',{shiftKey:true});check('时间轴 Shift 方向键扩展 cel 范围',grid.querySelectorAll('.cel.selected').length===6&&fi===1);press('ArrowUp');check('时间轴方向键定位并收回到单 cel',celRange.fromFrame===1&&celRange.toFrame===1&&celRange.fromLayer===1&&celRange.toLayer===1);
    click(0,1);click(1,0,true);const pixelClip=clipboard;grid.focus();press('c',{ctrlKey:true});check('cel 快捷复制使用独立剪贴板',celClipboard.frames===2&&celClipboard.layers===2&&clipboard===pixelClip);
    click(2,2);grid.focus();press('v',{ctrlKey:true});
    check('cel 粘贴覆盖透明像素并保持层序',doc.frames[2].cels[2][0]===original.frames[0].cels[1][0]&&doc.frames[2].cels[1][0]===original.frames[0].cels[0][0]&&doc.frames[2].cels[2][15]===0&&grid.querySelectorAll('.cel.selected').length===4);
    actions.undo();check('cel 粘贴单步撤销并收回选择',JSON.stringify(doc)===JSON.stringify(original)&&grid.querySelectorAll('.cel.selected').length===1);
    click(0,1);click(1,0,true);doc.layers[0].locked=true;let before=JSON.stringify(doc),rangeBefore=JSON.stringify(celRange),historyBefore=history.undoStack.length;
    actions['clear-cels']();check('锁定成员整组拒绝且保留 cel 范围',JSON.stringify(doc)===before&&JSON.stringify(celRange)===rangeBefore&&history.undoStack.length===historyBefore&&$('status').textContent.includes('锁定'));
    doc.layers[0].locked=false;doc.layers[1].visible=false;before=JSON.stringify(doc);const clipBefore=JSON.stringify(celClipboard);actions['cut-cels']();check('隐藏成员拒绝剪切且不改剪贴板',JSON.stringify(doc)===before&&JSON.stringify(celClipboard)===clipBefore&&$('status').textContent.includes('隐藏'));doc.layers[1].visible=true;
    grid.focus();press('x',{ctrlKey:true});check('cel 剪切清除整组并保留结构',celTargets(celRange).every(({frame,layer})=>doc.frames[frame].cels[layer].every(p=>!p))&&doc.frames.length===5&&doc.layers.length===3);actions.undo();
    click(0,1);click(1,0,true);let pending=celMoveDialog(),form=$('modal-form');form.elements.frames.value=1;form.elements.layers.value=1;form.requestSubmit($('modal-submit'));await pending;
    check('cel 重叠移动跨帧跨层不覆盖源快照',doc.frames[1].cels[2][0]===original.frames[0].cels[1][0]&&doc.frames[1].cels[1][0]===original.frames[0].cels[0][0]&&doc.frames[0].cels[0].every(p=>!p));actions.undo();check('cel 移动可整步撤销',JSON.stringify(doc)===JSON.stringify(original));
    click(0,1);click(1,0,true);before=JSON.stringify(doc);historyBefore=history.undoStack.length;pending=celMoveDialog();$('modal').close('cancel');await pending;check('取消 cel 移动不改项目或历史',JSON.stringify(doc)===before&&history.undoStack.length===historyBefore);
    click(4,0);before=JSON.stringify(doc);actions['paste-cels']();check('cel 粘贴越界整组拒绝',JSON.stringify(doc)===before&&$('status').textContent.includes('超出'));
    click(0,1);click(1,0,true);actions['flip-cels-x']();check('多 cel 翻转使用共同内容边界',celTargets(celRange).every(({frame,layer})=>doc.frames[frame].cels[layer][1]===original.frames[frame].cels[layer][0]));actions.undo();
    click(0,1);click(1,0,true);before=JSON.stringify(doc);rangeBefore=JSON.stringify(celRange);historyBefore=history.undoStack.length;pending=transformSelection(true);
    check('批量变换打开统一手柄面板',$('modal-title').textContent.includes('4 个 cel')&&!!transformSession&&!selection);
    form.elements.x.value=1;form.dispatchEvent(new Event('input'));check('批量空间预览更新全部 cel',celTargets(celRange).every(({frame,layer})=>doc.frames[frame].cels[layer][1]===original.frames[frame].cels[layer][0]));
    if(window.desktop){await assertRecoveryRecord(check,'恢复副本排除多 cel 未确认预览',record=>record.data===before);}
    press('Escape');await pending;check('取消批量变换恢复全部 cel 与范围',JSON.stringify(doc)===before&&JSON.stringify(celRange)===rangeBefore&&history.undoStack.length===historyBefore&&!uiQuery('nav').inert);
    pending=transformSelection(true);form.elements.angle.value=90;form.dispatchEvent(new Event('input'));press('Enter');await pending;
    check('批量旋转仅记录一次并保持未选 cel',history.undoStack.length===historyBefore+1&&celTargets(celRange).every(({frame,layer})=>doc.frames[frame].cels[layer][1]===original.frames[frame].cels[layer][0])&&doc.frames[2].cels[2][15]===0xffffffff);actions.undo();check('批量变换撤销恢复全部像素',JSON.stringify(doc)===JSON.stringify(original));
    click(0,1);click(1,0,true);doc.layers[1].locked=true;before=JSON.stringify(doc);await transformSelection(true);check('锁定范围不进入批量变换预览',!$('modal').open&&!transformSession&&JSON.stringify(doc)===before);doc.layers[1].locked=false;
    play();before=JSON.stringify(doc);actions['clear-cels']();check('播放期间禁止 cel 范围修改',playing&&JSON.stringify(doc)===before);stop();
    actions['add-layer']();check('帧层结构修改后 cel 选择收回活动项',celRange.fromFrame===fi&&celRange.toFrame===fi&&celRange.fromLayer===li&&celRange.toLayer===li);
  }finally{grid.setPointerCapture=capture;finishCelSelection(true);$('timeline-mode').value='frames';celRange=null;celClipboard=null;stop();}
}

async function runAnimationSmoke(check,fixture){
  check('运行时支持原生 GIF 动画解码',typeof ImageDecoder==='function');
  const file=await window.desktop.open('gif'),bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));check('原生文件选择区分 GIF',file.type==='gif'&&file.filePath===null);
  const decoded=await decodeGif(bytes,file.name);check('GIF 帧处置与独立解码结果一致',decoded.doc.frames.length===fixture.frames.length&&decoded.doc.width===fixture.width&&decoded.doc.frames.every((frame,i)=>frame.duration===fixture.frames[i].duration&&JSON.stringify(frame.cels[0])===JSON.stringify(fixture.frames[i].pixels)));
  const short=bytes.slice(),control=short.findIndex((value,i)=>value===0x21&&short[i+1]===0xf9);short[control+4]=1;short[control+5]=0;const clamped=await decodeGif(short,'short.gif');check('GIF 原始短时长按项目下限调整',clamped.doc.frames[0].duration===20&&clamped.adjusted===1);
  replaceDocument(createDocument(4,4,'格式验收'),true);const original=JSON.stringify(doc);let pending=importFile(file);
  for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));$('modal').close('cancel');await pending;check('取消 GIF 导入保留当前项目',JSON.stringify(doc)===original&&!dirty);
  pending=importFile(file);for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));$('modal-form').requestSubmit($('modal-submit'));await pending;
  check('GIF 导入成为可编辑逐帧项目',doc.layers.length===1&&doc.frames.length===4&&dirty&&history.undoStack.length===0&&doc.frames[3].cels[0][15]===0);
  const beforeInvalid=JSON.stringify(doc),large=bytes.slice();large[6]=0;large[7]=0x20;large[8]=0;large[9]=0x20;let rejected=false;
  try{await importFile({...file,data:btoa(String.fromCharCode(...large))});}catch{rejected=true;}check('GIF 超出总像素拒绝且解除忙碌状态',rejected&&!busy&&JSON.stringify(doc)===beforeInvalid);
  doc.name='format-test';doc.tags=[{id:'format-range',name:'格式范围',from:0,to:2,color:'#668fb7',direction:'reverse'}];render();activateTag('format-range');let before=JSON.stringify(doc);const historyBefore=history.undoStack.length;
  pending=exportDialog('gif');const form=$('modal-form');check('GIF 导出展示量化与透明选项',!$('gif-options').hidden&&!form.elements.threshold.disabled&&form.elements.matte.disabled);
  form.elements.repeat.value='once';form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await pending;check('GIF 原生导出完成',$('status').textContent.startsWith('导出完成'));
  const exported=await window.desktop.open('gif'),roundtrip=await decodeGif(Uint8Array.from(atob(exported.data),c=>c.charCodeAt(0)),exported.name),order=[2,1,0];
  check('GIF 按标签反向导出保留时长和最近邻像素',roundtrip.doc.width===8&&roundtrip.doc.height===8&&roundtrip.doc.frames.length===3&&roundtrip.doc.frames.every((frame,i)=>frame.duration===fixture.frames[order[i]].duration&&frame.cels[0].every((pixel,p)=>pixel===fixture.frames[order[i]].pixels[Math.floor(Math.floor(p/8)/2)*4+Math.floor((p%8)/2)])));
  doc.frames[0].cels[0][14]=colorValue('#11223380');invalidateFrame(0);before=JSON.stringify(doc);
  pending=exportDialog('sequence');check('PNG 序列不暴露 GIF 专属选项',$('gif-options').hidden&&form.elements.colors.disabled);form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await pending;const firstFolder=$('status').textContent;check('PNG 序列导出完成',firstFolder.startsWith('导出完成'));
  pending=exportDialog('sequence');form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await pending;check('重复序列导出生成独立目录',$('status').textContent.startsWith('导出完成')&&$('status').textContent!==firstFolder);
  check('动画导出不修改项目与历史',JSON.stringify(doc)===before&&history.undoStack.length===historyBefore);
  doc.name='cancel-save';pending=exportDialog('gif');form.requestSubmit($('modal-submit'));await pending;check('取消 GIF 文件路径不写出文件',$('status').textContent==='已取消导出');doc.name='format-test';
  const many=createDocument(1,1,'帧数验收');for(let i=1;i<130;i++)addFrame(many,i-1);replaceDocument(many,true);pending=exportDialog('gif');form.elements.direction.value='pingpong';form.requestSubmit($('modal-submit'));check('GIF 往返输出帧数超过上限保留对话框',$('modal').open&&$('modal-error').textContent.includes('256'));$('modal').close('cancel');await pending;
}

window.runDroppedFileSmoke=async()=>{const target=documentTabs.items.find(item=>item.state.doc.name==='recent-B');switchDocument(target.id);const dt=new DataTransfer();dt.items.add($('file-input').files[0]);document.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));for(let i=0;i<100&&doc.name!=='recent-A';i++)await new Promise(r=>setTimeout(r,10));return{ok:doc.name==='recent-A'&&pixels()[0]===colorValue('#ff0000')&&documentTabs.items.length===2,name:doc.name,pixel:pixels()[0],tabs:documentTabs.items.length,file:$('file-input').files[0]?.name};};
window.runFileNavigationSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{const startup=await window.desktop.startupFiles();check('启动队列文件通过同一读取链路',startup.length===1&&startup[0].name==='startup.pix');await window.desktop.clearRecent();replaceDocument(createDocument(3,3,'recent-A'),true);mutate(()=>pixels()[0]=colorValue('#ff0000'));await saveProject();const a=documentId,pathA=filePath;replaceDocument(createDocument(4,4,'recent-B'),true,null,crypto.randomUUID(),true);await saveProject();const b=documentId;const recent=await window.desktop.recentFiles();check('保存更新最近文件并排序',recent.length===2&&recent[0].name==='recent-B.pix');let pending=closeDocumentTab(b);await pending;check('关闭保存文档移除标签',documentTabs.items.length===1);reopenDocument();check('重开恢复文档路径和历史',documentId===b&&filePath.endsWith('recent-B.pix')&&doc.width===4);switchDocument(a);const count=documentTabs.items.length;const opened=await window.desktop.openRecent(1);await importFile(opened,true);check('最近文件重复打开切回已有标签',documentTabs.items.length===count&&documentId===a&&filePath===pathA);pending=recentDialog();for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));$('modal').close('cancel');await pending;check('取消最近文件保持当前标签',documentId===a);await window.desktop.clearRecent();check('清空最近记录不关闭文档',(await window.desktop.recentFiles()).length===0&&documentTabs.items.length===2);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runDocumentsSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{replaceDocument(createDocument(2,2,'文档 A'),true);const a=documentId;mutate(()=>pixels()[0]=colorValue('#ff0000'));selection={x:0,y:0,w:1,h:1};zoom=10;pan={x:20,y:30};replaceDocument(createDocument(4,4,'文档 B'),true,null,crypto.randomUUID(),true);const b=documentId;mutate(()=>pixels()[0]=colorValue('#0000ff'));zoom=3;pan={x:4,y:5};const tabBefore=uiQuery(`.document-tab[data-document-id="${a}"]`),tabRect=tabBefore.getBoundingClientRect(),stripRight=uiQuery('.document-strip').getBoundingClientRect().right;switchDocument(a);const tabAfter=uiQuery(`.document-tab[data-document-id="${a}"]`),tabRectAfter=tabAfter.getBoundingClientRect();check('点击可拖动文件标签不重建标签或收缩右侧',tabBefore===tabAfter&&tabRectAfter.width===tabRect.width&&tabRectAfter.right===tabRect.right&&uiQuery('.document-strip').getBoundingClientRect().right===stripRight);check('标签切换恢复独立视图选区历史',doc.name==='文档 A'&&zoom===10&&pan.x===20&&selection.w===1&&history.undoStack.length===1&&dirty);actions.undo();check('文档 A 撤销只影响 A',pixels()[0]===0);actions.redo();actions.copy();switchDocument(b);check('文档 B 像素和历史保持',pixels()[0]===colorValue('#0000ff')&&zoom===3&&history.undoStack.length===1);actions.paste();check('跨不同尺寸文档复制粘贴',pixels()[0]===colorValue('#ff0000')&&doc.width===4);let pending=closeDocumentTab(b);$('modal').close('cancel');await pending;check('取消关闭保留脏文档',documentTabs.items.length===2&&documentId===b);pending=closeDocumentTab(b);$('modal').close('discard');await pending;check('放弃关闭只移除对应标签',documentTabs.items.length===1&&documentId===a&&doc.name==='文档 A');check('标签界面同步数量',uiAll('.document-tab').length===1);const pathASaved=await saveProject();const pathA=filePath;replaceDocument(createDocument(6,6,'文档 C'),true,null,crypto.randomUUID(),true);const c=documentId;mutate(()=>pixels()[0]=colorValue('#00ff00'));let closing=requestClose();$('modal').close('cancel');await closing;check('关闭窗口取消保留后台脏文档',documentTabs.items.length===2&&!closePending);await saveProject();const pathC=filePath;switchDocument(a);mutate(()=>pixels()[1]=colorValue('#00ff00'));await saveProject();check('切换文档保存沿用各自路径',pathASaved&&filePath===pathA&&pathA!==pathC);switchDocument(c);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runInputSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{inputPreferences={...DEFAULT_INPUT};replaceDocument(createDocument(8,8,'Input'),true);const original=JSON.stringify(doc);let pending=inputDialog(),form=$('modal-form');form.elements.right.value='eyedropper';form.elements.wheel.value='pan';form.elements.invert.checked=true;form.requestSubmit($('modal-submit'));await pending;check('右键吸色动作与光标适配',currentMode(2).tool==='eyedropper'&&currentMode(2).cursor==='eyedropper');const before=pan.y;viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:10,bubbles:true,cancelable:true}));check('反向滚轮平移实际改变视图',pan.y>before);check('鼠标设置落盘',loadInput(localStorage).wheel==='pan'&&loadInput(localStorage).invert);pending=inputDialog();form.elements.left.value='pan';$('modal').close('cancel');await pending;check('取消不改变鼠标设置',inputPreferences.left==='tool');check('输入偏好不修改项目或历史',JSON.stringify(doc)===original&&!dirty&&history.undoStack.length===0);void inputDialog();return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runAseKeysSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{keymap=asepriteKeymap();refreshKeymapLabels();replaceDocument(createDocument(8,8,'Keys'),true);const press=(key,code,options={})=>document.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,...options}));viewport.focus();press('U','KeyU',{shiftKey:true});check('Aseprite Shift U 切换椭圆',tool==='ellipse');press('M','KeyM',{shiftKey:true});check('Shift M 切换椭圆选区',tool==='select'&&$('selection-kind').value==='ellipse');press('N','KeyN',{shiftKey:true});await new Promise(r=>setTimeout(r,0));check('Shift N 新建图层',doc.layers.length===2);press('N','KeyN',{altKey:true});await new Promise(r=>setTimeout(r,0));check('Alt N 复制动画帧',doc.frames.length===2);$('onion').checked=false;press('F3','F3');await new Promise(r=>setTimeout(r,0));check('F3 切换洋葱皮',$('onion').checked);check('选择修饰键语义',selectionOperationFor('aseprite',{shiftKey:true})==='add'&&selectionOperationFor('aseprite',{shiftKey:true,altKey:true})==='subtract'&&selectionOperationFor('aseprite',{shiftKey:true,ctrlKey:true})==='intersect');void keymapDialog();return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runKeymapSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{keymap=defaultKeymap();refreshKeymapLabels();const original=JSON.stringify(doc);let pending=keymapDialog();const input=$('keymap-list').querySelector('[data-binding="tool:pencil"]');input.value='J';input.dispatchEvent(new Event('input'));$('modal-form').requestSubmit($('modal-submit'));await pending;check('编辑快捷键后工具提示同步',keymap.bindings['tool:pencil'][0]==='J'&&uiQuery('[data-tool="pencil"] .tool-key').textContent==='J');viewport.focus();setTool('eraser');document.dispatchEvent(new KeyboardEvent('keydown',{key:'j',code:'KeyJ',bubbles:true}));check('自定义按键实际切换工具',tool==='pencil');check('本机存储恢复快捷键',loadKeymap(localStorage).bindings['tool:pencil'][0]==='J');pending=keymapDialog();const conflict=$('keymap-list').querySelector('[data-binding="tool:eraser"]');conflict.value='J';conflict.dispatchEvent(new Event('input'));$('modal-form').requestSubmit($('modal-submit'));check('重复按键冲突阻止保存',$('modal').open&&$('modal-error').textContent.includes('冲突'));$('modal').close('cancel');await pending;check('取消保留原键位且项目不变',keymap.bindings['tool:eraser'][0]==='E'&&JSON.stringify(doc)===original);void keymapDialog();$('modal-form').elements.search.value='pencil';$('modal-form').elements.search.dispatchEvent(new Event('input'));check('搜索筛选快捷键行',[...$('keymap-list').children].filter(row=>!row.hidden).length===1);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runAseWriteSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{const fixture=await window.desktop.open('aseprite');replaceDocument(validateDocument(fixture.doc),true);const original=JSON.stringify(doc);let pending=exportAsepriteDialog();$('modal-form').requestSubmit($('modal-submit'));await pending;check('原生 ASE 文件导出完成',$('status').textContent==='已导出 Aseprite RGBA');const read=await window.desktop.open('aseprite');check('原生文件跨层像素和时长往返',JSON.stringify(read.doc.frames)===JSON.stringify(doc.frames)&&read.doc.layers.length===doc.layers.length);check('原生标签切片和色板往返',read.doc.tags[0].name===doc.tags[0].name&&read.doc.slices[0].center.w===doc.slices[0].center.w&&JSON.stringify(read.doc.palette.map(colorValue))===JSON.stringify(doc.palette.map(colorValue)));check('原生导出不改文档保存状态',JSON.stringify(doc)===original&&!dirty&&history.undoStack.length===0);doc.name='cancel-save';pending=exportAsepriteDialog();$('modal-form').requestSubmit($('modal-submit'));await pending;check('取消 ASE 路径不写出',$('status').textContent==='已取消导出');return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runAseReadSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{replaceDocument(createDocument(2,2,'ASE read'),true);const before=JSON.stringify(doc),file=await window.desktop.open('aseprite');let pending=importFile(file);check('ASE 预览显示明确兼容说明',$('modal-title').textContent==='导入 Aseprite · RGBA');$('modal').close('cancel');await pending;check('取消 ASE 导入保留当前项目',JSON.stringify(doc)===before&&!dirty);pending=importFile(file);$('modal-form').requestSubmit($('modal-submit'));await pending;check('ASE 导入恢复图层动画及 Slice',doc.layers.length===2&&doc.frames.length===2&&celPixels(doc,1,0)[3]===0x0000ff80&&doc.slices[0].pivot.x===1&&dirty&&!filePath);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runSlicesSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{localStorage.removeItem(EXPORT_SETTINGS_KEY);replaceDocument(createDocument(8,8,'slices-test'),true);selection={x:1,y:1,w:6,h:6};let pending=sliceDialog();const form=$('modal-form');form.elements.sliceName.value='按钮';form.elements.pivot.checked=true;form.elements.px.value=3;form.elements.py.value=3;form.elements.center.checked=true;form.elements.cx.value=1;form.elements.cy.value=1;form.elements.cw.value=2;form.elements.ch.value=2;form.requestSubmit($('modal-submit'));await pending;check('从选区创建命名切片和九宫格',doc.slices.length===1&&doc.slices[0].bounds.x===1&&doc.slices[0].center.w===2&&doc.slices[0].pivot.x===3);actions.undo();check('切片编辑可撤销',doc.slices.length===0);actions.redo();check('切片编辑可重做',doc.slices.length===1);const before=JSON.stringify(doc);pending=sliceDialog();$('modal').close('cancel');await pending;check('取消切片编辑不改项目',JSON.stringify(doc)===before);pending=exportDialog('sheet-pair');form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await pending;check('切片进入导出 JSON',$('status').textContent.startsWith('导出完成 · '));check('切片叠加层不污染像素',doc.frames[0].cels[0].every(p=>p===0));void sliceDialog();form.elements.target.value=doc.slices[0].id;form.elements.target.dispatchEvent(new Event('change'));return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runColorPanelSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const el=$('palette'),capture=el.setPointerCapture,release=el.releasePointerCapture,host=$('color-adjustments');
 const channel=(key,value)=>{const input=host.querySelector(`[data-channel="${key}"] input[type=number]`);input.value=value;input.dispatchEvent(new Event('change'));};
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 let clipboardStubbed=false;
 try{Object.defineProperty(navigator,'clipboard',{value:{_text:'',writeText:async function(value){this._text=value;},readText:async function(){return this._text;}},configurable:true});clipboardStubbed=true;}catch{}
 try{
  replaceDocument(createDocument(2,2,'color-panel-test'),true);
  doc.palette=['#ff0000','#00ff00','#0000ff','#ffffff'];colorIndex=0;paletteDomKey='';setColor('#ff0000');renderColors();
  el.setPointerCapture=()=>{};el.releasePointerCapture=()=>{};
  const swatch=index=>el.children[index];
  const actionBar=()=>document.querySelector('.palette-edit-actions');
  const center=index=>{const box=swatch(index).getBoundingClientRect();return{x:box.left+box.width/2,y:box.top+box.height/2};};
  const pointer=(type,index,id,dx=0)=>{const point=center(index);(type==='pointerdown'?swatch(index):el).dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,button:0,clientX:point.x+dx,clientY:point.y,isPrimary:true}));};
  const keydown=(key,extra={},target=document.body)=>target.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
  const foregroundBefore=color,paletteBefore=JSON.stringify(doc.palette);
  channel('h',180);
  check('非编辑态通道滑条只改前景色',color!==foregroundBefore&&JSON.stringify(doc.palette)===paletteBefore);
  setColor('#ff0000');renderColors();
  setPaletteEditing(true);
  check('编辑按钮进入内联色板编辑',paletteEditing&&el.classList.contains('editing')&&document.querySelector('[data-action="palette-editor"]').getAttribute('aria-pressed')==='true');
  check('进入编辑自动选中当前前景色',paletteSelection.size===1&&paletteActive===0&&swatch(0).classList.contains('edit-selected'));
  pointer('pointerdown',2,30);pointer('pointerup',2,30);
  check('点击色块稳定单选并高亮',paletteSelection.size===1&&paletteSelection.has(2)&&swatch(2).classList.contains('edit-selected')&&!swatch(0).classList.contains('edit-selected'));
  const barNode=actionBar(),reorderNode=barNode.querySelector('[data-palette-action="reorder"]'),deleteNode=barNode.querySelector('[data-palette-action="delete"]');
  const selBox=()=>{const r=swatch(2).getBoundingClientRect(),b=el.getBoundingClientRect();return{right:r.right-b.left,top:r.top-b.top,bottom:r.bottom-b.top};};
  const near=(a,b)=>Math.abs(a-b)<1.5;
  check('拖动与删除图标中心压在选中高亮描边角点上',barNode.parentElement===el&&!document.querySelector('.color-action-row .palette-edit-actions')&&(()=>{const c=n=>{const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}},s=swatch(2).getBoundingClientRect();return near(c(deleteNode).x,s.right)&&near(c(deleteNode).y,s.top)&&near(c(reorderNode).x,s.right)&&near(c(reorderNode).y,s.bottom)})()&&parseFloat(deleteNode.style.top)<parseFloat(reorderNode.style.top));
  pointer('pointerdown',0,31);pointer('pointermove',3,31);
  check('拖动前伸覆盖起点到末端且无可见选框',paletteSelection.size===4&&[0,1,2,3].every(index=>paletteSelection.has(index))&&!document.querySelector('.palette-marquee'));
  check('前伸时锚点落在末端色块',paletteActive===3&&swatch(3).classList.contains('edit-active')&&!swatch(0).classList.contains('edit-active'));
  pointer('pointermove',1,31);
  check('回拖立即收缩到起点到当前覆盖范围',paletteSelection.size===2&&[0,1].every(index=>paletteSelection.has(index))&&!paletteSelection.has(2)&&!paletteSelection.has(3)&&paletteActive===1&&swatch(1).classList.contains('edit-active'));
  pointer('pointermove',2,31);pointer('pointermove',3,31);pointer('pointerup',3,31);
  check('回拖后再前伸恢复完整范围且锚点跟随末端',paletteSelection.size===4&&paletteActive===3&&swatch(3).classList.contains('edit-active'));
  const foreground=color,edited=doc.palette[3];
  channel('s',100);
  check('编辑态通道滑条修改选中色块',doc.palette[3]!==edited&&color===foreground);
  actions.undo();check('编辑态色阶改色可撤销',doc.palette[3]===edited);
  $('hex').value='#abcdef';$('hex').dispatchEvent(new Event('change'));
  check('编辑态 HEX 修改选中色块',doc.palette[3]==='#abcdef'&&color===foreground);
  actions.undo();
  pointer('pointerdown',0,32);pointer('pointerup',0,32);
  actionBar().querySelector('[data-palette-action="reorder"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:33,button:0,clientX:center(0).x,clientY:center(0).y,isPrimary:true}));
  pointer('pointermove',3,33,8);pointer('pointerup',3,33);
  check('仅操作栏手柄拖动才排序',doc.palette[3]==='#ff0000'&&paletteSelection.has(3)&&paletteActive===3);
  const order=JSON.stringify(doc.palette);
  pointer('pointerdown',0,34);pointer('pointermove',3,34);pointer('pointerup',3,34);
  check('拖动色块本身只做多选不排序',JSON.stringify(doc.palette)===order);
  pointer('pointerdown',3,35);pointer('pointerup',3,35);
  actionBar().querySelector('[data-palette-action="delete"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  check('操作栏删除按钮删除选中色块',doc.palette.length===3&&!doc.palette.includes('#ff0000'));
  pointer('pointerdown',0,36);pointer('pointerup',0,36);
  swatch(0).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(0).x,clientY:center(0).y}));
  const menu=document.querySelector('.palette-context-menu');
  check('编辑态右键菜单项目完整',!!menu&&[...menu.querySelectorAll('button')].map(button=>button.textContent).join('|')==='修改颜色|复制色值|粘贴色值|在右侧插入颜色|删除颜色');
  const lengthBeforeInsert=doc.palette.length,copiedColor=doc.palette[0];
  menu.querySelector('[data-menu-action="在右侧插入颜色"]').click();
  check('右键菜单在右侧插入颜色',doc.palette.length===lengthBeforeInsert+1&&doc.palette[1]===copiedColor);
  pointer('pointerdown',0,37);pointer('pointerup',0,37);
  swatch(0).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(0).x,clientY:center(0).y}));
  document.querySelector('.palette-context-menu [data-menu-action="复制色值"]').click();
  await tick();
  pointer('pointerdown',2,38);pointer('pointerup',2,38);
  swatch(2).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(2).x,clientY:center(2).y}));
  document.querySelector('.palette-context-menu [data-menu-action="粘贴色值"]').click();
  await tick();
  check('右键复制与粘贴色值',clipboardStubbed?doc.palette[2]===normalizeColor(copiedColor):true);
  pointer('pointerdown',2,39);pointer('pointerup',2,39);
  swatch(2).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(2).x,clientY:center(2).y}));
  const deleteMenu=document.querySelector('.palette-context-menu'),lengthBeforeDelete=doc.palette.length;
  deleteMenu.querySelector('[data-menu-action="删除颜色"]').click();
  check('右键菜单删除颜色',doc.palette.length===lengthBeforeDelete-1);
  swatch(0).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(0).x,clientY:center(0).y}));
  document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  check('点击菜单外关闭右键菜单',!document.querySelector('.palette-context-menu'));
  pointer('pointerdown',0,40);pointer('pointerup',0,40);
  keydown('c',{ctrlKey:true});
  await tick();
  check('编辑态 Ctrl+C 复制选中色块',clipboardStubbed?navigator.clipboard._text===doc.palette[0].toUpperCase():true);
  pointer('pointerdown',1,41);pointer('pointerup',1,41);
  const keyboardBase=doc.palette.slice();
  keydown('v',{ctrlKey:true});
  await tick();
  check('编辑态 Ctrl+V 在选中色块右侧插入',doc.palette.length===keyboardBase.length+1&&doc.palette[2]===normalizeColor(keyboardBase[1])&&paletteActive===2);
  keydown('Delete');
  check('编辑态 Del 删除选中色块',doc.palette.length===keyboardBase.length&&paletteActive===2);
  pointer('pointerdown',0,42);pointer('pointermove',2,42);pointer('pointerup',2,42);
  const multiCopied=[0,1,2].map(index=>doc.palette[index]),multiBase=doc.palette.length;
  keydown('c',{ctrlKey:true});
  await tick();
  check('编辑态多选 Ctrl+C 复制全部颜色',clipboardStubbed?navigator.clipboard._text===multiCopied.map(value=>value.toUpperCase()).join('\n'):true);
  pointer('pointerdown',0,43);pointer('pointerup',0,43);
  keydown('v',{ctrlKey:true});
  await tick();
  check('编辑态多选 Ctrl+V 粘贴全部颜色且顺序正确',doc.palette.length===multiBase+3&&multiCopied.every((value,offset)=>doc.palette[1+offset]===normalizeColor(value))&&paletteSelection.size===3&&[1,2,3].every(index=>paletteSelection.has(index))&&paletteActive===3);
  actions.undo();
  check('多色粘贴整步可撤销',doc.palette.length===multiBase);
  const beforeHexShortcut=JSON.stringify(doc.palette);
  $('hex').focus();keydown('v',{ctrlKey:true},$('hex'));
  await tick();
  check('编辑态焦点在 HEX 输入时快捷键不触发',JSON.stringify(doc.palette)===beforeHexShortcut);
  const paletteBeforeOneColor=[...doc.palette];
  doc.palette=['#ff0000'];paletteActive=0;paletteSelection=new Set([0]);paletteDomKey='';renderPalette();
  keydown('Delete');
  check('编辑态 Del 保留至少一色',doc.palette.length===1&&doc.palette[0]==='#ff0000');
  doc.palette=paletteBeforeOneColor;paletteActive=0;paletteSelection=new Set([0]);paletteDomKey='';renderPalette();syncPaletteSelection();
  setPaletteEditing(false);
  const paletteWhileIdle=JSON.stringify(doc.palette),idleColor=color;
  keydown('v',{ctrlKey:true});
  await tick();
  keydown('Delete');
  check('非编辑态快捷键不修改色板',JSON.stringify(doc.palette)===paletteWhileIdle);
  channel('h',240);
  check('非编辑态色阶不影响色板',JSON.stringify(doc.palette)===paletteWhileIdle&&color!==idleColor);
  swatch(0).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:center(0).x,clientY:center(0).y}));
  check('非编辑态右键不弹菜单也不进入编辑',!paletteEditing&&!document.querySelector('.palette-context-menu'));
  setColor('#ff0000');
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{el.setPointerCapture=capture;el.releasePointerCapture=release;if(clipboardStubbed){try{delete navigator.clipboard;}catch{}}}
};
window.runColorModesSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const capture=viewport.setPointerCapture;try{inputPreferences={...DEFAULT_INPUT};penPreferences={...DEFAULT_PEN,mode:'none'};brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=1;updateBrushControls();const sample=createDocument(4,4,'color-modes-test');sample.palette=['#00000000','#ff0000ff','#ff0000ff','#00ff0080','#ffffffff'];sample.frames[0].cels[0].fill(0xff0000ff);replaceDocument(sample,true);setTool('pencil');const form=$('modal-form'),convert=async(mode)=>{const pending=colorModeDialog();form.elements.mode.value=mode;form.elements.mode.dispatchEvent(new Event('change'));if(mode==='indexed'){form.elements.palette.value='current';form.elements.colors.value=5;}form.requestSubmit($('modal-submit'));await pending;};await convert('indexed');check('模式面板生成真实索引并更新模式标记',doc.colorMode==='indexed'&&doc.frames[0].indices[0].every(i=>i===1)&&$('doc-color-mode').dataset.mode==='INDEXED 8');setColor('#ff0000',2);viewport.setPointerCapture=()=>{};const point=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:79,button:0}));};point('pointerdown',0,0);point('pointerup',0,0);check('相同RGBA的不同索引可实际绘画并记录历史',doc.frames[0].indices[0][0]===2&&history.undoStack.at(-1).indexChanges.length>0);actions.undo();check('索引变化可独立撤销',doc.frames[0].indices[0][0]===1);actions.redo();setPaletteColor(2,'#0000ffff');check('修改索引色槽只改变引用它的像素',pixels()[0]===0x0000ffff&&pixels()[1]===0xff0000ff&&doc.frames[0].indices[0][0]===2);const before=JSON.stringify(doc);point('pointerdown',2,2);viewport.dispatchEvent(new Event('pointercancel'));check('取消索引笔画同时恢复RGBA与索引',JSON.stringify(doc)===before);await saveProject();const opened=validateDocument(JSON.parse((await window.desktop.openRecent(0)).data));check('项目保存重开保留索引与透明槽',JSON.stringify(opened.frames[0].indices)===JSON.stringify(doc.frames[0].indices)&&opened.transparentIndex===0);await window.desktop.exportAseprite(doc);let ase=await window.desktop.open('aseprite');check('8位ASE实际读写保留索引',ase.doc.colorMode==='indexed'&&JSON.stringify(ase.doc.frames[0].indices)===JSON.stringify(doc.frames[0].indices));await convert('grayscale');check('灰度转换生成相同RGB通道并保留Alpha',doc.colorMode==='grayscale'&&!doc.frames[0].indices&&pixels().every(v=>(v>>>24)===(v>>>16&255)&&(v>>>24)===(v>>>8&255)));await window.desktop.exportAseprite(doc);ase=await window.desktop.open('aseprite');check('16位灰度ASE实际读写保持像素',ase.doc.colorMode==='grayscale'&&JSON.stringify(ase.doc.frames[0].cels)===JSON.stringify(doc.frames[0].cels));actions.undo();check('模式转换撤销恢复完整索引数据',doc.colorMode==='indexed'&&doc.frames[0].indices[0][0]===2);actions['duplicate-frame']();frameSelection=new Set([0,1]);actions['link-cels']();setColor('#ffffff',4);point('pointerdown',3,3);point('pointerup',3,3);check('链接索引图像同步颜色与索引别名',doc.frames[0].indices[0]===doc.frames[1].indices[0]&&doc.frames[0].cels[0]===doc.frames[1].cels[0]&&doc.frames[0].indices[0][15]===4);const outputPixel=Array.from(frameCanvas(fi).getContext('2d').getImageData(3,3,1,1).data),previewPixel=Array.from($('preview').getContext('2d').getImageData(3,3,1,1).data);check('索引绘画RGBA与导航像素一致 '+JSON.stringify({pixel:pixels()[15],outputPixel,previewPixel}),pixels()[15]===0xffffffff&&outputPixel.every(v=>v===255)&&previewPixel.every(v=>v===255));return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;}};

window.runCelLinksSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const capture=viewport.setPointerCapture;try{replaceDocument(createDocument(8,8,'cel-links-test'),true);penPreferences={...DEFAULT_PEN,mode:'none'};inputPreferences={...DEFAULT_INPUT};setBrush(1);setTool('pencil');setColor('#ff0000');mutate(()=>pixels()[0]=0xff0000ff);actions['duplicate-frame']();frameSelection=new Set([0,1]);fi=0;actions['link-cels']();check('链接所选帧建立共享图像与时间轴标记',doc.frames[0].cels[0]===doc.frames[1].cels[0]&&uiAll('.cel.linked').length===2);fi=1;render();viewport.setPointerCapture=()=>{};const event=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:77,button:0}));};event('pointerdown',2,2);event('pointerup',2,2);check('编辑后全部链接成员同步',doc.frames.every(f=>f.cels[0][18]===0xff0000ff));actions.undo();check('撤销恢复全部成员像素和共享关系',doc.frames.every(f=>f.cels[0][18]===0)&&doc.frames[0].cels[0]===doc.frames[1].cels[0]);actions.redo();const before=JSON.stringify(doc),entries=history.undoStack.length;event('pointerdown',3,3);viewport.dispatchEvent(new Event('pointercancel'));check('取消链接笔画恢复全部成员且不加历史',JSON.stringify(doc)===before&&history.undoStack.length===entries);frameSelection=new Set([1]);actions['unlink-cels']();check('取消链接保留内容并断开别名',doc.frames[0].cels[0]!==doc.frames[1].cels[0]&&doc.frames[1].cels[0][18]===0xff0000ff);$('layer-continuous').checked=true;$('layer-continuous').dispatchEvent(new Event('change'));actions['add-frame']();check('连续层新建空白帧实际链接前帧',doc.frames[fi].cels[0]===doc.frames[fi-1].cels[0]&&linkedMembers(doc,fi,0).length===2);await saveProject();const file=await window.desktop.openRecent(0),opened=validateDocument(JSON.parse(file.data));check('项目重开恢复真实共享关系',opened.frames[fi].cels[0]===opened.frames[fi-1].cels[0]);await window.desktop.exportAseprite(doc);const ase=await window.desktop.open('aseprite'),restored=validateDocument(ase.doc);check('ASE 原生链接与连续层标志往返',restored.layers[0].continuous&&!!ase.doc.frames[fi].links[1]&&ase.doc.frames[fi].links[1]===ase.doc.frames[fi-1].links[1]&&restored.frames[fi].cels[0]===restored.frames[fi-1].cels[0]);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;}};

window.runLayerTypesSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{replaceDocument(createDocument(8,8,'layer-types-test'),true);setTool('pencil');setBackground('#112233');actions['toggle-background']();check('背景转换铺满且固定底部',isBackground(doc.layers[0])&&pixels().every(v=>(v&255)===255));const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};try{setTool('eraser');const r=canvas.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+zoom*.5,clientY:r.top+zoom*.5,pointerId:67,button:0}));check('背景橡皮恢复铺底色而非透明',pixels()[0]===0x112233ff);}finally{viewport.setPointerCapture=capture;}const backgroundIndex=li;await importReferenceImage();check('导入参考完整保存源图数据',isReference(doc.layers[li])&&doc.layers[li].reference.width===4&&doc.layers[li].reference.data.length>0);check('参考只读并使用禁止绘画光标',!editable()&&currentMode().blocked);const referenceIndex=li,editor=Array.from(frameCanvas(fi,true).getContext('2d').getImageData(0,0,8,8).data),output=Array.from(frameCanvas(fi).getContext('2d').getImageData(0,0,8,8).data);check('编辑参考图可见，导航和输出隔离',editor.some((v,i)=>v!==output[i])&&output.every((v,i)=>v===[17,34,51,255][i%4]));const pending=referenceSettings(),form=$('modal-form');form.elements.x.value=2;form.elements.y.value=1;form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await pending;check('参考位置倍率可调整并撤销',doc.layers[referenceIndex].reference.x===2&&doc.layers[referenceIndex].reference.scale===2);actions.undo();check('参考变换撤销恢复原图位置',doc.layers[referenceIndex].reference.x===0&&doc.layers[referenceIndex].reference.scale===1);li=referenceIndex;actions['toggle-reference']();check('参考转普通保留当前栅格内容',!isReference(doc.layers[li])&&pixels().some(v=>v));actions.undo();li=backgroundIndex;actions['toggle-background']();check('背景转普通保留像素',!isBackground(doc.layers[li])&&pixels()[0]===0x112233ff);actions.undo();await saveProject();const opened=await window.desktop.openRecent(0),loaded=validateDocument(JSON.parse(opened.data));check('项目保存重开保持背景和原始参考',isBackground(loaded.layers[0])&&loaded.layers.some(isReference));await window.desktop.exportAseprite(doc);const ase=await window.desktop.open('aseprite');check('ASE 背景保留且参考不参与输出',ase.doc.layers.length===1&&isBackground(ase.doc.layers[0]));return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runPenSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const capture=viewport.setPointerCapture,old=penPreferences;try{inputPreferences={...DEFAULT_INPUT};penPreferences={...DEFAULT_PEN,mode:'both'};brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=12;updateBrushControls();replaceDocument(createDocument(64,32,'pen-test'),true);setTool('pencil');setColor('#ff0000');viewport.setPointerCapture=()=>{};const event=(type,x,y,pressure=.5,button=0,pointerType='pen')=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:60,pressure,button,buttons:type==='pointerup'?0:button===5?32:1,pointerType}));};event('pointerdown',8,8,.2);event('pointerup',8,8,0);const low=pixels().filter(v=>v).length,lowAlpha=pixels()[8*64+8]&255;event('pointerdown',30,8,.9);event('pointerup',30,8,0);const high=pixels().filter(v=>v).length-low;check('笔压同时改变实际笔刷大小与 Alpha',high>low&&(pixels()[8*64+30]&255)>lowAlpha);event('pointerdown',30,8,1,5);event('pointerup',30,8,0,5);check('笔尾按钮5临时擦除',pixels()[8*64+30]===0&&tool==='pencil');const before=JSON.stringify(doc),entries=history.undoStack.length;event('pointerdown',20,20,.8);viewport.dispatchEvent(new Event('pointercancel'));check('数位笔中断回滚且不增加历史',JSON.stringify(doc)===before&&history.undoStack.length===entries);const previousPan={...pan};event('pointerdown',8,8,.5,0,'touch');event('pointermove',12,12,.5,0,'touch');event('pointerup',12,12,0,0,'touch');check('单指默认平移不改像素历史',pan.x!==previousPan.x&&JSON.stringify(doc)===before&&history.undoStack.length===entries);const stored=localStorage.getItem(PEN_KEY);let pending=penDialog();$('modal').close('cancel');await pending;check('取消压感设置不写偏好',localStorage.getItem(PEN_KEY)===stored);pending=penDialog();const form=$('modal-form');form.elements.mode.value='opacity';form.elements.gamma.value=1.5;form.requestSubmit($('modal-submit'));await pending;check('确认保存并恢复数位笔偏好',loadPen(localStorage).gamma===1.5&&penPreferences.mode==='opacity');return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;penPreferences=old;}};
window.prepareDisplayAudit=()=>{replaceDocument(createDocument(64,32,'物理多 DPI 验收'),true);scale(.7);pan.x-=17;pan.y+=11;place();draw();return window.readDisplayAudit();};
window.readDisplayAudit=()=>({zoom,center:{x:(viewport.clientWidth/2-pan.x)/zoom,y:(viewport.clientHeight/2-pan.y)/zoom},...window.checkInputDpi(),overlay:{w:overlay.width,h:overlay.height},viewport:{w:viewport.clientWidth,h:viewport.clientHeight}});
window.checkInputDpi=()=>{const r=canvas.getBoundingClientRect(),p=point({clientX:r.left+3.5*zoom,clientY:r.top+5.5*zoom});return{pass:p.x===3&&p.y===5&&overlay.width===Math.round(viewport.clientWidth*devicePixelRatio)&&overlay.height===Math.round(viewport.clientHeight*devicePixelRatio),dpr:devicePixelRatio};};

window.runGroupSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{const sample=createDocument(2,1,'groups-test');sample.frames[0].cels[0]=[0xff0000ff,0];addLayer(sample,0);sample.frames[0].cels[1]=[0x0000ffff,0x00ff00ff];replaceDocument(sample,true);li=1;actions['group-layer']();const innerId=doc.layers[li].id;check('编组生成头部与缩进成员',isGroup(doc.layers[li])&&uiAll('.group-fold').length===1&&doc.layers[1].parentId===innerId);actions['group-layer']();const outerId=doc.layers[li].id;check('可创建嵌套图层组',doc.layers[2].parentId===outerId);uiQuery('.group-fold').click();check('折叠同时收起图层和时间轴子项',$('layers').children.length===2&&$('timeline-grid').querySelectorAll('.cel').length===2);uiQuery('.group-fold').click();check('展开恢复全部子项',$('layers').children.length===4);$('opacity').value=50;$('opacity').dispatchEvent(new Event('change'));check('组透明度作用于合成像素',frameCanvas(0).getContext('2d').getImageData(1,0,1,1).data[3]===128);const groupIndex=li;li=1;render();doc.layers[groupIndex].locked=true;render();check('祖先组锁定禁止子层绘画',!editable());doc.layers[groupIndex].locked=false;li=groupIndex;render();actions['duplicate-layer']();check('复制组连同所有子层且项目结构有效',doc.layers.length===7&&validateDocument(doc).layers.length===7);actions.undo();check('整组复制可撤销',doc.layers.length===4);actions['ungroup-layer']();check('解组保留成员及其内部嵌套',doc.layers.length===3&&doc.layers[1].parentId===innerId);actions.undo();const before=JSON.stringify(doc);await saveProject();const saved=await window.desktop.openRecent(0);check('原生项目保存保留组与父子关系',validateDocument(JSON.parse(saved.data)).layers[1].parentId===innerId);await window.desktop.exportAseprite(doc);const native=await window.desktop.open('aseprite');check('ASE 输出读取保持组结构',native.doc.layers.filter(isGroup).length===2&&native.doc.layers[1].parentId===native.doc.layers[2].id);check('只读往返不修改原项目',JSON.stringify(doc)===before);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runBlendSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{const sample=createDocument(2,1,'blend-test');sample.frames[0].cels[0]=[0x804020ff,0x2080c080];addLayer(sample,0);sample.frames[0].cels[1]=[0x4080c0ff,0xc0604080];replaceDocument(sample,true);li=1;render();const comparison=document.createElement('canvas');comparison.width=2;comparison.height=1;const cx=comparison.getContext('2d',{willReadFrequently:true});for(const [mode]of BLEND_MODES){$('layer-blend').value=mode;$('layer-blend').dispatchEvent(new Event('change'));const actual=Array.from(frameCanvas(0).getContext('2d').getImageData(0,0,2,1).data);if(!['addition','subtract','divide'].includes(mode)){cx.globalCompositeOperation='copy';cx.drawImage(imageCanvas(Uint8ClampedArray.from([128,64,32,255,32,128,192,128])),0,0);cx.globalCompositeOperation=mode==='normal'?'source-over':mode;cx.drawImage(imageCanvas(Uint8ClampedArray.from([64,128,192,255,192,96,64,128])),0,0);const expected=cx.getImageData(0,0,2,1).data;check(mode+' 不透明底色与 Chromium 独立混合一致',actual.slice(0,4).every((v,i)=>Math.abs(v-expected[i])<=2));}}const previous=doc.layers[1].blendMode;actions.undo();actions.redo();check('混合模式撤销重做保持字段',doc.layers[1].blendMode===previous);await saveProject();const opened=await window.desktop.openRecent(0);check('项目原生保存与重开保持混合模式',validateDocument(JSON.parse(opened.data)).layers[1].blendMode===previous);await window.desktop.exportAseprite(doc);const ase=await window.desktop.open('aseprite');check('ASE 读写保持非正常混合模式',ase.doc.layers[1].blendMode===previous);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runStage1Smoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{inputPreferences={...DEFAULT_INPUT};keymap=defaultKeymap();brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=1;updateBrushControls();await runBasicEditSmoke(check);await runColorSmoke(check);await runFileSmoke(check);replaceDocument(createDocument(512,512,'overlay-test'),true);scale(48/zoom);$('grid').checked=true;selection={x:0,y:0,w:512,h:512};drawOverlay();check('512 画布 48 倍缩放覆盖层按视口分配',zoom===48&&overlay.width===Math.round(viewport.clientWidth*devicePixelRatio)&&overlay.height===Math.round(viewport.clientHeight*devicePixelRatio));return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runExchangeSmoke=async(fixture)=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{localStorage.removeItem(EXPORT_SETTINGS_KEY);await runAnimationSmoke(check,fixture);await runSequenceSmoke(check);await runSheetSmoke(check);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.viewportProbe=(prepare=false)=>{if(prepare){replaceDocument(createDocument(32,32,'resize-test'),true);scale(.7);pan.x-=37;pan.y+=23;place();draw();}return{zoom,center:{x:(viewport.clientWidth/2-pan.x)/zoom,y:(viewport.clientHeight/2-pan.y)/zoom},size:{w:viewport.clientWidth,h:viewport.clientHeight},overlay:{w:overlay.width,h:overlay.height}};};
window.runToolbarGroupsSmoke=()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{
  window.workspaceLayout.reset();
  const topResize=document.querySelector('.resize-top');topResize.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
  check('顶部工具栏初始高度等于拖动最小高度',window.workspaceLayout.state().sizes.top===80&&parseFloat(document.querySelector('.resize-top').parentElement.style.getPropertyValue('--dock-top')||getComputedStyle(document.querySelector('.resize-top').parentElement).getPropertyValue('--dock-top'))===80);
  const slots=[...$('tools').querySelectorAll('[data-tool-group]')];check('工具按官方关系压缩为分组槽位',slots.length===TOOL_GROUPS.length&&slots.every((slot,index)=>slot.dataset.toolGroup===TOOL_GROUPS[index].join(',')));
  check('每个工具恰好属于一个分组',TOOLS.every(([name])=>slots.filter(slot=>slot.dataset.toolGroup.split(',').includes(name)).length===1));
  const shapes=slots.find(slot=>slot.dataset.toolGroup==='line,curve');shapes.click();shapes.click();const menu=uiQuery('.tool-group-menu:popover-open');check('再次点击已激活组合槽位显示同组工具',!!menu&&menu.querySelectorAll('[data-tool-option]').length===2);menu.querySelector('[data-tool-option=curve]').click();check('菜单选择后槽位显示所选工具',tool==='curve'&&shapes.dataset.tool==='curve'&&shapes.querySelector('[data-icon=curve]'));
  viewport.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'l',code:'KeyL',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{key:'l',code:'KeyL',bubbles:true}));check('快捷键选择同步更新分组图标',tool==='line'&&shapes.dataset.tool==='line'&&shapes.querySelector('[data-icon=line]'));
  const selectSlot=slots[0];
  for(const kind of ['rect','ellipse','lasso','polygon','wand']){
   setTool('select');selectSlot.click();const popup=uiQuery('.tool-group-menu:popover-open');
   popup.querySelector(`[data-tool-option="${kind==='rect'?'select':'selection-'+kind}"]`).click();
   check('选区工具同槽切换 '+kind,tool==='select'&&$('selection-kind').value===kind&&!!selectSlot.querySelector('[data-icon="select-'+kind+'"]')&&selectSlot.classList.contains('active'));
  }
  for(const [profile,kind,keys]of [[defaultKeymap(),'lasso','Q'],[defaultKeymap(),'wand','W'],[asepriteKeymap(),'ellipse','Shift+M']]){
   keymap=profile;setTool('selection-'+kind);selectSlot.click();const popup=uiQuery('.tool-group-menu:popover-open'),option=popup.querySelector('[data-tool-option="selection-'+kind+'"]');
   check('选区列表显示配置快捷键 '+keys,option.querySelector('kbd').textContent===keys&&option.title.includes(keys)&&selectSlot.getAttribute('aria-keyshortcuts')===keys);popup.hidePopover();
  }
  keymap=defaultKeymap();keymap.bindings['selection-lasso']=['Alt+Q'];refreshKeymapLabels();setTool('select');selectSlot.click();
  check('选区列表显示自定义快捷键',uiQuery('.tool-group-menu:popover-open [data-tool-option="selection-lasso"] kbd').textContent==='Alt+Q');uiQuery('.tool-group-menu:popover-open').hidePopover();
  viewport.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'q',code:'KeyQ',altKey:true,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{key:'q',code:'KeyQ',altKey:true,bubbles:true}));
  check('显示的自定义快捷键实际切换自由套索',tool==='select'&&$('selection-kind').value==='lasso');keymap=defaultKeymap();refreshKeymapLabels();
  check('顶部移除选区形状且合并同类操作',$('selection-kind').closest('label').hidden&&!$('toolbar-menu-selection-kind')&&!!$('selection-choose-menu')&&!!$('selection-transform-menu')&&!!$('selection-pixels-menu'));
  replaceDocument(createDocument(4,4,'选区菜单文字验收'),true);setTool('select');actions['select-all']();
  for(const group of ['selection-choose','selection-transform','selection-pixels']){
   const popup=$(group+'-menu');popup.parentElement.querySelector('.toolbar-control-trigger').click();
   check('选区弹出菜单文字显示 '+group,[...popup.querySelectorAll('[data-action]')].every(button=>button.textContent.trim().length>0&&!button.querySelector('svg')&&!button.classList.contains('visual-button')&&getComputedStyle(button).fontSize!=='0px'));
   popup.hidePopover();
  }
  $('selection-choose-menu').parentElement.querySelector('.toolbar-control-trigger').click();$('selection-choose-menu').querySelector('[data-action="deselect"]').click();
  check('文字菜单取消选区操作仍可执行',!selection);
  replaceDocument(createDocument(4,4,'选区笔刷验收'),true);keymap=defaultKeymap();selection=null;setTool('select');syncContextUI();viewport.focus();
  const key=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'b',code:'KeyB',ctrlKey:true,bubbles:true,cancelable:true}));
  const beforePattern=brushSettings.pattern;key();check('无选区Ctrl+B不可建笔刷',brushSettings.pattern===beforePattern&&tool==='select'&&!commandStates()['capture-brush']);
  pixels()[0]=0xff0000ff;selection={x:0,y:0,w:1,h:1};syncContextUI();key();
  check('有选区Ctrl+B建立笔刷并退出选区 '+JSON.stringify({shape:brushSettings.shape,pattern:brushSettings.pattern,selection,tool,state:commandStates()['capture-brush'],modal:$('modal').open}),brushSettings.shape==='pattern'&&brushSettings.pattern.data[0]===0xff0000ff&&!selection&&tool==='pencil');
  return{ok:true,results};
}catch(error){return{ok:false,results,error:error.stack};}};
window.runBlurTextSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const capture=viewport.setPointerCapture;try{
  replaceDocument(createDocument(32,16,'blur-text-test'),true);viewport.setPointerCapture=()=>{};const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:87,button:0}));};
  pixels()[8*32+8]=0xffffffff;setTool('blur');send('pointerdown',8,8);send('pointerup',8,8);check('模糊工具按邻域柔化像素',pixels()[8*32+8]!==0xffffffff&&pixels()[8*32+8]!==0&&history.undoStack.length===1);actions.undo();check('模糊笔画可撤销',pixels()[8*32+8]===0xffffffff);
  setTool('text');
  check('文字工具显示文字选项行并隐藏绘画参数',!$('text-options').hidden&&$('paint-options').hidden&&$('selection-options').hidden);
  $('text-size').value=8;$('text-antialias').checked=false;readTextControls();
  send('pointerdown',2,2);send('pointerup',2,2);
  const editor=viewport.querySelector('.text-editor');
  check('点击画布就地打开文字编辑器',!!editor&&document.activeElement===editor&&!$('modal').open&&textSession?.anchor.x===2&&textSession?.anchor.y===2);
  editor.value='MinePix';editor.dispatchEvent(new Event('input',{bubbles:true}));
  editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));
  check('Ctrl+Enter 提交后栅格化且写入单步历史',!viewport.querySelector('.text-editor')&&pixels().some(value=>value)&&history.undoStack.length===1);
  actions.undo();
  check('文字栅格化可整步撤销',pixels()[8*32+8]===0xffffffff&&pixels().filter(Boolean).length===1);
  send('pointerdown',4,4);send('pointerup',4,4);
  const cancelled=viewport.querySelector('.text-editor');
  cancelled.value='Cancel';cancelled.dispatchEvent(new Event('input',{bubbles:true}));
  cancelled.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
  check('Esc 取消文字不写入历史',!viewport.querySelector('.text-editor')&&history.undoStack.length===0&&pixels().filter(Boolean).length===1);
  send('pointerdown',1,1);send('pointermove',10,8);send('pointerup',10,8);
  const boxed=viewport.querySelector('.text-editor');
  check('拖拽拉出定宽文本框并聚焦编辑器',!!boxed&&textSession?.box?.x===1&&textSession?.box?.y===1&&textSession?.box?.w===10&&textSession?.box?.h===8&&document.activeElement===boxed);
  boxed.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
  send('pointerdown',6,2);send('pointerup',6,2);
  const outside=viewport.querySelector('.text-editor');
  outside.value='O';outside.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.palette-panel').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:91}));
  check('点击画布外提交文字并写入历史',!viewport.querySelector('.text-editor')&&history.undoStack.length===1&&pixels().filter(Boolean).length>1);
  actions.undo();
  setTool('pencil');
  check('切回绘画工具后文字选项行隐藏',$('text-options').hidden&&!$('paint-options').hidden);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;}};
window.runPreviewPanelSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},capture=previewArea.setPointerCapture;try{
  check('预览控制按钮仅显示图标',[...previewControls.children].every(button=>button.children.length===1&&button.firstElementChild?.matches('svg')));
  previewArea.setPointerCapture=()=>{};replaceDocument(createDocument(16,8,'preview-test'),true);check('单帧项目隐藏播放按钮',$('preview-play').hidden);
  const second=clone(doc.frames[0]);doc.frames.push(second);doc.frames[0].duration=200;second.duration=200;second.cels[0][0]=0xff0000ff;render();check('多帧项目显示播放按钮',!$('preview-play').hidden);
  const z=previewZoom,rect=previewArea.getBoundingClientRect();previewArea.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-100,clientX:rect.left+30,clientY:rect.top+30}));check('预览滚轮独立缩放',previewZoom>z);
  const start={...previewPan};for(const [type,x] of [['pointerdown',30],['pointermove',50],['pointerup',50]])previewArea.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:81,button:0,clientX:rect.left+x,clientY:rect.top+30}));check('预览可独立拖动',previewPan.x>start.x);
  $('preview-fit').click();check('预览适应内容恢复倍率',Math.abs(previewZoom-z)<.001);
  $('preview-play').click();check('预览播放不改变主画布播放',previewPlaying&&!playing&&fi===0);await new Promise(resolve=>setTimeout(resolve,225));check('预览按时间轴帧时长前进',previewPlayFrame===1&&fi===0);$('preview-play').click();check('预览播放可独立暂停',!previewPlaying&&!playing);return{ok:true,results};
}catch(error){return{ok:false,results,error:error.stack};}finally{clearTimeout(previewTimer);previewArea.setPointerCapture=capture;}};
window.runDrawingGestureSmoke=()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},capture=viewport.setPointerCapture;try{
  viewport.setPointerCapture=()=>{};toolBrushShapes={};replaceDocument(createDocument(16,16,'gesture-test'),true);setBrush(1);setColor('#ff0000');setTool('zoom');
  const send=(type,x,y,options={})=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:71,button:0,...options}));};
  const z=zoom;send('pointerdown',4,4);send('pointerup',4,4);check('缩放工具点击放大',zoom>z);
  const dragZoom=zoom,rect=viewport.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rect.left+100,clientY:rect.top+100,pointerId:71,button:0}));viewport.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:rect.left+150,clientY:rect.top+100,pointerId:71,button:0}));check('缩放工具拖动实时改变倍率',zoom>dragZoom);viewport.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:rect.left+150,clientY:rect.top+100,pointerId:71,button:0}));
  setTool('pencil');brushSettings.shape='circle';saveBrushSettings();setTool('eraser');check('橡皮擦笔形不继承铅笔',brushSettings.shape==='square');brushSettings.shape='line';saveBrushSettings();setTool('pencil');check('铅笔恢复自己的笔形',brushSettings.shape==='circle');
  check('笔形下拉与当前工具同步',$('brush-shape').value==='circle');
  setTool('line');check('切换工具后笔形下拉跟随',$('brush-shape').value===brushSettings.shape&&brushSettings.shape==='square');
  setTool('pencil');brushSettings.shape='square';brushSettings.pixelPerfect=true;saveBrushSettings();
  send('pointerdown',2,2);check('绘制时光标范围保持显示',!brushPreview.hidden);send('pointerup',2,2);const beforePreview=[...pixels()],historyBefore=history.undoStack.length;send('pointermove',6,2,{shiftKey:true});const dpr=devicePixelRatio,previewAlpha=octx.getImageData(Math.floor((pan.x+4.5*zoom)*dpr),Math.floor((pan.y+2.5*zoom)*dpr),1,1).data[3];check('按住 Shift 悬停显示连线预览且不修改项目',previewAlpha>0&&pixels().every((value,index)=>value===beforePreview[index])&&history.undoStack.length===historyBefore);document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',code:'ShiftLeft',bubbles:true}));check('未点击左键释放 Shift 不应用预览',pixels().every((value,index)=>value===beforePreview[index])&&history.undoStack.length===historyBefore);
  send('pointerdown',6,2,{shiftKey:true});check('Shift 连线沿用完美像素路径',gesture.options.pixelPerfect&&[3,4,5,6].every(x=>pixels()[2*16+x]!==0));send('pointerup',6,2);check('Shift 连线提交后记录终点',lastStrokePoint.point.x===6&&lastStrokePoint.point.y===2);
  setTool('eraser');send('pointerdown',2,2);send('pointerup',2,2);send('pointerdown',6,2,{shiftKey:true});send('pointerup',6,2);check('橡皮擦 Shift 连线清除路径',[2,3,4,5,6].every(x=>pixels()[2*16+x]===0));
  return{ok:true,results};
}catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;}};
window.runViewportSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const capture=viewport.setPointerCapture;try{inputPreferences={...DEFAULT_INPUT};keymap=defaultKeymap();brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=1;updateBrushControls();replaceDocument(createDocument(8,8,'capture-test'),true);setTool('pencil');setColor('#ff0000');viewport.setPointerCapture=()=>{};const point=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:55,button:0}));};for(const type of ['pointercancel','lostpointercapture','blur']){point('pointerdown',1,1);point('pointermove',3,1);check(type+' 前存在笔画预览',pixels()[9]!==0);if(type==='blur')window.dispatchEvent(new Event('blur'));else viewport.dispatchEvent(new Event(type));check(type+' 回滚像素且不写历史',gesture===null&&pixels().every(v=>!v)&&history.undoStack.length===0&&!dirty);check(type+' 显示明确取消结果',$('status').textContent.includes('已取消'));}point('pointerdown',2,2);point('pointerup',2,2);const status=$('status').textContent;viewport.dispatchEvent(new Event('lostpointercapture'));check('正常释放捕获不会回滚已提交笔画',pixels()[18]!==0&&history.undoStack.length===1&&$('status').textContent===status);const before={...pan};setTool('pan');point('pointerdown',1,1);point('pointermove',3,3);viewport.dispatchEvent(new Event('lostpointercapture'));check('平移捕获丢失恢复原视图',pan.x===before.x&&pan.y===before.y);const oldZoom=zoom;scale(.5);const manualZoom=zoom;fit();check('显式适应画布可重新缩放',manualZoom!==zoom&&zoom===oldZoom);await runTransformSmoke(check);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;}};

window.runExportConsistencySmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(4,4,'export-consistency');sample.frames[0].cels[0][0]=0xff0000ff;sample.frames.push({duration:70,cels:[Array(16).fill(0x00ff0080)]});sample.tags=[{id:'walk',name:'Walk',color:'#112233',from:0,to:1,direction:'reverse'}];replaceDocument(sample,true);const form=$('modal-form'),run=async(mode,options={})=>{const pending=exportDialog(mode);for(const [key,value]of Object.entries(options))form.elements[key].value=value;form.requestSubmit($('modal-submit'));await pending;};await run('sheet',{columns:1,scale:2});check('独立 PNG 可保存并手动改名',$('status').textContent==='导出完成');await run('metadata');check('JSON 校验关联 PNG 后导出',$('status').textContent==='导出完成');const settings=localStorage.getItem(EXPORT_SETTINGS_KEY);await run('metadata',{columns:2});check('布局不同拒绝关联且保留成功设置',$('status').textContent.includes('不一致')&&localStorage.getItem(EXPORT_SETTINGS_KEY)===settings);doc.name='cancel-association';await run('metadata');check('取消关联 PNG 不误报成功',$('status').textContent==='已取消导出');doc.name='cancel-save';await run('metadata');check('取消 JSON 保存不误报成功',$('status').textContent==='已取消导出');doc.name='fail-save';await run('metadata');check('写入失败显示失败且保留成功设置',/EPERM|EISDIR|EACCES/.test($('status').textContent)&&localStorage.getItem(EXPORT_SETTINGS_KEY)===settings);doc.name='cancel-save';await run('sheet-pair');check('取消配对目录不误报成功',$('status').textContent==='已取消导出');return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runEditingSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{keymap=defaultKeymap();inputPreferences={...DEFAULT_INPUT};for(const run of [runBrushSmoke,runPathSmoke,runSelectionSmoke,runTransformSmoke,runTimelineSmoke,runOnionSmoke,runCelSmoke])await run(check);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runRenderSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};let metrics;try{inputPreferences={...DEFAULT_INPUT};keymap=defaultKeymap();const large=createDocument(512,512,'render-test');large.layers=Array.from({length:8},(_,i)=>({id:i+1,name:'Layer '+i,visible:true,locked:false,opacity:100}));large.frames=Array.from({length:4},()=>({duration:100,cels:large.layers.map((_,i)=>Array(512*512).fill(i?0x33669980:0x112233ff))}));replaceDocument(large,true);$('onion').checked=false;$('grid').checked=false;frameCache.clear();referenceCache.clear();frameCache.stats={full:0,partial:0,hits:0};const cold=[],warm=[],paint=[],intervals=[];for(let f=0;f<4;f++){const t=performance.now();frameCanvas(f);cold.push(performance.now()-t);}const cachedBytes=frameCache.memoryBytes;playing=true;await new Promise(requestAnimationFrame);let previousTime=performance.now();for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previousTime);previousTime=now;previewFrame=i%4;const t=performance.now();draw();warm.push(performance.now()-t);}stop();fi=0;setTool('pencil');setColor('#ffffff');const row=$('layers').firstElementChild,header=uiQuery('.frame-head'),capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};const point=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:40,button:0}));};point('pointerdown',1,1);for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const t=performance.now();point('pointermove',2+i,2);paint.push(performance.now()-t);}const partialBeforeCommit=frameCache.stats.partial;const commitStart=performance.now();point('pointerup',42,2);const commitMs=performance.now()-commitStart;viewport.setPointerCapture=capture;check('画布和预览复用同一帧缓存',frameCache.stats.hits>100);check('笔画期间采用脏区域合成',partialBeforeCommit>=40);check('像素编辑保留图层和时间轴 DOM',row===$('layers').firstElementChild&&header===uiQuery('.frame-head'));check('缓存图像与独立合成逐字节一致',(()=>{const expected=composite(doc,0);return frameCache.get(doc,0).rgba.every((v,i)=>v===expected[i]);})());const p95=values=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*.95))];metrics={pixels:8388608,framePixels:262144,layers:8,frames:4,coldP95ms:p95(cold),warmDrawP95ms:p95(warm),paintMoveP95ms:p95(paint),frameIntervalP95ms:p95(intervals),commitMs,cachedBytes,stats:{...frameCache.stats},targets:{coldMs:100,warmMs:16.7,paintMs:16.7,intervalMs:35}};check('8M 项目冷合成目标',metrics.coldP95ms<100);check('8M 项目热播放绘制目标',metrics.warmDrawP95ms<16.7);check('8M 项目连续绘画目标',metrics.paintMoveP95ms<16.7);check('可见窗口播放帧间隔目标',metrics.frameIntervalP95ms<35);return{ok:true,results,metrics};}catch(error){return{ok:false,results,metrics,error:error.stack};}};

window.runHistorySmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{replaceDocument(createDocument(128,128,'history-test'),true);mutate(()=>pixels()[0]=colorValue('#ff0000'));check('修改设置版本脏标记',dirty&&history.revision!==saved);await saveProject();check('保存记录历史保存点',!dirty&&saved===history.revision);const savedName=doc.name;mutate(()=>pixels()[1]=colorValue('#00ff00'));actions.undo();check('撤销回保存点恢复干净状态',!dirty&&pixels()[1]===0&&doc.name===savedName);actions.redo();check('重做恢复修改状态',dirty&&pixels()[1]===colorValue('#00ff00'));actions.undo();mutate(()=>pixels()[2]=colorValue('#0000ff'));check('保存点新分支没有旧 redo',dirty&&history.redoStack.length===0);const before=snapshotCel(doc,0,0);pixels()[3]=0xffffffff;history.push(before,doc);changed();check('稀疏编辑历史不保留整幅像素',history.undoStack.every(entry=>entry.kind==='delta')&&history.memoryBytes<65536);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runEngineExportSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(4,4,'engine-test');sample.frames[0].cels[0][5]=colorValue('#ff0000');addFrame(sample,0);sample.frames[1].duration=60;sample.frames[1].cels[0][10]=colorValue('#00ff0080');addFrame(sample,1);sample.frames[2].duration=80;sample.tags=[{id:'walk',name:'walk',from:0,to:2,color:'#668fb7',direction:'reverse'},{id:'bounce',name:'bounce',from:0,to:2,color:'#668fb7',direction:'pingpong'}];replaceDocument(sample,true);const before=JSON.stringify(doc),form=$('modal-form');for(const [id,format]of [['phaser-sheet','phaser'],['godot-sheet','godot']]){const pending=exportDialog('sheet-pair');form.elements.preset.value=id;form.elements.preset.dispatchEvent(new Event('change'));check('引擎预设应用 '+format,form.elements.engineFormat.value===format&&form.elements.trim.checked&&form.elements.pack.checked);form.requestSubmit($('modal-submit'));await pending;check('引擎配套文件导出 '+format,$('status').textContent.startsWith('导出完成'));}const file=await window.desktop.open('sheet-manifest');check('引擎输出附带可回读原生清单',file.type==='sheet-manifest'&&file.metadata.frames.length===3&&file.metadata.tags[0].direction==='reverse');check('引擎导出不改项目及历史',JSON.stringify(doc)===before&&!dirty&&history.undoStack.length===0);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runAtlasSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 try{localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(6,4,'atlas-test');sample.frames[0].cels[0][8]=colorValue('#ff0000');sample.frames[0].cels[0][15]=colorValue('#ff000080');addFrame(sample,0);sample.frames[1].cels[0][18]=colorValue('#0000ff');sample.frames[1].duration=60;addFrame(sample,1);sample.frames[2].duration=80;sample.tags=[{id:'a',name:'A',from:0,to:2,color:'#668fb7',direction:'reverse'}];replaceDocument(sample,true);const original=clone(doc),form=$('modal-form');let pending=exportDialog('sheet-pair');form.elements.trim.checked=true;form.elements.pack.checked=true;form.elements.extrude.value=1;form.elements.scale.value=2;form.elements.margin.value=1;form.elements.gapX.value=1;form.elements.gapY.value=1;form.requestSubmit($('modal-submit'));await pending;check('裁边打包及挤出配对输出',$('status').textContent.startsWith('导出完成'));check('图集导出不改源项目',JSON.stringify(doc)===JSON.stringify(original)&&!dirty&&history.undoStack.length===0);const file=await window.desktop.open('sheet-manifest');const plan=sheetManifestPlan(file.metadata);check('空帧占位及来源尺寸',plan.width===12&&plan.height===8&&plan.frames[2].empty&&file.metadata.extrude===2);pending=importFile(file);for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));form.requestSubmit($('modal-submit'));await pending;check('裁边图集恢复完整画布和偏移',doc.width===12&&doc.height===8&&doc.frames[0].cels[0][2*12+4]===colorValue('#ff0000')&&doc.frames[0].cels[0][4*12+6]===colorValue('#ff000080')&&doc.frames[1].cels[0][6*12]===colorValue('#0000ff'));check('空帧回读保持全透明',doc.frames[2].cels[0].every(p=>p===0));check('图集回读时长和标签',doc.frames.map(f=>f.duration).join(',')==='100,60,80'&&doc.tags[0].direction==='reverse');void exportDialog('sheet-pair');return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}
};

window.runExportLayersSmoke=async()=>{
  const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
  try{
    localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(2,1,'layer-export');sample.layers[0].name='底色';sample.frames[0].cels[0]=[colorValue('#ff0000'),0];addLayer(sample,0);sample.layers[1].name='蓝光';sample.layers[1].opacity=50;sample.layers[1].locked=true;sample.frames[0].cels[1]=[colorValue('#0000ff'),colorValue('#0000ff')];addLayer(sample,1);sample.layers[2].name='隐藏绿';sample.layers[2].visible=false;sample.frames[0].cels[2]=[colorValue('#00ff00'),colorValue('#00ff0080')];addFrame(sample,0,true);sample.frames[1].duration=80;sample.frames[1].cels[2][0]=0;sample.tags=[{id:'range',name:'Range',color:'#668fb7',from:0,to:1,direction:'reverse'}];replaceDocument(sample,true);li=2;render();const original=JSON.stringify(doc),form=$('modal-form');
    const setScope=mode=>{form.elements.layerScope.value=mode;form.elements.layerScope.dispatchEvent(new Event('change'));};
    let pending=exportDialog('sheet-pair');check('精灵表默认可见范围并隐藏多选列表',form.elements.layerScope.value==='visible'&&$('export-layer-list').hidden&&$('export-layer-info').textContent.includes('2 个图层'));form.requestSubmit($('modal-submit'));await pending;check('可见范围配对导出完成',$('status').textContent.startsWith('导出完成'));
    pending=exportDialog('sheet-pair');setScope('current');check('当前隐藏图层允许只读导出',$('export-layer-info').textContent.includes('1 个图层'));form.requestSubmit($('modal-submit'));await pending;
    pending=exportDialog('sheet-pair');setScope('custom');for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=false;form.requestSubmit($('modal-submit'));check('未选图层阻止确认且保留项目',$('modal').open&&$('modal-error').textContent.includes('至少')&&JSON.stringify(doc)===original);
    for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=[0,2].includes(+input.value);$('export-layer-list').dispatchEvent(new Event('change'));check('可明确选择隐藏图层并按源层序合成',!$('export-layer-list').hidden&&$('export-layer-info').textContent.includes('2 个图层'));form.requestSubmit($('modal-submit'));await pending;check('自定义范围配对导出完成',$('status').textContent.startsWith('导出完成'));
    pending=exportDialog('sheet');setScope('custom');for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=[0,2].includes(+input.value);form.requestSubmit($('modal-submit'));await pending;check('独立 PNG 导出支持同一自定义范围',$('status').textContent==='导出完成');
    pending=exportDialog('metadata');check('重新打开不继承项目图层选择',form.elements.layerScope.value==='visible');setScope('current');form.requestSubmit($('modal-submit'));await pending;check('不同图层范围不能关联已保存 PNG',$('status').textContent.includes('不一致'));pending=exportDialog('metadata');setScope('custom');for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=[0,2].includes(+input.value);form.requestSubmit($('modal-submit'));await pending;check('独立 JSON 导出沿用相同范围逻辑',$('status').textContent==='导出完成');
    pending=exportDialog('sheet-pair');setScope('custom');for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=+input.value===2;const remembered=localStorage.getItem(EXPORT_SETTINGS_KEY);$('modal').close('cancel');await pending;check('取消图层选择不写入最近设置',localStorage.getItem(EXPORT_SETTINGS_KEY)===remembered&&JSON.stringify(doc)===original);
    pending=exportDialog('gif');check('GIF 分支不显示精灵表图层选项',$('export-layers').hidden&&form.elements.layerScope.disabled);$('modal').close('cancel');await pending;
    check('导出不改变像素图层属性和历史',JSON.stringify(doc)===original&&history.undoStack.length===0&&!dirty&&li===2);
    void exportDialog('sheet-pair');setScope('custom');for(const input of $('export-layer-list').querySelectorAll('input'))input.checked=[0,2].includes(+input.value);$('export-layer-list').dispatchEvent(new Event('change'));return{ok:true,results};
  }catch(error){return{ok:false,results,error:error.stack};}
};

window.runSheetImportSmoke=async()=>{
  const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
  try{
    localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(2,2,'sheet-json-roundtrip');sample.frames[0].cels[0]=[colorValue('#ff0000'),0,0,colorValue('#11223380')];for(let i=1;i<5;i++)sample.frames.push({duration:40+i*20,cels:[[colorValue('#0000ff'),0,0,colorValue('#00ff00')]]});sample.tags=[{id:'walk',name:'Walk',color:'#668fb7',from:1,to:4,direction:'reverse'}];replaceDocument(sample,true);const form=$('modal-form');let pending=exportDialog('sheet-pair');for(const [key,value]of Object.entries({scale:2,columns:3,margin:1,gapX:2,gapY:3,order:'columns'}))form.elements[key].value=value;form.requestSubmit($('modal-submit'));await pending;check('生成逐列非满表配对文件',$('status').textContent.startsWith('导出完成'));
    const wait=async()=>{for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));};
    const oversized=document.createElement('canvas');oversized.width=800;oversized.height=600;const oversizedContext=oversized.getContext('2d');oversizedContext.fillStyle='#123456';oversizedContext.fillRect(0,0,800,600);oversizedContext.fillStyle='#ff0000';oversizedContext.fillRect(790,590,10,10);pending=importFile({type:'image',name:'oversized.png',data:oversized.toDataURL('image/png').split(',')[1]});await wait();check('大图 PNG 单图默认保留原始尺寸',form.elements.width.value==='800'&&form.elements.height.value==='600'&&$('sheet-import-info').textContent.includes('800 × 600 px → 导入 800 × 600 px')&&!$('modal-error').textContent);form.requestSubmit($('modal-submit'));await pending;check('大图 PNG 单图确认后导入且保留像素颜色',doc.width===800&&doc.height===600&&doc.frames.length===1&&doc.frames[0].cels[0][0]===colorValue('#123456')&&doc.frames[0].cels[0].at(-1)===colorValue('#ff0000'));replaceDocument(sample,true);
    const source=await window.desktop.open('sheet-manifest'),normal=await window.desktop.open();check('专用入口与普通打开识别精灵表 JSON',source.type==='sheet-manifest'&&normal.type==='sheet-manifest');
    const original=JSON.stringify(doc);pending=importFile(source);await wait();check('JSON 导入预览包含帧数和标签',$('modal-title').textContent==='导入精灵表 JSON'&&$('sheet-json-info').textContent.includes('5 帧 · 1 个标签')&&$('sheet-import-preview').width>0);$('modal').close('cancel');await pending;check('取消 JSON 导入保留项目与历史',JSON.stringify(doc)===original&&!dirty&&history.undoStack.length===0);
    pending=importFile(source);await wait();form.elements.name.value='回读动画';form.requestSubmit($('modal-submit'));await pending;
    check('JSON 回读恢复尺寸时长与标签',doc.name==='回读动画'&&doc.width===4&&doc.height===4&&doc.frames.map(f=>f.duration).join(',')==='100,60,80,100,120'&&doc.tags[0].from===1&&doc.tags[0].to===4&&doc.tags[0].direction==='reverse');
    check('逐列矩形顺序及透明半透明像素正确',doc.frames[0].cels[0][0]===colorValue('#ff0000')&&(doc.frames[0].cels[0][15]&255)===128&&doc.frames[0].cels[0][3]===0&&doc.frames[2].cels[0][0]===colorValue('#0000ff'));
    check('JSON 导入生成单层未保存独立帧',doc.layers.length===1&&dirty&&!filePath&&history.undoStack.length===0&&doc.frames[1].cels[0]!==doc.frames[2].cels[0]);
    const before=JSON.stringify(doc);let failed=false;const invalid=clone(source);invalid.metadata.frames[0].frame.x=999;try{await importFile(invalid);}catch{failed=true;}check('越界元数据拒绝且保留当前项目',failed&&JSON.stringify(doc)===before&&!busy);
    failed=false;try{await importFile({...source,data:source.data.slice(0,32)});}catch{failed=true;}check('损坏 PNG 拒绝且解除忙碌',failed&&JSON.stringify(doc)===before&&!busy);
    const reversed=clone(source);reversed.metadata.frames.reverse();reversed.metadata.tags=[];pending=importFile(reversed);await wait();form.requestSubmit($('modal-submit'));await pending;check('以 JSON 数组顺序为准而非源索引',doc.frames[0].duration===120&&doc.frames.at(-1).duration===100&&doc.frames.at(-1).cels[0][0]===colorValue('#ff0000')&&doc.tags.length===0);
    replaceDocument(doc,true);$('viewport').focus();return{ok:true,results};
  }catch(error){return{ok:false,results,error:error.stack};}
};

window.runExportSettingsSmoke=async()=>{
  const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
  try{
    localStorage.removeItem(EXPORT_SETTINGS_KEY);const sample=createDocument(2,2,'export-settings');sample.frames[0].cels[0][0]=colorValue('#ff0000');sample.frames.push(clone(sample.frames[0]),clone(sample.frames[0]));replaceDocument(sample,true);const original=JSON.stringify(doc),form=$('modal-form');
    const cancel=async pending=>{$('modal').close('cancel');await pending;};
    const choose=id=>{form.elements.preset.value=id;form.elements.preset.dispatchEvent(new Event('change'));};
    let pending=exportDialog('sheet-pair');for(const [key,value]of Object.entries({scale:2,columns:2,margin:1,gapX:2,gapY:1,order:'rows',presetName:'项目动画'}))form.elements[key].value=value;$('save-export-preset').click();let state=readExportSettings(localStorage),preset=state.presets[0];check('命名预设保存布局且不记忆项目范围',state.presets.length===1&&preset.options.gapX===2&&!('scope'in preset.options));
    form.elements.margin.value=2;$('save-export-preset').click();state=readExportSettings(localStorage);check('同名预设更新并保持标识',state.presets.length===1&&state.presets[0].id===preset.id&&state.presets[0].options.margin===2);form.elements.margin.value=1;$('save-export-preset').click();
    form.elements.presetName.value='临时';$('save-export-preset').click();$('delete-export-preset').click();check('删除预设保留其他预设与当前布局',readExportSettings(localStorage).presets.length===1&&form.elements.margin.value==='1');
    await cancel(pending);check('取消对话框不写最近设置但保留主动保存预设',Object.keys(readExportSettings(localStorage).last).length===0&&readExportSettings(localStorage).presets.length===1);
    pending=exportDialog('sheet-pair');choose(preset.id);check('应用自定义预设恢复完整布局',form.elements.scale.value==='2'&&form.elements.gapX.value==='2'&&form.elements.presetName.value==='项目动画');form.requestSubmit($('modal-submit'));await pending;check('配对导出成功后记忆设置',readExportSettings(localStorage).last.sheet.scale===2&&$('status').textContent.startsWith('导出完成'));
    pending=exportDialog('metadata');check('精灵表独立 PNG JSON 与配对共享最近布局',form.elements.scale.value==='2'&&form.elements.columns.value==='2'&&form.elements.margin.value==='1');form.elements.scale.value=7;await cancel(pending);check('取消编辑不覆盖成功设置',readExportSettings(localStorage).last.sheet.scale===2);
    pending=exportDialog('sheet-pair');form.elements.scale.value=2;form.elements.mode.value='gif';form.elements.mode.dispatchEvent(new Event('change'));check('动画仅提供 Aseprite 多帧格式',[...form.elements.format.options].map(option=>option.value).join(',')==='gif,webp');check('切换 GIF 恢复自己的默认参数与选项隔离',form.elements.scale.value==='1'&&!$('gif-options').hidden&&$('sheet-options').hidden&&form.elements.margin.disabled);form.elements.scale.value=3;form.elements.mode.value='sheet';form.elements.mode.dispatchEvent(new Event('change'));check('精灵表提供完整静态格式',[...form.elements.format.options].map(option=>option.value).join(',')==='bmp,css,gif,ico,jpeg,jpg,png,svg,webp');check('来回切换类型保留本次草稿',form.elements.scale.value==='2'&&form.elements.gapX.value==='2');choose('loop-gif');check('内置 GIF 预设应用并保留范围',form.elements.mode.value==='gif'&&form.elements.repeat.value==='loop'&&form.elements.scope.value==='all'&&$('delete-export-preset').disabled);form.elements.scale.value=3;form.elements.colors.value=16;form.elements.repeat.value='once';form.requestSubmit($('modal-submit'));await pending;
    check('GIF 成功设置与精灵表分别记忆',readExportSettings(localStorage).last.gif.scale===3&&readExportSettings(localStorage).last.sheet.scale===2);
    pending=exportDialog('png');check('单图提供请求的全部格式',[...form.elements.format.options].map(option=>option.value).join(',')==='bmp,css,gif,ico,jpeg,jpg,png,svg,webp');check('当前帧 PNG 不继承 GIF 放大倍数',form.elements.scale.value==='1');check('单一图像隐藏帧范围选择',$('export-scope').hidden&&form.elements.scope.disabled);form.elements.mode.value='sheet';form.elements.mode.dispatchEvent(new Event('change'));check('切换回精灵表恢复帧范围',!$('export-scope').hidden&&!form.elements.scope.disabled);await cancel(pending);const savedSelection=frameSelection;frameSelection=new Set();pending=exportDialog('gif');check('无选中帧时隐藏选中帧范围',![...form.elements.scope.options].some(option=>option.value==='selected'));await cancel(pending);frameSelection=savedSelection;pending=exportDialog('sheet-pair');check('有选中帧时保留选中帧范围',[...form.elements.scope.options].some(option=>option.value==='selected'));await cancel(pending);
    doc.name='cancel-save';pending=exportDialog('sheet-pair');form.elements.scale.value=5;form.requestSubmit($('modal-submit'));await pending;check('取消路径不覆盖最近设置',$('status').textContent==='已取消导出'&&readExportSettings(localStorage).last.sheet.scale===2);doc.name='export-settings';
    pending=exportDialog('sheet-pair');form.elements.scale.value=8;form.elements.margin.value=512;form.requestSubmit($('modal-submit'));check('容量校验失败保持对话框且不记忆',$('modal').open&&$('modal-error').textContent.includes('过大')&&readExportSettings(localStorage).last.sheet.scale===2);await cancel(pending);
    pending=exportDialog('sheet-pair');form.requestSubmit($('modal-submit'));await pending;check('再次输出直接使用记忆布局',$('status').textContent.startsWith('导出完成')&&readExportSettings(localStorage).last.sheet.gapX===2);check('设置预设与导出均不修改项目历史',JSON.stringify(doc)===original&&!dirty&&history.undoStack.length===0);
    return{ok:true,results};
  }catch(error){return{ok:false,results,error:error.stack};}
};
window.checkExportSettingsReload=()=>{
  void exportDialog('sheet-pair');const form=$('modal-form'),preset=readExportSettings(localStorage).presets[0];return form.elements.scale.value==='2'&&form.elements.gapX.value==='2'&&[...form.elements.preset.options].some(option=>option.value===preset.id);
};

async function runSheetSmoke(check){
  const sample=createDocument(2,2,'sheet-pair-test');sample.frames[0].cels[0]=[colorValue('#ff0000'),0,0,colorValue('#11223380')];for(let i=1;i<5;i++){sample.frames.push({duration:40+i*20,cels:[[colorValue('#0000ff'),0,0,colorValue('#00ff00')]]});}sample.tags=[{id:'walk',name:'Walk',color:'#668fb7',from:1,to:4,direction:'reverse'}];replaceDocument(sample,true);
  const before=JSON.stringify(doc),form=$('modal-form');let pending=exportDialog('sheet-pair');form.elements.columns.value=3;form.elements.scale.value=2;form.elements.margin.value=1;form.elements.gapX.value=2;form.elements.gapY.value=3;form.elements.order.value='columns';form.requestSubmit($('modal-submit'));await pending;
  check('PNG JSON 配对导出完成并保留项目历史',$('status').textContent.startsWith('导出完成')&&JSON.stringify(doc)===before&&history.undoStack.length===0);
  const layout=sheetLayout(2,2,5,{columns:3,scale:2,margin:1,gapX:2,gapY:3,order:'columns'}),c=document.createElement('canvas');c.width=layout.width+2;c.height=layout.height+2;const cx=c.getContext('2d');cx.imageSmoothingEnabled=false;layout.rects.forEach((r,i)=>cx.drawImage(frameCanvas(i),r.x+2,r.y+2,r.w,r.h));const file={type:'image',name:'padded.png',data:c.toDataURL('image/png').split(',')[1]};
  pending=importFile(file);for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));form.elements.mode.value='sheet';for(const [key,value]of Object.entries({width:4,height:4,margin:2,offsetX:2,offsetY:2,gapX:4,gapY:6,count:5,duration:75,order:'columns'}))form.elements[key].value=value;form.dispatchEvent(new Event('input'));
  check('精灵表切片预览识别偏移边距与帧数',$('sheet-import-info').textContent.includes('导入 5 帧')&&$('sheet-import-preview').width>0);
  form.elements.count.value=7;form.requestSubmit($('modal-submit'));check('切片帧数超过网格保留对话框',$('modal').open&&$('modal-error').textContent.includes('不足'));form.elements.count.value=5;form.requestSubmit($('modal-submit'));await pending;
  check('带间距精灵表逐列导入与半透明像素',doc.width===4&&doc.frames.length===5&&doc.frames.every(f=>f.duration===75)&&(doc.frames[0].cels[0][15]&255)===128&&doc.frames[1].cels[0][0]===colorValue('#0000ff'));
  const imported=JSON.stringify(doc);pending=importFile(file);for(let i=0;i<100&&!$('modal').open;i++)await new Promise(r=>setTimeout(r,10));$('modal').close('cancel');await pending;check('取消精灵表预览保留当前项目',JSON.stringify(doc)===imported);
  doc.name='cancel-save';pending=exportDialog('sheet-pair');form.requestSubmit($('modal-submit'));await pending;check('取消配对输出目录不写出文件',$('status').textContent==='已取消导出');
}

async function runSequenceSmoke(check){
  const source=await window.desktop.open('sequence'),form=$('modal-form'),before=JSON.stringify(doc),oldDirty=dirty;
  let pending=importFile(source);check('PNG 序列自然排序预览', $('sequence-preview').children[0].children[1].textContent==='walk1.png');$('modal').close('cancel');await pending;check('取消序列导入保留项目与修改状态',JSON.stringify(doc)===before&&dirty===oldDirty);
  pending=importFile(source);form.elements.order.value='selected';form.dispatchEvent(new Event('input'));check('PNG 序列选择顺序预览',$('sequence-preview').children[0].children[1].textContent==='walk10.png');form.elements.order.value='natural';form.elements.duration.value=120;form.requestSubmit($('modal-submit'));await pending;
  check('PNG 多文件自然排序及默认时长导入',doc.width===8&&doc.frames.length===3&&doc.frames.every(f=>f.duration===120)&&doc.frames[0].cels[0][63]===colorValue('#0000ff')&&doc.tags.length===0&&dirty&&!filePath);
  check('PNG 序列半透明像素与独立 cel',(doc.frames[2].cels[0][52]&255)===128&&doc.frames[0].cels[0]!==doc.frames[1].cels[0]);
  const sourceManifest=await window.desktop.open('sequence-manifest');pending=importFile(sourceManifest);check('清单锁定顺序并预览标签',form.elements.order.disabled&&form.elements.duration.disabled&&$('sequence-info').textContent.includes('1 个标签'));form.requestSubmit($('modal-submit'));await pending;
  check('PNG 清单恢复顺序、逐帧时长与标签',doc.frames.map(f=>f.duration).join(',')==='40,60,80'&&doc.tags[0].direction==='reverse'&&doc.tags[0].to===2&&(doc.frames[0].cels[0][52]&255)===128&&doc.frames[0].cels[0][63]===0);
  pending=importFile(sourceManifest);form.elements.useTiming.checked=false;form.elements.useTags.checked=false;form.dispatchEvent(new Event('input'));form.elements.duration.value=75;form.requestSubmit($('modal-submit'));await pending;check('清单可覆盖时长并跳过标签',doc.frames.every(f=>f.duration===75)&&doc.tags.length===0);
  const original=JSON.stringify(doc),bad={...source,files:[{name:'broken.png',data:source.files[0].data.slice(0,32)}]};let rejected=false;pending=importFile(bad);form.requestSubmit($('modal-submit'));try{await pending;}catch{rejected=true;}check('损坏 PNG 解码失败保留项目并解除忙碌',rejected&&!busy&&JSON.stringify(doc)===original);
}


window.runSmokeTests=async(gifFixture)=>{
  localStorage.removeItem(EXPORT_SETTINGS_KEY);
  const results=[];const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
  try{
    if($('modal').open){$('modal').close('cancel');await new Promise(r=>setTimeout(r,0));}
    onionSettings={...DEFAULT_ONION_SETTINGS};$('onion').checked=false;onionCache.clear();frameCache.clear();referenceCache.clear();
    brushSettings={shape:'square',angle:0,opacity:100,ink:'simple',pixelPerfect:false,filled:false,pattern:null};brush=1;updateBrushControls();
    check('启动无文档时显示欢迎页且隐藏顶部绘画参数行',!documentTabs.items.length&&!$('welcome').hidden&&getComputedStyle(document.querySelector('.options')).display==='none'&&bootDocumentAudit.layers===1&&bootDocumentAudit.frames===1&&bootDocumentAudit.transparent&&[...ctx.getImageData(0,0,canvas.width,canvas.height).data].every(value=>value===0),{tabs:documentTabs.items.length,welcomeHidden:$('welcome').hidden});
    replaceDocument(createDocument(16,16,'验收测试'),false);li=0;fit();setColor('#edb75b');setTool('pencil');
    const pointEvent=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:1,button:0}));};
    // Native pointer capture rejects synthetic pointers; use a real trusted mouse event in UI testing where available.
    const capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
    pointEvent('pointerdown',2,2);pointEvent('pointermove',9,2);pointEvent('pointerup',9,2);viewport.setPointerCapture=capture;
    check('铅笔连续笔画',pixels()[2*16+5]===colorValue('#edb75b'));actions.undo();check('笔画撤销',pixels().every(p=>p===0));actions.redo();check('笔画重做',pixels()[2*16+5]!==0);
    actions['add-layer']();check('新增图层',doc.layers.length===2&&doc.frames.every(f=>f.cels.length===2));actions['duplicate-frame']();check('复制动画帧',doc.frames.length===2);fi=0;li=0;doc.frames[0].cels[0][0]=colorValue('#ffffff');check('帧互不共享像素',doc.frames[1].cels[0][0]===0);
    selection={x:2,y:2,w:8,h:1};actions.copy();selection={x:0,y:6,w:8,h:1};actions.paste();check('选区复制粘贴',pixels()[6*16]===colorValue('#edb75b'));
    const pasteBefore=pixels().filter(p=>p===colorValue('#edb75b')).length;selection={x:2,y:2,w:8,h:1};actions.paste();check('保留选区再粘贴落到选区之外',pixels().filter(p=>p===colorValue('#edb75b')).length===pasteBefore+8&&pixels()[3*16+2]===colorValue('#edb75b')&&selection.y!==2);
    const restored=validateDocument(JSON.parse(JSON.stringify(doc)));check('项目序列化往返',JSON.stringify(restored)===JSON.stringify(validateDocument(doc)));check('PNG 编码',frameCanvas(0).toDataURL('image/png').startsWith('data:image/png;base64,iVBOR'));
    play();await new Promise(r=>setTimeout(r,120));check('动画按帧时长推进',previewFrame===1);stop();
    if(window.desktop){await saveData(JSON.stringify(doc),'project','smoke-project');await saveData(frameCanvas(0).toDataURL('image/png').split(',')[1],'png','smoke-frame');const file=await window.desktop.open();const roundtrip=validateDocument(JSON.parse(file.data));check('原生项目文件读写',JSON.stringify(roundtrip)===JSON.stringify(validateDocument(doc)));}
    const pngData=frameCanvas(0).toDataURL('image/png').split(',')[1];
    const importing=importFile({type:'image',data:pngData,name:'test-sheet.png'});
    for(let wait=0;wait<50&&!$('modal').open;wait++)await new Promise(r=>setTimeout(r,10));
    const form=$('modal-form');form.elements.mode.value='sheet';form.elements.width.value=8;form.elements.height.value=8;form.requestSubmit($('modal-submit'));await importing;
    check('PNG 精灵表切帧导入',doc.width===8&&doc.height===8&&doc.frames.length===4&&doc.frames[0].cels[0][2*8+2]===colorValue('#edb75b'));
    if(window.desktop){const exporting=exportDialog('sheet');form.elements.columns.value=2;form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await exporting;check('精灵表 PNG 导出流程',$('status').textContent==='导出完成');const metadata=exportDialog('metadata');form.elements.columns.value=2;form.elements.scale.value=2;form.requestSubmit($('modal-submit'));await metadata;check('精灵表 JSON 导出流程',$('status').textContent==='导出完成');}
    await runBasicEditSmoke(check);
    await runBrushSmoke(check);
    await runPathSmoke(check);
    await runSelectionSmoke(check);
    await runTransformSmoke(check);
    await runTimelineSmoke(check);
    await runOnionSmoke(check);
    await runCelSmoke(check);
    if(window.desktop){await runAnimationSmoke(check,gifFixture);await runSequenceSmoke(check);await runSheetSmoke(check);}
    await runColorSmoke(check);
    if(window.desktop)await runFileSmoke(check);
    await runInteractionSmoke(check);
    replaceDocument(createDocument(512,512,'缩放验收'),false);scale(48/zoom);$('grid').checked=true;selection={x:0,y:0,w:512,h:512};drawOverlay();
    check('最大画布高倍缩放叠加层受视口限制',zoom===48&&overlay.width===Math.round(viewport.clientWidth*devicePixelRatio)&&overlay.height===Math.round(viewport.clientHeight*devicePixelRatio));
    $('grid').checked=false;

    // Aseprite 功能补齐：替换颜色 / 网格设置 / 图像大小
    replaceDocument(createDocument(4,4,'aseprite-tools'),true);li=0;fit();
    check('新命令均接入原生菜单',window.checkMenuActions(['replace-color','sprite-size','grid-settings']).length===0);
    const replaceButton=uiQuery('[data-action="replace-color"]'),spriteButton=uiQuery('[data-action="sprite-size"]'),gridButton=uiQuery('[data-action="grid-settings"]');
    check('三个新命令在界面中有矢量图标入口',[replaceButton,spriteButton,gridButton].every(b=>b&&b.querySelector('svg[data-icon]')));
    check('替换颜色放进颜色操作菜单，不再占用工具工具栏',!!replaceButton.closest('#palette-menu')&&!replaceButton.closest('.drawing-options'));
    check('替换颜色在颜色操作菜单里同时有图标与文字',replaceButton.textContent.trim()==='替换颜色'&&!!replaceButton.querySelector('svg[data-icon]'),{text:replaceButton.textContent.trim()});
    mutate(()=>pixels()[0]=colorValue('#ff0000'),'准备替换颜色');
    const replaceHistory=history.undoStack.length;
    check('可编辑像素层启用替换颜色',!replaceButton.disabled);
    doc.layers[li].locked=true;syncInteraction();check('锁定图层置灰替换颜色',replaceButton.disabled);doc.layers[li].locked=false;syncInteraction();
    let pending=replaceColorDialog();
    check('替换颜色弹窗包含原色/新色/容差/范围',$('modal').open&&['from','to','tolerance','scope'].every(name=>!!$('modal-form').elements[name]));
    const replaceForm=$('modal-form');replaceForm.elements.from.value='#ff0000';replaceForm.elements.to.value='#00ff00';replaceForm.elements.scope.value='cel';replaceForm.requestSubmit($('modal-submit'));await pending;
    check('替换颜色实际改写像素并可撤销',pixels()[0]===colorValue('#00ff00')&&history.undoStack.length===replaceHistory+1);
    actions.undo();check('替换颜色单步撤销恢复原色',pixels()[0]===colorValue('#ff0000'));
    // 网格设置：偏移与宽高生效并绘制在主画布上，设置写入本机
    pending=gridSettingsDialog();
    const gridForm=$('modal-form');for(const [key,value]of [['x',0],['y',0],['w',4],['h',4]])gridForm.elements[key].value=value;gridForm.requestSubmit($('modal-submit'));await pending;
    // 本机设置可能残留上一次的显示状态，先显式置为隐藏再点开关，断言才与运行顺序无关。
    gridSettings={...gridSettings,visible:false};saveGrid(localStorage,gridSettings);syncGridGuideLabel();drawOverlay();
    uiQuery('[data-action="toggle-grid-guide"]').click();
    check('网格设置写入本机并同步状态',gridSettings.w===4&&gridSettings.visible&&JSON.parse(localStorage.getItem('pixpix-grid-settings-v1')).w===4);
    const overlayPixels=()=>{const data=octx.getImageData(0,0,overlay.width,overlay.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count;};
    selection=null;drawOverlay();const gridOn=overlayPixels();
    gridSettings={...gridSettings,visible:false};drawOverlay();const gridOff=overlayPixels();
    check('网格设置实际绘制到画布叠加层',gridOn>gridOff);
    gridSettings={...gridSettings,visible:true};saveGrid(localStorage,gridSettings);drawOverlay();
    check('网格设置不修改项目像素',doc.width===4&&doc.height===4&&pixels()[0]===colorValue('#ff0000'));
    // 图像大小：缩放全部图层与帧，与只改画布的「画布」命令语义不同
    replaceDocument(createDocument(4,4,'sprite-size'),true);addLayer(doc,0);mutate(()=>{doc.frames[0].cels[0][0]=colorValue('#ff0000');doc.frames[0].cels[1][15]=colorValue('#0000ff');},'准备缩放');
    const frameCountBefore=doc.frames.length,layerCountBefore=doc.layers.length;
    pending=spriteSizeDialog();
    check('图像大小弹窗包含像素/百分比/锁定比例/插值',$('modal').open&&['width','height','widthPerc','heightPerc','lockRatio','method'].every(name=>!!$('modal-form').elements[name]));
    const sizeForm=$('modal-form');sizeForm.elements.width.value=8;sizeForm.elements.width.dispatchEvent(new Event('input'));check('锁定比例联动高度',sizeForm.elements.height.value==='8');sizeForm.requestSubmit($('modal-submit'));await pending;
    check('图像大小缩放全部图层像素并保持帧图层数',doc.width===8&&doc.height===8&&doc.frames.length===frameCountBefore&&doc.layers.length===layerCountBefore&&doc.frames[0].cels[0][1]===colorValue('#ff0000')&&doc.frames[0].cels[1][6*8+6]===colorValue('#0000ff'));
    actions.undo();check('图像大小单步撤销恢复尺寸与像素',doc.width===4&&doc.height===4&&doc.frames[0].cels[0][1]===0);
    // 画布尺寸命令仍不缩放内容，确认两者语义独立
    replaceDocument(createDocument(2,2,'canvas-vs-sprite'),true);mutate(()=>pixels()[0]=colorValue('#ff0000'),'准备画布尺寸');
    pending=canvasSizeDialog();$('modal-form').elements.width.value=4;$('modal-form').elements.height.value=4;$('modal-form').elements.anchor.value='top-left';$('modal-form').requestSubmit($('modal-submit'));await pending;
    check('画布尺寸只扩展画布不缩放内容',doc.width===4&&doc.height===4&&pixels()[0]===colorValue('#ff0000')&&pixels()[1]===0);
    replaceDocument(demoDocument(),true);fi=0;li=1;setTool('pencil');fit();message('核心功能验收通过');check('恢复示例界面',$('doc-name').textContent==='林间微光.pix');
    check('功能按钮统一使用矢量图标',[...uiAll('[data-action]')].every(b=>b.querySelector('svg[data-icon]')&&!b.innerHTML.includes('undefined')));
    check('所有工具图标和快捷键可见',[...uiAll('#tools [data-tool]')].every(b=>b.querySelector('svg')&&b.querySelector('.tool-key')));
    const lowerEye=$('layers').lastElementChild.querySelector('.layer-visibility');lowerEye.querySelector('path').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    check('点击图层 SVG 显隐保持活动图层',!doc.layers[0].visible&&li===1);actions.undo();
    const lowerLock=$('layers').lastElementChild.querySelector('.layer-lock');lowerLock.querySelector('path').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    check('点击图层 SVG 锁定保持活动图层',doc.layers[0].locked&&li===1);actions.undo();
    const beforeTheme=JSON.stringify(doc),beforeColor=getComputedStyle(document.body).color,initialTheme=document.documentElement.dataset.theme;
    $('theme-toggle').click();check('主题切换更新颜色并持久化',getComputedStyle(document.body).color!==beforeColor&&localStorage.getItem('pixel-studio-theme')===document.documentElement.dataset.theme);
    $('theme-toggle').click();check('恢复主题保持项目数据不变',document.documentElement.dataset.theme===initialTheme&&JSON.stringify(doc)===beforeTheme);
    await Promise.all([...document.images].map(img=>img.decode()));check('品牌与明暗插画全部可解码',[...document.images].every(img=>img.naturalWidth>0));
    replaceDocument(demoDocument(),true);setTool('pencil');message('图标与主题验收通过');
    return{ok:true,results};
  }catch(error){return{ok:false,results,error:error.stack};}
};

window.prepareAccessibilitySmoke=()=>{
  replaceDocument(createDocument(8,8,'辅助功能验收'),true);addLayer(doc,0);const group=groupLayer(doc,1,'测试组');doc.layers[0].name='底层';doc.layers[1].name='子图层';li=group;render();setTool('pencil');
  $('layers').querySelector('[tabindex="0"]').focus();
  window.accessibilityState=()=>({layer:doc.layers[li].name,collapsed:!!doc.layers.find(l=>l.name==='测试组').collapsed,tool,focus:uiActive().id||uiActive().getAttribute('aria-label'),hex:$('hex').value,gesture:!!gesture});
  window.compositionEvents=[];for(const type of ['compositionstart','compositionupdate','compositionend'])$('hex').addEventListener(type,e=>compositionEvents.push({type,data:e.data}));
  return true;
};

window.runImeDeviceAudit=async()=>{
  const events=[];const result=await modal('Windows 中文输入法实机验收','<p>请使用 Windows 中文输入法，在下方输入“像素测试”；先用 Enter 确认候选词，再按 Tab 到“确定”并提交。</p><label>测试名称 <input name="name" type="text" required autofocus maxlength="80"></label>',form=>{
    const input=form.elements.name;for(const type of ['compositionstart','compositionupdate','compositionend','beforeinput','input'])input.addEventListener(type,event=>{events.push({type,trusted:event.isTrusted,data:event.data,inputType:event.inputType,composing:event.isComposing});});
  });
  const record={value:result?.name,events,recordedAt:new Date().toISOString()};return{...record,...validateImeAudit(record)};
};

window.runContextUiSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},shown=node=>!!node.getClientRects().length;
 try{
  replaceDocument(createDocument(8,8,'界面操作验收'),true);setTool('pencil');
  const all=uiAll('[data-action]').length,visible=[...uiAll('[data-action]')].filter(shown).length;
  check('常用操作直接展示，图层和文件菜单按需打开 '+visible+'/'+all,visible>0&&!shown($('layer-menu'))&&!shown($('document-menu')));
  check('铅笔不显示形状填充、笔形角度和选区操作行',!shown($('shape-filled'))&&!shown($('brush-angle'))&&!shown($('selection-options')));
  check('笔刷预设按钮紧跟工具名分隔线、位于该行最左侧',uiQuery('.options').children[2].classList.contains('divider')&&uiQuery('.options').children[2].nextElementSibling.contains(uiQuery('[data-action=brush-presets]'))&&shown(uiQuery('[data-action=brush-presets]')));
  setTool('rect');check('矩形显示填充并隐藏像素完美',shown($('shape-filled'))&&!shown($('pixel-perfect')));
  setTool('fill');const toolbar=uiQuery('.options'),visibleDividers=[...toolbar.querySelectorAll(':scope > .divider')].filter(shown);check('填充工具名称后只显示一个分隔符',visibleDividers.length===1&&visibleDividers[0]===toolbar.children[2]&&shown(uiQuery('[data-action=brush-presets]'))&&!shown($('brush').closest('label'))&&!shown($('symmetry').closest('label')));
  setTool('select');check('选区工具切换专用栏并收起绘画参数',shown($('selection-options'))&&$('paint-options').hidden&&['invert-selection','reselect','select-content','transform-selection','copy','paste','flip-x','flip-y','clear','deselect'].every(a=>$('selection-options').querySelector('.selection-inline-actions [data-action="'+a+'"].visual-button'))&&!uiQuery('.palette-panel [data-action=copy],.palette-panel [data-action=flip-x]')&&!document.getElementById('selection-menu-trigger'));
  const invertIcon=$('selection-options').querySelector('[data-action="invert-selection"] svg'),reselectIcon=$('selection-options').querySelector('[data-action="reselect"] svg');check('反选与重选图标可区分',invertIcon.dataset.icon!==reselectIcon.dataset.icon&&invertIcon.innerHTML!==reselectIcon.innerHTML);
  setTool('move');check('移动工具上部工具栏不显示任何操作项',!shown($('selection-options'))&&!shown($('paint-options'))&&[...uiQuery('.options').querySelectorAll('[data-action]')].every(action=>!shown(action)));setTool('select');check('切回选区工具恢复选区操作行',shown($('selection-options'))&&$('selection-options').querySelectorAll('.selection-inline-actions [data-action]').length===10);
  $('selection-kind').value='wand';$('selection-kind').dispatchEvent(new Event('change'));check('魔棒才显示容差',shown($('wand-tolerance')));$('selection-kind').value='rect';$('selection-kind').dispatchEvent(new Event('change'));check('矩形选区隐藏魔棒容差',!shown($('wand-tolerance')));
  setTool('pencil');const optionRow=uiQuery('.options'),rowRect=optionRow.getBoundingClientRect();setTool('hand');const handRect=optionRow.getBoundingClientRect();check('平移工具收起参数并保持单行工具栏高度',$('paint-options').classList.contains('options-empty')&&rowRect.height===handRect.height&&handRect.height===44);
  const before=JSON.stringify(doc);$('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:250}));check('图层操作按需打开原生浮层',$('layer-menu').matches(':popover-open')&&$('layer-menu-trigger').getAttribute('aria-expanded')==='true');
  check('图层菜单不再有参考图入口且普通图层不显示解组',!uiQuery('[data-action="reference-import"],[data-action="reference-settings"],[data-action="toggle-reference"]')&&!shown(uiQuery('[data-action="ungroup-layer"]')));
  check('图层菜单不再有类型子菜单且背景切换直接是菜单项',!uiAll('.context-submenu').some(details=>details.querySelector('[data-action="toggle-background"]'))&&!!uiQuery('#layer-menu [data-action="toggle-background"]'));
  check('混合与不透明度只在图层菜单内展示',$('layer-blend').closest('#layer-menu')===$('layer-menu')&&$('opacity').closest('#layer-menu')===$('layer-menu')&&!uiQuery('.layers-panel #layer-blend')&&!uiQuery('.layers-panel #opacity'));
  const layerBefore=JSON.stringify(doc.layers[li]);
  $('layer-blend').value='multiply';$('layer-blend').dispatchEvent(new Event('change'));
  check('菜单内切换混合模式立即生效',doc.layers[li].blendMode==='multiply'&&doc.requiredFeatures.includes('layer-blending'));
  $('opacity').value='40';$('opacity').dispatchEvent(new Event('input'));$('opacity').dispatchEvent(new Event('change'));
  check('菜单内调整不透明度立即生效并同步标签',doc.layers[li].opacity===40&&$('opacity-label').textContent==='40%');
  actions.undo();actions.undo();
  check('菜单内混合与不透明度可撤销',JSON.stringify(doc.layers[li])===layerBefore&&$('opacity').value==='100');
  actions['group-layer']();$('group-mode').value='pass';$('group-mode').dispatchEvent(new Event('change'));
  check('穿透组禁用混合与不透明度',$('layer-blend').disabled&&$('opacity').disabled);
  actions.undo();actions.undo();
  actions['toggle-background']();
  check('背景层禁用混合与不透明度',$('layer-blend').disabled&&$('opacity').disabled);
  actions.undo();
  check('类型切换后恢复可编辑',!$('layer-blend').disabled&&!$('opacity').disabled);
  uiQuery('[data-action="group-layer"]').closest('.context-submenu').querySelector(':scope > button').click();uiQuery('[data-action="group-layer"]').click();await new Promise(r=>setTimeout(r,0));check('菜单编组实际生效并自动关闭',doc.layers[li].type==='group'&&!$('layer-menu').matches(':popover-open'));
  $('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:250}));uiQuery('[data-action=ungroup-layer]').closest('.context-submenu').querySelector(':scope > button').click();check('组图层只显示适用类型操作',shown(uiQuery('[data-action="ungroup-layer"]'))&&!shown($('layer-continuous'))&&!uiQuery('[data-action="toggle-reference"]'));$('layer-menu').hidePopover();actions.undo();check('菜单操作仍可撤销',JSON.stringify(doc)===before);
  setTool('pencil');const grid=$('grid').checked;uiQuery('[data-toggle=grid]').click();check('画布网格图标直接切换并同步状态',$('grid').checked!==grid&&uiQuery('[data-toggle=grid]').getAttribute('aria-pressed')===String($('grid').checked));
  const canvasRow=uiQuery('.canvas-actions'),canvasButtons=[...canvasRow.querySelectorAll('button')];
  check('画布右上只保留适应、像素网格、参考网格与网格设置四个按钮',canvasButtons.length===4&&canvasButtons[0].dataset.action==='fit'&&canvasButtons[1].dataset.toggle==='grid'&&canvasButtons[1].querySelector('svg')?.dataset.icon==='grid-guide'&&canvasButtons[2].dataset.action==='toggle-grid-guide'&&canvasButtons[2].querySelector('svg')?.dataset.icon==='pixel-grid'&&canvasButtons[3].dataset.action==='grid-settings');
  check('被移出右上角的画布命令仍在画布菜单内',!!$('canvas-menu-trigger')&&['canvas-size','crop-selection','trim-canvas','sprite-size','slices'].every(name=>$('canvas-menu').querySelector('[data-action="'+name+'"]')));
  const gridLabel=()=>$('grid').closest('label').textContent.trim(),gridButtonLabel=()=>uiQuery('[data-toggle=grid]').title,gridWord=()=>$('grid').checked?'隐藏像素网格':'显示像素网格';
  check('网格文案随勾选状态切换',gridLabel()===gridWord()&&gridButtonLabel()===gridWord());
  uiQuery('[data-toggle=grid]').click();
  check('切换后网格文案立即反转',gridLabel()===gridWord()&&gridButtonLabel()===gridWord());
  uiQuery('[data-toggle=grid]').click();
  for(const id of ['palette-menu','document-menu']){$(id+'-trigger').click();check(id+'打开且处于屏幕内',$(id).matches(':popover-open')&&$(id).getBoundingClientRect().left>=0);$(id).hidePopover();}
  return{ok:true,results,visibleActions:visible,totalActions:all};
 }catch(error){return{ok:false,results,error:error.stack};}
};

window.runSettingsSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{const before=JSON.stringify(doc),old=inputPreferences.wheel;let pending=settingsDialog();const form=$('modal-form');check('设置移除颜色偏好并保留十类偏好',$('settings-tabs').children.length===10&&!$('settings-tab-colors')&&!$('settings-page-colors')&&!form.elements['colors.foreground']&&!form.elements['colors.background']);form.elements['input.wheel'].value='frames';form.elements['appearance.width'].value=48;form.elements['appearance.height'].value=24;form.elements['appearance.duration'].value=80;form.elements['canvasBackground.defaultSize'].value=5;form.elements['canvasBackground.defaultColor1'].value='#112233';form.elements['canvasBackground.defaultColor2'].value='#445566';form.elements['pen.gamma'].value=1.4;form.requestSubmit($('modal-submit'));await pending;check('跨分类设置一起保存并同步运行值',inputPreferences.wheel==='frames'&&penPreferences.gamma===1.4&&JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)).canvasBackground.size===5);check('应用设置不修改作品和历史',JSON.stringify(doc)===before);pending=settingsDialog();form.elements['input.wheel'].value='brush';$('modal').close('cancel');await pending;check('取消不保存任何分类',inputPreferences.wheel==='frames');pending=newDocument();check('新建使用设置里的默认宽高',form.elements.width.value==='48'&&form.elements.height.value==='24');form.requestSubmit($('modal-submit'));await pending;check('新建使用默认帧时长和透明背景',doc.width===48&&doc.height===24&&doc.frames[0].duration===80&&doc.canvasBackground.size===5&&getComputedStyle($('canvas-wrap')).getPropertyValue('--document-checker-a').trim()==='#112233');pending=settingsDialog();form.elements['canvasBackground.currentSize'].value=7;form.elements['canvasBackground.currentColor1'].value='#abcdef';form.requestSubmit($('modal-submit'));await pending;check('当前项目背景独立保存并可撤销',doc.canvasBackground.size===7&&doc.canvasBackground.color1==='#abcdef'&&history.undoStack.length===1);const checker=getComputedStyle(wrap);check('方格尺寸与双颜色实际应用到主画布',checker.backgroundSize===`${14*zoom}px ${14*zoom}px`&&checker.backgroundColor==='rgb(171, 205, 239)'&&checker.backgroundImage.includes('rgb(68, 85, 102)'));const squareCount=()=>({x:parseFloat(wrap.style.width)/(parseFloat(getComputedStyle(wrap).backgroundSize)/2),y:parseFloat(wrap.style.height)/(parseFloat(getComputedStyle(wrap).backgroundSize)/2)}),beforeCount=squareCount(),beforeZoom=zoom;for(const deltaY of [-120,120]){const oldZoom=zoom;viewport.dispatchEvent(new WheelEvent('wheel',{deltaY,ctrlKey:true,bubbles:true,cancelable:true}));const count=squareCount();check(deltaY<0?'设置后滚轮放大时方格同步放大且数量不变':'设置后滚轮缩小时方格同步缩小且数量不变',zoom!==oldZoom&&Math.abs(count.x-beforeCount.x)<1e-7&&Math.abs(count.y-beforeCount.y)<1e-7&&getComputedStyle(wrap).backgroundSize===`${14*zoom}px ${14*zoom}px`);}fit();check('适应内容后透明背景方格数量不变',Math.abs(squareCount().x-beforeCount.x)<1e-7&&Math.abs(squareCount().y-beforeCount.y)<1e-7);scale(beforeZoom/zoom);check('透明背景不会填充作品像素或导出画面',pixels().every(value=>value===0)&&frameCanvas(fi).getContext('2d').getImageData(0,0,1,1).data[3]===0);await saveProject();const backgroundFile=await window.desktop.openRecent(0);check('当前透明背景随实际项目文件保存',JSON.parse(backgroundFile.data).canvasBackground.size===7&&JSON.parse(backgroundFile.data).canvasBackground.color1==='#abcdef');actions.undo();check('撤销恢复实际方格周期与背景颜色',getComputedStyle(wrap).backgroundSize===`${10*zoom}px ${10*zoom}px`&&getComputedStyle(wrap).backgroundColor==='rgb(17, 34, 51)');pending=settingsDialog();form.elements['canvasBackground.currentSize'].value=11;$('modal').close('cancel');await pending;check('取消透明背景设置不修改画布显示',getComputedStyle(wrap).backgroundSize===`${10*zoom}px ${10*zoom}px`);pending=settingsDialog();form.elements['pen.gamma'].value=0;form.requestSubmit($('modal-submit'));check('无效隐藏分类自动定位数位笔设置',$('modal').open&&$('settings-tab-pen').getAttribute('aria-selected')==='true');$('modal').close('cancel');await pending;pending=settingsDialog();form.elements['keys.bindings.tool:pencil'].value='E';form.requestSubmit($('modal-submit'));check('快捷键冲突阻止整份设置保存',$('modal').open&&$('modal-error').textContent.includes('冲突'));$('modal').close('cancel');await pending;for(const language of ['zh','en','zh']){
 applyLocale(language);uiQuery('[data-menu-command="settings"]').click();
 for(let i=0;i<100&&!$('modal').open;i++)await new Promise(resolve=>setTimeout(resolve,20));
 $('settings-tab-keys').click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const labels=()=>[...document.querySelectorAll('.settings-key-list label>span')].map(node=>node.textContent),caption=action=>form.elements['keys.bindings.'+action].previousElementSibling.textContent;
 check('顶部设置快捷键操作名称随语言显示 '+language,labels().every(label=>label&&!label.includes('tool:')&&!label.includes('capture-brush'))&&caption('capture-brush')===(language==='en'?'Create brush from selection':'从选区建立笔刷')&&caption('tool:pencil')===(language==='en'?'Pencil':'铅笔')&&(language!=='en'||labels().every(label=>!/[\u3400-\u9fff]/.test(label))));
 const profile=form.elements['keys.profile'];profile.value='aseprite';profile.dispatchEvent(new Event('change'));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 check('切换预设后名称保持国际化 '+language,caption('selection-lasso')===(language==='en'?'Free lasso':'自由套索')&&caption('capture-brush')===(language==='en'?'Create brush from selection':'从选区建立笔刷'));
 const search=document.querySelector('#settings-page-keys input[aria-label]');search.value=language==='en'?'Create brush':'从选区建立';search.dispatchEvent(new Event('input'));
 check('本地化操作名称可搜索 '+language,!form.elements['keys.bindings.capture-brush'].closest('label').hidden&&form.elements['keys.bindings.tool:pencil'].closest('label').hidden);
 $('modal').close('cancel');await new Promise(resolve=>setTimeout(resolve,50));
}return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runI18nSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const stage=name=>{window.__i18nStage=name;},tick=()=>new Promise(r=>setTimeout(r,80)),menuLabel=label=>uiQuery('[data-top-menu="'+label+'"]')?.textContent,tabLabel=id=>uiQuery('[data-panel-tab="'+id+'"]')?.title;try{
  stage('reset-zh');window.minepixLocale.set('zh');await tick();
  check('默认界面为简体中文',locale()==='zh'&&menuLabel('视图')==='视图'&&tabLabel('colors')==='颜色');
  stage('open-settings');let pending=settingsDialog();
  const form=$('modal-form'),language=form.elements['appearance.language'];
  check('设置弹窗提供语言下拉且当前为简体中文',!!language&&language.options.length===2&&language.value==='zh');
  stage('submit-en');language.value='en';form.requestSubmit($('modal-submit'));await pending;await tick();
  stage('menu-en');check('切到 English 后顶部菜单变英文',[...document.querySelectorAll('[data-top-menu]')].map(button=>button.textContent).join(',')==='File,Edit,Color,Layers,Canvas,Selection,Animation,View');
  stage('tab-tool-en');check('切到 English 后栏目标签与工具提示变英文',tabLabel('colors')==='Color'&&uiQuery('#tools [data-tool=pencil]').title.startsWith('Pencil'));
  stage('persist');check('语言选择持久化到本机偏好',localStorage.getItem(LOCALE_KEY)==='en'&&JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)).language==='en');
  stage('residue');const residue=(()=>{const found=new Set(),cjk=/[\u3400-\u9fff]/,skip=new Set(['简体中文','语言 / Language']);const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node=walker.nextNode();while(node){const text=node.nodeValue.trim();if(cjk.test(text)&&!skip.has(text))found.add(text);node=walker.nextNode();}for(const element of document.querySelectorAll('body *'))for(const name of ['title','aria-label','placeholder']){const value=element.getAttribute?.(name);if(value&&cjk.test(value))found.add('@'+name+':'+value);}for(const element of document.querySelectorAll('body *'))for(const pseudo of ['::before','::after']){const content=getComputedStyle(element,pseudo).content;if(content&&cjk.test(content))found.add(pseudo+':'+content);}return[...found];})();
  window.__i18nResidue=residue;
  check('切到 English 后界面不再残留中文',residue.length===0);
  stage('status-en');message('已显示网格');await tick();
  check('切到 English 后状态提示变英文',$('status').textContent==='Grid shown');
  check('语言切换同步给主进程对话框',typeof window.desktop.setLocale==='function');
  stage('reset-zh-back');window.minepixLocale.set('zh');await tick();
  check('切回简体中文后界面复原',menuLabel('视图')==='视图'&&tabLabel('colors')==='颜色'&&localStorage.getItem(LOCALE_KEY)==='zh'&&$('status').textContent==='已显示网格');
  stage('done');return {ok:true,results};
}catch(error){return {ok:false,results,error:error.stack};}};

window.runWelcomeSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};const welcome=document.getElementById('welcome'),inner=welcome&&welcome.querySelector('.welcome-inner'),topAt=(x,y)=>document.elementsFromPoint(x,y)[0],covers=node=>node===welcome||!!(welcome&&welcome.contains(node));try{
  welcomeEntries=await window.desktop.recentFiles();welcomeRecentKey='';renderWelcomeRecent();
  check('无文档时显示欢迎页',!!welcome&&!welcome.hidden&&!!inner);
  check('欢迎页使用应用图标',welcome.querySelector('.welcome-mark')?.getAttribute('src')==='./assets/app-icon.png');
  const rect=inner.getBoundingClientRect();
  check('欢迎页内容居中且不超出窗口',rect.top>=0&&rect.left>=0&&rect.bottom<=innerHeight&&rect.right<=innerWidth);
  const resizers=[...document.querySelectorAll('.dock-resizer')].map(node=>node.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
  const covered=resizers.filter(r=>!covers(topAt(r.left+r.width/2,r.top+r.height/2)));
  check('栏位分隔条不压在欢迎页上',resizers.length>0&&covered.length===0);
  const slots=[...document.querySelectorAll('.dock-slot')].map(node=>node.getBoundingClientRect()).filter(r=>r.right<=innerWidth&&r.bottom<=innerHeight);
  const hit=slots.filter(r=>!covers(topAt(r.left+3,r.top+3)));
  check('面板边框不压在欢迎页上',hit.length===0);
  check('欢迎页内容不需要滚动',welcome.scrollHeight<=welcome.clientHeight+1);
  const before=document.documentElement.dataset.theme;document.documentElement.dataset.theme='light';
  const light=covers(topAt((resizers[0]||{left:0,width:0,top:0,height:0}).left+2,(resizers[0]||{left:0,width:0,top:0,height:0}).top+1))&&slots.every(r=>covers(topAt(r.left+3,r.top+3)));
  document.documentElement.dataset.theme=before;
  check('浅色主题下欢迎页同样盖住栏位装饰',light);
  check('最近文件每条提供独立删除按钮',$('welcome-recent').querySelectorAll('.welcome-recent-remove').length===welcomeEntries.length&&welcomeEntries.length===1);
  const removal=new Promise(resolve=>{const poll=()=>{if(!welcomeEntries.length)resolve();else setTimeout(poll,10);};poll();});$('welcome-recent').querySelector('.welcome-recent-remove').click();await removal;
  check('点击删除只移除记录且留在欢迎页',!$('welcome').hidden&&!documentTabs.items.length&&!$('welcome-recent').querySelector('.welcome-recent-item')&&!!$('welcome-recent').querySelector('.welcome-recent-empty'));
  check('删除结果持久化',(await window.desktop.recentFiles()).length===0);
}catch(error){results.push({name:'欢迎页套件中断：'+error.message,pass:false});}
return{ok:results.every(row=>row.pass),results};};
window.runDockSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},layout=window.workspaceLayout;try{
  if(!documentTabs.items.length)window.loadDemoDocumentForSmoke();
 layout.reset();replaceDocument(createDocument(8,8,'停靠验收'),true);setTool('pencil');check('四边六个独立停靠栏位',uiAll('.dock-slot').length===6);
 check('核心栏目默认停靠且时间轴控件可查',layout.state().slots.bottom.includes('timeline')&&!!document.getElementById('onion')&&!!document.getElementById('timeline-mode'));
 layout.setPanelVisible('timeline',false);
 check('删除时间轴后控件仍留在文档中',!layout.panelPresent('timeline')&&!!document.getElementById('onion')&&document.getElementById('onion').ownerDocument===document);
 layout.setPanelVisible('timeline',true);
 check('重新显示时间轴回到下方栏位',layout.panelPresent('timeline')&&layout.state().slots.bottom.includes('timeline')&&!layout.panels.timeline.hidden);
 const layoutRect=layout.root.getBoundingClientRect(),centerRect=uiQuery('.dock-center').getBoundingClientRect(),bottomRect=uiQuery('[data-slot=bottom]').getBoundingClientRect(),leftRect=uiQuery('.dock-left').getBoundingClientRect(),rightRect=uiQuery('.dock-right').getBoundingClientRect(),footerTop=uiQuery('footer').getBoundingClientRect().top;
 check('下方栏位宽度等于画布宽度',Math.abs(bottomRect.width-centerRect.width)<=1&&Math.abs(bottomRect.left-centerRect.left)<=1);
 check('左右栏位延伸到底部不被下方栏位截断',Math.abs(leftRect.bottom-footerTop)<=1&&Math.abs(rightRect.bottom-footerTop)<=1&&leftRect.height>centerRect.height+1&&rightRect.height>centerRect.height+1&&Math.abs(leftRect.bottom-layoutRect.bottom)<=1);
 check('下方栏位标签栏位于面板上方',(()=>{const tabs=uiQuery('[data-slot=bottom]>.dock-tabs').getBoundingClientRect(),content=uiQuery('[data-slot=bottom]>.dock-content').getBoundingClientRect();return tabs.bottom<=content.top+1&&tabs.top>=bottomRect.top-1})());
 check('分隔条命中区贴合新布局',(()=>{const left=uiQuery('.resize-left').getBoundingClientRect(),right=uiQuery('.resize-right').getBoundingClientRect(),bottom=uiQuery('.resize-bottom').getBoundingClientRect();return Math.abs(left.bottom-footerTop)<=1&&Math.abs(right.bottom-footerTop)<=1&&Math.abs(bottom.width-centerRect.width)<=1&&Math.abs(bottom.left-centerRect.left)<=1&&left.width===5&&right.width===5&&bottom.height===5})());
 const transfer=new DataTransfer();transfer.setData(layout.dragType,'layers');document.querySelector('[data-slot="left-bottom"]').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));check('拖放将图层与颜色放到同栏标签',layout.state().slots['left-bottom'].join(',')==='colors,layers'&&layout.panels.layers.ownerDocument===document);
 document.querySelector('[data-slot="left-bottom"] [data-panel-tab=colors]').click();check('同栏切换标签只显示活动面板',!layout.panels.colors.hidden&&layout.panels.layers.hidden);
 layout.dock('tools','right-top');const rightSide=uiQuery('.dock-right'),rightBefore=rightSide.getBoundingClientRect(),rightTabWidths=[...uiAll('.dock-right [data-panel-tab]')].map(tab=>tab.getBoundingClientRect().width);uiQuery('.dock-right [data-panel-tab=tools]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const rightAfter=rightSide.getBoundingClientRect(),rightTabWidthsAfter=[...uiAll('.dock-right [data-panel-tab]')].map(tab=>tab.getBoundingClientRect().width);check('点击可拖动标签后右侧栏位与标签尺寸不收缩',rightAfter.left===rightBefore.left&&rightAfter.width===rightBefore.width&&JSON.stringify(rightTabWidthsAfter)===JSON.stringify(rightTabWidths));
 layout.dock('tools','left-top');
 layout.dock('tools','top');check('工具可移到上方栏位且左下仍可见',layout.state().slots.top.includes('tools')&&layout.panels.colors.getBoundingClientRect().height>50);
 layout.toggleBottom();check('下方栏位折叠保留标签条',layout.state().collapsed&&uiQuery('[data-slot=bottom]').classList.contains('collapsed'));layout.toggleBottom();
 await layout.detach('colors');const floating=layout.floats.get('colors'),child=floating.child;check('颜色面板进入真实新窗口并迁移原DOM',child!==window&&layout.panels.colors.ownerDocument===child.document&&child.document.getElementById('color')===$('color'));
 const foreground=child.document.getElementById('color');foreground.value='#ff3300';foreground.dispatchEvent(new Event('input',{bubbles:true}));check('独立窗口颜色控件直接影响主编辑器',color.startsWith('#ff3300'));
 child.close();await new Promise(r=>setTimeout(r,100));check('关闭独立窗口自动放回原栏位',layout.panels.colors.ownerDocument===document&&layout.state().slots['left-bottom'].includes('colors'));
 await layout.detach('timeline');const time=layout.floats.get('timeline').child;time.document.querySelector('[data-action="add-frame"]').click();await new Promise(r=>setTimeout(r,0));check('独立时间轴命令更新同一作品与界面',doc.frames.length===2&&time.document.querySelectorAll('.frame-head').length===2);
 layout.dock('timeline','bottom');check('重新停靠关闭原独立窗口',time.closed&&layout.panels.timeline.ownerDocument===document);
 await layout.detach('layers');const layerWindow=layout.floats.get('layers').child;layerWindow.document.getElementById('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:100,clientY:140}));check('独立图层的浮层菜单随面板迁移',layerWindow.document.getElementById('layer-menu').matches(':popover-open'));layerWindow.document.querySelector('[data-action="group-layer"]').closest('.context-submenu').querySelector(':scope > button').click();layerWindow.document.querySelector('[data-action="group-layer"]').click();await new Promise(r=>setTimeout(r,0));check('独立图层菜单操作与主历史一致',doc.layers[li].type==='group'&&history.undoStack.length===2);layout.dock('layers','right-bottom');
 await layout.detach('tools');const toolsWindow=layout.floats.get('tools').child;toolsWindow.document.querySelector('[data-tool=eraser]').click();check('独立工具面板切换主画布工具',tool==='eraser'&&viewport.dataset.tool==='eraser');layout.dock('tools','top');
 await layout.detach('preview');doc.frames[fi].cels[0][0]=0xff0000ff;invalidateFrame(fi);drawPreview();const previewWindow=layout.floats.get('preview').child;check('独立预览仍渲染当前作品像素',previewWindow.document.getElementById('preview').getContext('2d').getImageData(0,0,1,1).data[0]===255);previewWindow.close();await new Promise(r=>setTimeout(r,100));check('关闭预览后原栏位自动重绘像素',layout.panels.preview.ownerDocument===document&&$('preview').getContext('2d').getImageData(0,0,1,1).data[0]===255);
 const previousWidth=layout.state().sizes.left;document.querySelector('.resize-left').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check('栏位尺寸可调并持久化',layout.state().sizes.left===previousWidth+10);
 const stored=JSON.parse(localStorage.getItem('pixel-studio-layout-v1'));check('布局持久化包含栏位标签及尺寸',stored.slots.top.includes('tools')&&stored.sizes.left===previousWidth+10);
 const topHandle=uiQuery('.resize-top');for(let i=0;i<8;i++)topHandle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  const topSlotRect=uiQuery('[data-slot=top]').getBoundingClientRect(),topTabsRect=uiQuery('[data-slot=top]>.dock-tabs').getBoundingClientRect(),toolsPanel=uiQuery('[data-slot=top] [data-panel=tools]');
  check('顶部栏位最小高度装得下标签栏与工具图标行',layout.state().sizes.top===80&&Math.round(topSlotRect.height)>=80&&Math.round(topTabsRect.height)>=40&&toolsPanel.scrollHeight<=toolsPanel.clientHeight+1&&Math.round(toolsPanel.getBoundingClientRect().height)>=35,{sizes:layout.state().sizes,slot:topSlotRect.height,tabs:topTabsRect.height,tools:toolsPanel.getBoundingClientRect().height,scroll:toolsPanel.scrollHeight,client:toolsPanel.clientHeight});
  const sideHandle=uiQuery('.resize-left');for(let i=0;i<40;i++)sideHandle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  const leftWidth=uiQuery('[data-slot="left-top"]').getBoundingClientRect().width,barsWidth=uiQuery('.dock-left').getBoundingClientRect().width;check('左右栏位最小宽度为 260px',layout.state().sizes.left===260&&Math.round(barsWidth)===260&&leftWidth>=259,{sizes:layout.state().sizes,width:leftWidth,bar:barsWidth});
  for(let i=0;i<16;i++)sideHandle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  layout.dock('timeline','right-bottom');
  const emptyBottom=uiQuery('[data-slot=bottom]'),emptyBottomStyle=getComputedStyle(emptyBottom);
  check('下方栏位没有栏目时整条隐藏',emptyBottomStyle.display==='none'&&!emptyBottom.querySelector('[aria-label="折叠下方栏位"]')&&getComputedStyle(document.getElementById('dock-layout')).getPropertyValue('--dock-bottom').trim()==='0px',{display:emptyBottomStyle.display,tabs:emptyBottom.querySelectorAll('.dock-tabs button').length});
  layout.dock('timeline','bottom');
  uiQuery('[data-slot="left-bottom"] [data-panel-tab=colors]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:220,clientY:320}));const panelMenuNode=document.querySelector('.panel-menu');check('栏目标签右键可删除该栏目',!!panelMenuNode&&panelMenuNode.textContent==='删除该栏目');panelMenuNode.querySelector('button').click();check('删除后栏目从栏位移除且面板隐藏',!layout.state().slots['left-bottom'].includes('colors')&&layout.panels.colors.hidden);
  uiQuery('[data-slot="left-bottom"]>.dock-tabs').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:220,clientY:320}));const addMenu=document.querySelector('.panel-menu');check('栏位空白右键可添加未显示栏目',!!addMenu&&[...addMenu.querySelectorAll('button')].some(button=>button.textContent==='添加「颜色」'));[...addMenu.querySelectorAll('button')].find(button=>button.textContent==='添加「颜色」').click();check('添加后栏目回到原栏位',layout.state().slots['left-bottom'].includes('colors')&&!layout.panels.colors.hidden);
  uiQuery('[data-slot="right-top"] [data-panel-tab=preview]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:1200,clientY:120}));document.querySelector('.panel-menu button').click();
  uiQuery('[data-slot="left-bottom"]>.dock-tabs').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:220,clientY:320}));const slotAddMenu=document.querySelector('.panel-menu');[...slotAddMenu.querySelectorAll('button')].find(button=>button.textContent==='添加「预览」').click();
  check('在哪个栏位右键添加就落在哪个栏位',layout.state().slots['left-bottom'].includes('preview')&&!layout.state().slots['right-top'].includes('preview'),{slots:layout.state().slots});layout.dock('preview','right-top');
   uiQuery('[data-slot="left-bottom"] [data-panel-tab=colors]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:220,clientY:320}));document.querySelector('.panel-menu button').click();actions['panel-colors']();check('视图菜单显示被删栏目时回到原栏位',layout.state().slots['left-bottom'].includes('colors')&&!layout.panels.colors.hidden);
   actions['panel-colors']();check('视图菜单再次点击会隐藏该面板',layout.panels.colors.hidden&&!layout.state().slots['left-bottom'].includes('colors'));actions['panel-colors']();
   layout.setPanelVisible('tileset',false);check('图集栏目可从视图菜单重新打开',layout.panels.tileset.hidden&&!Object.values(layout.state().slots).some(list=>list.includes('tileset')));actions['panel-tileset']();check('视图菜单复原图集栏目后回到原栏位',!layout.panels.tileset.hidden&&Object.values(layout.state().slots).some(list=>list.includes('tileset')));actions['panel-tileset']();
   await new Promise(r=>setTimeout(r,80));
   const menuTree=await window.desktop.windowMenu(),findMenu=(items,id)=>{for(const item of items){if(item.id===id)return item;const hit=item.submenu&&findMenu(item.submenu,id);if(hit)return hit;}return null;};
   check('视图菜单面板项是勾选型且常显时处于勾选态',findMenu(menuTree,'panel-colors')?.type==='checkbox'&&findMenu(menuTree,'panel-colors')?.checked===true&&findMenu(menuTree,'panel-tools')?.checked===true&&findMenu(menuTree,'grid')?.type==='checkbox'&&findMenu(menuTree,'onion')?.type==='checkbox');
   layout.setPanelVisible('layers',false);await new Promise(r=>setTimeout(r,80));const menuHidden=await window.desktop.windowMenu();layout.setPanelVisible('layers',true);
   check('隐藏面板后菜单勾选态同步取消',findMenu(menuHidden,'panel-layers')?.checked===false);
  const gridItem=findMenu(menuTree,'grid-toggle'),guideBefore=gridSettings.visible,pixelBefore=$('grid').checked;
  check('画布显示菜单的显示网格项绑定参考网格',!!gridItem&&['显示网格','隐藏网格'].includes(gridItem.label)&&gridItem.label===(guideBefore?'隐藏网格':'显示网格'),{label:gridItem?.label});
  actions['grid-toggle']();await new Promise(r=>setTimeout(r,80));const gridStepTree=await window.desktop.windowMenu();
  check('点击网格菜单项只切换参考网格且不动像素网格',gridSettings.visible===!guideBefore&&$('grid').checked===pixelBefore&&findMenu(gridStepTree,'grid-toggle')?.label===(gridSettings.visible?'隐藏网格':'显示网格'),{guide:gridSettings.visible,pixel:$('grid').checked,label:findMenu(gridStepTree,'grid-toggle')?.label});
  actions['grid-toggle']();check('再次点击网格菜单项恢复参考网格原状态',gridSettings.visible===guideBefore&&$('grid').checked===pixelBefore);
  check('布局菜单不再提供折叠或显示下方栏位',findMenu(menuTree,'toggle-bottom')===null);
   const layerMenuTree=menuTree.find(item=>item.label==='图层').submenu,layerMenuIds=[];(function walkMenu(items){for(const item of items){if(item.id)layerMenuIds.push(item.id);if(item.submenu)walkMenu(item.submenu);}})(layerMenuTree);
   check('顶部图层菜单不再有参考图相关项但保留设为背景',!layerMenuIds.includes('reference-import')&&!layerMenuIds.includes('reference-settings')&&!layerMenuIds.includes('toggle-reference')&&layerMenuIds.includes('toggle-background'),{ids:layerMenuIds});
  layout.reset();check('恢复默认布局保留文档',doc.frames.length===2&&layout.state().slots['left-top'][0]==='reference'&&layout.state().sizes.left===420&&layout.floats.size===0);return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}};

window.runDocumentChromeSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};try{check('移除原顶部品牌与文件按钮行',!document.querySelector('header')&&!!document.querySelector('.document-strip'));check('主题位于自绘工具栏右侧',!!$('theme-toggle').closest('#window-toolbar'));const before=JSON.stringify(doc);$('document-menu-trigger').click();check('加号打开新建、打开与最近文件入口',$('document-menu').matches(':popover-open')&&$('document-menu').querySelectorAll('[data-action]').length===3);$('document-menu').querySelector('[data-action=new]').click();await new Promise(r=>setTimeout(r,0));check('加号新建实际打开表单并关闭菜单',$('modal').open&&$('modal-title').textContent==='新建像素项目'&&!$('document-menu').matches(':popover-open'));$('modal').close('cancel');await new Promise(r=>setTimeout(r,0));check('取消新建保留作品与加号',JSON.stringify(doc)===before&&$('document-menu-trigger').isConnected);const old=document.documentElement.dataset.theme;$('theme-toggle').click();check('顶层主题切换仍可使用',document.documentElement.dataset.theme!==old);$('theme-toggle').click();return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.runTilemapSmoke=async()=>{
 const results=[],check=(name,pass,details)=>{results.push({name,pass:!!pass,...(details?{details}:{})});if(!pass)throw new Error(name);},layout=window.workspaceLayout;
 const wait=async()=>new Promise(r=>setTimeout(r,60));
 const point=(type,x,y)=>{const r=canvas.getBoundingClientRect();viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+(x+.5)*zoom,clientY:r.top+(y+.5)*zoom,pointerId:91,button:0}));};
 const capture=viewport.setPointerCapture,atlasCapture=$('tileset-panel').querySelector('.tileset-atlas-canvas'),originalAtlasCapture=atlasCapture.setPointerCapture;atlasCapture.setPointerCapture=()=>{};
 try{
  layout.reset();replaceDocument(createDocument(8,8,'tileset-test'),true);penPreferences={...DEFAULT_PEN,mode:'none'};inputPreferences={...DEFAULT_INPUT};brush=1;setTool('pencil');fit();
  check('无 tileset 图层时图集栏位不显示',!layout.state().slots['right-bottom'].includes('tileset')&&!uiQuery('[data-panel-tab=tileset]'),{slots:layout.state().slots['right-bottom']});
  check('无 tileset 图层时不显示地形预览栏目',!layout.panelPresent('terrain-preview')&&!uiQuery('[data-panel-tab=terrain-preview]'));
  check('像素层合并按钮显示转为图集并文字选项',uiQuery('[data-action=tileset-toggle]').textContent==='转为图集'&&!uiQuery('[data-action=tileset-toggle] .icon')&&!uiQuery('[data-action=tileset-toggle]').disabled);
  // 普通层画一块 2×2 红块，转成 tileset
  mutate(()=>{for(let y=0;y<2;y++)for(let x=0;x<2;x++)pixels()[y*doc.width+x]=colorValue('#ff0000');},'铺图块');
  const form=$('modal-form');let pending=toTilesetDialog();
  form.elements.w.value=2;form.elements.h.value=2;form.elements.frame.value=1;form.requestSubmit($('modal-submit'));await pending;
  check('普通层转 tileset 后图层类型与图集非空',doc.layers[0].type==='tileset'&&doc.layers[0].tileset.tiles.length===(doc.width/2)*(doc.height/2)&&doc.frames[0].cels[0].some(p=>p&255));
  check('图集层合并按钮显示转为普通图层并文字选项',uiQuery('[data-action=tileset-toggle]').textContent==='转为普通图层'&&!uiQuery('[data-action=tileset-toggle] .icon'));
  check('图层菜单不再提供「转为 tilemap」',!uiQuery('[data-action="to-tilemap"]'));
  li=0;syncInteraction();check('替换颜色在图集图层可用',!uiQuery('[data-action="replace-color"]').disabled);
  const replacePending=actions['replace-color']();await wait();
  check('图集图层点替换颜色会打开替换对话框',$('modal').open&&$('modal-title').textContent==='替换颜色',{open:$('modal').open,title:$('modal-title').textContent});
  $('modal').close('cancel');await new Promise(r=>setTimeout(r,0));void replacePending;
  await wait();
  check('存在 tileset 图层时图集栏位出现',layout.state().slots['right-bottom'].includes('tileset')&&!!uiQuery('[data-panel-tab=tileset]')&&!$('tileset-panel').hidden,{slots:layout.state().slots['right-bottom']});
  const panel=$('tileset-panel');
  check('图集栏目头部固定且主体可滚动',!!panel.querySelector('.tileset-head')&&!!panel.querySelector('.tileset-body')&&getComputedStyle(panel).overflowY==='hidden'&&getComputedStyle(panel.querySelector('.tileset-body')).overflowY==='auto'&&!!panel.querySelector('.tileset-head .tileset-toolbar')&&!!panel.querySelector('.tileset-body .tileset-atlas')&&!panel.querySelector('.tileset-head .tileset-atlas'),{head:!!panel.querySelector('.tileset-head'),body:!!panel.querySelector('.tileset-body'),overflow:getComputedStyle(panel).overflowY});
  check('图集画布不再被 40% 高度裁切',getComputedStyle(panel.querySelector('.tileset-atlas')).maxHeight==='none');
  const terrainsNode=panel.querySelector('.tileset-terrains'),modesNode=panel.querySelector('.tileset-modes'),terrainGap=terrainsNode&&modesNode?Math.round(modesNode.getBoundingClientRect().top-terrainsNode.getBoundingClientRect().bottom):-1;
  check('地形集与设置按钮组之间留出空隙',terrainGap>=8,{gap:terrainGap});
  layout.setPanelVisible('tileset',false);await wait();const slotsHidden=JSON.stringify(layout.state().slots);
  document.getElementById('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:210,clientY:210}));await wait();
  check('右键图层不会自动重新打开图集栏目',JSON.stringify(layout.state().slots)===slotsHidden&&panel.hidden,{slots:layout.state().slots,hidden:panel.hidden});
  $('layer-menu').hidePopover();layout.setPanelVisible('tileset',true);await wait();
  uiQuery('[data-slot="right-bottom"] [data-panel-tab=layers]').click();const activeBeforeLayerMenu=JSON.stringify(layout.state().active);document.getElementById('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:210,clientY:210}));await wait();
  check('图集栏位可见时右键图层也不会切走当前页签',JSON.stringify(layout.state().active)===activeBeforeLayerMenu&&layout.state().active['right-bottom']==='layers',{before:JSON.parse(activeBeforeLayerMenu),after:layout.state().active});$('layer-menu').hidePopover();uiQuery('[data-slot="right-bottom"] [data-panel-tab=tileset]').click();await wait();
  check('图集栏位显示图块网格与地形列表且图块上无可点击热区',!!panel.querySelector('.tileset-atlas-canvas')&&!!panel.querySelector('.tileset-terrains-head')&&panel.querySelectorAll('.tileset-atlas button:not(.tileset-atlas-fit)').length===0);
  const atlasFit=panel.querySelector('.tileset-atlas .tileset-atlas-fit'),atlasRect=panel.querySelector('.tileset-atlas').getBoundingClientRect(),atlasFitRect=atlasFit&&atlasFit.getBoundingClientRect();
  check('图集适应内容按钮浮在画布右上角且工具条不再有缩放按钮',!!atlasFit&&!panel.querySelector('.tileset-toolbar .tileset-fit')&&atlasFitRect.right>atlasRect.left+atlasRect.width-40&&atlasFitRect.top<atlasRect.top+40,{right:atlasFitRect&&atlasFitRect.right,atlasRight:atlasRect.right,top:atlasFitRect&&atlasFitRect.top,atlasTop:atlasRect.top});
  // 图集区只保留「设置」与「自动标注」两个按钮，设置是唯一的编辑模式。
  const atlasCell=(type,col,row,fx=.5,fy=.5,opts={})=>{const atlas=panel.querySelector('.tileset-atlas-canvas'),rect=atlas.getBoundingClientRect(),cols=doc.width/doc.layers[0].tileset.w,rows=doc.height/doc.layers[0].tileset.h;atlas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:77,button:0,clientX:rect.left+(col+fx)*rect.width/cols,clientY:rect.top+(row+fy)*rect.height/rows,...opts}));};
  const atlasClick=(col,row,opts)=>{atlasCell('pointerdown',col,row,.5,.5,opts);atlasCell('pointerup',col,row,.5,.5,opts);};
  const modeButton=name=>[...panel.querySelectorAll('.tileset-mode-button')].find(button=>button.textContent===name);
  const atlasCorner=(col,row,fx,fy,opts={})=>{atlasCell('pointermove',col,row,fx,fy,opts);atlasCell('pointerdown',col,row,fx,fy,opts);};
  check('图集区只有设置、自动标注、清空三个按钮且设置默认开启',panel.querySelectorAll('.tileset-mode-button').length===3&&!!modeButton('设置')&&!!modeButton('自动标注')&&!!modeButton('清空')&&!modeButton('选择')&&!modeButton('绘制')&&!modeButton('全选')&&modeButton('设置').classList.contains('active'));
  const beforeSetup=JSON.stringify(doc),beforeSetupHistory=history.undoStack.length;
  modeButton('设置').click();check('空地形集点击设置在操作附近显示提示',!panel.querySelector('.tileset-notice').hidden&&panel.querySelector('.tileset-notice').textContent.includes('请先在地形集中添加地形')&&panel.querySelector('.tileset-notice').getBoundingClientRect().height>20);
  panel.querySelector('.tileset-notice').hidden=true;atlasClick(0,0);check('空地形集点图块显示局部提示且不修改项目',!panel.querySelector('.tileset-notice').hidden&&panel.querySelector('.tileset-notice').textContent.includes('请先在地形集中添加地形')&&JSON.stringify(doc)===beforeSetup&&history.undoStack.length===beforeSetupHistory);
  panel.querySelector('.tileset-terrains-head button').click();
  check('图集栏位新增地形后自动收起空态提示',doc.layers[0].tileset.terrains.length===1&&panel.querySelector('.tileset-notice').hidden);
  const nameInput=panel.querySelector('.tileset-terrain-name');nameInput.value='草地';nameInput.dispatchEvent(new Event('change',{bubbles:true}));
  check('地形可改名',doc.layers[0].tileset.terrains[0].name==='草地');
  const colorInput=panel.querySelector('.tileset-terrain-color');colorInput.value='#123456';colorInput.dispatchEvent(new Event('change',{bubbles:true}));
  check('地形可改颜色',doc.layers[0].tileset.terrains[0].color==='#123456');
  panel.querySelector('.tileset-terrains-head button').click();
  check('图集栏位可增加第二个地形',doc.layers[0].tileset.terrains.length===2);
  const pickTerrain=index=>panel.querySelectorAll('.tileset-terrain-row .tileset-terrain-pick')[index].click();
  pickTerrain(0);
  await wait();const headerFields=[...panel.querySelectorAll('.tileset-head .form-field')];check('图集顶部标签控件统一对齐且无底部提示',!panel.querySelector('.tileset-hint')&&headerFields.length===3&&headerFields.every(node=>{const a=node.querySelector('.field-caption').getBoundingClientRect(),b=node.querySelector('.field-control').getBoundingClientRect();return b.left-a.right>=11&&Math.abs(a.top+a.height/2-b.top-b.height/2)<2;}));
  // 设置模式：不用先选中图块，鼠标移到图块上点中心设地形、点四角/四边设期望地形。
  atlasClick(0,0);
  check('设置模式点图块中心即给图块设地形，不必先选中',doc.layers[0].tileset.tiles[0].terrain===0);
  atlasCorner(0,0,.2,.2);
  check('设置模式点角位写入该方向的期望地形',doc.layers[0].tileset.tiles[0].peering[0]===0);
  atlasCell('pointerdown',0,0,.2,.2,{button:2});
  check('右键单击角位清除该方向的期望地形',doc.layers[0].tileset.tiles[0].peering[0]===-1);
  atlasCorner(0,0,.5,.2);
  check('设置模式点边位写入该方向的期望地形',doc.layers[0].tileset.tiles[0].peering[1]===0);
  // 点图块会同时选中它；Shift 单击加选后，TileData 检视器可一次改全部选中图块。
  atlasClick(0,0);
  check('点图块即选中，TileData 检视器显示该图块',panel.querySelector('.tileset-inspector-count').textContent==='图块 #0',{count:panel.querySelector('.tileset-inspector-count').textContent});
  atlasClick(1,0,{shiftKey:true});
  check('Shift 单击加选后检视器显示选中数量',panel.querySelector('.tileset-inspector-count').textContent==='已选 2 个图块');
  const multiBit=panel.querySelectorAll('.tileset-bits select')[1];multiBit.value='0';multiBit.dispatchEvent(new Event('change',{bubbles:true}));
  check('检视器改一位应用到全部选中图块',doc.layers[0].tileset.tiles[0].peering[1]===0&&doc.layers[0].tileset.tiles[1].peering[1]===0);
  // 九宫格只作用于鼠标下的图块，不会把残留选中块一起改。
  atlasClick(1,0);
  mutate(()=>{doc.layers[0].tileset.tiles[1].peering[1]=-1;doc.layers[0].tileset.tiles[2].terrain=0;},'准备只改图块 1');
  atlasCorner(1,0,.2,.2);
  check('设置模式点角位只改鼠标下的图块，不广播到残留选中块',
    doc.layers[0].tileset.tiles[1].peering[0]===0&&doc.layers[0].tileset.tiles[0].peering[0]===-1&&doc.layers[0].tileset.tiles[2].peering[0]===-1,
    {tiles:doc.layers[0].tileset.tiles.map(tile=>[tile.terrain,tile.peering[0]])});
  // 设置模式点中心即写入图块地形；清除只走右键，地形集里不再有「空地（-1）」。
  pickTerrain(0);
  check('地形集不再有「空地（-1）」按钮与空地行',!panel.querySelector('.tileset-empty-pick')&&!panel.querySelector('.tileset-empty-row'));
  const undoBefore=history.undoStack.length;
  atlasClick(3,1);
  check('设置模式点中心即写入图块地形',doc.layers[0].tileset.tiles[7].terrain===0,{terrain:doc.layers[0].tileset.tiles[7].terrain});
  check('点中心设地形只记一次撤销',history.undoStack.length===undoBefore+1,{before:undoBefore,after:history.undoStack.length});
  actions.undo();
  check('撤销恢复图块地形',doc.layers[0].tileset.tiles[7].terrain===-1);
  atlasClick(2,3);
  check('再次点中心写入地形',doc.layers[0].tileset.tiles[14].terrain===0);
  atlasClick(2,3,{button:2});
  check('右键点中心清除该图块地形',doc.layers[0].tileset.tiles[14].terrain===-1,{terrain:doc.layers[0].tileset.tiles[14].terrain});
  // 按住左键拖动：途经的图块一次写入，整笔只记一步撤销。
  pickTerrain(0);
  const dragBefore=history.undoStack.length;
  atlasCell('pointerdown',0,2);
  atlasCell('pointermove',1,2);
  atlasCell('pointermove',2,2);
  atlasCell('pointerup',2,2);
  check('按住拖动把途经图块一次设成当前地形',[8,9,10].every(id=>doc.layers[0].tileset.tiles[id].terrain===0),{terrains:[8,9,10].map(id=>doc.layers[0].tileset.tiles[id].terrain)});
  check('整次拖动只记一步撤销',history.undoStack.length===dragBefore+1,{delta:history.undoStack.length-dragBefore});
  actions.undo();
  check('撤销整次拖动恢复这些图块',[8,9,10].every(id=>doc.layers[0].tileset.tiles[id].terrain===-1),{terrains:[8,9,10].map(id=>doc.layers[0].tileset.tiles[id].terrain)});
  // 图集缩放：滚轮放大、双击回到适应宽度。
  const atlasNode=panel.querySelector('.tileset-atlas-canvas'),atlasHost=panel.querySelector('.tileset-atlas');
  const atlasRectBefore=atlasNode.getBoundingClientRect();
  atlasNode.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120,clientX:atlasRectBefore.left+8,clientY:atlasRectBefore.top+8}));
  const atlasRectZoomed=atlasNode.getBoundingClientRect();
  check('滚轮放大图集',atlasRectZoomed.width>atlasRectBefore.width*1.1,{before:atlasRectBefore.width,after:atlasRectZoomed.width});
  atlasNode.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  const atlasRectReset=atlasNode.getBoundingClientRect();
  check('双击回到按栏宽适应的图集视图',Math.abs(atlasRectReset.width-atlasRectBefore.width)<1,{before:atlasRectBefore.width,after:atlasRectReset.width,host:atlasHost.clientWidth});
  const panRect=atlasNode.getBoundingClientRect(),realCapture=atlasNode.setPointerCapture;atlasNode.setPointerCapture=()=>{};
  const panEvent=(type,x,y)=>new PointerEvent(type,{bubbles:true,cancelable:true,button:1,pointerId:77,clientX:panRect.left+x,clientY:panRect.top+y});
  atlasNode.dispatchEvent(panEvent('pointerdown',40,40));atlasNode.dispatchEvent(panEvent('pointermove',70,55));atlasNode.dispatchEvent(panEvent('pointerup',70,55));atlasNode.setPointerCapture=realCapture;
  check('中键拖动平移图集',/translate\(30px,\s*15px\)/.test(atlasNode.style.transform),{transform:atlasNode.style.transform});
  panel.querySelector('.tileset-fit').click();
  check('图集工具条适应内容按钮复位缩放与平移',/translate\(0px,\s*0px\)/.test(atlasNode.style.transform)&&/scale\(1\)/.test(atlasNode.style.transform),{transform:atlasNode.style.transform});
  atlasNode.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  pickTerrain(0);
  check('选择与绘制按钮已移除，只剩设置、自动标注与清空',!modeButton('选择')&&!modeButton('绘制')&&panel.querySelectorAll('.tileset-mode-button').length===3);
  const modeSelect=panel.querySelector('.tileset-mode select'),emptyActual=new Array(8).fill(-1);
  modeSelect.value='corners';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  check('匹配角只渲染 4 个角位下拉，不可用位不占位',panel.querySelectorAll('.tileset-bits select').length===4);
  check('切换匹配角后候选包含该图块',matchTiles(doc.layers[0].tileset,0,emptyActual).includes(0));
  modeSelect.value='sides';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  check('切换匹配方式清掉这次用不到的邻居位',doc.layers[0].tileset.tiles[0].peering[1]===-1&&doc.layers[0].tileset.tiles[0].peering[0]===-1);
  mutate(()=>{doc.layers[0].tileset.tiles[0].peering[1]=0;},'给图块 0 补一个上边期望位');
  check('切换匹配边后候选排除该图块',!matchTiles(doc.layers[0].tileset,0,emptyActual).includes(0));
  modeSelect.value='corners';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  // 匹配边模式下中心格在设置模式里仍然用来设图块地形。
  modeSelect.value='sides';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  check('匹配边只渲染 4 个边位下拉且没有邻居中心格',panel.querySelectorAll('.tileset-bits select').length===4&&terrainZones('sides').length===4);
  modeButton('设置').click();
  atlasClick(2,1);
  check('设置模式在匹配边下点中心仍能给图块设地形',doc.layers[0].tileset.tiles[6].terrain===0);
  // 自动标注：不需要先选中图块，按图块像素推断四角/四边。
  modeSelect.value='corners';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  mutate(()=>{doc.layers[0].tileset.tiles[0].peering=new Array(8).fill(-1);},'清空图块 0 的期望位');
  panel.querySelector('button[title^="按图块像素"]').click();
  check('自动标注按图块像素推断角位且不需要先选中图块',doc.layers[0].tileset.tiles[0].peering[0]===0&&doc.layers[0].tileset.tiles[0].peering[1]===-1);
  // 给已设过地形的图块点角位即可写期望位，不需要先选中。
  atlasClick(2,0);
  atlasCorner(2,0,.2,.2);
  check('设置模式给已设地形的图块点角位写入期望位',doc.layers[0].tileset.tiles[2].terrain===0&&doc.layers[0].tileset.tiles[2].peering[0]===0,{tile:[doc.layers[0].tileset.tiles[2].terrain,doc.layers[0].tileset.tiles[2].peering[0]]});
  const reopenedTiles=validateDocument(JSON.parse(JSON.stringify(doc))).layers[0].tileset.tiles;
  check('重新打开项目后图块地形与期望位仍然保留',reopenedTiles[0].terrain===0&&reopenedTiles[0].peering[0]===0&&reopenedTiles[2].peering[0]===0);
  check('未选中图块时已配置的位仍然需要绘制',visibleBitTiles(doc.layers[0].tileset).includes(0)&&visibleBitTiles(doc.layers[0].tileset).includes(2));
  // 图块尺寸是设置项：改输入框不立刻动数据，点「重新切块」才生效；同尺寸重切要保住规则。
  const sizeInputs=[...panel.querySelectorAll('.tileset-field input')],repackButton=panel.querySelector('button[title^="按新的图块尺寸"]');
  check('图集工具条提供图块宽高输入与重新切块按钮',sizeInputs.length===2&&!!repackButton);
  const keepW=doc.layers[0].tileset.w,keepH=doc.layers[0].tileset.h,keepTerrain=doc.layers[0].tileset.tiles[0].terrain,keepBit=doc.layers[0].tileset.tiles[0].peering[0];
  sizeInputs[0].value='4';sizeInputs[0].dispatchEvent(new Event('change',{bubbles:true}));
  check('改图块宽度只改输入框，不提前改动图集网格',doc.layers[0].tileset.w===keepW&&sizeInputs[0].value==='4',{w:doc.layers[0].tileset.w});
  sizeInputs[1].value='4';sizeInputs[1].dispatchEvent(new Event('change',{bubbles:true}));
  const undoRepack=history.undoStack.length;
  repackButton.click();
  check('重新切块按输入尺寸切分并只记一次撤销',doc.layers[0].tileset.w===4&&doc.layers[0].tileset.h===4&&doc.layers[0].tileset.tiles.length===4&&history.undoStack.length===undoRepack+1,{w:doc.layers[0].tileset.w,tiles:doc.layers[0].tileset.tiles.length,undo:history.undoStack.length-undoRepack});
  actions.undo();
  check('撤销重新切块恢复图块尺寸与规则',doc.layers[0].tileset.w===keepW&&doc.layers[0].tileset.tiles[0].terrain===keepTerrain&&doc.layers[0].tileset.tiles[0].peering[0]===keepBit);
  sizeInputs[0].value=String(keepW);sizeInputs[0].dispatchEvent(new Event('change',{bubbles:true}));sizeInputs[1].value=String(keepH);sizeInputs[1].dispatchEvent(new Event('change',{bubbles:true}));
  repackButton.click();
  check('同尺寸重新切块保留图块地形与期望位',doc.layers[0].tileset.w===keepW&&doc.layers[0].tileset.tiles[0].terrain===keepTerrain&&doc.layers[0].tileset.tiles[0].peering[0]===keepBit);
  // 清掉刚标注的邻居位，后续地形预览用例仍按「无邻位约束」匹配，避免挑到全透明图块。
  mutate(()=>{doc.layers[0].tileset.tiles.forEach((tile,id)=>{tile.peering.fill(-1);if(id!==0)tile.terrain=-1;});},'只保留图块 0 的地形');
  // 地形只在参考栏的地形预览里刷格子：图层区没有地形绘制入口，图集图层也不再产生第二种图层类型。
  check('工具栏不再有地形画笔',!tools.some(item=>item[0]==='terrain')&&!uiQuery('[data-tool=terrain]')&&commandStates()['terrain-brush']===undefined);
  const toolWas=tool;setTool('terrain');
  check('地形工具切换无效',tool===toolWas);
  li=0;render();
  viewport.setPointerCapture=()=>{};
  // 独立地形预览栏目仍只做显示参考，不写图层。
  const compositeBefore=JSON.stringify([...composite(doc,0)]);
  const previewNode=uiQuery('.terrain-preview-canvas'),previewBar=uiQuery('.terrain-preview-bar'),previewTab=uiQuery('[data-panel-tab="terrain-preview"]');
  check('地形预览以独立栏目出现',!!previewNode&&!!previewTab&&!previewTab.hidden);
  previewTab.click();
  const previewTileset=doc.layers[0].tileset;
  check('切到地形预览栏目显示工具条且按设置格子数创建画布',!$('terrain-preview-panel').hidden&&!previewBar.hidden&&previewNode.width===10*previewTileset.w&&previewNode.height===10*previewTileset.h,{w:previewNode.width,h:previewNode.height});
  const refWrap=$('terrain-preview-panel').querySelector('.reference-viewport-wrap'),refTools=refWrap.querySelector('.board-canvas-tools'),refFit=$('reference-panel').querySelector('.board-fit'),refPreviewFit=refTools.querySelector('.terrain-preview-fit');
  check('参考与地形各有独立适应内容按钮且没有参考内部页签',refTools.parentElement===refWrap&&!!refWrap.querySelector('.terrain-preview-canvas')&&!!refFit&&!!refPreviewFit&&!$('reference-panel').querySelector('.reference-tabs,.reference-toolbar'));
  const previewFitRect=refPreviewFit.getBoundingClientRect(),previewWrapRect=refWrap.getBoundingClientRect();
  check('地形适应内容按钮贴住画布右上角',previewFitRect.width>0&&previewWrapRect.right-previewFitRect.right<=14&&previewFitRect.top-previewWrapRect.top<=14);
  const previewLayerSelect=uiQuery('.terrain-preview-bar select.terrain-preview-layer-select'),previewTerrainSelect=uiQuery('.terrain-preview-bar select.terrain-preview-terrain');
  check('预览工具条列出图集图层与地形',previewLayerSelect.options.length===1&&previewTerrainSelect.options.length===2,{layers:previewLayerSelect.options.length,terrains:previewTerrainSelect.options.length});
  const previewLayers=[...document.querySelectorAll('.terrain-preview-layer')],preview2d=previewNode.getContext('2d'),previewFitZoom=previewView().zoom;
  check('预览的图层下拉不占用预览层的绝对定位，预览层只剩画布容器一个',previewLayerSelect.className==='terrain-preview-layer-select'&&getComputedStyle(previewLayerSelect).position==='static'&&previewLayers.length===1&&previewLayers[0].querySelector('.terrain-preview-canvas')!==null,{cls:previewLayerSelect.className,position:getComputedStyle(previewLayerSelect).position,layers:previewLayers.length});
  const previewGridBefore=$('grid').checked;$('grid').checked=false;drawPreviewCanvas();
  const gridOverlay=uiQuery('.terrain-preview-grid-overlay');
  check('预览网格画在独立覆盖层且不受主画布像素网格开关影响',!!gridOverlay&&!uiQuery('.terrain-preview-grid')&&gridOverlay.width>0&&gridOverlay.height>0&&!$('grid').checked,{w:gridOverlay&&gridOverlay.width,h:gridOverlay&&gridOverlay.height,gridOn:$('grid').checked});
  const gridProbe=document.createElement('div');gridProbe.style.background='var(--accent-line)';document.body.append(gridProbe);const gridRgb=getComputedStyle(gridProbe).backgroundColor.match(/\d+/g).map(Number);gridProbe.remove();
  // 屏幕空间覆盖层：放大到 4 倍，在板面矩形内量线宽/间距/颜色，并确认线条不外溢到板面之外。
  const gridViewBefore={...previewView()};
  setPreviewView({zoom:4,x:8,y:8});
  const gridScale=gridOverlay.width/Math.max(1,gridOverlay.clientWidth),gridCtx=gridOverlay.getContext('2d');
  const gridOverlayRect=gridOverlay.getBoundingClientRect(),gridBoardRect=previewNode.getBoundingClientRect();
  const gridRelX=value=>Math.round((value-gridOverlayRect.left)*gridScale),gridRelY=value=>Math.round((value-gridOverlayRect.top)*gridScale);
  const gridAt=(x,y)=>Array.from(gridCtx.getImageData(x,y,1,1).data);
  const gridScanY=Math.max(1,gridRelY(gridBoardRect.top+gridBoardRect.height/4)),gridRowData=gridCtx.getImageData(0,gridScanY,gridOverlay.width,1).data;
  const gridRuns=[];for(let x=0;x<gridOverlay.width;x++){if(!(gridRowData[x*4+3]>20))continue;const last=gridRuns[gridRuns.length-1];if(last&&x===last.end+1)last.end=x;else gridRuns.push({start:x,end:x});}
  const gridWidths=gridRuns.map(run=>run.end-run.start+1),gridStep=doc.layers[0].tileset.w*4*gridScale,gridSpacing=gridRuns.length>1?gridRuns[1].start-gridRuns[0].start:NaN;
  check('预览网格按屏幕空间 1 物理像素绘制且放大后不糊',gridRuns.length>=2&&Math.abs(gridSpacing-gridStep)<=Math.max(1,gridScale)&&Math.max(...gridWidths)-Math.min(...gridWidths)<=1&&Math.max(...gridWidths)<=Math.ceil(gridScale)+1,{runs:gridRuns.length,widths:gridWidths,spacing:gridSpacing,step:gridStep});
  const gridLineRun=gridRuns[1]||gridRuns[0],gridLineX=Math.round((gridLineRun.start+gridLineRun.end)/2),gridLinePixel=gridAt(gridLineX,gridScanY);
  const gridNeighborPixel=gridAt(gridLineRun.end+2,gridScanY);
  check('预览网格颜色与图集栏位同为 --accent-line 且线外透明',gridLinePixel[3]>0&&[0,1,2].every(i=>Math.abs(gridLinePixel[i]-gridRgb[i])<=10)&&gridNeighborPixel[3]===0,{pixel:gridLinePixel,neighbor:gridNeighborPixel,gridRgb:gridRgb.slice(0,3)});
  const gridOutsideRight=gridAt(Math.min(gridOverlay.width-1,gridRelX(gridBoardRect.right+6)),gridScanY),gridOutsideTop=gridAt(gridRelX(gridBoardRect.left+gridBoardRect.width/2),Math.max(0,gridRelY(gridBoardRect.top-6)));
  check('预览网格只画在板面矩形内，不外溢到整个面板',gridRuns[0].start>=gridRelX(gridBoardRect.left)-2&&gridRuns[gridRuns.length-1].end<=gridRelX(gridBoardRect.right)+2&&gridOutsideRight[3]===0&&gridOutsideTop[3]===0,{first:gridRuns[0].start,last:gridRuns[gridRuns.length-1].end,boardLeft:gridRelX(gridBoardRect.left),boardRight:gridRelX(gridBoardRect.right),right:gridOutsideRight,top:gridOutsideTop});
  setPreviewView(gridViewBefore);
  $('grid').checked=previewGridBefore;drawPreviewCanvas();
  previewNode.setPointerCapture=()=>{};previewNode.releasePointerCapture=()=>{};previewNode.hasPointerCapture=()=>false;
  // 预览画布跟着参考栏位的缩放/平移一起变换（此前只改视图状态，画布停在原处）
  const previewViewport=uiQuery('.terrain-preview-viewport'),previewZoomBefore=previewView().zoom;
  previewViewport.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:20,clientY:20,bubbles:true,cancelable:true}));
  check('预览在独立栏目内滚轮缩放',previewView().zoom>previewZoomBefore&&previewLayers[0].style.transform==='scale('+previewView().zoom+')'&&previewLayers[0].style.width===(10*previewTileset.w)+'px',{zoom:previewView().zoom,transform:previewLayers[0].style.transform,width:previewLayers[0].style.width});
  uiQuery('.terrain-preview-fit').click();
  check('预览工具条适应内容按钮回到铺满视图',previewView().zoom<=previewZoomBefore+1e-6&&previewLayers[0].style.transform==='scale('+previewView().zoom+')',{before:previewZoomBefore,after:previewView().zoom});
  const panBefore={...previewView()};
  for(const type of ['pointerdown','pointermove','pointerup'])previewNode.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:95,button:1,clientX:type==='pointerdown'?50:90,clientY:type==='pointerdown'?50:80}));
  check('预览按住中键可平移板面视图',Math.abs(previewView().x-panBefore.x-40)<.001&&Math.abs(previewView().y-panBefore.y-30)<.001,{before:panBefore,after:{...previewView()}});
  setPreviewView({zoom:1,x:0,y:0});renderTerrainPreview();
  const previewGridWasOn=$('grid').checked;if(previewGridWasOn)actions['grid']();
  const previewCell=(cx,cy,button=0)=>{const rect=previewNode.getBoundingClientRect(),view=previewView(),{w,h}=doc.layers[0].tileset;for(const type of ['pointerdown','pointerup'])previewNode.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:93,button,clientX:rect.left+(cx+.5)*w*view.zoom,clientY:rect.top+(cy+.5)*h*view.zoom}));};
  const previewPixel=()=>Array.from(previewNode.getContext('2d').getImageData(Math.floor(doc.layers[0].tileset.w/2),Math.floor(doc.layers[0].tileset.h/2),1,1).data);
  previewTerrainSelect.value='0';
  previewCell(0,0);
  check('预览刷格子写入 previewTerrain 且不动图层',doc.previewTerrain&&doc.previewTerrain.layerId===doc.layers[0].id&&doc.previewTerrain.cells[0]===0&&doc.layers[0].type==='tileset');
  check('预览画布按图块规则解析出像素',previewPixel()[3]===255&&previewPixel()[0]>200&&previewPixel()[1]<60,{pixel:previewPixel()});
  // 第 9 项：图集图层的绘画直接改图集像素，地形预览按新像素重绘
  const previewResolved=resolvePreviewCells(doc.layers[0].tileset,10,10,doc.previewTerrain.cells),resolvedTileId=previewResolved[0].id,tileCols=Math.floor(doc.width/previewTileset.w),halfX=Math.floor(previewTileset.w/2),halfY=Math.floor(previewTileset.h/2),atlasX=(resolvedTileId%tileCols)*previewTileset.w+halfX,atlasY=Math.floor(resolvedTileId/tileCols)*previewTileset.h+halfY;
  const liBeforeAtlasPaint=li;li=0;syncInteraction();setTool('pencil');setColor('#ff00ff');
  const atlasPixelBefore=doc.frames[0].cels[0][atlasY*doc.width+atlasX];
  point('pointerdown',atlasX,atlasY);point('pointerup',atlasX,atlasY);
  check('图集图层可用铅笔直接绘制图集像素',doc.frames[0].cels[0][atlasY*doc.width+atlasX]!==atlasPixelBefore&&doc.frames[0].cels[0][atlasY*doc.width+atlasX]===colorValue('#ff00ff'),{before:atlasPixelBefore,after:doc.frames[0].cels[0][atlasY*doc.width+atlasX]});
  const previewPaintedPixel=Array.from(previewNode.getContext('2d').getImageData(halfX,halfY,1,1).data);
  check('图集绘画后地形预览按新图集像素重绘',previewPaintedPixel[0]>200&&previewPaintedPixel[1]<60&&previewPaintedPixel[2]>200,{pixel:previewPaintedPixel,tileId:resolvedTileId});
  actions.undo();li=liBeforeAtlasPaint;syncInteraction();
  check('预览不影响合成与画布输出',JSON.stringify([...composite(doc,0)])===compositeBefore);
  previewCell(0,0,2);
  check('右键擦除预览格子',doc.previewTerrain.cells[0]===-1&&previewPixel()[3]<200,{alpha:previewPixel()[3]});
  if(previewGridWasOn)actions['grid']();
  previewTerrainSelect.value='1';
  previewCell(2,2);
  check('预览记录所选地形',doc.previewTerrain.cells[2*10+2]===1&&doc.previewTerrain.w===10&&doc.previewTerrain.h===10);
  // 独立地形预览面板的画布尺寸设置：改格子数后按比例重采样已画地形并写回本机设置。
  const sizeCols=previewBar.querySelector('.terrain-preview-cols'),sizeRows=previewBar.querySelector('.terrain-preview-rows');
  sizeCols.value='12';sizeRows.value='8';sizeCols.dispatchEvent(new Event('change',{bubbles:true}));
  const savedSize=JSON.parse(localStorage.getItem('pixpix-terrain-preview-v1')||'null');
  check('地形页签内的画布尺寸设置改格子数并写回本机',previewNode.width===12*previewTileset.w&&previewNode.height===8*previewTileset.h&&doc.previewTerrain.w===12&&doc.previewTerrain.h===8&&savedSize?.cols===12&&savedSize?.rows===8,{w:previewNode.width,h:previewNode.height,preview:doc.previewTerrain&&{w:doc.previewTerrain.w,h:doc.previewTerrain.h},saved:savedSize});
  sizeCols.value='10';sizeRows.value='10';sizeCols.dispatchEvent(new Event('change',{bubbles:true}));
  const sizeAfter=JSON.parse(localStorage.getItem('pixpix-terrain-preview-v1')||'null');
  check('画布尺寸改回后预览恢复格子数',previewNode.width===10*previewTileset.w&&previewNode.height===10*previewTileset.h&&doc.previewTerrain.w===10&&sizeAfter?.cols===10&&previewBar.querySelector('.terrain-preview-size')!==null,{w:previewNode.width,saved:sizeAfter});
  previewTerrainSelect.value='0';previewCell(0,0);
  // 规则与邻居不符时不再塞一个"最接近"的错误图块，而是留空并用地形色 + 虚线标出这一格（Godot 的 Connect 语义）。
  mutate(()=>{doc.layers[0].tileset.tiles[0].peering[1]=0;},'给图块 0 加上方邻位');
  modeSelect.value='sides';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  check('匹配规则不成立时预览只留地形色提示，不塞错误图块',previewPixel()[3]>=40&&previewPixel()[3]<=160,{pixel:previewPixel()});
  modeSelect.value='corners';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  check('切回匹配角后预览仍按当前规则重新解析',previewPixel()[3]===255&&doc.previewTerrain.cells[0]===0);
  mutate(()=>{doc.layers[0].tileset.tiles[0].peering[1]=-1;},'移除图块 0 的上方邻位');
  // 第 3 项：一键清空全部图块规则（地形集定义与地形预览格子保留，且整步可撤销）。
  const clearButton=modeButton('清空'),rulesBeforeClear=JSON.stringify(doc.layers[0].tileset.tiles),terrainsBeforeClear=doc.layers[0].tileset.terrains.length,previewCellsBeforeClear=JSON.stringify(doc.previewTerrain&&doc.previewTerrain.cells);
  check('图集区有清空按钮且带说明',!!clearButton&&/清空/.test(clearButton.title||''),{title:clearButton&&clearButton.title});
  clearButton.click();
  const tilesAfterClear=doc.layers[0].tileset.tiles;
  check('点清空后全部图块的地形与期望位归零',tilesAfterClear.every(tile=>tile.terrain===-1&&tile.peering.every(bit=>bit===-1)),{sample:tilesAfterClear.slice(0,3)});
  check('清空保留地形集定义与地形预览格子',doc.layers[0].tileset.terrains.length===terrainsBeforeClear&&JSON.stringify(doc.previewTerrain&&doc.previewTerrain.cells)===previewCellsBeforeClear);
  actions.undo();
  check('撤销清空恢复原有图块规则',JSON.stringify(doc.layers[0].tileset.tiles)===rulesBeforeClear);
  // 存盘读回
  await saveProject();
  const saved=await window.desktop.openRecent(0),opened=validateDocument(JSON.parse(saved.data));
  check('.pix 存盘读回图集与地形预览一致',opened.layers[0].type==='tileset'&&opened.layers[0].tileset.tiles.length===doc.layers[0].tileset.tiles.length&&opened.requiredFeatures.includes('tileset')&&!opened.requiredFeatures.includes('tilemap'),{features:opened.requiredFeatures});
  check('.pix 保存并读回地形预览且不新增特性标记',JSON.stringify(opened.previewTerrain)===JSON.stringify(doc.previewTerrain)&&!opened.requiredFeatures.some(f=>f.includes('preview')));
  const brokenPreview=validateDocument({...JSON.parse(saved.data),previewTerrain:{layerId:'bad',w:0,h:-1,cells:'nope'}});
  check('非法预览字段不影响项目打开',!brokenPreview.previewTerrain&&brokenPreview.layers.length===1);
  // 图集栏位可拖出为独立窗口，配置仍作用于同一文档
  await layout.detach('tileset');
  const floating=layout.floats.get('tileset')?.child;
  check('图集栏位可拖出为独立窗口并迁移原 DOM',!!floating&&layout.panels.tileset.ownerDocument===floating.document&&!!floating.document.querySelector('.tileset-atlas-canvas'));
  floating.document.querySelector('.tileset-terrains-head button').click();
  check('独立窗口中的图集配置直接修改同一文档',doc.layers[0].tileset.terrains.length===3);
  layout.dock('tileset','right-bottom');
  await wait();
  check('图集栏位放回栏位后仍在原位',layout.panels.tileset.ownerDocument===document&&layout.state().slots['right-bottom'].includes('tileset'));
  check('图集层合并按钮显示转为普通图层并文字选项',uiQuery('[data-action=tileset-toggle]').textContent==='转为普通图层'&&!uiQuery('[data-action=tileset-toggle] .icon'));
  // 转回像素层：像素保留，图块规则与地形预览一并清掉
  const pixelsBeforeToggle=JSON.stringify(doc.frames[0].cels[0]);
  pending=actions['tileset-toggle']();await pending;
  check('图集转普通层保留像素清掉预览并移除地形栏目',doc.layers[0].type===undefined&&JSON.stringify(doc.frames[0].cels[0])===pixelsBeforeToggle&&!doc.previewTerrain&&!layout.panelPresent('terrain-preview'));
  check('最后一个图集图层消失后移除 tileset 特性标记',!doc.layers.some(layer=>layer.type==='tileset')&&!doc.requiredFeatures.includes('tileset')&&!doc.requiredFeatures.includes('tilemap'),{features:doc.requiredFeatures});
  check('转回像素后合并按钮恢复转为图集并保留图标',uiQuery('[data-action=tileset-toggle]').textContent==='转为图集'&&!uiQuery('[data-action=tileset-toggle] .icon'));
  await wait();check('图集操作全程没有未处理错误弹窗',!$('error-dialog').open);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}finally{viewport.setPointerCapture=capture;atlasCapture.setPointerCapture=originalAtlasCapture;}
};

window.checkMenuActions=ids=>ids.filter(id=>typeof actions[id]!=='function');
window.loadDemoDocumentForSmoke=()=>{$('welcome').hidden=true;replaceDocument(demoDocument(),true);fi=0;li=1;setTool('pencil');fit();return{name:doc.name,frames:doc.frames.length,tags:doc.tags.length,layers:doc.layers.length};};

window.interactionModifiers=()=>({alt:modifiers.alt,shift:modifiers.shift,space});

window.prepareDocumentWindowsSmoke=async()=>{window.workspaceLayout.reset();replaceDocument(createDocument(3,2,'窗口A'),true);await saveProject();mutate(()=>pixels()[0]=0xff0000ff,'A绘画');selection={x:0,y:0,w:1,h:1};zoom=8;pan={x:21,y:30};render();const a={id:documentId,path:filePath};replaceDocument(createDocument(4,4,'窗口B'),true,null,crypto.randomUUID(),true);await saveProject();mutate(()=>pixels()[0]=0x00ff00ff,'B绘画');return{a,b:{id:documentId,path:filePath}};};
window.documentWindowEdit=(value=0x0000ffff)=>mutate(()=>pixels()[0]=value,'独立窗口绘画');
window.documentWindowNew=()=>newDocument();

window.runPanelDragV2Smoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},layout=window.workspaceLayout,wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25));}throw new Error('等待面板窗口超时');};try{
 layout.reset();const tab=id=>uiQuery(`[data-panel-tab="${id}"]`),begin=async id=>{const node=tab(id),data=new DataTransfer();node.dispatchEvent(new DragEvent('dragstart',{dataTransfer:data,bubbles:true}));await new Promise(requestAnimationFrame);return{node,data};},end=drag=>drag.node.dispatchEvent(new DragEvent('dragend',{dataTransfer:drag.data,bubbles:true}));
 const cancel=drag=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));end(drag);};
 const checkEmptySide=(side,part)=>{const empty=uiQuery(`[data-slot="${side}-${part}"]`),occupied=uiQuery(`[data-slot="${side}-${part==='top'?'bottom':'top'}"]`),r=empty.getBoundingClientRect(),other=occupied.getBoundingClientRect(),bounds=empty.parentElement.getBoundingClientRect(),hint=getComputedStyle(empty,':after');return empty.classList.contains('empty')&&r.width>100&&r.height>=54&&r.left>=bounds.left&&r.right<=bounds.right&&r.top>=bounds.top&&r.bottom<=bounds.bottom&&!(r.left<other.right&&r.right>other.left&&r.top<other.bottom&&r.bottom>other.top)&&getComputedStyle(empty.querySelector('.dock-tabs')).display==='none'&&hint.position==='absolute'&&hint.display==='grid'&&hint.placeItems==='center'&&hint.pointerEvents==='none';};
 layout.dock('reference','left-bottom');layout.dock('preview','right-bottom');let emptyDrag=await begin('tools');check('左右上方空栏位独占区域且提示不覆盖已有栏目',checkEmptySide('left','top')&&checkEmptySide('right','top'));cancel(emptyDrag);check('取消拖拽后空栏位隐藏并恢复已有栏目空间',getComputedStyle(uiQuery('[data-slot=right-top]')).display==='none'&&uiQuery('[data-slot=right-bottom]').getBoundingClientRect().height===uiQuery('.dock-right').getBoundingClientRect().height);
 layout.dock('reference','left-top');layout.dock('colors','left-top');layout.dock('preview','right-top');layout.dock('layers','right-top');emptyDrag=await begin('tools');check('左右下方空栏位独占区域且不显示空标签条',checkEmptySide('left','bottom')&&checkEmptySide('right','bottom'));const emptyTarget=uiQuery('[data-slot=right-bottom]');emptyTarget.dispatchEvent(new DragEvent('dragover',{dataTransfer:emptyDrag.data,bubbles:true,cancelable:true}));check('空栏位悬停高亮且可直接命中',emptyTarget.classList.contains('drop-hover')&&document.elementFromPoint(emptyTarget.getBoundingClientRect().left+20,emptyTarget.getBoundingClientRect().top+20)===emptyTarget);emptyTarget.dispatchEvent(new DragEvent('drop',{dataTransfer:emptyDrag.data,bubbles:true,cancelable:true}));end(emptyDrag);check('拖入空栏位后提示消失并正常显示面板',layout.state().slots['right-bottom'].includes('tools')&&!emptyTarget.classList.contains('empty')&&!layout.root.classList.contains('dragging-panels'));layout.reset();
 layout.dock('reference','right-bottom');layout.dock('colors','right-bottom');emptyDrag=await begin('tools');const emptySide=uiQuery('.dock-left').getBoundingClientRect();check('整侧为空时仍显示两个独立可停靠区域',emptySide.width>100&&checkEmptySide('left','top')&&checkEmptySide('left','bottom'));cancel(emptyDrag);layout.reset();
 layout.dock('tools','left-top');layout.dock('timeline','left-bottom');emptyDrag=await begin('colors');const topTarget=uiQuery('[data-slot=top]'),bottomTarget=uiQuery('[data-slot=bottom]'),center=uiQuery('.dock-center').getBoundingClientRect();check('上下空栏位占据自身网格行且不覆盖主画布',topTarget.getBoundingClientRect().bottom<=center.top&&bottomTarget.getBoundingClientRect().top>=center.bottom&&getComputedStyle(topTarget.querySelector('.dock-tabs')).display==='none');cancel(emptyDrag);layout.reset();
 check('栏位标签字号和高度增大',parseFloat(getComputedStyle(tab('tools')).fontSize)>=13&&tab('tools').getBoundingClientRect().height>=34);
 const original=tab('tools').getBoundingClientRect();let drag=await begin('tools');const during=tab('tools').getBoundingClientRect();check('拖动开始保留原标签位置和栏位尺寸且不创建窗口',original.x===during.x&&original.y===during.y&&original.width===during.width&&original.height===during.height&&!layout.floats.size);check('拖动突出所有六个可放置栏位',layout.root.classList.contains('dragging-panels')&&uiAll('.dock-slot.drop-ready').length===6);
 const dropSlots=uiAll('.dock-left .dock-slot,.dock-right .dock-slot');
 check('左右四个栏目高亮位于内容上方且边框完全在可视边界内',dropSlots.length===4&&dropSlots.every(slot=>{const style=getComputedStyle(slot,'::before'),r=slot.getBoundingClientRect(),side=slot.parentElement.getBoundingClientRect();return style.content!=='none'&&style.position==='absolute'&&style.inset==='1px'&&+style.zIndex>13&&style.pointerEvents==='none'&&parseFloat(style.borderTopWidth)===2&&r.left>=side.left-1&&r.right<=side.right+1&&r.top>=side.top-1&&r.bottom<=side.bottom+1;}));
 const preview=tab('preview');preview.dispatchEvent(new DragEvent('dragover',{dataTransfer:drag.data,clientX:preview.getBoundingClientRect().left+2,bubbles:true,cancelable:true}));check('目标栏位重点描边并指示插入位置',preview.dataset.drop==='before'&&preview.closest('.dock-slot').classList.contains('drop-hover')&&getComputedStyle(preview.closest('.dock-slot'),'::before').borderTopWidth==='3px');
 preview.dispatchEvent(new DragEvent('drop',{dataTransfer:drag.data,clientX:preview.getBoundingClientRect().left+2,bubbles:true,cancelable:true}));end(drag);check('跨栏拖放合为同栏标签且不产生窗口',layout.state().slots['right-top'].join(',')==='tools,preview'&&!layout.floats.size);
 drag=await begin('preview');const target=tab('tools');target.dispatchEvent(new DragEvent('drop',{dataTransfer:drag.data,clientX:target.getBoundingClientRect().left,bubbles:true,cancelable:true}));end(drag);check('同一栏位标签左右拖动排序',layout.state().slots['right-top'].join(',')==='preview,tools');
 drag=await begin('preview');end(drag);await wait(()=>layout.floats.has('preview')&&layout.panels.preview.ownerDocument!==document);const child=layout.floats.get('preview').child;check('不在栏位释放自动独立为窗口',!!child&&layout.panels.preview.ownerDocument===child.document);check('独立面板没有放回按钮',!child.document.querySelector('.floating-header button')&&!!child.document.querySelector('[data-window-control=close]'));
 const floatingHeader=child.document.querySelector('.floating-header');check('独立预览栏标题可拖动',floatingHeader.draggable);const floatingData=new DataTransfer();floatingHeader.dispatchEvent(new DragEvent('dragstart',{dataTransfer:floatingData,bubbles:true}));const returnTarget=tab('tools');returnTarget.dispatchEvent(new DragEvent('drop',{dataTransfer:floatingData,clientX:returnTarget.getBoundingClientRect().right,bubbles:true,cancelable:true}));floatingHeader.dispatchEvent(new DragEvent('dragend',{dataTransfer:floatingData,bubbles:true}));await wait(()=>!layout.floats.has('preview'));check('小窗口预览拖回主栏并按释放位置停靠',layout.state().slots['right-top'].join(',')==='tools,preview'&&layout.panels.preview.ownerDocument===document);
 drag=await begin('colors');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));end(drag);check('Esc取消拖动不会独立窗口',!layout.floats.size&&layout.state().slots['left-bottom'].includes('colors'));
 layout.reset();const quickTab=tab('tools'),quickData=new DataTransfer();quickTab.dispatchEvent(new DragEvent('dragstart',{dataTransfer:quickData,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));quickTab.dispatchEvent(new DragEvent('dragend',{dataTransfer:quickData,bubbles:true}));await new Promise(requestAnimationFrame);check('启动后立即取消不会留下延迟空目标',!layout.root.classList.contains('dragging-panels')&&!layout.floats.size);return{ok:true,results};}catch(error){return{ok:false,results,error:error.stack};}};

window.prepareIndexedDocumentWindow=()=>{const next=createDocument(2,1,'索引链接窗口');next.palette=['#00000000','#ff0000ff'];next.frames[0].cels[0]=[0xff0000ff,0];replaceDocument(next,true,null,crypto.randomUUID(),true);mutate(()=>convertColorMode(doc,'indexed',{palette:'current'}),'索引模式');actions['duplicate-frame']();mutate(()=>linkCels(doc,0,[0,1]),'链接');return documentId;};
window.editIndexedDocumentWindow=()=>mutate(()=>{doc.frames[fi].indices[0][0]=0;doc.frames[fi].cels[0][0]=0;},'共享索引编辑',{colorsReady:true});

window.runColorAdjustmentsSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},layout=window.workspaceLayout;
 try{
  replaceDocument(createDocument(4,4,'颜色调整验收'),true);setColor('#ff000080');
  const panel=$('color-adjustments'),channel=key=>panel.querySelector(`[data-channel="${key}"] input[type=range]`),input=(key,value,commit=false)=>{const el=channel(key);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));if(commit)el.dispatchEvent(new Event('change',{bubbles:true}));};
  check('颜色面板常驻色板下方',!!($('palette').compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING)&&panel.getBoundingClientRect().height>140&&panel.getBoundingClientRect().top>=$('palette').getBoundingClientRect().bottom);
  input('h',120);check('HSV实时调整前景色且保留Alpha',color==='#00ff0080'&&$('hex').value==='#00FF0080');
  input('a',64);check('透明度滑条实时更新',rgba(color).a===64);
  const mode=panel.querySelector('select');mode.value='rgb';mode.dispatchEvent(new Event('change'));input('r',255);check('RGB通道实时更新且其他通道保持',color==='#ffff0040');
  setColor('#336699');check('外部选色同步所有通道',channel('r').value==='51'&&channel('g').value==='102'&&channel('b').value==='153');
  doc.palette=['#00000000','#ff0000','#ff0000'];doc.frames[0].cels[0][0]=0xff0000ff;mutate(()=>convertColorMode(doc,'indexed',{palette:'current'}),'索引验收');doc.frames[0].indices[0][0]=2;setColor('#ff0000',2);setPaletteEditing(true);paletteActive=2;paletteSelection=new Set([2]);syncPaletteSelection();syncPalettePanel();const before=history.undoStack.length;
  input('b',255);check('索引拖动尚未松手时保持原图',pixels()[0]===0xff0000ff);input('r',0,true);
  const adjusted={pixel:pixels()[0],palette:[...doc.palette],index:doc.frames[0].indices[0][0],undoDelta:history.undoStack.length-before};
  check('松手只修改当前索引色槽并记录一次撤销 '+JSON.stringify(adjusted),adjusted.pixel===0x0000ffff&&adjusted.palette[1]==='#ff0000'&&adjusted.index===2&&adjusted.undoDelta===1);
  setPaletteEditing(false);
  actions.undo();check('颜色调整可撤销还原索引与像素',pixels()[0]===0xff0000ff&&doc.frames[0].indices[0][0]===2);
  const paletteBeforeFree=JSON.stringify(doc.palette),historyBeforeFree=history.undoStack.length;
  $('hex').value='#12345678';$('hex').dispatchEvent(new Event('change'));
  check('索引模式HEX允许任意前景色',color==='#12345678'&&$('hex').value==='#12345678');
  check('索引HEX自由颜色不高亮近似色槽',!$('palette').querySelector('.swatch.selected'));
  input('r',37,true);const freeColor=color;render();
  check('索引模式RGB自由改色在渲染后保持且不改色板或历史',rgba(color).r===37&&color===freeColor&&JSON.stringify(doc.palette)===paletteBeforeFree&&history.undoStack.length===historyBeforeFree);
  check('索引RGB自由颜色不高亮近似色槽',!$('palette').querySelector('.swatch.selected'));
  $('palette').querySelector('[data-index="2"]').click();check('点击色板恢复精确索引选中',$('palette').querySelectorAll('.swatch.selected').length===1&&$('palette').querySelector('[data-index="2"]').classList.contains('selected'));
  // 色板库：切换只换色值，索引像素由用户点「重映射」手动搬过去。
  const libSelect=$('palette-library');
  check('色板库把内置色板分组列出',!!libSelect&&libSelect.querySelectorAll('optgroup[label="内置色板"] option').length>=3&&libSelect.options[0].textContent==='（未选择色板）');
  const savedEntry=savePaletteToLibrary('验收色板',['#000000','#ff0000','#00ff00']);renderPaletteLibrary();
  check('保存色板后出现在我的色板',[...libSelect.querySelectorAll('optgroup')].map(group=>group.label).join('|')==='内置色板|我的色板'&&[...libSelect.querySelectorAll('optgroup[label="我的色板"] option')].some(option=>option.value===savedEntry.id));
  libSelect.value='';libSelect.dispatchEvent(new Event('change'));
  libSelect.value=savedEntry.id;libSelect.dispatchEvent(new Event('change'));
  const paletteSwapped=JSON.stringify(doc.palette)===JSON.stringify(libraryPaletteColors(paletteById(savedEntry.id))),indexBeforeRemap=doc.frames[0].indices[0][0];
  check('应用色板库替换项目色板且索引像素不自动重映射',paletteSwapped&&indexBeforeRemap===2&&!$('remap-indices').hidden);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));
  check('Ctrl+Z恢复之前未选择色板并将删除置灰',libSelect.value===''&&document.querySelector('[data-action="delete-palette"]').disabled&&$('remap-indices').hidden);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true}));
  check('Ctrl+Shift+Z恢复用户色板和重映射',libSelect.value===savedEntry.id&&!document.querySelector('[data-action="delete-palette"]').disabled&&!$('remap-indices').hidden);
  actions['remap-indices']();
  check('手动重映射把索引像素按旧色板搬到新色板',doc.frames[0].indices[0][0]!==indexBeforeRemap&&doc.frames[0].cels[0][0]===indexColor(doc,doc.frames[0].indices[0][0],doc.layers[0])&&$('remap-indices').hidden,{index:doc.frames[0].indices[0][0]});
  const deletePaletteButton=document.querySelector('[data-action="delete-palette"]');
  libSelect.value='';libSelect.dispatchEvent(new Event('change'));
  check('色板库未选择时删色板按钮置灰',deletePaletteButton.disabled&&deletePaletteButton.title==='先在色板库选择一个色板');
  libSelect.value=libSelect.querySelector('optgroup[label="内置色板"] option').value;libSelect.dispatchEvent(new Event('change'));
  check('内置色板时删色板按钮置灰',deletePaletteButton.disabled&&deletePaletteButton.title==='内置色板不能删除');
  libSelect.value=savedEntry.id;libSelect.dispatchEvent(new Event('change'));
  check('用户色板时删色板按钮可用',!deletePaletteButton.disabled);
  libSelect.value=savedEntry.id;actions['delete-palette']();
  check('从色板库删除用户色板',!paletteById(savedEntry.id)&&![...libSelect.options].some(option=>option.value===savedEntry.id));
  const svNode=document.querySelector('.color-sv'),palettePanelNode=$('palette').closest('.palette-panel'),svBox=svNode.getBoundingClientRect(),svStyle=getComputedStyle(svNode);
  check('色阶图宽度在 180 到 260 之间且贴合栏宽',svBox.width>=179.5&&svBox.width<=260.5&&svStyle.minWidth==='180px'&&svStyle.maxWidth==='260px',{width:svBox.width,min:svStyle.minWidth,max:svStyle.maxWidth});
  check('颜色栏目左右内边距收紧到 4px',getComputedStyle(palettePanelNode).paddingLeft==='4px'&&getComputedStyle(palettePanelNode).paddingRight==='4px');
  replaceDocument(createDocument(2,1,'色板重映射'),true);doc.palette=['#00000000','#ff0000ff','#00ff00ff','#0000ffff'];pixels()[0]=0xff0000ff;pixels()[1]=0x00ff00ff;
  mutate(()=>convertColorMode(doc,'indexed',{palette:'current'}),'索引夹具');setPaletteEditing(true);setColor('#ff0000',1);paletteSelection=new Set([1]);paletteActive=1;syncPaletteSelection();
  const paletteElement=$('palette'),oldCapture=paletteElement.setPointerCapture,oldRelease=paletteElement.releasePointerCapture;paletteElement.setPointerCapture=()=>{};paletteElement.releasePointerCapture=()=>{};
  const start=paletteElement.querySelector('[data-palette-action="reorder"]'),startBox=start.getBoundingClientRect(),target=paletteElement.querySelector('[data-index="3"]').getBoundingClientRect();
  start.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:98,button:0,clientX:startBox.x+5,clientY:startBox.y+5}));
  for(const type of ['pointermove','pointerup'])paletteElement.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:98,button:0,clientX:target.right-3,clientY:target.top+target.height/2}));
  paletteElement.setPointerCapture=oldCapture;paletteElement.releasePointerCapture=oldRelease;
  check('实际拖拽排序后提供重映射',doc.palette[3]==='#ff0000ff'&&!$('remap-indices').hidden);
  $('remap-indices').click();check('排序重映射恢复绘制颜色',pixels()[0]===0xff0000ff&&pixels()[1]===0x00ff00ff&&$('remap-indices').hidden);
  paletteActive=3;paletteSelection=new Set([3]);syncPaletteSelection();paletteElement.querySelector('[data-palette-action="delete"]').click();
  check('删除颜色后提供重映射',!doc.palette.includes('#ff0000ff')&&!$('remap-indices').hidden);
  setPaletteEditing(false);setColor('#ff0000ff');$('add-color').click();check('新增颜色后仍提供重映射',doc.palette.some(value=>colorValue(value)===0xff0000ff)&&!$('remap-indices').hidden);
  $('remap-indices').click();check('删除再新增原色后重映射恢复原像素',pixels()[0]===0xff0000ff&&pixels()[1]===0x00ff00ff&&$('remap-indices').hidden);
  actions.undo();check('撤销重映射恢复待映射按钮',!$('remap-indices').hidden);actions.redo();check('重做重映射隐藏按钮且保留原色',$('remap-indices').hidden&&pixels()[0]===0xff0000ff);
  mutate(()=>convertColorMode(doc,'grayscale'),'灰度验收');input('b',255);check('灰度调整维持通道相同',rgba(color).r===rgba(color).g&&rgba(color).g===rgba(color).b);
  replaceDocument(createDocument(4,4,'独立颜色验收'),true);await layout.detach('colors');input('r',80);check('独立颜色窗口调节同一前景色',rgba(color).r===80&&panel.ownerDocument!==document);layout.floats.get('colors').child.close();await new Promise(r=>setTimeout(r,100));check('关闭颜色窗口后控件恢复且继续可用',panel.ownerDocument===document);input('g',90);check('还原后滑条仍可更新颜色',rgba(color).g===90);
  layout.reset();replaceDocument(demoDocument(),false);setColor('#edb75b');mode.value='hsv';mode.dispatchEvent(new Event('change'));fit();return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
};

window.runDocumentOverflowSmoke=async()=>{const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},host=$('document-tabs'),overflow=()=>host.querySelector('.document-overflow'),menu=()=>host.querySelector('.document-overflow-menu');const original=[...documentTabs.items],active=documentId,oldWidth=host.style.width,oldFlex=host.style.flex;
 try{
  host.style.width='';host.style.flex='';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const plusBounds=$('document-menu-trigger').getBoundingClientRect(),hostBounds=host.getBoundingClientRect(),stripBounds=host.parentElement.getBoundingClientRect();check('宽栏加号紧跟标签和折叠按钮，不贴整行右侧',Math.abs(plusBounds.left-hostBounds.right)<2&&plusBounds.right<stripBounds.right-80);
  for(let i=0;i<7;i++)documentTabs.add({...captureDocumentState(),documentId:crypto.randomUUID(),doc:createDocument(2,2,'长文档标签 '+i)});renderDocumentTabs();host.style.flex='none';host.style.width='310px';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const plus=$('document-menu-trigger'),hidden=[...host.querySelectorAll('.document-tab')].filter(tab=>tab.hidden);
  const visibleWidth=[...host.querySelectorAll('.document-tab:not([hidden])')].reduce((n,tab)=>n+tab.offsetWidth,overflow().offsetWidth);check('窄栏标签折叠且可见标签与溢出按钮铺满可用宽度 '+JSON.stringify({hidden:hidden.length,overflow:overflow().hidden,visibleWidth,available:host.clientWidth,plusParent:plus.parentElement===host.parentElement}),hidden.length>0&&!overflow().hidden&&visibleWidth<=host.clientWidth&&visibleWidth>host.clientWidth-80&&plus.parentElement===host.parentElement&&!!(plus.compareDocumentPosition(host)&Node.DOCUMENT_POSITION_PRECEDING));
  overflow().click();check('折叠菜单列出所有隐藏标签',menu().matches(':popover-open')&&menu().children.length===hidden.length);
  const source=host.querySelector('.document-tab:not([hidden]) [role=tab]'),sourceId=source.closest('.document-tab').dataset.documentId,targetId=hidden[0].dataset.documentId,target=menu().querySelector(`[data-document-id="${targetId}"]`),targetX=target?.getBoundingClientRect().right||0,dragData=new DataTransfer();check('折叠菜单内标签仍可拖动',!!target&&target.draggable);source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dragData}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,clientX:targetX,dataTransfer:dragData}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,clientX:targetX,dataTransfer:dragData}));source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dragData}));check('标签可拖入折叠菜单目标位置排序',documentTabs.items.findIndex(item=>item.id===sourceId)>documentTabs.items.findIndex(item=>item.id===targetId));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const chosen=menu().firstElementChild.dataset.documentId;menu().firstElementChild.click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const activeTab=host.querySelector(`[data-document-id="${chosen}"]`);
  check('选择隐藏标签后切为活动标签并可见',documentId===chosen&&!activeTab.hidden);
  check('加号始终可见且位于文档标签之后',!plus.hidden&&plus.parentElement===host.parentElement&&!!(host.compareDocumentPosition(plus)&Node.DOCUMENT_POSITION_FOLLOWING));
  const endDragData=new DataTransfer(),lastId=documentTabs.items[0].id;endDragData.setData('application/x-pixel-document',JSON.stringify({owner:editorHost.id,id:lastId}));const strip=host.parentElement;strip.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:endDragData}));strip.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:endDragData}));check('在整个文件栏空白处释放会追加至队尾',documentTabs.items.at(-1).id===lastId);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
 finally{host.style.width=oldWidth;host.style.flex=oldFlex;documentTabs.items=original;documentTabs.active=active;restoreDocumentState(original.find(item=>item.id===active).state);renderDocumentTabs();}}
window.canvasSelectionProbe=(prepare=false)=>{
 if(prepare){replaceDocument(createDocument(32,32,'选区验收'),true);fit();setTool('select');selection={x:6,y:5,w:14,h:12};place();drawOverlay();}
 const menu=document.querySelector('.selection-context-menu');
 return{selection:selection?{x:selection.x,y:selection.y,w:selection.w,h:selection.h}:null,dash:selectionDash,animating:selectionAnim!==null,line:selectionColors().line,lineWidth:1,menuOpen:!!menu,menuItems:menu?[...menu.querySelectorAll('button')].map(button=>({label:button.textContent,action:button.dataset.selectionAction})):[],clipboard:!!clipboard,handles:selection?selectionHandlePoints():[],frame:selection?{left:pan.x+selection.x*zoom,top:pan.y+selection.y*zoom,width:selection.w*zoom,height:selection.h*zoom,zoom}:null};
};
window.sampleCanvasOverlay=(x,y)=>{const dpr=window.devicePixelRatio;return[...octx.getImageData(Math.max(0,Math.min(overlay.width-1,Math.round(x*dpr))),Math.max(0,Math.min(overlay.height-1,Math.round(y*dpr))),1,1).data];};
window.selectionScreenPoint=(x,y)=>{const r=viewport.getBoundingClientRect();return{x:r.left+pan.x+(x+.5)*zoom,y:r.top+pan.y+(y+.5)*zoom};};
window.canvasSelectionScale=factor=>{scale(factor,{x:viewport.clientWidth/2,y:viewport.clientHeight/2});return window.canvasSelectionProbe();};

window.runReferenceBoardSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);},layout=window.workspaceLayout;
 const wait=async()=>new Promise(r=>setTimeout(r,60));
 const press=(node,type,x,y)=>node.dispatchEvent(new (node.ownerDocument.defaultView.PointerEvent)(type,{bubbles:true,cancelable:true,pointerId:7,button:0,clientX:x,clientY:y}));
 try{
  layout.reset();replaceDocument(createDocument(8,8,'reference-board-test'),true);
  const clearReferenceButton=()=>boardPanel().querySelector('[data-reference-clear]');
  check('空参考栏目清空按钮置灰',clearReferenceButton().disabled);
  check('参考面板默认独占左栏且图层留在右栏',layout.state().slots['right-bottom'].join(',')==='layers'&&layout.state().slots['left-top'].join(',')==='reference'&&layout.state().active['left-top']==='reference');
  check('六个面板标签含参考',uiAll('[data-panel-tab]').length===6&&!!uiQuery('[data-panel-tab=reference]'));
  check('参考动作可经命令菜单调用',typeof actions['panel-reference']==='function');
  const legacy={version:1,slots:{top:[],'left-top':['tools'],'left-bottom':['colors'],'right-top':['preview'],'right-bottom':['layers'],bottom:['timeline']},active:{},sizes:{left:210,right:240,top:160,bottom:200,leftSplit:.28,rightSplit:.4},collapsed:false,floating:{}};
  localStorage.setItem('pixel-studio-layout-v1',JSON.stringify(legacy));
  const {readLayout}=await import('./workspace-layout.js');
  const migrated=readLayout();
  check('旧五面板布局补入参考而不重置',migrated.slots['left-top'].includes('reference')&&migrated.slots['right-bottom'].join(',')==='layers'&&migrated.sizes.left===210);
  localStorage.removeItem('pixel-studio-layout-v1');layout.reset();

  const fixtures=await window.desktop.open('reference'),fixture=fixtures[0];
  check('桌面打开参考图可多选并返回 MIME',Array.isArray(fixtures)&&fixtures.length===2&&typeof fixture.data==='string'&&fixture.data.length>0&&/^image\//.test(fixture.mime||''),{count:fixtures.length,mime:fixture&&fixture.mime});
  const importButton=[...document.querySelectorAll('#reference-panel .board-canvas-tools button')].find(button=>button.getAttribute('aria-label')==='导入图片');
  importButton.click();
  for(let i=0;i<40&&(doc.references||[]).length<2;i++)await wait();
  const importedReferences=doc.references||[];
  check('点「导入图片」一次导入多张参考图',importedReferences.length===2&&new Set(importedReferences.map(reference=>reference.name)).size===2,{names:importedReferences.map(reference=>reference.name)});
  check('导入后清空参考按钮可用',!clearReferenceButton().disabled);
  clearReferenceButton().click();boardPanel().ownerDocument.querySelector('dialog.reference-dialog button[value=ok]').click();await wait();
  check('确认清空后按钮返回置灰',!doc.references.length&&clearReferenceButton().disabled);
  doc.references=[];boardChanged('重置参考图夹具');
  const first=await addBoardImage(fixture.data,fixture.name),second=await addBoardImage(fixture.data,'参考图 2');
  const panel=$('reference-panel');
  check('两张参考图进入 doc.references 且互不重叠',doc.references.length===2&&first.id!==second.id&&second.x>first.x);
  check('板面为每张参考图生成 canvas',panel.querySelectorAll('.reference-image').length===2);
  const canvas=panel.querySelector('.reference-image'),item=doc.references.find(reference=>reference.id===canvas.dataset.referenceId);
  check('canvas 尺寸等于原始尺寸乘倍率',canvas.style.width===item.width*item.scale+'px'&&canvas.width===item.width);
  check('canvas 使用像素化渲染',getComputedStyle(canvas).imageRendering==='pixelated');
  check('参考图节点可键盘聚焦',canvas.tabIndex===0&&panel.querySelectorAll('.reference-handle').length===8);

  const historyBefore=history.undoStack.length,compositeBefore=JSON.stringify([...composite(doc,fi)]),selectionBefore=JSON.stringify(selection);
  canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
  const startX=item.x;
  press(canvas,'pointerdown',0,0);press(canvas,'pointermove',30,12);press(canvas,'pointerup',30,12);
  const moved=doc.references.find(reference=>reference.id===item.id);
  check('拖动参考图提交位移',moved.x===startX+30&&moved.y===16+12);
  check('拖动后 canvas 跟随定位',canvas.style.left===moved.x+'px'&&canvas.style.top===moved.y+'px');

  const handle=panel.querySelector('.reference-handle.reference-se');
  handle.setPointerCapture=()=>{};handle.hasPointerCapture=()=>false;
  press(handle,'pointerdown',0,0);press(handle,'pointermove',8,0);press(handle,'pointerup',8,0);
  const resized=doc.references.find(reference=>reference.id===item.id);
  check('四角手柄等比缩放并写回',resized.scale===3&&canvas.style.width===resized.width*3+'px');
  check('参考编辑不写绘制历史栈',history.undoStack.length===historyBefore);
  check('参考编辑不影响合成结果',JSON.stringify([...composite(doc,fi)])===compositeBefore&&JSON.stringify(selection)===selectionBefore);
  check('参考编辑置脏且保存后清除',dirty&&boardRevision!==savedBoardRevision);
  await saveProject();
  check('保存同步参考脏标记',!dirty&&savedBoardRevision===boardRevision);

  await saveData(JSON.stringify(doc),'project','smoke-project');
  const reopened=validateDocument(JSON.parse((await window.desktop.open()).data));
  check('项目保存往返后参考图仍在',JSON.stringify(reopened.references)===JSON.stringify(doc.references)&&reopened.requiredFeatures.includes('reference-board'));

  const delCanvas=panel.querySelector('.reference-image');
  delCanvas.dispatchEvent(new (delCanvas.ownerDocument.defaultView.KeyboardEvent)('keydown',{key:'Delete',bubbles:true,cancelable:true}));
  check('聚焦参考图按 Delete 删除',doc.references.length===1);
  panel.querySelector('.reference-delete').click();
  const deleteDialog=panel.ownerDocument.querySelector('dialog.reference-dialog');
  check('删除按钮在面板所属文档内弹确认框',!!deleteDialog&&deleteDialog.open&&deleteDialog.ownerDocument===panel.ownerDocument);
  deleteDialog.querySelector('button[value=ok]').click();
  await wait();
  check('确认后删除参考图',doc.references.length===0&&panel.querySelectorAll('.reference-image').length===0);
  check('删除最后一张参考图后清空按钮置灰',clearReferenceButton().disabled);
  await addBoardImage(fixture.data,'窗口参考图');

  await layout.detach('reference');await wait();
  const child=layout.floats.get('reference').child,floatingPanel=child.document.getElementById('reference-panel'),floatingCanvas=floatingPanel.querySelector('.reference-image');
  check('参考面板可独立为窗口且图片随面板迁移',floatingPanel.ownerDocument===child.document&&!!floatingCanvas&&floatingCanvas.ownerDocument===child.document);
  const floatingPixels=floatingCanvas.getContext('2d').getImageData(0,0,floatingCanvas.width,floatingCanvas.height).data,floatingStyle=child.getComputedStyle(floatingCanvas);
  check('独立窗口内参考图有真实像素且可见',[...floatingPixels].some((value,index)=>index%4===3&&value>0)&&floatingStyle.display==='block'&&floatingStyle.opacity==='1');
  modifiers.alt=true;syncInteraction();
  check('独立窗口参考图同步吸管光标',floatingCanvas.style.cursor===cursorStyle('eyedropper'));
  modifiers.alt=false;syncInteraction();
  check('独立窗口松开 Alt 后恢复默认光标',floatingCanvas.style.cursor==='');
  floatingCanvas.setPointerCapture=()=>{};floatingCanvas.hasPointerCapture=()=>false;
  const floatingX=doc.references[0].x;
  press(floatingCanvas,'pointerdown',0,0);press(floatingCanvas,'pointermove',20,0);press(floatingCanvas,'pointerup',20,0);
  check('独立窗口内拖动参考图写回同一文档',doc.references[0].x===floatingX+20);
  floatingPanel.querySelector('.reference-delete').click();
  const floatingDialog=child.document.querySelector('dialog.reference-dialog');
  check('独立窗口内删除确认框弹在该窗口而非主窗口',!!floatingDialog&&floatingDialog.open&&floatingDialog.ownerDocument===child.document&&!document.querySelector('dialog.reference-dialog'));
  floatingDialog.querySelector('button[value=cancel]').click();
  await wait();
  check('取消删除后参考图仍在',doc.references.length===1&&!!child.document.querySelector('.reference-image'));
  floatingPanel.querySelector('.reference-delete').click();
  child.document.querySelector('dialog.reference-dialog button[value=ok]').click();
  for(let i=0;i<40&&doc.references.length;i++)await wait();
  check('独立窗口内确认后可删除参考图',doc.references.length===0);
  layout.dock('reference','right-bottom');await wait();
  check('参考面板可拖回栏位并保留状态',layout.panels.reference.ownerDocument===document&&child.closed);

  window.dispatchEvent(new CustomEvent('panel-moved',{detail:{id:'reference'}}));
  check('panel-moved 后板面重绘',!!$('reference-panel').querySelector('.reference-board'));

  await addBoardImage(fixture.data,'交互参考图');await addBoardImage(fixture.data,'层次参考图');
  const viewportNode=panel.querySelector('.reference-viewport'),WheelEvent=panel.ownerDocument.defaultView.WheelEvent;
  viewportNode.setPointerCapture=()=>{};viewportNode.hasPointerCapture=()=>false;
  const wheelAt=deltaY=>{const box=viewportNode.getBoundingClientRect();viewportNode.dispatchEvent(new WheelEvent('wheel',{deltaY,clientX:box.left+40,clientY:box.top+40,bubbles:true,cancelable:true}));};
  const zoomBefore=boardView().zoom;wheelAt(-120);
  const zoomCanvas=panel.querySelector('.reference-image'),zoomItem=boardItems()[0];
  check('滚轮缩放板面视图并缩放图片',boardView().zoom>zoomBefore&&Math.abs(parseFloat(zoomCanvas.style.width)-zoomItem.width*zoomItem.scale*boardView().zoom)<.01);
  setBoardZoom(1);
  const panBefore={...boardView()},panItemX=boardItems()[0].x;
  space=true;press(viewportNode,'pointerdown',200,200);press(viewportNode,'pointermove',240,230);press(viewportNode,'pointerup',240,230);space=false;
  check('空格拖动平移板面视图且不移动图片',Math.abs(boardView().x-panBefore.x-40)<.001&&Math.abs(boardView().y-panBefore.y-30)<.001&&boardItems()[0].x===panItemX);
  setBoardZoom(1);BOARD_VIEWS.set(documentId,{zoom:1,x:0,y:0});boardKey='';renderReferenceBoard(true);
  const moveCanvas=panel.querySelector('.reference-image'),moveStartX=boardItems()[0].x;
  moveCanvas.setPointerCapture=()=>{};moveCanvas.hasPointerCapture=()=>false;
  setTool('move');
  press(moveCanvas,'pointerdown',0,0);press(moveCanvas,'pointermove',26,10);press(moveCanvas,'pointerup',26,10);
  check('V 工具下拖动参考图移动位置',tool==='move'&&boardItems()[0].x===moveStartX+26&&boardItems()[0].y===26);
  const pickItem=boardItems()[0],pickPixels=boardItemPixels(pickItem),pickIndex=pickPixels.findIndex(pixel=>(pixel&255)>0);
  const pickCanvas=panel.querySelector('.reference-image'),pickScale=pickItem.scale*boardView().zoom,pickBox=pickCanvas.getBoundingClientRect();
  const pickX=pickBox.left+(pickIndex%pickItem.width+.5)*pickScale,pickY=pickBox.top+(Math.floor(pickIndex/pickItem.width)+.5)*pickScale;
  const eyedropperCursor=cursorStyle('eyedropper');
  setTool('eyedropper');
  check('吸管工具下参考图显示吸管光标',pickCanvas.style.cursor.includes('data:image/svg+xml')&&pickCanvas.style.cursor===eyedropperCursor);
  setTool('pencil');
  check('切回铅笔后参考图恢复默认光标',pickCanvas.style.cursor==='');
  modifiers.alt=true;syncInteraction();
  check('按住 Alt 参考图即时切换吸管光标',pickCanvas.style.cursor===eyedropperCursor);
  modifiers.alt=false;syncInteraction();
  check('松开 Alt 参考图光标恢复默认',pickCanvas.style.cursor==='');
  setColor('#000000');setTool('eyedropper');
  pickCanvas.setPointerCapture=()=>{};pickCanvas.hasPointerCapture=()=>false;
  press(pickCanvas,'pointerdown',pickX,pickY);
  const want=rgba(fromRgba({r:pickPixels[pickIndex]>>>24,g:pickPixels[pickIndex]>>>16&255,b:pickPixels[pickIndex]>>>8&255,a:pickPixels[pickIndex]&255})),got=rgba(color);
  check('吸管可从参考图取色到前景色',pickIndex>=0&&got.r===want.r&&got.g===want.g&&got.b===want.b&&got.a===want.a);
  setTool('pencil');
  const frontId=boardItems()[0].id;
  const menuAt=(id=frontId)=>{const node=[...panel.querySelectorAll('.reference-image')].find(canvas=>canvas.dataset.referenceId===id);node.dispatchEvent(new (panel.ownerDocument.defaultView.MouseEvent)('contextmenu',{bubbles:true,cancelable:true,clientX:120,clientY:120}));return panel.ownerDocument.querySelector('.context-menu');};
  const boardMenu=menuAt(),menuLabels=boardMenu?[...boardMenu.querySelectorAll('button')].map(button=>button.textContent):[];
  check('参考图右键菜单列出五项能力',['适应内容','缩放到 100%','重置位置与缩放','置于顶层','置于底层','删除'].every(label=>menuLabels.includes(label)));
  boardMenu.querySelector('[data-menu-action="置于顶层"]').click();
  check('右键菜单可置于顶层',doc.references.at(-1).id===frontId);
  menuAt().querySelector('[data-menu-action="置于底层"]').click();
  check('右键菜单可置于底层',doc.references[0].id===frontId);
  menuAt().querySelector('[data-menu-action="重置位置与缩放"]').click();
  const resetItem=doc.references.find(reference=>reference.id===frontId);
  check('右键菜单可重置位置与缩放',resetItem.x===0&&resetItem.y===0&&resetItem.scale===1);
  menuAt().querySelector('[data-menu-action="缩放到 100%"]').click();
  check('右键菜单可缩放到 100%',boardView().zoom===1);
  menuAt().querySelector('[data-menu-action="适应内容"]').click();
  check('右键菜单可适应内容',/^已适应内容 \d+%$/.test(panel.querySelector('.reference-status').textContent)&&boardView().zoom>=.125&&boardView().zoom<=16);
  const removeCount=doc.references.length;menuAt().querySelector('[data-menu-action="删除"]').click();
  const menuDialog=panel.ownerDocument.querySelector('dialog.reference-dialog');
  check('右键菜单删除同样弹确认框',!!menuDialog&&menuDialog.open);
  menuDialog.querySelector('button[value=ok]').click();
  await wait();
  check('右键菜单确认后删除该参考图',doc.references.length===removeCount-1&&!doc.references.some(reference=>reference.id===frontId));
  for(const item of boardItems())boardForget(item);
  doc.references=[];boardChanged('');
  check('参考图不影响选区',selection===null&&selectionBefore==='null');
  layout.reset();replaceDocument(createDocument(4,4,'reference-board-done'),true);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
};

window.runErrorDialogSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 try{
  const original=JSON.stringify(doc);
  await importFile({type:'project',data:'broken'}).catch(error=>showError('打开失败：'+error.message));
  check('打开损坏项目显示 Error 弹窗并保留项目',$('error-dialog').open&&$('error-detail').textContent.includes('打开失败')&&JSON.stringify(doc)===original);
  $('error-dialog').querySelector('.primary').click();check('确定关闭错误弹窗',!$('error-dialog').open);
  window.dispatchEvent(new ErrorEvent('error',{error:new Error('<b>运行错误</b>')}));
  check('未捕获异常按纯文本显示',$('error-dialog').open&&$('error-detail').textContent==='<b>运行错误</b>'&&!$('error-detail').querySelector('b'));
  $('error-dialog').close();
  window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:new Error('异步错误')}));
  check('异步拒绝显示错误弹窗',$('error-dialog').open&&$('error-detail').textContent==='异步错误');$('error-dialog').close();
  const pending=newDocument();check('关闭后可以继续新建',$('modal').open);$('modal').close('cancel');await pending;
  const formPending=modal('测试原表单','<input name="value" value="保留">');showError('操作失败');$('error-dialog').close();
  check('错误弹窗不替换原表单',$('modal').open&&$('modal-form').elements.value.value==='保留');$('modal').close('cancel');await formPending;
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
};

window.runPixelRepairSmoke=async grass=>{const {pixelRepairSmoke}=await import('./import-smoke.js');return pixelRepairSmoke({$,openDocument,importFile,documentState:()=>doc,grass});};

window.runRecoveryPolicySmoke=async phase=>{const {recoveryPolicySmoke}=await import('./recovery-smoke.js');return recoveryPolicySmoke({$,newDocument,closeDocumentTab,saveProject,flushRecovery,importFile,settingsDialog,edit:value=>mutate(()=>pixels()[0]=value),state:()=>({id:documentId,filePath,dirty,pixel:pixels()[0]})},phase);};

window.runNormalMapSmoke=async()=>{const {normalMapSmoke}=await import('./normal-map-smoke.js');return normalMapSmoke({$,actions,createDocument,replaceDocument,documentState:()=>doc,exportDialog,applyLocale});};

window.runParitySmoke=async suite=>{const {runParitySmoke}=await import('./parity-smoke.js');return runParitySmoke(suite,{$,actions,createDocument,replaceDocument,documentState:()=>doc,setTool,setColor,setBackground,applyLocale,viewport,getSelection:()=>selection,position:(x,y)=>{const r=viewport.getBoundingClientRect();return{x:r.left+pan.x+(x+.5)*zoom,y:r.top+pan.y+(y+.5)*zoom};}});};

window.prepareUpdateSmoke=dirty=>{replaceDocument(createDocument(2,2,'更新前项目'),!dirty);};
window.automaticUpdateSmoke=()=>help.check(true);

window.helpUpdateChecking=()=>help.checking;

const runSettingsBehaviorSmoke=window.runSettingsSmoke;
window.runSettingsSmoke=async()=>{
 const original=await runSettingsBehaviorSmoke();if(!original.ok)return original;
 const {formLayoutSmoke}=await import('./form-layout-smoke.js');
 const layout=await formLayoutSmoke({$,actions,settingsDialog,setTool,applyLocale,createDocument,replaceDocument});
 return{...layout,results:[...original.results,...layout.results]};
};

window.runWorkspaceRefreshSmoke=async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const wait=async test=>{for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,20));}throw new Error('等待界面超时');};
 const layout=window.workspaceLayout,button=name=>uiQuery('[data-action="'+name+'"]');
 try{
  layout.reset();check('默认时间轴折叠且保留可点击标签',layout.state().collapsed&&!!uiQuery('[data-panel-tab=timeline]')&&uiQuery('[data-slot=bottom]').classList.contains('collapsed'));
  const sample=createDocument(18,10,'workspace-refresh-recent');sample.frames[0].cels[0][0]=0xff0000ff;replaceDocument(sample,true);
  check('测试项目通过实际保存加入最近文件',await saveProject());enterEmptyState();
  $('welcome').querySelector('[data-action="recent-files"]').click();
  await wait(()=>$('modal').open&&$('recent-preview')?.textContent.includes('18 × 10'));
  const controls=uiQuery('.recent-file-controls'),clear=$('clear-recent'),paths=controls.querySelector('select'),a=clear.getBoundingClientRect(),b=paths.getBoundingClientRect();
  check('开始页最近文件弹窗左侧路径右侧清空且同行',b.right<a.left&&Math.abs(a.top+a.height/2-b.top-b.height/2)<3&&b.width>a.width&&a.right<=controls.getBoundingClientRect().right+1);
  check('最近文件缩略图显示实际画布尺寸',$('recent-preview').querySelector('canvas')?.width===32&&$('recent-preview').textContent==='18 × 10'&&!$('recent-preview').textContent.includes('undefined'));
  const caption=controls.querySelector('.field-caption');check('最近文件路径前显示完整文件标签与冒号',caption.textContent.trim()==='文件'&&getComputedStyle(caption).display!=='none'&&getComputedStyle(caption,'::after').content.includes('：')&&!caption.querySelector('.sr-only'));
  const metadata=(await window.desktop.recentThumbs())[0];check('缩略图接口同时返回原始宽高与缩略图尺寸',metadata.width===18&&metadata.height===10&&metadata.size===32);
  $('modal-form').requestSubmit($('modal-submit'));await wait(()=>!$('modal').open&&$('welcome').hidden&&doc.width===18);
  check('最近文件确认后实际打开所选项目',$('welcome').hidden&&doc.width===18&&doc.height===10);
  await window.desktop.clearRecent();void recentDialog();await wait(()=>$('modal').open&&!!$('clear-recent'));
  check('没有记录仍可打开最近文件弹窗且按钮置灰',$('clear-recent').disabled&&$('modal-submit').disabled&&$('modal-form').elements.index.disabled&&$('modal-form').elements.index.selectedOptions[0].textContent==='暂无最近文件');
  $('modal').close('cancel');await new Promise(r=>setTimeout(r,0));await saveProject();void recentDialog();await wait(()=>$('modal').open&&!$('clear-recent').disabled);
  $('clear-recent').click();await wait(()=>$('clear-recent').disabled);
  check('清空后保留弹窗并同步空态禁用确定',$('modal').open&&$('modal-submit').disabled&&$('recent-preview').textContent==='暂无最近文件'&&(await window.desktop.recentFiles()).length===0);
  $('modal').close('cancel');await new Promise(r=>setTimeout(r,0));
  uiQuery('[data-panel-tab=timeline]').click();check('点击时间轴标签展开默认折叠栏目',!layout.state().collapsed&&!uiQuery('[data-slot=bottom]').classList.contains('collapsed'));
  const {readLayout}=await import('./workspace-layout.js');check('已有展开布局读取后保持展开',readLayout().collapsed===false);
  const expected={'add-frame':'frame-add','duplicate-frame':'frame-copy','delete-frame':'frame-delete','frame-left':'frame-shift-left','frame-right':'frame-shift-right','reverse-frames':'frames-reverse','cel-properties':'cel-properties','link-cels':'cel-link','unlink-cels':'cel-unlink','frame-fps':'fps','add-tag':'tag-add','edit-tag':'tag-edit','delete-tag':'tag-delete'};
  check('时间轴各功能使用对应 SVG 且不含缺失图标',Object.entries(expected).every(([name,icon])=>button(name)?.querySelector('svg')?.dataset.icon===icon&&!button(name).innerHTML.includes('undefined')));
  check('时间轴按选择帧编辑共享标签洋葱皮分组',document.querySelectorAll('.timeline-options>.timeline-control-group').length===6&&['选择与 Cel 属性','帧编辑','Cel 范围编辑','共享图像','动画标签','洋葱皮'].every(name=>uiQuery('.timeline-options [aria-label="'+name+'"]')));
  const duration=$('duration'),durationUnit=duration.closest('.number-unit'),unitStyle=getComputedStyle(durationUnit,'::after');
  check('帧时长单位在输入框内部右侧置灰且不显示外部单位',durationUnit.dataset.unit==='ms'&&unitStyle.position==='absolute'&&unitStyle.right==='7px'&&unitStyle.color!==getComputedStyle(duration).color&&!duration.closest('label').textContent.includes('ms')&&getComputedStyle(duration.closest('label').querySelector('.field-caption'),'::after').content==='none');
  check('移除帧时长时钟图标及全部标签占位',!duration.closest('label').querySelector('svg')&&getComputedStyle(duration.closest('label').querySelector('.field-caption')).display==='none'&&duration.closest('label').getBoundingClientRect().width<=90);
  const appInfo=await window.desktop.appInfo(),editMenu=(await window.desktop.windowMenu()).find(item=>item.label==='编辑');check('实际编辑菜单按正式或开发环境决定开发工具入口',editMenu.submenu.some(item=>item.role?.toLowerCase()==='toggledevtools')===!appInfo.packaged);
  duration.value=120;duration.dispatchEvent(new Event('change',{bubbles:true}));check('输入框内单位不影响帧时长数值编辑',doc.frames[fi].duration===120&&duration.value==='120');actions.undo();
  const celButton=button('cel-properties');check('Cel属性是带说明的纯图标按钮',celButton.classList.contains('visual-button')&&celButton.childElementCount===1&&celButton.getAttribute('aria-label').includes('Cel'));
  celButton.click();let popup=$('cel-properties-popover'),form=popup.querySelector('form');
  await new Promise(requestAnimationFrame);check('Cel百分比单位同样放在输入框内',form.elements.opacity.closest('.number-unit')?.dataset.unit==='%'&&!form.elements.opacity.closest('label').querySelector('.field-caption').textContent.includes('%'));
  check('气泡内仅有文字操作按钮和常规属性输入',popup.querySelectorAll('button').length===2&&[...document.querySelectorAll('[popover] button')].every(node=>!node.querySelector('svg')&&!!node.textContent.trim()));
  const rect=popup.getBoundingClientRect();check('点击Cel属性打开按钮旁气泡且主窗口未被模态阻塞',popup.matches(':popover-open')&&!$('modal').open&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight);
  const opacitySlider=form.querySelector('[data-opacity-slider]');opacitySlider.value=37;opacitySlider.dispatchEvent(new Event('input',{bubbles:true}));check('Cel透明滑条同步数值且应用前不修改cel',form.elements.opacity.value==='37'&&celProperty(doc,fi,li).opacity===100&&getComputedStyle(opacitySlider).backgroundImage===getComputedStyle($('paint-opacity-range')).backgroundImage);form.elements.opacity.value=62;form.elements.opacity.dispatchEvent(new Event('input',{bubbles:true}));check('Cel透明度输入反向同步滑条',opacitySlider.value==='62');
  form.elements.x.value=2;form.elements.y.value=1;form.elements.opacity.value=50;form.requestSubmit();
  check('气泡应用实际修改当前cel位置透明度',celProperty(doc,fi,li).x===2&&celProperty(doc,fi,li).y===1&&celProperty(doc,fi,li).opacity===50&&!popup.matches(':popover-open'));
  actions.undo();check('Cel属性改动可一次撤销',celProperty(doc,fi,li).x===0&&celProperty(doc,fi,li).opacity===100);
  celButton.click();popup=$('cel-properties-popover');popup.querySelector('[name=x]').value=9;popup.querySelector('.cel-property-actions [data-close]').click();check('取消气泡不保存输入',celProperty(doc,fi,li).x===0);
  await layout.detach('timeline');const timelineWindow=layout.floats.get('timeline').child;
  timelineWindow.document.querySelector('[data-action=cel-properties]').click();
  const floatingPopup=timelineWindow.document.getElementById('cel-properties-popover');
  check('独立时间轴窗口内可打开纯文字属性气泡',floatingPopup.matches(':popover-open')&&!floatingPopup.querySelector('svg')&&floatingPopup.ownerDocument===timelineWindow.document&&floatingPopup.querySelector('[name=opacity]').closest('.number-unit')?.dataset.unit==='%');
  floatingPopup.querySelector('.cel-property-actions [data-close]').click();timelineWindow.document.querySelector('[data-action=frame-fps]').click();const floatingFps=timelineWindow.document.getElementById('frame-fps-popover');check('独立时间轴窗口可打开文字FPS气泡',floatingFps.matches(':popover-open')&&!floatingFps.querySelector('svg')&&!!floatingFps.querySelector('[name=fps]'));floatingFps.querySelector('[data-close]').click();layout.dock('timeline','bottom');
  check('停靠后属性气泡随时间轴返回主窗口',$('cel-properties-popover')?.ownerDocument===document);
  const count=doc.frames.length;button('add-frame').click();button('duplicate-frame').click();check('重组后新增与复制帧仍实际生效',doc.frames.length===count+2);button('delete-frame').click();check('删除帧图标仍实际删除所选帧',doc.frames.length===count+1);
  const frameHeads=uiAll('.frame-head');frameHeads[0].click();frameHeads.at(-1).dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));
  const durations=doc.frames.map(frame=>frame.duration);button('frame-fps').click();let fpsPopup=$('frame-fps-popover'),fpsForm=fpsPopup.querySelector('form');check('FPS图标打开非模态文字设置气泡',fpsPopup.matches(':popover-open')&&!$('modal').open&&!fpsPopup.querySelector('svg')&&fpsForm.elements.fps.closest('.number-unit').dataset.unit==='FPS');
  fpsForm.elements.fps.value=12.5;fpsForm.requestSubmit();check('FPS气泡按所选帧实际批量换算时长',doc.frames.every(frame=>frame.duration===80)&&!fpsPopup.matches(':popover-open'));
  button('frame-fps').click();fpsPopup=$('frame-fps-popover');fpsForm=fpsPopup.querySelector('form');fpsForm.elements.fps.value=0;fpsForm.requestSubmit();check('FPS无效值阻止提交并保留气泡',fpsPopup.matches(':popover-open')&&doc.frames.every(frame=>frame.duration===80));fpsForm.elements.fps.value=25;fpsPopup.querySelector('[data-close]').click();check('取消FPS气泡不修改时长',doc.frames.every(frame=>frame.duration===80));actions.undo();check('FPS批量改动可一次撤销',doc.frames.every((frame,index)=>frame.duration===durations[index]));
  $('layers').querySelector('.layer').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:1000,clientY:420}));await new Promise(requestAnimationFrame);
  const layerMenu=$('layer-menu'),menuFields=[$('layer-blend').closest('label'),$('opacity').closest('label')],rows=menuFields.map(node=>node.getBoundingClientRect());
  check('实际右键图层后参数文字与控件居中并留足间距',layerMenu.matches(':popover-open')&&menuFields.every(node=>{const caption=node.querySelector(':scope>.field-caption'),control=node.querySelector(':scope>.field-control'),a=caption.getBoundingClientRect(),b=control.getBoundingClientRect();return !node.querySelector('svg')&&b.left-a.right>=15&&Math.abs(a.top+a.height/2-b.top-b.height/2)<2;})&&rows[1].top-rows[0].bottom>=5);layerMenu.hidePopover();
  const reference=$('reference-panel'),tools=reference.querySelector('.board-canvas-tools'),wrap=reference.querySelector('.reference-viewport-wrap');
  const toolNames=[...tools.querySelectorAll('button')].map(node=>node.getAttribute('aria-label'));check('参考栏目移除内部页签和按钮工具行',!reference.querySelector('.reference-tabs,.reference-toolbar')&&toolNames.join(',')==='导入图片,清空参考图,适应内容');
  const tr=tools.getBoundingClientRect(),wr=wrap.getBoundingClientRect(),fitRect=tools.querySelector('.board-fit').getBoundingClientRect(),importRect=tools.firstElementChild.getBoundingClientRect();check('参考导入清空在左适应内容靠右',importRect.left-wr.left>=0&&importRect.left-wr.left<12&&wr.right-fitRect.right<12&&fitRect.left>tools.children[1].getBoundingClientRect().right+20&&tr.top-wr.top<12);
  check('预览适应内容背景边框与参考适应内容一致',['backgroundColor','borderColor','borderRadius','color'].every(key=>getComputedStyle($('preview-fit'))[key]===getComputedStyle(tools.querySelector('.board-fit'))[key]));
  check('无图集时地形预览面板不自动显示',!layout.panelPresent('terrain-preview'));
  const atlas=createDocument(16,16,'workspace-refresh-terrain');atlas.frames[0].cels[0].fill(0x44aa44ff);toTileset(atlas,0,{w:4,h:4});replaceDocument(atlas,true);
  check('有图集时地形预览以同级面板加入左上栏',layout.panelPresent('terrain-preview')&&layout.state().slots['left-top'].includes('reference')&&layout.state().slots['left-top'].includes('terrain-preview')&&!!uiQuery('[data-panel-tab="terrain-preview"]'));
  check('视图面板命令包含地形预览',typeof actions['panel-terrain-preview']==='function');
  uiQuery('[data-panel-tab="terrain-preview"]').click();const terrain=$('terrain-preview-panel');
  check('地形操作栏下不再显示提示文字',!terrain.querySelector('.terrain-preview-hint')&&terrain.querySelector('.terrain-preview-bar').lastElementChild.matches('.terrain-preview-size'));
  check('地形预览画布与参考图分别属于独立栏目',terrain.querySelector('.terrain-preview-canvas')?.closest('[data-panel]')===terrain&&!reference.querySelector('.terrain-preview-canvas'));
  const before={...boardView()},view={...previewView()},vp=terrain.querySelector('.terrain-preview-viewport'),r=vp.getBoundingClientRect();vp.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:r.left+40,clientY:r.top+40,bubbles:true,cancelable:true}));
  check('地形预览滚轮缩放不改变参考图视图',previewView().zoom>view.zoom&&JSON.stringify(boardView())===JSON.stringify(before));
  actions['panel-terrain-preview']();check('面板菜单可隐藏地形预览',!layout.panelPresent('terrain-preview'));renderReferenceBoard(true);check('自动同步尊重用户隐藏的地形面板',!layout.panelPresent('terrain-preview'));actions['panel-terrain-preview']();check('面板菜单可恢复地形预览',layout.panelPresent('terrain-preview')&&!terrain.hidden);
  await layout.detach('terrain-preview');const floating=layout.floats.get('terrain-preview').child;await wait(()=>!!floating.document.querySelector('.terrain-preview-canvas'));check('地形预览可独立浮动且画布随面板迁移',terrain.ownerDocument===floating.document&&!!floating.document.querySelector('.terrain-preview-canvas'));layout.dock('terrain-preview','left-top');
  replaceDocument(createDocument(18,10,'workspace-refresh-done'),true);check('退出图集项目后自动移除地形面板',!layout.panelPresent('terrain-preview'));
  enterEmptyState();check('关闭所有项目后地形预览不出现',!layout.panelPresent('terrain-preview'));replaceDocument(createDocument(18,10,'workspace-refresh-done'),true);
  layout.reset();check('恢复默认布局再次折叠时间轴',layout.state().collapsed);
  uiQuery('[data-panel-tab=timeline]').click();button('cel-properties').click();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  check('最终属性气泡可见且没有错误弹窗',$('cel-properties-popover').matches(':popover-open')&&!$('error-dialog').open);
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
};
}
if(window.desktop?.inputAudit&&!editorHost.detached)window.startInputAudit();

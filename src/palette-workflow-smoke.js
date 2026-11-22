import {BRIGHT24} from './builtin-palette.js';
import {encodePalette,decodePalette,importPaletteFile,paletteBase64,paletteBytes} from './palette-file.js';
import {palettePreset,PALETTE_PRESET_KEY,paletteById,deletePaletteFromLibrary} from './palette-library.js';
import {applyLocale} from './i18n.js';
import {convertColorMode} from './color-modes.js';

export async function paletteWorkflowSmoke(samples,api){
 const {$,actions,newDocument,replaceDocument,createDocument,importFile,importPalette,exportPalette,setTool,state,pattern,library,switchDocument,empty}=api;
 const results=[],check=(name,value)=>{results.push({name,pass:!!value});if(!value)throw new Error(name);};
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const preset=localStorage.getItem(PALETTE_PRESET_KEY),bridge=window.desktop;
 let savedPaletteId;
 const originalOpen=bridge.openPalette,originalSave=bridge.save;
 async function makeDocument(){
  const pending=newDocument();
  $('modal-form').requestSubmit($('modal-submit'));await pending;await nextFrame();
 }
 try{
  localStorage.removeItem(PALETTE_PRESET_KEY);
  await makeDocument();
  check('新建项目使用 bright24 且下拉选中该内置色板',state().doc.palette.join()===BRIGHT24.join()&&$('palette-library').value==='bright24');
  const presetButton=document.querySelector('[data-action="set-palette-preset"]'),option=id=>$('palette-library').querySelector(`option[value="${id}"]`);
  check('初始预设在下拉中标识且设置按钮置灰',option('bright24').textContent==='bright24（预设）'&&presetButton.disabled);
  const changeLibrary=id=>{$('palette-library').value=id;$('palette-library').dispatchEvent(new Event('change',{bubbles:true}));};
  changeLibrary('pico8');
  check('选择其他色板启用设置按钮并保留旧预设标识',!presetButton.disabled&&option('bright24').dataset.preset==='true'&&option('pico8').dataset.preset==='false');
  presetButton.click();await nextFrame();
  check('设置后标识迁移且按钮立即置灰',option('pico8').textContent==='PICO-8（预设）'&&option('bright24').dataset.preset==='false'&&presetButton.disabled);
  actions.undo();check('撤销到非预设色板重新启用按钮',!presetButton.disabled&&$('palette-library').value==='bright24');
  actions.redo();check('重做恢复预设内容后重新置灰',presetButton.disabled&&$('palette-library').value==='pico8');
  applyLocale('en');await nextFrame();check('英文下拉显示 Preset 标识',option('pico8').textContent==='PICO-8 (Preset)');
  applyLocale('zh');localStorage.removeItem(PALETTE_PRESET_KEY);library();await makeDocument();
  check('前景色调整标题已移除且通道模式保留',!document.querySelector('.color-adjust-heading strong')&&!!document.querySelector('#color-adjustments select'));
  const png=await importPaletteFile('bright24.png',paletteBytes(samples.png));
  check('PNG 导入逐色匹配 bright24 原图顺序',png.map(color=>color.toUpperCase()).join()===BRIGHT24.join());
  const ase=await importPaletteFile('lost-century.ase',paletteBytes(samples.ase));
  check('用户 Adobe ASE 样本导入16色',ase.length===16&&ase[0]==='#d1b187');
  const colors=['#ff000080','#00ff00','#ff000080'];
  bridge.openPalette=async()=>({name:'coast.v2.pix',data:paletteBase64(encodePalette(colors))});
  await importPalette();
  check('导入色板未入库时预设按钮置灰',presetButton.disabled);
  check('导入后显示文件名并替换未选择色板选项',$('palette-library').selectedOptions[0].textContent==='coast.v2.pix'&&![...$('palette-library').options].some(option=>option.textContent==='（未选择色板）'));
  check('导入保留 Alpha 与重复色槽，允许撤销',state().doc.palette.join()===colors.join()&&state().history===1&&$('palette-library').value==='');
  const importedDocumentId=state().documentId;await makeDocument();switchDocument(importedDocumentId);
  check('切换项目后恢复导入文件名与未入库状态',$('palette-library').selectedOptions[0].textContent==='coast.v2.pix'&&presetButton.disabled);
  actions.undo();check('撤销恢复 bright24 及库选择',$('palette-library').value==='bright24'&&state().doc.palette.join()===BRIGHT24.join());
  actions.redo();
  check('重做恢复导入文件名且预设仍置灰',$('palette-library').selectedOptions[0].textContent==='coast.v2.pix'&&presetButton.disabled);
  const beforePreset=localStorage.getItem(PALETTE_PRESET_KEY);actions['set-palette-preset']();
  check('未入库色板不能绕过按钮设置预设',localStorage.getItem(PALETTE_PRESET_KEY)===beforePreset);
  let exported;
  bridge.save=async(...args)=>{exported=args;return true;};
  await exportPalette();
  check('导出二进制 .pix 并可完整回读',exported[1]==='pix'&&exported[3]===true&&decodePalette(paletteBytes(exported[0])).join()===colors.join());
  const canceledSave=actions['save-palette']();
  check('存为色板默认使用导入文件名并仅移除最后扩展名',$('modal-form').elements.name.value==='coast.v2');
  $('modal').close('cancel');await canceledSave;
  check('取消保存保持导入名称与预设禁用状态',$('palette-library').selectedOptions[0].textContent==='coast.v2.pix'&&presetButton.disabled);
  const saved=actions['save-palette']();$('modal-form').requestSubmit($('modal-submit'));await saved;
  savedPaletteId=$('palette-library').value;
  check('保存入库后选中命名色板并启用预设按钮',!!savedPaletteId&&$('palette-library').selectedOptions[0].textContent==='coast.v2'&&!presetButton.disabled);
  $('add-color').click();check('入库后修改色板需重新保存才能设为预设',presetButton.disabled);
  actions.undo();check('撤销修改恢复已入库色板的预设资格',!presetButton.disabled&&$('palette-library').value===savedPaletteId);
  actions['set-palette-preset']();
  check('设为预设保存当前内容',palettePreset().colors.join()===colors.join());
  check('自定义色板设为预设后设置按钮置灰',presetButton.disabled);
  await makeDocument();check('后续新建应用自定义预设',state().doc.palette.join()===colors.join());
  check('我的色板分组排在内置色板之前',[...$('palette-library').querySelectorAll('optgroup')].map(group=>group.label).join('|')==='我的色板|内置色板');
  changeLibrary(savedPaletteId);
  const beforeDelete=JSON.stringify(state().doc),presetBeforeDelete=localStorage.getItem(PALETTE_PRESET_KEY);
  let deleting=actions['delete-palette']();
  check('删除前弹出含色板名的二次确认且条目仍存在',$('modal').open&&$('delete-palette-confirm').textContent.includes('coast.v2')&&!!paletteById(savedPaletteId));
  $('modal').close('cancel');await deleting;
  check('取消删除保留色板及当前选择',!!paletteById(savedPaletteId)&&$('palette-library').value===savedPaletteId&&JSON.stringify(state().doc)===beforeDelete);
  deleting=actions['delete-palette']();$('modal-form').requestSubmit($('modal-submit'));await deleting;
  check('确认后才删除色板库条目',!paletteById(savedPaletteId)&&!option(savedPaletteId)&&document.querySelector('[data-action="delete-palette"]').disabled);
  check('删除库条目保留当前项目颜色与预设',JSON.stringify(state().doc)===beforeDelete&&localStorage.getItem(PALETTE_PRESET_KEY)===presetBeforeDelete);

  const before=state().documentId,bytes=encodePalette(['#11223344','#abcdef']);
  await importFile({type:'palette',name:'opened.pix',data:paletteBase64(bytes)},true);
  check('普通打开色板应用到当前项目',state().documentId===before&&state().doc.palette[0]==='#11223344');
  check('普通打开同样显示导入文件名并禁用未入库预设',$('palette-library').selectedOptions[0].textContent==='opened.pix'&&presetButton.disabled);
  const sample=createDocument(2,1);sample.palette=['#00000000','#ff0000','#00ff00'];sample.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
  convertColorMode(sample,'indexed',{palette:'current'});replaceDocument(sample,true,null,crypto.randomUUID(),true);
  await importFile({type:'palette',name:'indexed.pix',data:paletteBase64(encodePalette(['#00000000','#00ff00','#ff0000']))});
  check('索引模式导入保持像素原色',state().doc.frames[0].cels[0][0]===0xff0000ff&&state().doc.frames[0].cels[0][1]===0x00ff00ff);
  let resolveImport;
  bridge.openPalette=()=>new Promise(resolve=>{resolveImport=resolve;});
  const pending=importPalette();replaceDocument(createDocument(2,2),true,null,crypto.randomUUID(),true);
  const current=state().doc.palette.join();resolveImport({name:'late.pix',data:paletteBase64(bytes)});await pending;
  check('异步导入不会改动切换后的文档',state().doc.palette.join()===current);
  empty();await importFile({type:'palette',name:'empty-import.pix',data:paletteBase64(bytes)},true);
  check('无项目时打开色板仍显示文件名且禁止未入库预设',$('palette-library').selectedOptions[0].textContent==='empty-import.pix'&&presetButton.disabled);
  setTool('pencil');pattern();await nextFrame();
  const shape=$('brush-shape').closest('.toolbar-select-label'),host=$('pattern-controls');
  check('图案笔刷按钮紧邻笔形按钮右侧',shape.nextElementSibling===host&&!host.hidden&&host.getBoundingClientRect().left>=shape.getBoundingClientRect().right);
  host.querySelector('button').click();await nextFrame();
  const save=document.querySelector('[data-action="save-pattern-brush"]'),remove=document.querySelector('[data-action="delete-pattern-brush"]');
  check('气泡内保存与删除同一行',$('pattern-menu').matches(':popover-open')&&Math.abs(save.getBoundingClientRect().top-remove.getBoundingClientRect().top)<1&&remove.getBoundingClientRect().left>=save.getBoundingClientRect().right);
  const alignedPatternText=()=>{
   const captions=[...$('pattern-menu').querySelectorAll('.field-caption')],controls=[...$('pattern-menu').querySelectorAll('.field-control')];
   const textLeft=element=>{const range=document.createRange();range.selectNodeContents(element);return range.getBoundingClientRect().left;};
   const controlTextLeft=element=>{const style=getComputedStyle(element);return element.getBoundingClientRect().left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft);};
   return captions.every(caption=>Math.abs(textLeft(caption)-textLeft(save))<1)&&controls.every(control=>Math.abs(controlTextLeft(control)-textLeft(remove))<1);
  };
  check('图案弹窗标签与保存文字左对齐、选择框与删除文字左对齐',alignedPatternText());
  applyLocale('en');await nextFrame();check('英文图案弹窗两列文字保持对齐',alignedPatternText());applyLocale('zh');await nextFrame();
  $('pattern-menu').hidePopover();$('brush-shape').value='square';$('brush-shape').dispatchEvent(new Event('change',{bubbles:true}));await nextFrame();
  check('离开图案笔形隐藏图案按钮',host.hidden);
  const wide=createDocument(2,1,'wide-index-ui');wide.palette=Array.from({length:300},(_,i)=>'#'+i.toString(16).padStart(6,'0'));wide.colorMode='indexed';wide.transparentIndex=299;wide.frames[0].indices=[[256,299]];wide.frames[0].cels=[[0x000100ff,0]];
  replaceDocument(wide,true);setTool('pencil');await nextFrame();
  check('完整大色板显示300槽及16位索引标记',$('palette').querySelectorAll('.swatch').length===300&&$('doc-color-mode').dataset.mode==='INDEXED 16');
  $('palette').querySelector('[data-index="257"]').click();
  const viewport=$('viewport'),capture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
   const r=$('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;
   for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+z*.5,clientY:r.top+z*.5,pointerId:91,button:0}));
  }finally{viewport.setPointerCapture=capture;}
  check('实际色槽点击及笔画写入257而不回绕',state().doc.frames[0].indices[0][0]===257&&state().doc.frames[0].indices[0] instanceof Uint16Array);
  actions.undo();check('16位笔画撤销恢复256',state().doc.frames[0].indices[0][0]===256);
  actions.redo();check('16位笔画重做恢复257',state().doc.frames[0].indices[0][0]===257);
  const paletteRoundtrip=decodePalette(encodePalette(state().doc.palette));check('实际项目色板导出保留全部300槽',paletteRoundtrip.length===300&&paletteRoundtrip[299]===wide.palette[299]);
  $('hex').value='#ffbb88';$('hex').dispatchEvent(new Event('change'));$('add-color').click();
  check('超过256项后添加前景色按钮仍追加完整色槽',state().doc.palette.length===301&&state().doc.palette[300]==='#ffbb88'&&state().doc.frames[0].indices[0][0]===257);
  actions.undo();check('大色板添加颜色可撤销且保留原索引',state().doc.palette.length===300&&state().doc.frames[0].indices[0][0]===257);
  actions.redo();check('大色板添加颜色可重做',state().doc.palette.length===301&&state().doc.palette[300]==='#ffbb88');
  changeLibrary('gameboy');
  check('高索引项目切换短库色板保持有效透明槽',state().doc.palette.length===5&&state().doc.transparentIndex===0&&state().doc.frames[0].indices[0].every(index=>index<5)&&state().doc.frames[0].cels[0][1]===0);
  actions.undo();check('短库色板切换撤销恢复完整大色板与索引',state().doc.palette.length===301&&state().doc.frames[0].indices[0][0]===257);
  actions.redo();check('短库色板切换可重做',state().doc.palette.length===5&&state().doc.transparentIndex===0);
  const imported=createDocument(2,1,'opaque-palette');imported.palette=['#00000000','#ff0000','#00ff00'];imported.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];convertColorMode(imported,'indexed',{palette:'current'});replaceDocument(imported,true);
  await importFile({type:'palette',name:'opaque.pix',data:paletteBase64(encodePalette(['#ff0000','#00ff00']))});
  check('索引导入不透明色板保留首色并补透明槽',state().doc.palette.length===3&&state().doc.transparentIndex===0&&state().doc.frames[0].cels[0][0]===0xff0000ff&&state().doc.frames[0].cels[0][1]===0x00ff00ff);
  $('hex').value='#ff000080';$('hex').dispatchEvent(new Event('change'));$('background-color').value='#00ff00';$('background-color').dispatchEvent(new Event('input'));actions['swap-colors']();
  const swapCapture=viewport.setPointerCapture;viewport.setPointerCapture=()=>{};
  try{
   const r=$('canvas').getBoundingClientRect(),z=window.documentWindowAudit().zoom;
   for(const type of ['pointerdown','pointerup'])viewport.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:r.left+z*.5,clientY:r.top+z*.5,pointerId:92,button:0}));
  }finally{viewport.setPointerCapture=swapCapture;}
  check('索引前背景交换后实际笔画使用新的绿色索引',state().doc.frames[0].indices[0][0]===2&&state().doc.frames[0].cels[0][0]===0x00ff00ff);
  const dithered=createDocument(4,4,'opaque-dither');dithered.palette=['#00000000','#ff0000','#00ff0080'];dithered.frames[0].cels[0].fill(0x800000ff);replaceDocument(dithered,true);
  const changingMode=actions['color-mode'](),modeForm=$('modal-form');modeForm.elements.mode.value='indexed';modeForm.elements.mode.dispatchEvent(new Event('change'));modeForm.elements.palette.value='current';modeForm.elements.dither.checked=true;modeForm.requestSubmit($('modal-submit'));await changingMode;
  check('真实模式转换抖动不会用透明槽填充不透明像素',state().doc.frames[0].indices[0].every(index=>index===1)&&state().doc.frames[0].cels[0].every(pixel=>(pixel&255)===255));
  actions.undo();check('抖动转换撤销恢复原RGBA',!state().doc.colorMode&&state().doc.frames[0].cels[0].every(pixel=>pixel===0x800000ff));
  if(samples.inspectPattern){pattern();host.querySelector('button').click();await nextFrame();}

  return {ok:true,results};
 }catch(error){return {ok:false,results,error:error.stack};}
 finally{
  bridge.openPalette=originalOpen;bridge.save=originalSave;
  if(savedPaletteId)deletePaletteFromLibrary(savedPaletteId);
  if(preset===null)localStorage.removeItem(PALETTE_PRESET_KEY);else localStorage.setItem(PALETTE_PRESET_KEY,preset);
 }
}

import {BRIGHT24} from './builtin-palette.js';
import {encodePalette,decodePalette,importPaletteFile,paletteBase64,paletteBytes} from './palette-file.js';
import {palettePreset,PALETTE_PRESET_KEY} from './palette-library.js';
import {applyLocale} from './i18n.js';
import {convertColorMode} from './color-modes.js';

export async function paletteWorkflowSmoke(samples,api){
 const {$,actions,newDocument,replaceDocument,createDocument,importFile,importPalette,exportPalette,setTool,state,pattern,library}=api;
 const results=[],check=(name,value)=>{results.push({name,pass:!!value});if(!value)throw new Error(name);};
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const preset=localStorage.getItem(PALETTE_PRESET_KEY),bridge=window.desktop;
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
  bridge.openPalette=async()=>({name:'palette.pix',data:paletteBase64(encodePalette(colors))});
  await importPalette();
  check('导入不同色板后预设按钮启用',!presetButton.disabled);
  check('导入保留 Alpha 与重复色槽，允许撤销',state().doc.palette.join()===colors.join()&&state().history===1&&$('palette-library').value==='');
  actions.undo();check('撤销恢复 bright24 及库选择',$('palette-library').value==='bright24'&&state().doc.palette.join()===BRIGHT24.join());
  actions.redo();
  let exported;
  bridge.save=async(...args)=>{exported=args;return true;};
  await exportPalette();
  check('导出二进制 .pix 并可完整回读',exported[1]==='pix'&&exported[3]===true&&decodePalette(paletteBytes(exported[0])).join()===colors.join());
  actions['set-palette-preset']();
  check('设为预设保存当前内容',palettePreset().colors.join()===colors.join());
  check('自定义色板设为预设后设置按钮置灰',presetButton.disabled);
  await makeDocument();check('后续新建应用自定义预设',state().doc.palette.join()===colors.join());
  const before=state().documentId,bytes=encodePalette(['#11223344','#abcdef']);
  await importFile({type:'palette',name:'opened.pix',data:paletteBase64(bytes)},true);
  check('普通打开色板应用到当前项目',state().documentId===before&&state().doc.palette[0]==='#11223344');
  const sample=createDocument(2,1);sample.palette=['#00000000','#ff0000','#00ff00'];sample.frames[0].cels[0]=[0xff0000ff,0x00ff00ff];
  convertColorMode(sample,'indexed',{palette:'current'});replaceDocument(sample,true,null,crypto.randomUUID(),true);
  await importFile({type:'palette',name:'indexed.pix',data:paletteBase64(encodePalette(['#00000000','#00ff00','#ff0000']))});
  check('索引模式导入保持像素原色',state().doc.frames[0].cels[0][0]===0xff0000ff&&state().doc.frames[0].cels[0][1]===0x00ff00ff);
  let resolveImport;
  bridge.openPalette=()=>new Promise(resolve=>{resolveImport=resolve;});
  const pending=importPalette();replaceDocument(createDocument(2,2),true,null,crypto.randomUUID(),true);
  const current=state().doc.palette.join();resolveImport({name:'late.pix',data:paletteBase64(bytes)});await pending;
  check('异步导入不会改动切换后的文档',state().doc.palette.join()===current);
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
  if(samples.inspectPattern){pattern();host.querySelector('button').click();await nextFrame();}
  return {ok:true,results};
 }catch(error){return {ok:false,results,error:error.stack};}
 finally{
  bridge.openPalette=originalOpen;bridge.save=originalSave;
  if(preset===null)localStorage.removeItem(PALETTE_PRESET_KEY);else localStorage.setItem(PALETTE_PRESET_KEY,preset);
 }
}

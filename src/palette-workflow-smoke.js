import {BRIGHT24} from './builtin-palette.js';
import {encodePalette,decodePalette,importPaletteFile,paletteBase64,paletteBytes} from './palette-file.js';
import {palettePreset,PALETTE_PRESET_KEY} from './palette-library.js';
import {convertColorMode} from './color-modes.js';

export async function paletteWorkflowSmoke(samples,api){
 const {$,actions,newDocument,replaceDocument,createDocument,importFile,importPalette,exportPalette,setTool,state,pattern}=api;
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
  const png=await importPaletteFile('bright24.png',paletteBytes(samples.png));
  check('PNG 导入逐色匹配 bright24 原图顺序',png.map(color=>color.toUpperCase()).join()===BRIGHT24.join());
  const ase=await importPaletteFile('lost-century.ase',paletteBytes(samples.ase));
  check('用户 Adobe ASE 样本导入16色',ase.length===16&&ase[0]==='#d1b187');
  const colors=['#ff000080','#00ff00','#ff000080'];
  bridge.openPalette=async()=>({name:'palette.pix',data:paletteBase64(encodePalette(colors))});
  await importPalette();
  check('导入保留 Alpha 与重复色槽，允许撤销',state().doc.palette.join()===colors.join()&&state().history===1&&$('palette-library').value==='');
  actions.undo();check('撤销恢复 bright24 及库选择',$('palette-library').value==='bright24'&&state().doc.palette.join()===BRIGHT24.join());
  actions.redo();
  let exported;
  bridge.save=async(...args)=>{exported=args;return true;};
  await exportPalette();
  check('导出二进制 .pix 并可完整回读',exported[1]==='pix'&&exported[3]===true&&decodePalette(paletteBytes(exported[0])).join()===colors.join());
  actions['set-palette-preset']();
  check('设为预设保存当前内容',palettePreset().colors.join()===colors.join());
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
  return {ok:true,results};
 }catch(error){return {ok:false,results,error:error.stack};}
 finally{
  bridge.openPalette=originalOpen;bridge.save=originalSave;
  if(preset===null)localStorage.removeItem(PALETTE_PRESET_KEY);else localStorage.setItem(PALETTE_PRESET_KEY,preset);
 }
}

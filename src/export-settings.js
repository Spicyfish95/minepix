export const EXPORT_SETTINGS_KEY='pixel-studio-export-settings-v1';
export const exportFamily=mode=>['sheet','metadata','sheet-pair'].includes(mode)?'sheet':mode;
const fields={png:['format','scale'],sheet:['format','scale','columns','margin','gapX','gapY','order','trim','pack','extrude','engineFormat'],gif:['format','scale','direction','repeat','colors','alphaMode','threshold','matte'],sequence:['scale']};
export const BUILTIN_EXPORT_PRESETS=[
  {id:'plain-sheet',name:'精灵表 · 无间距',options:{mode:'sheet-pair',engineFormat:'native',trim:false,pack:false,extrude:0,scale:1,columns:8,margin:0,gapX:0,gapY:0,order:'rows'}},
  {id:'spaced-sheet',name:'精灵表 · 1 px 间距',options:{mode:'sheet-pair',engineFormat:'native',trim:false,pack:false,extrude:0,scale:1,columns:8,margin:1,gapX:1,gapY:1,order:'rows'}},
  {id:'phaser-sheet',name:'Phaser 3 · 图集与动画',options:{mode:'sheet-pair',engineFormat:'phaser',trim:true,pack:true,extrude:1,scale:1,columns:8,margin:1,gapX:1,gapY:1,order:'rows'}},
  {id:'godot-sheet',name:'Godot 4 · SpriteFrames',options:{mode:'sheet-pair',engineFormat:'godot',trim:true,pack:true,extrude:1,scale:1,columns:8,margin:1,gapX:1,gapY:1,order:'rows'}},
  {id:'loop-gif',name:'GIF · 透明循环',options:{mode:'gif',scale:1,direction:'tag',repeat:'loop',colors:256,alphaMode:'threshold',threshold:127,matte:'#ffffff'}}
];
export function defaultExportOptions(mode,frameCount){return{mode,format:mode==='gif'?'gif':'png',engineFormat:'native',trim:false,pack:false,extrude:0,scale:1,columns:Math.min(8,frameCount),margin:0,gapX:0,gapY:0,order:'rows',direction:'tag',repeat:'loop',colors:256,alphaMode:'threshold',threshold:127,matte:'#ffffff'};}
export function pickExportOptions(values){return Object.fromEntries(['mode',...fields[exportFamily(values.mode)]].filter(key=>values[key]!==undefined).map(key=>[key,values[key]]));}
export function readExportSettings(storage){try{return JSON.parse(storage.getItem(EXPORT_SETTINGS_KEY))||{last:{},presets:[]};}catch{return{last:{},presets:[]};}}
export function restoredExportOptions(state,mode,frameCount){return{...defaultExportOptions(mode,frameCount),...state.last[exportFamily(mode)],mode};}
export function rememberExportOptions(state,values){return{...state,last:{...state.last,[exportFamily(values.mode)]:pickExportOptions(values)}};}
export function saveExportPreset(state,name,values,id){
  name=name.trim();if(!name||name.length>40)throw new Error('预设名称需为 1–40 字符');
  const existing=state.presets.find(preset=>preset.name===name),preset={id:existing?.id||id,name,options:pickExportOptions(values)};
  return{...state,presets:existing?state.presets.map(item=>item.id===existing.id?preset:item):[...state.presets,preset]};
}
export function deleteExportPreset(state,id){return{...state,presets:state.presets.filter(preset=>preset.id!==id)};}

import {normalizeColor} from './colors.js';

// 色板剪贴板文本：每行一个 HEX，单色时与旧版单行格式完全一致，便于与外部工具互操作。
export function formatPaletteClipboard(colors){
  return colors.map(color=>color.toUpperCase()).join('\n');
}

// 逐行解析；空行忽略，无法解析的行计入 skipped，由调用方提示用户。
export function parsePaletteClipboard(text){
  const colors=[],lines=String(text).split(/\r?\n/);
  let skipped=0;
  for(const line of lines){
    const value=line.trim();
    if(!value)continue;
    try{colors.push(normalizeColor(value));}catch{skipped++;}
  }
  return {colors,skipped};
}

// 把一批颜色按顺序插到锚点右侧，返回新色板与被插入的颜色；不截断额外色槽。
export function insertPaletteColors(palette,anchor,colors,limit=Infinity){
  const inserted=colors.slice(0,Math.max(0,limit-palette.length));
  if(!inserted.length)return{palette:[...palette],inserted:[],dropped:colors.length};
  return{palette:[...palette.slice(0,anchor+1),...inserted,...palette.slice(anchor+1)],inserted,dropped:colors.length-inserted.length};
}

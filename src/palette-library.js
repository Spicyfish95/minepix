export const PALETTE_LIBRARY_KEY='pixpix-palette-library-v1';
export const PALETTE_LIBRARY_LIMIT=256;

// 颜色统一成 #RRGGBB 大写；无法解析返回 null，透明（alpha=00）按 #000000 处理。
const toHex=value=>{
  let raw=String(value==null?'':value).trim().replace(/^#/,'').toLowerCase();
  if(!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(raw))return null;
  if(raw.length<6)raw=[...raw].map(char=>char+char).join('');
  if(raw.length===8&&raw.slice(6)==='00')return '#000000';
  return '#'+raw.slice(0,6).toUpperCase();
};
const paletteColor=value=>toHex(value)||'#000000';
const rgbOf=color=>{const hex=paletteColor(color);return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];};
const newId=()=>'palette-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*10000).toString(36);

export const BUILTIN_PALETTES=[
  {id:'pico8',name:'PICO-8',colors:['#000000','#1D2B53','#7E2553','#008751','#AB5236','#5F574F','#C2C3C7','#FFF1E8','#FF004D','#FFA300','#FFEC27','#00E436','#29ADFF','#83769C','#FF77A8','#FFCCAA']},
  {id:'db32',name:'DawnBringer 32',colors:['#000000','#222034','#45283C','#663931','#8F563B','#DF7126','#D9A066','#EEC39A','#FBF236','#99E550','#6ABE30','#37946E','#4B692F','#524B24','#323C39','#3F3F74','#306082','#5B6EE1','#639BFF','#5FCDE4','#CBDBFC','#FFFFFF','#9BADB7','#847E87','#696A6A','#595652','#76428A','#AC3232','#D95763','#D77BBA','#8F974A','#8A6F30']},
  {id:'gray16',name:'灰阶 16',colors:['#000000','#111111','#222222','#333333','#444444','#555555','#666666','#777777','#888888','#999999','#AAAAAA','#BBBBBB','#CCCCCC','#DDDDDD','#EEEEEE','#FFFFFF']},
  {id:'gameboy',name:'Game Boy',colors:['#0F380F','#306230','#8BAC0F','#9BBC0F']},
];

function readUserPalettes(){
  try{
    const raw=JSON.parse(localStorage.getItem(PALETTE_LIBRARY_KEY)||'[]');
    return Array.isArray(raw)?raw.filter(entry=>entry&&entry.id&&entry.name&&Array.isArray(entry.colors)).map(entry=>({id:String(entry.id),name:String(entry.name),colors:entry.colors.map(paletteColor),user:true})):[];
  }catch{return [];}
}
function writeUserPalettes(list){localStorage.setItem(PALETTE_LIBRARY_KEY,JSON.stringify(list));}

export function listPaletteLibrary(){return [...BUILTIN_PALETTES,...readUserPalettes()];}

export function paletteById(id){return listPaletteLibrary().find(entry=>entry.id===id)||null;}

// 同名覆盖并沿用原 id，便于已引用的色板继续解析到同一项。
export function savePaletteToLibrary(name,colors){
  if(!Array.isArray(colors)||!colors.length)throw new Error('色板至少需要一个颜色');
  const normalized=[];
  for(const color of colors){
    const value=toHex(color);
    if(!value)throw new Error('色板颜色需为 #RRGGBB：'+color);
    if(!normalized.includes(value))normalized.push(value);
  }
  if(normalized.length>PALETTE_LIBRARY_LIMIT)throw new Error('色板最多 '+PALETTE_LIBRARY_LIMIT+' 色');
  const list=readUserPalettes(),label=String(name==null?'':name).trim()||('色板 '+(list.length+1));
  const existing=list.find(entry=>entry.name===label);
  const entry={id:existing?existing.id:newId(),name:label,colors:normalized,user:true};
  if(existing)list[list.indexOf(existing)]=entry;else list.push(entry);
  writeUserPalettes(list);
  return entry;
}

export function deletePaletteFromLibrary(id){
  if(BUILTIN_PALETTES.some(entry=>entry.id===id))return;
  const list=readUserPalettes(),next=list.filter(entry=>entry.id!==id);
  if(next.length!==list.length)writeUserPalettes(next);
}

// RGB 欧氏距离取最近色，平手时保留较小下标。
export function nearestIndex(palette,hex){
  const [r,g,b]=rgbOf(hex);
  let best=-1,bestDistance=Infinity;
  palette.forEach((color,index)=>{
    const [pr,pg,pb]=rgbOf(color),distance=(r-pr)**2+(g-pg)**2+(b-pb)**2;
    if(distance<bestDistance){bestDistance=distance;best=index;}
  });
  return best;
}

// 旧索引→旧色→新色板最近色；无法定位的下标保持原值并跳过，不参与 changed 判定。
export function remapIndices(oldPalette,newPalette,indices){
  const source=Array.from(indices),mapped=new Array(source.length),targets=new Map();
  let changed=false;
  for(let i=0;i<source.length;i++){
    const index=source[i];
    if(!Number.isInteger(index)||index<0||index>=oldPalette.length){mapped[i]=index;continue;}
    if(!targets.has(index))targets.set(index,nearestIndex(newPalette,oldPalette[index]));
    const next=targets.get(index);
    if(next<0){mapped[i]=index;continue;}
    mapped[i]=next;
    if(next!==index)changed=true;
  }
  return {indices:mapped,changed};
}

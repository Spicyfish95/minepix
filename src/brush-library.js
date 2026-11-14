const KEY='pixpix-brush-library-v1';
export const MAX_BRUSH_PATTERN=128;
const clean=pattern=>pattern&&pattern.w>0&&pattern.h>0&&pattern.w<=MAX_BRUSH_PATTERN&&pattern.h<=MAX_BRUSH_PATTERN&&pattern.data?.length===pattern.w*pattern.h?{w:pattern.w,h:pattern.h,data:[...pattern.data],...(pattern.origin?{origin:{...pattern.origin}}:{})}:null;
function persist(list){localStorage.setItem(KEY,JSON.stringify(list));}
export function listPatternBrushes(){
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(raw)?raw.filter(entry=>entry&&entry.id&&entry.name&&clean(entry.pattern)):[];}catch{return [];}
}
export function patternBrushById(id){return listPatternBrushes().find(entry=>entry.id===id)||null;}
export function savePatternBrush(name,settings){
  const pattern=clean(settings.pattern);if(!pattern)throw new Error('图案笔刷无效');
  const list=listPatternBrushes(),label=String(name||'').trim()||('笔刷 '+(list.length+1));
  const entry={id:'brush-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*10000).toString(36),name:label,size:Math.min(MAX_BRUSH_PATTERN,Math.max(1,Math.round(settings.size||Math.max(pattern.w,pattern.h)))),patternMode:['source','destination','brush'].includes(settings.patternMode)?settings.patternMode:'destination',opacity:settings.opacity??100,ink:settings.ink??'simple',pattern};
  const index=list.findIndex(item=>item.name===label);if(index<0)list.push(entry);else list[index]=entry;
  persist(list);return entry;
}
export function deletePatternBrush(id){persist(listPatternBrushes().filter(entry=>entry.id!==id));}

import {brushFootprint} from './brush-engine.js';
export const PEN_KEY='pixel-studio-pen-v1';
export const DEFAULT_PEN={mode:'size',gamma:1,minSize:.15,eraser:true,touch:'pan'};
export function validatePen(value){const p={...DEFAULT_PEN,...value};if(!['none','size','opacity','both'].includes(p.mode)||!Number.isFinite(p.gamma)||p.gamma<.25||p.gamma>4||!Number.isFinite(p.minSize)||p.minSize<.01||p.minSize>1||typeof p.eraser!=='boolean'||!['pan','draw'].includes(p.touch))throw new Error('数位笔压感或触控设置无效');return p;}
export function loadPen(storage){return validatePen(JSON.parse(storage.getItem(PEN_KEY)||'{}'));}
export function deviceTool(pointer,tool,prefs){if(pointer?.pointerType==='touch'&&prefs.touch==='pan')return'hand';if(pointer?.pointerType==='pen'&&prefs.eraser&&(pointer.button===5||pointer.buttons&32))return'eraser';return tool;}
export function pressureOptions(options,type,pressure,prefs,cache=null){
 if(type!=='pen'||prefs.mode==='none')return options;
 cache=cache||new Map();
 const amount=Math.max(0,Math.min(1,pressure))**prefs.gamma,size=['size','both'].includes(prefs.mode)?Math.max(1,Math.round(options.size*(prefs.minSize+(1-prefs.minSize)*amount))):options.size;
 if(!cache.has(size))cache.set(size,brushFootprint({...options,size}));
 return{...options,size,footprint:cache.get(size),opacity:options.opacity*(['opacity','both'].includes(prefs.mode)?amount:1)};
}

export const APP_SETTINGS_KEY='pixel-studio-application-v1';
export const PROJECT_SAVE_FORMATS=['pix','aseprite','ase'];
export const IMAGE_SAVE_FORMATS=['png','webp','jpg','jpeg','svg','ico','gif'];
export const SAVE_FORMATS=[...PROJECT_SAVE_FORMATS,...IMAGE_SAVE_FORMATS];
export function readSaveFormat(storage){const value=JSON.parse(storage.getItem(APP_SETTINGS_KEY)||'{}').saveFormat;return SAVE_FORMATS.includes(value)?value:'pix';}
export function rememberSaveFormat(storage,path){
 const format=String(path||'').split('.').at(-1).toLowerCase();if(!SAVE_FORMATS.includes(format))return;
 const settings=JSON.parse(storage.getItem(APP_SETTINGS_KEY)||'{}');storage.setItem(APP_SETTINGS_KEY,JSON.stringify({...settings,saveFormat:format}));
}

export const APP_SETTINGS_KEY='pixel-studio-application-v1';
export const SAVE_FORMATS=['pix','aseprite','ase'];
export function readSaveFormat(storage){const value=JSON.parse(storage.getItem(APP_SETTINGS_KEY)||'{}').saveFormat;return SAVE_FORMATS.includes(value)?value:'pix';}
export function rememberSaveFormat(storage,path){
 const format=String(path||'').split('.').at(-1).toLowerCase();if(!SAVE_FORMATS.includes(format))return;
 const settings=JSON.parse(storage.getItem(APP_SETTINGS_KEY)||'{}');storage.setItem(APP_SETTINGS_KEY,JSON.stringify({...settings,saveFormat:format}));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_SETTINGS_KEY,SAVE_FORMATS,readSaveFormat,rememberSaveFormat} from '../src/save-format.js';
const storage=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('initial default is PIX and unsupported stored format falls back to PIX',()=>{const local=storage();assert.equal(readSaveFormat(local),'pix');local.setItem(APP_SETTINGS_KEY,'{"saveFormat":"unsupported"}');assert.equal(readSaveFormat(local),'pix');});
test('successful file type becomes next default while retaining other preferences',()=>{const local=storage();local.setItem(APP_SETTINGS_KEY,'{"language":"en","width":64}');for(const format of [...SAVE_FORMATS,'pix']){rememberSaveFormat(local,'C:/sprite.'+format.toUpperCase());assert.equal(readSaveFormat(local),format);assert.equal(JSON.parse(local.getItem(APP_SETTINGS_KEY)).width,64);}rememberSaveFormat(local,null);assert.equal(readSaveFormat(local),'pix');});

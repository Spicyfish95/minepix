import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentSaver} from '../src/document-save.js';
import {SAVE_FORMATS,IMAGE_SAVE_FORMATS} from '../src/save-format.js';
function harness(format='pix'){
 const calls=[],state={destination:{filePath:'C:/output.'+format,format},format};
 const save=createDocumentSaver({getDefaultFormat:()=>state.format,choosePath:async value=>{calls.push(['choose',value]);return state.destination;},savePacked:async(...args)=>{calls.push(['packed',...args]);return{filePath:args[2]};},encodeImage:(doc,frame,format)=>{calls.push(['encode',doc,frame,format]);return{data:format,binary:format!=='svg'};},saveImage:async(...args)=>{calls.push(['image',...args]);return{filePath:args[0],singleImage:true};}});
 return{save,calls,state};
}
for(const format of SAVE_FORMATS)test(format+' selects the correct saving route',async()=>{
 const {save,calls}=harness(format),doc={name:'snapshot'};const result=await save(doc,'snapshot',true,'C:/previous.pix',3);
 assert.equal(calls[0][1].defaultFormat,format);assert.equal(calls[0][1].saveAs,true);assert.equal(calls[0][1].filePath,'C:/previous.pix');
 if(IMAGE_SAVE_FORMATS.includes(format)){assert.equal(calls[1][0],'encode');assert.equal(calls[1][2],3);assert.equal(calls[1][3],format);assert.equal(calls[2][0],'image');assert.equal(result.singleImage,true);}
 else{assert.equal(calls[1][0],'packed');assert.equal(calls[1][3],'C:/output.'+format);}
});
test('cancelled path selection does not pack encode or write anything',async()=>{const {save,calls,state}=harness();state.destination=null;assert.equal(await save({},'name'),null);assert.equal(calls.length,1);});
test('actual chosen extension controls encoding instead of default type',async()=>{const {save,calls,state}=harness('pix');state.destination={filePath:'C:/chosen.JPEG',format:'jpeg'};await save({},'name',true);assert.equal(calls[1][3],'jpeg');});
test('encoding failure prevents write',async()=>{let written=false;const save=createDocumentSaver({getDefaultFormat:()=> 'ico',choosePath:async()=>({filePath:'bad.ico',format:'ico'}),savePacked:()=>{},encodeImage:()=>{throw Error('ICO size');},saveImage:()=>{written=true;}});await assert.rejects(save({},'name'),/ICO size/);assert.equal(written,false);});

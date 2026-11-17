import test from 'node:test';
import assert from 'node:assert/strict';
import {createExportClient} from '../src/export-client.js';
import {unpackBinaryPacket} from '../src/binary-packet.js';
import {packProjectSave} from '../src/project-transfer.js';
import {createDocument} from '../src/model.js';
import {canvasBytes,encodeBmp,encodeIco} from '../src/export-formats.js';
const fixture=()=>{const calls=[];return{calls,client:createExportClient({invoke:async bytes=>{const packet=unpackBinaryPacket(bytes);calls.push(packet);return{filePath:'out'};},packProject:async(...args)=>packProjectSave(...args)})};};
test('ASE export sends project pixels as raw packed data',async()=>{const {calls,client}=fixture();await client.aseprite(createDocument(2,1),{directory:'out'});assert.equal(calls[0].metadata.args[0],null);assert.equal(new TextDecoder().decode(calls[0].payloads[0].subarray(0,8)),'MPXSAVE1');});
test('animation pixels and sequence PNGs are binary blocks, not numeric JSON or Base64',async()=>{
 const {calls,client}=fixture(),rgba=Uint8ClampedArray.of(255,0,0,255);await client.animation({frames:[{duration:100,rgba},{duration:80,png:'AQID'}]});
 assert.equal(calls[0].metadata.args[0].frames[0].rgba,undefined);assert.equal(calls[0].metadata.args[0].frames[1].png,undefined);
 assert.deepEqual([...calls[0].payloads[0]],[255,0,0,255]);assert.deepEqual([...calls[0].payloads[1]],[1,2,3]);assert.equal(rgba[0],255);
});
test('sheet and metadata retain structure and move image bytes into a payload',async()=>{const {calls,client}=fixture();for(const mode of[false,true])await client.sheet({png:'AQID',metadata:{frames:[]}},mode);assert.equal(calls[0].metadata.method,'exportSheet');assert.equal(calls[1].metadata.method,'exportSheetMetadata');assert.equal(calls[0].metadata.args[0].png,undefined);assert.deepEqual([...calls[0].payloads[0]],[1,2,3]);});
test('single image, text output and image saving all use raw byte commands',async()=>{const {calls,client}=fixture();await client.save('AQID','png','a',true);await client.save('<svg/>','svg','a',false);await client.image({data:'AQID',format:'png',filePath:'out.png',binary:true});assert.deepEqual([...calls[0].payloads[0]],[1,2,3]);assert.equal(new TextDecoder().decode(calls[1].payloads[0]),'<svg/>');assert.equal(calls[2].metadata.args[0].data,undefined);});
test('canvas encoding returns blob bytes without invoking a data URL',async()=>{
 const canvas={toBlob:callback=>callback(new Blob([Uint8Array.of(1,2,3)])),toDataURL:()=>assert.fail('Base64 intermediate')};assert.deepEqual([...await canvasBytes(canvas)],[1,2,3]);
 await assert.rejects(canvasBytes({toBlob:callback=>callback(null)}),/编码失败/);
});
test('BMP and ICO raw encoders match existing format bytes',()=>{
 const image={width:1,height:1,data:Uint8ClampedArray.of(255,0,0,128)};
 assert.deepEqual(encodeBmp(image,true),Uint8Array.from(Buffer.from(encodeBmp(image),'base64')));
 assert.deepEqual(encodeIco(Uint8Array.of(1,2,3),1,1,true),Uint8Array.from(Buffer.from(encodeIco('AQID',1,1),'base64')));
});

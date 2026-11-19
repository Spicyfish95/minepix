import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createDocument,validateDocument} from '../src/model.js';
import {convertColorMode} from '../src/color-modes.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
for(const mode of ['rgba','indexed','grayscale'])for(const filePath of ['C:/sprite.ase',null])test(`${mode} ASE opens directly with correct save point: ${filePath||'unsaved import'}`,async()=>{
 const doc=createDocument(2,1,'ase');if(mode!=='rgba')convertColorMode(doc,mode,{palette:'current'});
 let opened,message;
 const context=vm.createContext({validateDocument,crypto,modal:()=>{throw new Error('Unexpected modal');},replaceDocument:(...args)=>{opened=args;},message:value=>{message=value;}});
 vm.runInContext(source.slice(source.indexOf('async function importFile('),source.indexOf('async function saveData(')),context);
 await context.importFile({type:'aseprite',doc,warnings:['unsupported metadata'],filePath},true);
 assert.deepEqual(opened[0],validateDocument(doc));assert.equal(opened[1],!!filePath);assert.equal(opened[2],filePath);assert.equal(opened[4],true);assert.ok(message.includes('unsupported metadata'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_EXPORT_KEY,projectDirectory,lastProjectExport,defaultExportDirectory,rememberProjectExport} from '../src/project-export.js';
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
test('first export defaults to project directory and unsaved uses last successful directory',()=>{
 const s=storage();assert.equal(projectDirectory('C:\\art\\work.pix'),'C:\\art\\');assert.equal(projectDirectory('/art/work.pix'),'/art/');
 assert.equal(defaultExportDirectory(s,'C:\\art\\work.pix','a'),'C:\\art\\');assert.equal(defaultExportDirectory(s,null,'b'),'');
 rememberProjectExport(s,null,'a',{mode:'png'},{directory:'D:\\out',filePath:'D:\\out\\work.png'});
 assert.equal(defaultExportDirectory(s,null,'b'),'D:\\out');assert.equal(defaultExportDirectory(s,'/art/work.pix','b'),'/art/');
});
test('successful export remembers exact configuration and destination per project across restart and save-as',()=>{
 const s=storage(),options={mode:'sheet-pair',scale:2,selectedFrames:[0,2],layerIds:['layer-1']},result={directory:'/out',folder:'/out/work'};
 rememberProjectExport(s,'/art/a.pix','a',options,result);options.scale=7;
 assert.equal(lastProjectExport(s,'/art/a.pix','new-session').options.scale,2);
 assert.equal(lastProjectExport(s,'/art/renamed.pix','a').destination.folder,'/out/work');
 assert.equal(lastProjectExport(s,'/art/b.pix','b'),null);
 assert.equal(defaultExportDirectory(s,'/art/a.pix','a'),'/out');
 rememberProjectExport(s,'/art/b.pix','b',{mode:'png'},{directory:'/other',filePath:'/other/b.png'});
 assert.equal(lastProjectExport(s,'/art/a.pix','a').options.mode,'sheet-pair');
});
test('cancellation and legacy booleans do not enable quick export or overwrite successful state',()=>{
 const s=storage();rememberProjectExport(s,null,'a',{},null);rememberProjectExport(s,null,'a',{},true);assert.equal(lastProjectExport(s,null,'a'),null);
 rememberProjectExport(s,null,'a',{mode:'metadata'},{directory:'/out',filePath:'/out/work.json',imagePath:'/out/work.png'});
 const before=s.getItem(PROJECT_EXPORT_KEY);rememberProjectExport(s,null,'a',{mode:'png'},false);assert.equal(s.getItem(PROJECT_EXPORT_KEY),before);
 assert.equal(lastProjectExport(s,null,'a').destination.imagePath,'/out/work.png');
});
test('damaged storage falls back without blocking export',()=>{const s={getItem:()=>'{bad'};assert.equal(lastProjectExport(s,null,'a'),null);assert.equal(defaultExportDirectory(s,'/art/a.pix','a'),'/art/');});

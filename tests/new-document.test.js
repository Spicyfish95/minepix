import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createDocument} from '../src/model.js';
import {APP_SETTINGS_KEY} from '../src/save-format.js';
import {DEFAULT_CANVAS_BACKGROUND,validateCanvasBackground} from '../src/canvas-background.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const implementation=source.slice(source.indexOf('async function newDocument('),source.indexOf('function replaceDocument('));
function editor(clipboard=null,answer=null){
 const dialogs=[],created=[],preferences={width:96,height:48,duration:80,canvasBackground:{size:5,color1:'#112233',color2:'#445566'}},serialized=JSON.stringify(preferences);
 const context=vm.createContext({clipboard,APP_SETTINGS_KEY,DEFAULT_APPLICATION:{width:32,height:32,duration:100},DEFAULT_CANVAS_BACKGROUND,validateCanvasBackground,createDocument,crypto,palettePreset:()=>({colors:['#00000000','#123456']}),localStorage:{getItem:key=>{assert.equal(key,APP_SETTINGS_KEY);return serialized;},setItem:()=>assert.fail('new dialog must not change preferences')},modal:async(title,html)=>{dialogs.push({title,html});return answer;},replaceDocument:(...args)=>created.push(args)});
 vm.runInContext(implementation,context);
 const dimensions=()=>Object.fromEntries(['width','height'].map(name=>[name,Number(dialogs.at(-1).html.match(new RegExp('name="'+name+'"[^>]*value="(\\d+)"'))[1])]));
 return{context,dialogs,created,dimensions,preferences};
}
test('no copied pixels keeps the configured new-document dimensions',async()=>{const {context,dimensions}=editor();await context.newDocument();assert.deepEqual(dimensions(),{width:96,height:48});});
test('new dialog accepts dimensions above the former pixel budget and drops its warning',async()=>{
 const state=editor({w:8192,h:4097});await state.context.newDocument();assert.deepEqual(state.dimensions(),{width:8192,height:4097});
 assert.ok(!state.dialogs[0].html.includes('32M'));assert.ok(!/name="(?:width|height)"[^>]*max=/.test(state.dialogs[0].html));
});
test('clipboard rectangle dimensions override preferences without copying source coordinates',async()=>{const clip={x:120,y:90,w:13,h:7,data:[]},state=editor(clip);await state.context.newDocument();assert.deepEqual(state.dimensions(),{width:13,height:7});assert.equal(state.context.clipboard,clip);});
test('transparent padding and selection mask keep the full clipboard bounding rectangle',async()=>{const state=editor({x:4,y:8,w:3,h:2,data:[0,0,0,0,0,0xff0000ff],mask:new Uint8Array([0,0,0,0,0,1])});await state.context.newDocument();assert.deepEqual(state.dimensions(),{width:3,height:2});});
test('manual dimensions create a blank project and preserve palette duration and background defaults',async()=>{
 const clip={w:3,h:2,data:[0xff0000ff]},state=editor(clip,{width:'7',height:'9',name:'manual'});await state.context.newDocument();const [doc,saved,path,id,newTab]=state.created[0];
 assert.equal(doc.width,7);assert.equal(doc.height,9);assert.ok(doc.frames[0].cels[0].every(pixel=>pixel===0));assert.equal(doc.frames[0].duration,80);assert.deepEqual(doc.canvasBackground,state.preferences.canvasBackground);assert.deepEqual(doc.palette,['#00000000','#123456']);assert.equal(saved,false);assert.equal(path,null);assert.equal(typeof id,'string');assert.equal(newTab,true);assert.equal(state.context.clipboard,clip);
});
test('cancelling new keeps clipboard intact and creates no document',async()=>{const clip={w:4,h:5},state=editor(clip);await state.context.newDocument();assert.equal(state.created.length,0);assert.equal(state.context.clipboard,clip);});
test('clipboard dimensions do not become persistent defaults',async()=>{const state=editor({w:3,h:2});await state.context.newDocument();state.context.clipboard=null;await state.context.newDocument();assert.deepEqual(state.dimensions(),{width:96,height:48});});

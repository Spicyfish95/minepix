import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDocument,composite,colorValue} from '../src/model.js';
import {BLEND_MODES} from '../src/compositor.js';
import {readAseprite} from '../tests/helpers/aseprite.js';

const run=promisify(execFile),root=path.resolve('artifacts/shell-thumbnail',String(Date.now()));await mkdir(root,{recursive:true});
const tool=path.resolve('src-tauri/target/debug/examples/project-tool.exe'),render=path.resolve('src-tauri/thumbnailer/target/debug/examples/render.exe'),probe=path.resolve('src-tauri/thumbnailer/target/debug/examples/probe.exe'),dll=path.resolve('src-tauri/thumbnailer/target/debug/minepix_thumbnailer.dll');
const results=[],check=(name,value)=>{assert.ok(value,name);results.push({name,pass:true});};
let seed=55;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
async function compare(file,doc,size,label){
 const out=path.join(root,'output.rgba'),{stdout}=await run(render,[file,String(size),out],{windowsHide:true});
 const actual=await readFile(out),{width,height}=JSON.parse(stdout),full=composite(doc,0),expected=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const from=(Math.floor(y*doc.height/height)*doc.width+Math.floor(x*doc.width/width))*4;
  expected.set(full.subarray(from,from+4),(y*width+x)*4);
 }
 assert.deepEqual(actual,expected,label);check(label+' matches editor composite pixel for pixel',true);
 if(size===32){
  const native=path.join(root,'output.bgra');await run(probe,[dll,file,String(size),native,'3'],{windowsHide:true});
  const bgra=await readFile(native),premult=Buffer.alloc(expected.length);
  for(let i=0;i<expected.length;i+=4){const a=expected[i+3];premult.set([Math.floor((expected[i+2]*a+127)/255),Math.floor((expected[i+1]*a+127)/255),Math.floor((expected[i]*a+127)/255),a],i);}
  assert.deepEqual(bgra,premult);check(label+' native COM repeats and releases every object',true);
 }
}
async function pix(doc,name,size=32){const json=path.join(root,name+'.json'),file=path.join(root,name+'.pix');await writeFile(json,JSON.stringify(doc));await run(tool,['encode',json,file],{windowsHide:true});await compare(file,doc,size,name);return file;}
try{
 for(const [mode]of BLEND_MODES){
  const doc=createDocument(7,5,mode);doc.frames[0].cels[0]=Array.from({length:35},random);
  doc.layers.push({id:2,name:'cropped',visible:true,locked:false,opacity:63,blendMode:mode});doc.frames[0].cels.push(Array.from({length:12},random));
  doc.frames[0].celProperties={2:{x:-1,y:2,width:3,height:4,opacity:71}};
  await pix(doc,mode);
 }
 for(const passThrough of [false,true]){
  const doc=createDocument(4,3,'groups');doc.frames[0].cels[0]=Array(12).fill(0x11335580);doc.layers.push({id:2,name:'child',parentId:3,visible:true,opacity:68},{id:3,name:'group',type:'group',visible:true,opacity:41,blendMode:'overlay',passThrough});doc.frames[0].cels.push(Array(12).fill(0xdd2299a0),Array(12).fill(0));
  await pix(doc,'group-'+passThrough,7);doc.layers[2].visible=false;await pix(doc,'hidden-group-'+passThrough,7);
 }
 const doc=createDocument(4,2,'indexed');doc.palette=Array.from({length:300},(_,i)=>'#'+(random()>>>0).toString(16).padStart(8,'0'));doc.colorMode='indexed';doc.transparentIndex=299;doc.requiredFeatures=['color-modes','indexed-16'];doc.frames[0].indices=[[256,299,1,257,255,0,298,256]];doc.frames[0].cels=[doc.frames[0].indices[0].map(index=>index===299?0:colorValue(doc.palette[index]))];
 const indexedFile=await pix(doc,'wide-index');
 const bg=createDocument(5,3,'background');bg.layers[0].type='background';bg.layers[0].clearColor=0x224466ff;bg.frames[0].cels[0]=[0xff000080];bg.frames[0].celProperties={1:{x:2,y:1,width:1,height:1,opacity:100}};await pix(bg,'background');
 const reference=createDocument(2,1,'reference');reference.frames[0].cels[0]=[0x123456ff,0];reference.layers.push({id:2,name:'external',visible:true,opacity:100,type:'reference',reference:{path:'C:/missing-reference.png',width:1,height:1,scale:1,x:0,y:0}});reference.frames[0].cels.push([0,0]);await pix(reference,'exclude-reference');
 for(const name of ['rgba-linked.aseprite','grayscale-linked.aseprite','indexed-linked.aseprite','grass.ase']){
  const file=path.resolve('tests/fixtures',name),bytes=await readFile(file),{doc}=await readAseprite(bytes);await compare(file,doc,32,name);
 }
 if(process.argv.includes('--workspace')){
  const decorates=path.resolve('../decorates.ase'),bytes=await readFile(decorates),{doc:scene}=await readAseprite(bytes);await compare(decorates,scene,128,'workspace decorates');assert.deepEqual(await readFile(decorates),bytes);
 }
 for(const size of ['0','1025']){
  await assert.rejects(run(render,[indexedFile,size,path.join(root,'invalid')],{windowsHide:true}));
  await assert.rejects(run(probe,[dll,indexedFile,size,path.join(root,'invalid'),'1'],{windowsHide:true}));check('invalid requested size '+size+' rejected by renderer and COM',true);
 }
 for(const [label,change]of [
  ['unknown-feature',doc=>doc.requiredFeatures=['future-filter']],
  ['cyclic-group',doc=>{doc.layers[0].type='group';doc.layers[0].parentId=1;}],
  ['bad-pixels',doc=>doc.frames[0].cels[0]=[0]],
  ['missing-parent',doc=>doc.layers[0].parentId=99],
 ]){
  const doc=createDocument(2,2,label);change(doc);const json=path.join(root,label+'.json'),file=path.join(root,label+'.pix');await writeFile(json,JSON.stringify(doc));await run(tool,['encode',json,file],{windowsHide:true});
  await assert.rejects(run(probe,[dll,file,'32',path.join(root,'invalid'),'1'],{windowsHide:true}));check(label+' is rejected safely by native provider',true);
 }
 const broken=path.join(root,'broken.ase');await writeFile(broken,'not an ASE');await assert.rejects(run(probe,[dll,broken,'32',path.join(root,'bad.bgra'),'1'],{windowsHide:true}));check('native provider rejects invalid files without an editor process',true);
 const thin=createDocument(1,2000,'thin');thin.frames[0].cels[0].fill(0xff0000ff);await pix(thin,'thin',32);
 // First-frame ASE preview must not parse damaged animation pixels after the first frame.
 const linked=await readFile('tests/fixtures/rgba-linked.aseprite'),corrupt=Buffer.from(linked);corrupt[corrupt.length-1]^=255;
 const later=path.join(root,'later-frame.ase');await writeFile(later,corrupt);await compare(later,(await readAseprite(linked)).doc,32,'first-frame only');
 await writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,results},null,2)+'\n');console.log(JSON.stringify({ok:true,passed:results.length,root,indexedFile}));
}catch(error){await writeFile(path.join(root,'failure.json'),JSON.stringify({ok:false,results,error:error.stack},null,2)+'\n');throw error;}

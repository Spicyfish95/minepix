import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from '../src/model.js';
import {DocumentStore} from '../src/document-manager.js';
import {addReference,moveReference,resizeReference} from '../src/reference-board.js';
import {encodeReference} from '../src/layer-types.js';
import {snapshotProject} from '../src/project-save-client.js';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function editor(){
 const documentTabs=new DocumentStore(),doc=createDocument(2,2,'A');
 const state={documentId:'a',doc,boardRevision:0,savedBoardRevision:0,dirty:false,filePath:'a.pix',saved:0,historyState:{revision:0}};
 documentTabs.add(state);
 const context={...state,documentTabs,projectSaves:new Map(),snapshotProject,busy:false,gesture:null,shapeSession:null,space:false,tool:'pencil',modifiers:{alt:false},history:{revision:0},crypto,
  encodeReference,addReference,moveReference,resizeReference,stop:()=>{},message:()=>{},render:()=>{},renderDocumentTabs:()=>{},renderReferenceBoard:()=>{},boardMessage:()=>{},scheduleRecovery:()=>{},flushRecovery:async()=>{},showError:()=>{},boardPanel:()=>({querySelector:()=>({})}),boardView:()=>({zoom:1}),boardApplyView:()=>{}};
 context.setBusy=value=>context.busy=value;
 context.setDirty=value=>context.dirty=value;
 context.boardDirty=()=>context.boardRevision!==context.savedBoardRevision;
 context.changed=()=>context.setDirty(context.history.revision!==context.saved||context.boardDirty());
 context.boardItems=()=>context.doc.references||[];
 context.window={desktop:{setDirty:()=>{},activateDocument:()=>{}}};
 vm.createContext(context);
 vm.runInContext(source.match(/^function boardChanged\(.*$/m)[0]+'\n'+section('async function saveProject(','// ── 参考面板')+'\n'+section('function startBoardPointer(','// ── 地形预览')+'\n'+section('async function addBoardImage(','async function referenceBoardImport('),context);
 return context;
}
test('保存期间拖动参考图后保留未保存标记，再保存才更新保存点',async()=>{
 const context=editor(),pending=deferred();let persisted;
 addReference(context.doc,{...encodeReference(1,1,new Uint8Array([255,0,0,255])),id:'ref',name:'ref'});
 context.window.desktop.saveProject=async doc=>{persisted=structuredClone(doc);return pending.promise;};
 const saving=context.saveProject();
 const node={setPointerCapture:()=>{},hasPointerCapture:()=>false,focus:()=>{}};
 context.startBoardPointer({button:0,currentTarget:node,pointerId:1,clientX:0,clientY:0,preventDefault:()=>{},stopPropagation:()=>{}},context.doc.references[0],'move');
 node.onpointermove({pointerId:1,clientX:100,clientY:50});node.onpointerup();
 pending.resolve({filePath:'a.pix',name:'A'});assert.equal(await saving,true);
 assert.equal(persisted.references[0].x,0);assert.equal(context.doc.references[0].x,100);
 assert.equal(context.dirty,true);assert.equal(context.savedBoardRevision,0);
 context.window.desktop.saveProject=async doc=>{persisted=structuredClone(doc);return{filePath:'a.pix',name:'A'};};
 assert.equal(await context.saveProject(),true);assert.equal(context.dirty,false);assert.equal(persisted.references[0].x,100);
});
test('保存快照期间不设置busy，后续像素编辑不会写入旧快照或清除脏标记',async()=>{
 const context=editor(),pending=deferred();let snapshot,path;
 context.window.desktop.saveProject=async(value,_name,_saveAs,targetPath)=>{snapshot=value;path=targetPath;return pending.promise;};
 const saving=context.saveProject();assert.equal(context.busy,false);assert.equal(path,'a.pix');
 context.doc.frames[0].cels[0][0]=0xff0000ff;context.history.revision=1;context.changed();
 assert.equal(snapshot.frames[0].cels[0][0],0);pending.resolve({filePath:'a.pix',name:'A'});assert.equal(await saving,true);
 assert.equal(context.saved,0);assert.equal(context.dirty,true);assert.equal(context.doc.frames[0].cels[0][0],0xff0000ff);
});
test('同一文档保存去重，完成后可再次保存新版本',async()=>{
 const context=editor(),pending=deferred();let calls=0;context.window.desktop.saveProject=async()=>{calls++;return pending.promise;};
 const first=context.saveProject(),second=context.saveProject(true);assert.equal(calls,1);pending.resolve({filePath:'a.pix',name:'A'});assert.equal(await first,true);assert.equal(await second,true);
 context.window.desktop.saveProject=async()=>{calls++;return{filePath:'a.pix',name:'A'};};await context.saveProject();assert.equal(calls,2);
});
for(const closed of [false,true])test('保存完成只更新发起文档，不修改前台标签'+(closed?'（原标签已关闭）':''),async()=>{
 const context=editor(),pending=deferred();context.window.desktop.saveProject=async()=>pending.promise;const saving=context.saveProject();switchToB(context);
 if(closed)context.documentTabs.remove('a');else{const original=context.documentTabs.get('a');original.doc.frames[0].cels[0][0]=17;original.historyState.revision=1;original.dirty=true;}
 const foreground=context.doc;pending.resolve({filePath:'renamed.pix',name:'renamed'});assert.equal(await saving,true);
 assert.equal(context.doc,foreground);assert.equal(context.doc.name,'B');assert.equal(context.dirty,false);assert.equal(context.saved,0);
 if(!closed){const original=context.documentTabs.get('a');assert.equal(original.filePath,'renamed.pix');assert.equal(original.doc.name,'renamed');assert.equal(original.dirty,true);assert.equal(original.doc.frames[0].cels[0][0],17);}
});
for(const outcome of ['cancel','error'])test(`保存${outcome}不改变原保存点`,async()=>{
 const context=editor();context.boardRevision=2;context.dirty=true;
 context.window.desktop.saveProject=async()=>{if(outcome==='error')throw new Error('磁盘写入失败');return null;};
 assert.equal(await context.saveProject(),false);assert.equal(context.savedBoardRevision,0);assert.equal(context.dirty,true);assert.equal(context.busy,false);
});
function switchToB(context){
 context.documentTabs.save({documentId:'a',doc:context.doc,boardRevision:context.boardRevision,savedBoardRevision:0,dirty:context.dirty,saved:0,historyState:{revision:0},filePath:'a.pix'});
 context.doc=createDocument(2,2,'B');context.documentId='b';context.filePath='b.pix';context.boardRevision=0;context.dirty=false;
 context.documentTabs.add({documentId:'b',doc:context.doc,boardRevision:0,savedBoardRevision:0,dirty:false,saved:0,historyState:{revision:0},filePath:'b.pix'});
}
test('参考图解码期间切换标签后仍加入发起文档并标脏',async()=>{
 const context=editor(),pending=deferred();
 context.decodeBoardPng=()=>pending.promise;
 const importing=context.addBoardImage('','ref','image/png','a');switchToB(context);
 pending.resolve({width:1,height:1,data:new Uint8Array([255,0,0,255])});await importing;
 const original=context.documentTabs.get('a');
 assert.equal(original.doc.references.length,1);assert.equal(original.dirty,true);assert.equal(original.boardRevision,1);
 assert.equal(context.doc.references,undefined);assert.equal(context.dirty,false);assert.equal(context.boardRevision,0);
});
test('参考图解码期间关闭原文档时停止导入，不写入其他项目',async()=>{
 const context=editor(),pending=deferred();context.decodeBoardPng=()=>pending.promise;
 const importing=context.addBoardImage('','ref','image/png','a');switchToB(context);context.documentTabs.remove('a');
 pending.resolve({width:1,height:1,data:new Uint8Array([255,0,0,255])});
 await assert.rejects(importing,/关闭/);assert.equal(context.doc.references,undefined);
});
test('批量参考图在多次解码间切换标签仍全部加入同一原文档',async()=>{
 const context=editor(),pending=deferred();let decoded=0;
 context.decodeBoardPng=async()=>{if(++decoded===2)await pending.promise;return{width:1,height:1,data:new Uint8Array([255,0,0,255])};};
 const importing=context.importBoardImages([{data:'',name:'first'},{data:'',name:'second'}],'a');
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 switchToB(context);pending.resolve();await importing;
 assert.equal(context.documentTabs.get('a').doc.references.length,2);assert.equal(context.doc.references,undefined);
});
test('文件选择期间切换标签仍向原文档导入',async()=>{
 const context=editor(),pending=deferred();context.window.desktop.open=()=>pending.promise;
 context.decodeBoardPng=async()=>({width:1,height:1,data:new Uint8Array([255,0,0,255])});
 vm.runInContext(section('async function referenceBoardImport(','async function dropReferenceFiles('),context);
 const importing=context.referenceBoardImport();switchToB(context);
 pending.resolve([{data:'',name:'picked'}]);await importing;
 assert.equal(context.documentTabs.get('a').doc.references.length,1);assert.equal(context.doc.references,undefined);
});
test('拖入文件读取期间切换标签仍向原文档导入',async()=>{
 const context=editor();let reader;
 context.boardPanel=()=>({ownerDocument:{defaultView:{FileReader:class{constructor(){reader=this;}readAsDataURL(){}}}}});
 context.decodeBoardPng=async()=>({width:1,height:1,data:new Uint8Array([255,0,0,255])});
 vm.runInContext(section('async function dropReferenceFiles(','function fitBoardContent('),context);
 const importing=context.dropReferenceFiles([{name:'dropped',type:'image/png'}]);switchToB(context);
 reader.result='data:image/png;base64,';reader.onload();await importing;
 assert.equal(context.documentTabs.get('a').doc.references.length,1);assert.equal(context.doc.references,undefined);
});
test('后台文档恢复写入使用其自身路径和内容，不清除前台恢复定时器',async()=>{
 const context=editor();switchToB(context);const state=context.documentTabs.get('a');state.dirty=true;
 let record,cleared=false;context.window.desktop.saveRecovery=async value=>{record=value;};
 context.clearTimeout=()=>{cleared=true;};
 vm.runInContext(section('async function flushRecovery(','window.addEventListener(\'beforeunload\''),context);
 await context.flushRecovery(state);
 assert.equal(record.id,'a');assert.equal(record.filePath,'a.pix');assert.equal(JSON.parse(record.data).name,'A');assert.equal(cleared,false);
});
test('最近文件首页按选中的路径请求，不随其他记录的顺序变化',async()=>{
 const context={welcomeEntries:[{path:'a.pix'},{path:'b.pix'}],window:{desktop:{openRecent:async path=>{assert.equal(path,'b.pix');return{filePath:path};}}},importFile:async file=>assert.equal(file.filePath,'b.pix')};
 vm.createContext(context);vm.runInContext(section('async function openWelcomeRecent(','function renderEmptyDocument('),context);
 await context.openWelcomeRecent('b.pix');
});
test('最近文件对话框提交列表快照中的路径',async()=>{
 const context={window:{desktop:{recentFiles:async()=>[{path:'a.pix'},{path:'b.pix'}],openRecent:async path=>{assert.equal(path,'b.pix');return{filePath:path};}}},modal:async()=>({index:'1'}),importFile:async file=>assert.equal(file.filePath,'b.pix')};
 vm.createContext(context);vm.runInContext(section('async function recentDialog(','async function newDocument('),context);
 await context.recentDialog();
});
function tabEditor(){
 const documentTabs=new DocumentStore();
 documentTabs.add({documentId:'b',doc:{name:'B'},dirty:true});
 documentTabs.add({documentId:'a',doc:{name:'A'},dirty:false});
 const confirmations=[],context={...documentTabs.get('a'),documentTabs,projectSaves:new Map(),filePath:null,busy:false,gesture:null,shapeSession:null,celGesture:null,closedDocuments:[],
  $:()=>({open:false}),message:()=>{},flushRecovery:async()=>{},captureDocumentState:()=>({documentId:context.documentId,doc:context.doc,dirty:context.dirty}),
  restoreDocumentState:state=>{Object.assign(context,state);documentTabs.active=state.documentId;},enterEmptyState:()=>{throw new Error('不应关闭全部标签');},
  modal:async()=>{confirmations.push(context.documentId);return context.answer;},setDirty:value=>{context.dirty=value;}};
 context.window={desktop:{discardRecovery:async()=>{}}};
 vm.createContext(context);
 vm.runInContext(section('async function confirmDiscard(','function captureDocumentState(')+'\n'+section('function switchDocument(','function reopenDocument('),context);
 return{context,confirmations};
}
test('关闭窗口也等待干净文档的另存任务，避免提前终止保存Worker',async()=>{
 const {context}=tabEditor(),pending=deferred();context.documentTabs.remove('b');context.closePending=false;let closed=false;
 context.window.desktop.closeConfirmed=()=>{closed=true;};context.projectSaves.set('a',pending.promise);pending.promise.then(()=>context.projectSaves.delete('a'));
 vm.runInContext(section('async function requestClose(','async function openDocument('),context);
 const closing=context.requestClose();await Promise.resolve();assert.equal(closed,false);pending.resolve(true);assert.equal(await closing,true);assert.equal(closed,true);
});
test('保存后关闭期间产生新编辑时不关闭标签',async()=>{
 const {context}=tabEditor(),pending=deferred();context.answer={};context.dirty=true;context.documentTabs.get('a').dirty=true;
 context.saveProject=async()=>pending.promise;
 const closing=context.closeDocumentTab('a');await Promise.resolve();context.dirty=true;pending.resolve(true);await closing;
 assert.equal(context.documentTabs.items.length,2);assert.equal(context.closedDocuments.length,0);
});
test('关闭正在保存的标签会等待保存，再确认后续编辑',async()=>{
 const {context,confirmations}=tabEditor(),pending=deferred();context.dirty=true;context.answer=null;context.projectSaves.set('a',pending.promise);
 const closing=context.closeDocumentTab('a');await Promise.resolve();assert.equal(context.documentTabs.items.length,2);assert.equal(confirmations.length,0);
 pending.resolve(true);await closing;assert.deepEqual(confirmations,['a']);assert.equal(context.closedDocuments.length,0);
});
test('cel 范围拖选期间不能关闭其他未保存标签，也不写入关闭历史',async()=>{
 const {context,confirmations}=tabEditor();context.celGesture={pointerId:1};
 await context.closeDocumentTab('b');
 assert.deepEqual(context.documentTabs.items.map(item=>item.id),['b','a']);
 assert.equal(context.documentTabs.get('b').dirty,true);assert.equal(context.documentId,'a');
 assert.equal(context.closedDocuments.length,0);assert.deepEqual(confirmations,[]);
});
test('关闭其他未保存标签时向目标文档确认，取消保留标签与关闭历史',async()=>{
 const {context,confirmations}=tabEditor();context.answer=null;
 await context.closeDocumentTab('b');
 assert.deepEqual(confirmations,['b']);assert.equal(context.documentId,'b');
 assert.equal(context.documentTabs.get('b').dirty,true);assert.equal(context.documentTabs.items.length,2);
 assert.equal(context.closedDocuments.length,0);
});
test('确认不保存后仅关闭目标标签，关闭历史保留目标文档',async()=>{
 const {context,confirmations}=tabEditor();context.answer={discard:true};
 await context.closeDocumentTab('b');
 assert.deepEqual(confirmations,['b']);assert.deepEqual(context.documentTabs.items.map(item=>item.id),['a']);
 assert.equal(context.documentId,'a');assert.equal(context.closedDocuments.length,1);
 assert.equal(context.closedDocuments[0].documentId,'b');assert.equal(context.closedDocuments[0].doc.name,'B');
});
test('桌面桥接按路径打开时直接传递路径，不重新查询列表序号',async()=>{
 const desktop=readFileSync(new URL('../src/desktop.js',import.meta.url),'utf8'),calls=[];
 const context={bridge:{},call:async(method,...args)=>{calls.push([method,...args]);return{filePath:args[0]};}};
 vm.createContext(context);vm.runInContext(desktop.slice(desktop.indexOf('bridge.openRecent=async'),desktop.indexOf('bridge.saveProject=')),context);
 assert.equal((await context.bridge.openRecent('a.pix')).filePath,'a.pix');assert.deepEqual(calls,[['openRecent','a.pix']]);
});

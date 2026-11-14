import {mkdir,writeFile} from 'node:fs/promises';
import {packProjectSave} from '../src/project-transfer.js';

const root='tests/fixtures/project-transfer';await mkdir(root,{recursive:true});
const document={format:'pixel-studio',version:2,name:'input',width:2,height:1,layers:[{id:1,name:'图层'}],
 frames:[{duration:75,cels:[null,[],[0,4294967295,287454020]],indices:[null,[],[0,255]],custom:{note:'保留'}},{duration:125,cels:[[0xdeadbeef]],links:{1:'shared'}}],
 references:[{id:'ref',data:'AQIDBA==',note:'参考'},{id:'empty',data:''}],custom:{unknown:[1,2,3]}};
await writeFile(root+'/fixture.json',JSON.stringify(document)+'\n');
await writeFile(root+'/fixture.bin',packProjectSave(JSON.stringify(document),'中文 名称',true));
console.log(JSON.stringify({fixture:root+'/fixture.bin'}));

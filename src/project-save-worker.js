import {packProjectSave} from './project-transfer.js';
self.onmessage=({data:{id,document,name,saveAs,target}})=>{
 try{const bytes=packProjectSave(document,name,saveAs,target);self.postMessage({id,bytes},[bytes.buffer]);}
 catch(error){self.postMessage({id,error:error.message});}
};

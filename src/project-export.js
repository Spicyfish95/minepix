export const PROJECT_EXPORT_KEY='minepix-project-exports-v1';
export function projectDirectory(path){const index=Math.max(path?.lastIndexOf('/')??-1,path?.lastIndexOf('\\')??-1);return index<0?'':path.slice(0,index+1);}
export function readProjectExports(storage){try{return JSON.parse(storage.getItem(PROJECT_EXPORT_KEY))||{projects:{}};}catch{return{projects:{}};}}
export function lastProjectExport(storage,path,id){const {projects={}}=readProjectExports(storage);return projects[path||id]||projects[id]||null;}
export function defaultExportDirectory(storage,path,id){const state=readProjectExports(storage);return lastProjectExport(storage,path,id)?.destination.directory||projectDirectory(path)||state.directory||'';}
export function rememberProjectExport(storage,path,id,options,result){
 if(!result||typeof result!=='object')return;
 const state=readProjectExports(storage),record={options:structuredClone(options),destination:{directory:result.directory,...(result.filePath?{filePath:result.filePath}:{}),...(result.folder?{folder:result.folder}:{}),...(result.imagePath?{imagePath:result.imagePath}:{})}};
 state.projects||={};state.projects[id]=record;if(path)state.projects[path]=record;state.directory=result.directory;
 storage.setItem(PROJECT_EXPORT_KEY,JSON.stringify(state));
}

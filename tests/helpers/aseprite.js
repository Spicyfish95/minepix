import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDocument} from '../../src/model.js';
const exec=promisify(execFile);
const tool=fileURLToPath(new URL('../../src-tauri/target/debug/examples/project-tool'+(process.platform==='win32'?'.exe':''),import.meta.url));
async function run(mode,bytes){
 const directory=await mkdtemp(path.join(tmpdir(),'minepix-ase-'));
 try {
  const input=path.join(directory,'input'),output=path.join(directory,'output');
  await writeFile(input,bytes);
  try {await exec(tool,[mode,input,output],{windowsHide:true});}
  catch(error){throw new Error(error.stderr?.trim()||error.message);}
  return await readFile(output);
 } finally {await rm(directory,{recursive:true,force:true});}
}
export async function readAseprite(bytes,name){
 const value=JSON.parse(await run('ase-import',bytes));
 value.doc=validateDocument(value.doc);
 if(name)value.doc.name=name;
 return value;
}
export async function writeAseprite(document){return run('ase-export',JSON.stringify(document));}

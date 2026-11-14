import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n'))];
let checked=0,links=0,imports=0;
for(const file of files){
 if(!/\.(?:js|mjs|cjs|rs|json|toml|md|yml|yaml|ps1|nsh|nsi|html|css|txt)$/.test(file))continue;
 let text;try{text=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
 assert.ok(!text.includes('\r\n'),`${file}: use LF line endings`);
 if(file!=='scripts/check-repository.mjs'){
  for(const forbidden of ['electron','tests/legacy','electron-baseline','docs/MIGRATION','../minepix/'])assert.ok(!text.toLowerCase().includes(forbidden.toLowerCase()),`${file}: obsolete reference ${forbidden}`);
 }
 if(file.endsWith('.md'))for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1].split('#')[0];
  if(!target||/^(https?:|mailto:)/.test(target))continue;
  await stat(path.resolve(path.dirname(file),decodeURIComponent(target)));links++;
 }
 if(/\.[cm]?js$/.test(file))for(const match of text.matchAll(/from\s+['\x22]([^'\x22]+)['\x22]/g)){
  if(!match[1].startsWith('.'))continue;
  await stat(path.resolve(path.dirname(file),match[1]));imports++;
 }
 checked++;
}
console.log(JSON.stringify({ok:true,checked,links,imports}));

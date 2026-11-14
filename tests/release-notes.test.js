import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractReleaseNotes,readReleaseNotes} from '../scripts/release-notes.mjs';

const changelog='# 变更记录\n\n## 未发布\n\n- 下一版本\n\n## 2.0.1\n\n本次说明。\n\n### 修复\n\n- 中文与 `代码`。\n\n## 2.0.0\n\n- 历史版本\n';
const expected='本次说明。\n\n### 修复\n\n- 中文与 `代码`。';

test('extracts only the exact version body, retaining paragraphs and subsections',()=>{
 assert.equal(extractReleaseNotes(changelog,'2.0.1'),expected);
 assert.equal(extractReleaseNotes(changelog,'2.0.0'),'- 历史版本');
});

test('matches prerelease versions exactly and normalizes Windows line endings',()=>{
 const text='## 2.0.1-alpha.10\r\n\r\n- 十\r\n\r\n## 2.0.1-alpha.1\r\n\r\n- 一\r\n';
 assert.equal(extractReleaseNotes(text,'2.0.1-alpha.1'),'- 一');
 assert.equal(extractReleaseNotes(text,'2.0.1-alpha.10'),'- 十');
});

test('missing, duplicate and empty version sections stop generation',()=>{
 assert.throws(()=>extractReleaseNotes(changelog,'2.0.2'),/唯一/);
 assert.throws(()=>extractReleaseNotes(changelog+'\n## 2.0.1\n\n- 重复','2.0.1'),/唯一/);
 assert.throws(()=>extractReleaseNotes('## 2.0.1\n\n## 2.0.0\n- 历史','2.0.1'),/不能为空/);
});

test('custom notes remain a standalone UTF-8 body and cannot be empty',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'minepix-notes-'));
 try{
  const file=path.join(dir,'notes.md');
  await writeFile(file,'\r\n自定义说明\r\n\r\n- 本次修改\r\n');
  assert.equal(await readReleaseNotes('2.0.1',file),'自定义说明\n\n- 本次修改');
  await writeFile(file,' \r\n');
  await assert.rejects(readReleaseNotes('2.0.1',file),/不能为空/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real manifest generation uses only version notes and honors a custom notes file',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'minepix-manifest-notes-'));
 const script=fileURLToPath(new URL('../scripts/create-update-manifest.mjs',import.meta.url));
 const exec=promisify(execFile);
 try{
  const installers=path.join(dir,'src-tauri/target/release/bundle/nsis');
  await mkdir(installers,{recursive:true});
  await writeFile(path.join(dir,'src-tauri/tauri.conf.json'),JSON.stringify({version:'2.0.1',plugins:{updater:{requireSignedVersion:true}}}));
  await writeFile(path.join(dir,'CHANGELOG.md'),changelog);
  const installer=path.join(installers,'MinePix_2.0.1_x64-setup.exe');
  await writeFile(installer,'fixture payload; not an installer');
  // Manifest generation checks version binding; cryptographic verification is a separate release step.
  await writeFile(installer+'.sig',Buffer.from('trusted comment: fixture\tversion:2.0.1\n').toString('base64'));
  const generate=async notesFile=>{
   await exec(process.execPath,[script],{cwd:dir,env:{...process.env,MINEPIX_RELEASE_NOTES:notesFile},windowsHide:true});
   return JSON.parse(await readFile(path.join(dir,'artifacts/release/latest.json'),'utf8'));
  };
  const manifest=await generate('');
  assert.equal(manifest.version,'2.0.1');
  assert.equal(manifest.notes,expected);
  const override=path.join(dir,'custom.md');
  await writeFile(override,'- 本次自定义说明\n');
  assert.equal((await generate(override)).notes,'- 本次自定义说明');
  await writeFile(path.join(dir,'CHANGELOG.md'),'## 2.0.0\n\n- 只有旧版');
  await assert.rejects(generate(''),/唯一/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const exec=promisify(execFile),root=path.resolve('artifacts/project-read'),tool=path.resolve('src-tauri/target/debug/examples/project-tool.exe');
await mkdir(root,{recursive:true});
await exec(tool,['encode',path.resolve('tests/fixtures/project-transfer/fixture.json'),path.join(root,'fixture.pix')],{windowsHide:true});
await exec(tool,['read-transfer',path.join(root,'fixture.pix'),path.resolve('tests/fixtures/project-transfer/read.bin')],{windowsHide:true});
console.log(JSON.stringify({fixture:'tests/fixtures/project-transfer/read.bin',generator:'Rust project::read_transfer'}));

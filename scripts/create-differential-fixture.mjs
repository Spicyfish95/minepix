import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {homedir} from 'node:os';
import {fixtureBytes} from './update-blockmap.mjs';

const bytes=fixtureBytes(0xbadc0ffe,65536);
Buffer.from('MinePix differential protocol fixture. Not an installer.').copy(bytes);
const file='tests/fixtures/updater-differential.bin';await writeFile(file,bytes);
execFileSync(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','signer','sign','--private-key-path',path.join(homedir(),'.ssh','minepix-tauri.key'),'--app-version','2.0.0-alpha.2',file],{stdio:'ignore'});
console.log('Generated signed differential protocol fixture; not an installer');

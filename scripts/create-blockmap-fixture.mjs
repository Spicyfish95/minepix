import {writeFile} from 'node:fs/promises';
import {blockmap,fixtureBytes} from './update-blockmap.mjs';
const seed=0xbadc0ffe,length=65536;
await writeFile('tests/fixtures/update-blockmap.json',JSON.stringify({seed,length,map:blockmap(fixtureBytes(seed,length),'2.0.0-alpha.2','https://example.test/setup.exe')},null,2)+'\n');
console.log('Generated deterministic cross-language blockmap fixture');

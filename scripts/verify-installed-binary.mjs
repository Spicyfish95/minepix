import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const [rawFile,installedFile]=process.argv.slice(2);
const raw=await readFile(rawFile),installed=await readFile(installedFile);
const original=Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK'),nsis=Buffer.from('__TAURI_BUNDLE_TYPE_VAR_NSS');
const offset=raw.indexOf(original);
assert.ok(offset>=0&&raw.indexOf(original,offset+1)===-1,'Raw binary has exactly one Tauri bundle marker');
const expected=Buffer.from(raw);nsis.copy(expected,offset);
assert.ok(installed.equals(expected),'Installed bytes must exactly equal raw EXE with only the official NSIS bundle marker patch');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({ok:true,rawSha256:sha(raw),installedSha256:sha(installed),bytes:raw.length,markerOffset:offset,marker:'UNK -> NSS',allOtherBytesIdentical:true}));

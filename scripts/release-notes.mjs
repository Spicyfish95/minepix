import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export function extractReleaseNotes(changelog,version){
 const text=changelog.replace(/\r\n/g,'\n');
 const headings=[...text.matchAll(/^##[\t ]+(.+?)[\t ]*$/gm)];
 const matches=headings.filter(heading=>heading[1]===version);
 assert.equal(matches.length,1,`CHANGELOG.md 必须包含唯一的 ## ${version} 章节`);
 const heading=matches[0],next=headings[headings.indexOf(heading)+1];
 const notes=text.slice(heading.index+heading[0].length,next?.index??text.length).trim();
 assert.ok(notes,`${version} 的版本说明不能为空`);
 return notes;
}

export async function readReleaseNotes(version,notesFile){
 if(!notesFile)return extractReleaseNotes(await readFile('CHANGELOG.md','utf8'),version);
 const notes=(await readFile(notesFile,'utf8')).replace(/\r\n/g,'\n').trim();
 assert.ok(notes,'自定义版本说明不能为空');
 return notes;
}

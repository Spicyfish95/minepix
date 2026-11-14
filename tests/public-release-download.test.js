import test from 'node:test';
import assert from 'node:assert/strict';
import {publicBytes} from '../scripts/public-release-download.mjs';

test('new public assets retry 404 with distinct cache keys and preserve returned bytes',async()=>{
 const requests=[],waits=[];
 const bytes=await publicBytes('https://github.com/example/releases/download/channel/latest.json',{
  fetcher:async(url,options)=>{
   requests.push({url,options});
   return requests.length<3?new Response(null,{status:404}):new Response('signed manifest');
  },
  wait:async milliseconds=>waits.push(milliseconds),
 });
 assert.equal(bytes.toString(),'signed manifest');
 assert.equal(new Set(requests.map(request=>request.url)).size,3);
 assert.ok(requests.every(request=>new URL(request.url).pathname.endsWith('/latest.json')));
 assert.ok(requests.every(request=>request.options.headers['Cache-Control']==='no-cache'));
 assert.deepEqual(waits,[5000,5000]);
});

test('public asset failures stay bounded and non-404 errors are not hidden',async()=>{
 let requests=0;
 await assert.rejects(publicBytes('https://example.com/asset',{
  fetcher:async()=>{requests++;return new Response(null,{status:404});},
  wait:async()=>{},
  attempts:3,
 }),/Public asset 404/);
 assert.equal(requests,3);
 requests=0;
 await assert.rejects(publicBytes('https://example.com/asset',{
  fetcher:async()=>{requests++;return new Response(null,{status:403});},
  wait:async()=>assert.fail('Unexpected retry'),
 }),/Public asset 403/);
 assert.equal(requests,1);
});

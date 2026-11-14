import test from 'node:test';
import assert from 'node:assert/strict';
import {WELCOME_ACTIONS,WELCOME_RECENT_LIMIT,welcomeRecent,createWelcomeState} from '../src/welcome.js';

test('欢迎页提供新建、打开与最近文件三个入口',()=>{
 assert.deepEqual(WELCOME_ACTIONS.map(item=>item.action),['new','open','recent-files']);
 assert.ok(WELCOME_ACTIONS.every(item=>item.label&&item.hint));
});

test('最近文件按打开时间倒序并按路径去重',()=>{
 const rows=welcomeRecent([
  {path:'b.pix',name:'b',openedAt:20},
  {path:'a.pix',name:'a',openedAt:10},
  {path:'b.pix',name:'b',openedAt:30}
 ]);
 assert.deepEqual(rows.map(row=>row.path),['b.pix','a.pix']);
 assert.equal(rows[0].name,'b');
});

test('最近文件截断到上限',()=>{
 const rows=welcomeRecent(Array.from({length:WELCOME_RECENT_LIMIT+3},(_,i)=>({path:'f'+i+'.pix',name:'f'+i,openedAt:i})));
 assert.equal(rows.length,WELCOME_RECENT_LIMIT);
 assert.equal(rows[0].path,'f'+(WELCOME_RECENT_LIMIT+2)+'.pix');
});

test('没有最近文件时欢迎页标记为空态',()=>{
 const state=createWelcomeState([]);
 assert.equal(state.empty,true);
 assert.equal(state.recent.length,0);
 assert.equal(state.actions.length,3);
});

test('有最近文件时欢迎页带出名称与路径',()=>{
 const state=createWelcomeState([{path:'/tmp/hero.pix',name:'hero',openedAt:1}]);
 assert.equal(state.empty,false);
 assert.deepEqual(state.recent,[{path:'/tmp/hero.pix',name:'hero'}]);
});

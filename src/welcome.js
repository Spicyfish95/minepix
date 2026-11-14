// 欢迎页纯数据：无文档时显示的入口与最近文件列表，供 app.js 渲染、单测校验。
export const WELCOME_ACTIONS=[
 {action:'new',label:'新建项目',hint:'从空白画布开始'},
 {action:'open',label:'打开文件',hint:'选择 .pix / .aseprite / PNG / GIF'},
 {action:'recent-files',label:'最近文件',hint:'继续上次编辑的项目'}
];

export const WELCOME_RECENT_LIMIT=6;

// 最近文件来自主进程记录（{path,name,openedAt}）；按路径去重、按打开时间倒序并截断。
export function welcomeRecent(entries,limit=WELCOME_RECENT_LIMIT){
 const seen=new Set(),rows=[];
 for(const entry of [...(entries||[])].sort((a,b)=>(b.openedAt||0)-(a.openedAt||0))){
  if(!entry?.path||seen.has(entry.path))continue;
  seen.add(entry.path);rows.push({path:entry.path,name:entry.name||entry.path});
 }
 return rows.slice(0,limit);
}

export function createWelcomeState(entries=[]){
 const recent=welcomeRecent(entries);
 return {title:'MinePix',actions:WELCOME_ACTIONS,recent,empty:recent.length===0};
}

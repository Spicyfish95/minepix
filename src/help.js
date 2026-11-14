import {locale} from './i18n.js';
const appIcon=new URL('./assets/app-icon.png',import.meta.url).href;
function releaseNotesText(notes){
 if(!/<\/?[a-z][^>]*>/i.test(notes))return notes;
 const template=document.createElement('template');template.innerHTML=notes;
 const read=node=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return '';
  if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.nodeName))return '';
  const content=Array.from(node.childNodes,read).join('');
  if(node.nodeName==='BR')return '\n';
  if(node.nodeName==='LI')return '• '+content.trim()+'\n';
  return /^(H[1-6]|P|DIV|UL|OL|PRE|BLOCKQUOTE)$/.test(node.nodeName)?content.trim()+'\n\n':content;
 };
 return read(template.content).replace(/\n{3,}/g,'\n\n').trim();
}
export function createHelp({desktop,modal,message,report}){
 const text=(zh,en)=>locale()==='en'?en:zh;
 let checking=false,state={status:'idle',current:'',releaseUrl:''},panel,badge;
 const titles=()=>({idle:text('软件更新','Software update'),checking:text('正在检查更新…','Checking for updates…'),current:text('当前已是最新版本','You are up to date'),available:text('发现新版本','Update available'),downloading:text('正在下载更新','Downloading update'),cancelling:text('正在取消下载…','Cancelling download…'),cancelled:text('下载已取消','Download cancelled'),downloaded:text('更新已就绪','Update ready'),preparing:text('正在处理未保存项目…','Checking unsaved projects…'),installing:text('正在启动安装程序…','Starting installer…'),error:text('更新失败','Update failed')});
 const bytes=value=>value>=1048576?(value/1048576).toFixed(1)+' MB':(value/1024).toFixed(0)+' KB';
 function ensurePanel(){
  if(panel)return;
  panel=document.createElement('section');panel.id='update-panel';panel.className='software-update';panel.hidden=true;panel.setAttribute('aria-labelledby','update-heading');
  panel.innerHTML='<header><h2 id="update-heading"></h2><button id="update-hide" type="button">×</button></header><p id="update-version"></p><p id="update-status-text" role="status" aria-live="polite"></p><progress id="update-progress" max="100" hidden></progress><p id="update-transfer"></p><p id="update-error" role="alert" hidden></p><pre class="update-notes"></pre><p id="update-hint"></p><div class="update-actions"><button id="update-release" type="button"></button><button id="update-cancel" type="button" hidden></button><button id="update-primary" class="primary" type="button"></button></div>';
  document.body.append(panel);badge=document.createElement('button');badge.id='update-status';badge.className='update-status-button';badge.hidden=true;badge.type='button';document.body.append(badge);
  badge.onclick=()=>{panel.hidden=false;};panel.querySelector('#update-hide').onclick=()=>{panel.hidden=true;};
  panel.querySelector('#update-release').onclick=()=>desktop.openUpdateRelease().catch(report);
  panel.querySelector('#update-cancel').onclick=()=>desktop.cancelUpdate().then(render).catch(report);
  panel.querySelector('#update-primary').onclick=()=>{
   const operation=state.status==='downloaded'||state.error?.operation==='install'?'installUpdate':state.status==='current'||state.status==='idle'||state.error?.operation==='check'?'checkUpdates':'downloadUpdate';
   void desktop[operation]().then(render).catch(error=>render({...state,status:'error',error:{message:error.message,operation:operation==='checkUpdates'?'check':operation==='installUpdate'?'install':'download'}}));
  };
  new MutationObserver(()=>render(state)).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 function render(next){
  const completed=next.status==='downloaded'&&state.status==='downloading';
  state=next;if(!desktop||state.status==='idle'&&!panel)return;ensurePanel();
  if(completed)panel.hidden=false;
  const find=id=>panel.querySelector('#update-'+id),title=titles()[state.status],progress=state.progress;
  find('heading').textContent=text('软件更新','Software update');find('hide').setAttribute('aria-label',text('收起更新面板','Hide update panel'));
  find('version').textContent='MinePix '+state.current+(state.version?' → '+state.version:'');
  find('status-text').textContent=title;
  const transferring=['downloading','cancelling'].includes(state.status);
  find('progress').hidden=!transferring;find('transfer').hidden=!transferring;
  if(transferring&&progress){find('progress').value=progress.percent;find('progress').setAttribute('aria-label',text('更新下载进度','Update download progress'));find('transfer').textContent=Math.floor(progress.percent)+'% · '+bytes(progress.transferred)+' / '+(progress.total?bytes(progress.total):'…')+' · '+bytes(progress.bytesPerSecond)+'/s';}
  find('error').hidden=state.status!=='error';find('error').textContent=state.error?text('原因：','Reason: ')+state.error.message:'';
  panel.querySelector('.update-notes').textContent=releaseNotesText(state.notes||'');
  find('hint').textContent=state.notice==='install-cancelled'?text('已取消安装，下载的更新已保留。','Installation cancelled. The downloaded update is kept.'):state.status==='downloaded'?text('点击“重启并更新”后，将先处理所有窗口的未保存项目。','Restart and update checks unsaved projects in every window first.'):text('下载期间可以继续使用软件。可前往 GitHub Release 手动下载。','You can keep working while downloading, or download manually from GitHub Release.');
  find('release').textContent=text('前往 GitHub Release 下载','Download from GitHub Release');
  const primary=find('primary');primary.hidden=['checking','downloading','cancelling','preparing','installing'].includes(state.status);
  primary.textContent=state.status==='error'?state.error.operation==='install'?text('重试安装','Retry installation'):text('重试','Retry'):state.status==='downloaded'?text('重启并更新','Restart and update'):state.status==='current'||state.status==='idle'?text('重新检查','Check again'):text('下载更新','Download update');
  find('cancel').hidden=!transferring;find('cancel').disabled=state.status==='cancelling';find('cancel').textContent=text('取消下载','Cancel download');
  badge.hidden=['idle','current'].includes(state.status);badge.textContent=title+(state.status==='downloading'&&progress?' '+Math.floor(progress.percent)+'%':'');badge.classList.toggle('update-failed',state.status==='error');
 }
 if(desktop){
  desktop.onUpdateState(render);void desktop.updateState().then(render).catch(report);
  desktop.onNotificationAction(purpose=>{if(purpose==='update'){ensurePanel();render(state);panel.hidden=false;}else if(purpose==='test')message(text('系统通知已返回 MinePix','Returned to MinePix from the system notification'));});
 }
 async function about(){const info=await desktop.appInfo();await modal(text('关于 MinePix','About MinePix'),`<div class="about-header"><img src="${appIcon}" width="64" height="64" alt="MinePix"><strong>MinePix ${info.version}</strong></div><p>${text('像素绘画与逐帧动画编辑器','Pixel art and frame animation editor')}</p><p>MIT License · MinePix</p><p><a id="about-repository" href="https://github.com/Spicyfish95/minepix">GitHub · Spicyfish95/minepix</a></p><label><input name="auto-update" type="checkbox">${text('启动时自动检查更新','Automatically check for updates on startup')}</label><p><button id="about-notification-test" type="button">${text('发送测试通知','Send test notification')}</button> <span id="about-notification-status" role="status"></span></p><p>${text('发现新版本后可查看下载进度；下载完成后点击重启并更新，安装前可保存未完成项目。也可前往 GitHub Release 手动下载。','New versions show download progress. Restart and update when ready, after checking unsaved projects. Manual downloads are available on GitHub Release.')}</p>`,form=>{form.querySelector('#about-repository').onclick=event=>{event.preventDefault();void desktop.openRepository().catch(report);};const input=form.elements['auto-update'];input.checked=info.autoUpdate;input.onchange=()=>desktop.setAutoUpdate(input.checked).catch(report);const notify=form.querySelector('#about-notification-test'),status=form.querySelector('#about-notification-status');notify.onclick=async()=>{notify.disabled=true;try{await desktop.testNotification();status.textContent=text('已提交测试通知；若未看到，请检查 Windows 通知设置。','Test notification submitted. If it does not appear, check Windows notification settings.');}catch(error){status.textContent=error.message;}finally{notify.disabled=false;}};});}
 async function guide(){const sections=locale()==='en'?[
 ['Getting started','Create a project with Ctrl+N or open a .pix file with Ctrl+O. Save all layers, frames and palettes with Ctrl+S. Undo with Ctrl+Z; redo with Ctrl+Shift+Z.'],
 ['Drawing','B pencil, E eraser, G fill, I eyedropper. Click an active grouped tool again to choose a related tool. Hold Space to pan, use the wheel to zoom, and Alt to pick a color.'],
 ['Selections and brushes','M opens the selection tool. Click it again for rectangle, ellipse, lasso, polygon or magic wand. The top bar groups selection operations, transforms and pixel commands. Ctrl+B creates a pattern brush from a visible editable selection.'],
 ['Indexed palettes','Colors → Color mode converts to indexed color. Foreground adjustments do not edit the palette unless palette editing is enabled and a slot is selected. After reordering, deleting or adding colors, Remap restores the closest available original colors.'],
 ['Animation and export','Add frames and set their durations in the timeline. File → Export offers single images, normal maps, sprite sheets, GIF, PNG sequences and Aseprite files.'],
 ['Reference images and layout','Import reference images in the Reference panel. They do not appear in exports. Drag panel tabs to rearrange the workspace; View → Layout restores defaults.'],
 ['Updates','Help → Check for updates uses the independent Tauri update channel and verifies the signed installer before installation. You can view progress, cancel, and retry. Restart and update checks unsaved projects in every window. Help → About controls automatic checks.']
 ]:[
 ['开始使用','Ctrl+N 新建项目，Ctrl+O 打开 .pix 项目。Ctrl+S 保存图层、帧和色板；Ctrl+Z 撤销，Ctrl+Shift+Z 重做。'],
 ['绘画','B 铅笔、E 橡皮、G 填充、I 吸管。再次点击已激活的组合工具打开同组列表。空格拖动平移，滚轮缩放，Alt 临时吸色。'],
 ['选区与笔刷','M 激活选区工具，再次点击可选择矩形、椭圆、自由套索、多边形套索或魔棒。顶部操作栏按选择、变换和像素命令分组。存在可编辑的可见选区时，Ctrl+B 建立图案笔刷。'],
 ['索引色与色板','在“颜色 → 颜色模式与量化”切换索引模式。前景色可自由修改；只有开启色板编辑并选中色槽才修改色板。排序、删除、新增颜色后可点“重映射”，按当前色板恢复最接近的原色。'],
 ['动画与导出','在时间轴新增帧并设置时长。“文件 → 导出”支持单一图像、法线贴图、精灵表、GIF、PNG 序列和 Aseprite 文件。'],
 ['参考图与布局','参考栏目可导入图片，参考图不会出现在导出结果中。拖动栏目标签调整布局；“视图 → 布局”可恢复默认。'],
 ['软件更新','“帮助 → 检查更新”使用独立的 Tauri 更新渠道，安装前验证签名。可查看下载进度、取消和重试；下载完成后手动重启更新，安装前检查所有窗口的未保存项目。“帮助 → 关于”可设置启动时自动检查。']
 ];await modal(text('MinePix 使用指南','MinePix Guide'),'<article class="help-guide">'+sections.map(([title,body])=>`<h3>${title}</h3><p>${body}</p>`).join('')+'</article>');}
 async function check(automatic=false){
  if(checking){if(!automatic){ensurePanel();panel.hidden=false;}return state;}
  checking=true;
  try{
   const current=await desktop.updateState();
   if(!automatic){ensurePanel();panel.hidden=false;}
   if(['downloading','cancelling','downloaded','preparing','installing'].includes(current.status)){render(current);return current;}
   const result=await desktop.checkUpdates();render(result);
   if(!automatic||result.status==='available'&&!document.getElementById('modal').open){ensurePanel();panel.hidden=false;}
   return result;
  }catch(error){render({...state,status:'error',error:{message:error.message,operation:'check'}});return state;}
  finally{checking=false;}
 }
 async function start(){const info=await desktop.appInfo();if(info.packaged&&info.autoUpdate&&!desktop.secondary)setTimeout(()=>void check(true),3000);}
 return{guide,about,check,start,get checking(){return checking;}};
}

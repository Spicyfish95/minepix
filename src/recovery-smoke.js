export async function recoveryPolicySmoke(api,phase){
 const {$,newDocument,closeDocumentTab,saveProject,flushRecovery,importFile,settingsDialog,edit,state}=api,results=[];
 const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 const wait=async predicate=>{for(let i=0;i<1000&&!predicate();i++)await new Promise(r=>setTimeout(r,10));if(!predicate())throw new Error('等待弹窗超时');};
 const create=async name=>{const pending=newDocument(),form=$('modal-form');form.elements.name.value=name;form.elements.width.value=4;form.elements.height.value=4;form.requestSubmit($('modal-submit'));await pending;};
 const close=async save=>{const pending=closeDocumentTab();await wait(()=>$('modal').open);check('关闭项目提供保存后关闭按钮',$('modal-submit').textContent.includes('保存后关闭')&&$('modal-content').textContent.includes('保存后关闭'));if(save)$('modal-form').requestSubmit($('modal-submit'));else [...$('modal').querySelectorAll('.modal-actions button')].find(button=>button.textContent==='不保存').click();await pending;};
 const disk=async filePath=>{const entries=await window.desktop.recentFiles(),index=entries.findIndex(entry=>entry.path===filePath);return window.desktop.openRecent(index);};
 try{
  if(phase==='before-reload'){
   check('空白启动无恢复弹窗',!$('modal').open);
   await wait(()=>document.querySelector('[data-menu-command=save]')?.disabled);check('空白项目菜单保存导出和撤销置灰',['save','png','undo'].every(id=>document.querySelector(`[data-menu-command=${id}]`)?.disabled));
   check('MinePix 标题与欢迎页名称',document.title.includes('MinePix')&&document.querySelector('#welcome h1')?.textContent==='MinePix');
   const {setTheme,setAppearance}=await import('./theme.js');setTheme('light');check('亮色主题可用',document.documentElement.dataset.theme==='light');
   $('theme-toggle').click();check('主题按钮显示三个选项',document.querySelectorAll('#theme-options [data-theme]').length===3);
   document.querySelector('#theme-options [data-theme="system"]').click();check('跟随系统应用当前系统主题',localStorage.getItem('pixel-studio-theme')==='system'&&document.documentElement.dataset.theme===(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
   $('theme-toggle').click();document.querySelector('#theme-options [data-theme="light"]').click();
   const appearance=settingsDialog();await wait(()=>$('modal').open);check('设置中主题移到独立外观页',!$('modal-form').elements['appearance.theme']&&!!$('settings-tab-visual'));
   $('settings-tab-visual').click();const cards=[...document.querySelectorAll('#settings-page-visual .visual-mode-choice')];check('外观页提供系统亮色深色预览卡',cards.map(card=>card.dataset.theme).join(',')==='system,light,dark'&&cards.every(card=>card.querySelector('.visual-mode-preview')));
   cards[0].click();check('点击系统卡实时预览并标记选中',localStorage.getItem('pixel-studio-theme')==='system'&&cards[0].getAttribute('aria-pressed')==='true');const accent=$('visual-accent'),font=$('visual-font');accent.value='#33aa77';accent.dispatchEvent(new Event('input',{bubbles:true}));font.value='mono';font.dispatchEvent(new Event('change',{bubbles:true}));check('主题色和字体即时预览',document.documentElement.style.getPropertyValue('--accent')==='#33aa77'&&document.documentElement.style.getPropertyValue('--ui-font').includes('Consolas'));
   $('modal').close('cancel');await appearance;check('取消设置恢复原外观',localStorage.getItem('pixel-studio-theme')==='light'&&!document.documentElement.style.getPropertyValue('--accent')&&!document.documentElement.style.getPropertyValue('--ui-font'));
   const savedAppearance=settingsDialog();await wait(()=>$('modal').open);$('settings-tab-visual').click();$('visual-accent').value='#4477cc';$('visual-accent').dispatchEvent(new Event('input',{bubbles:true}));$('visual-font').value='sans';$('visual-font').dispatchEvent(new Event('change',{bubbles:true}));$('modal-form').requestSubmit($('modal-submit'));await savedAppearance;check('主题色与字体保存到本机',JSON.parse(localStorage.getItem('minepix-appearance-v1')).accent==='#4477cc'&&JSON.parse(localStorage.getItem('minepix-appearance-v1')).font==='sans');setAppearance({accent:null,font:'system'});
   await create('never-saved');await wait(()=>!document.querySelector('[data-menu-command=save]')?.disabled);check('打开项目后保存可用但单帧删帧仍置灰',!document.querySelector('[data-menu-command=save]').disabled&&document.querySelector('[data-menu-command=delete-frame]').disabled);edit(0xff0000ff);await wait(()=>!document.querySelector('[data-menu-command=undo]')?.disabled);check('编辑后撤销菜单解锁',!document.querySelector('[data-menu-command=undo]').disabled);await flushRecovery();check('从未保存的项目无副本',(await window.desktop.listRecovery()).length===0);await close(false);
   await create('explicit-discard');await saveProject();const discarded=state().filePath;edit(0xff0000ff);await flushRecovery();check('保存后再编辑有副本',!!await window.desktop.recoveryForPath(discarded));await close(false);check('明确不保存删除副本',!await window.desktop.recoveryForPath(discarded));
   await create('unexpected-close');await saveProject();const saved=state().filePath;edit(0x00ff00ff);await flushRecovery();check('意外关闭前副本指向项目',!!await window.desktop.recoveryForPath(saved));check('磁盘项目未被副本覆盖',JSON.parse((await disk(saved)).data).frames[0].cels[0][0]===0);
   return{ok:true,results};
  }
  if(phase==='after-reload'){
   check('重启空白页不提示恢复',!$('modal').open);
   const entries=await window.desktop.recentFiles(),saved=entries.find(entry=>entry.name==='unexpected-close.pix').path;
   const pending=importFile(await disk(saved),true);await wait(()=>$('modal').open);check('先显示磁盘项目再询问恢复',state().filePath===saved&&!state().dirty&&state().pixel===0&&document.querySelector('#welcome').hidden);
   check('仅打开匹配项目提示恢复',$('modal-title').textContent==='恢复未保存内容？'&&!$('modal-form').querySelector('select, input[type=checkbox]'));
   $('modal-form').requestSubmit($('modal-submit'));await pending;check('恢复内容与路径',state().filePath===saved&&state().dirty&&state().pixel===0x00ff00ff);
   await saveProject();check('保存清除副本',!await window.desktop.recoveryForPath(saved));await closeDocumentTab();
   await importFile(await disk(saved),true);check('正常保存后打开不提示恢复',!$('modal').open&&!state().dirty);
   return{ok:true,results};
  }
  check('再次启动空白页无恢复弹窗',!$('modal').open&&(await window.desktop.listRecovery()).length===0);return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
}

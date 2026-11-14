import {normalizeFormLayout} from './form-layout.js';
export function showTimelinePopover({trigger,id,title,content,setup,apply}){
 const dom=trigger.ownerDocument;
 dom.getElementById(id)?.remove();
 const popup=dom.createElement('div');popup.id=id;popup.popover='auto';
 popup.className='context-popover cel-property-popover';popup.setAttribute('role','dialog');popup.setAttribute('aria-label',title);
 popup.innerHTML='<form><header><strong>'+title+'</strong></header>'+content+'<div class="cel-property-actions"><button type="button" data-close>取消</button><button type="submit" class="primary">应用</button></div></form>';
 const form=popup.querySelector('form');setup(form);
 popup.querySelector('[data-close]').onclick=()=>popup.hidePopover();
 form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;apply(form);popup.hidePopover();};
 trigger.dataset.popupTarget=id;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','true');
 popup.addEventListener('toggle',event=>trigger.setAttribute('aria-expanded',String(event.newState==='open')));
 normalizeFormLayout(popup);dom.body.append(popup);popup.showPopover();
 const rect=trigger.getBoundingClientRect(),view=dom.defaultView;
 popup.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-popup.offsetWidth-8))+'px';
 popup.style.top=Math.max(8,rect.top-popup.offsetHeight-8)+'px';
 form.querySelector('input').focus({preventScroll:true});
 return popup;
}

import {syncSurfaceThemes,syncSurfaceAppearance} from './ui-surfaces.js';
import {iconMarkup} from './icons.js';

const KEY='pixel-studio-theme';
const APPEARANCE_KEY='minepix-appearance-v1';
const choices=[['light','亮色主题'],['dark','深色主题'],['system','跟随系统']];
const system=matchMedia('(prefers-color-scheme: dark)');
let selected='light';
let appearance={accent:null,font:'system'};

function actualTheme(){return selected==='system'?(system.matches?'dark':'light'):selected;}
export function getTheme(){return selected;}
export function getAppearance(){return {...appearance};}
export function setAppearance(next){appearance={accent:next.accent||null,font:next.font||'system'};syncSurfaceAppearance(appearance);localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearance));return getAppearance();}
export function setTheme(theme){
 selected=choices.some(([value])=>value===theme)?theme:'light';
 const actual=actualTheme(),button=document.getElementById('theme-toggle');
 syncSurfaceThemes(actual);
 button.innerHTML=iconMarkup(selected==='system'?'settings':actual==='light'?'moon':'sun');
 button.title=`主题：${choices.find(([value])=>value===selected)[1]}`;
 button.setAttribute('aria-label',button.title);
 button.setAttribute('aria-expanded','false');
 localStorage.setItem(KEY,selected);
 document.querySelectorAll('#theme-options [data-theme]').forEach(option=>{
  option.setAttribute('aria-checked',String(option.dataset.theme===selected));
  option.classList.toggle('is-checked',option.dataset.theme===selected);
 });
}
export function initTheme(){
 const button=document.getElementById('theme-toggle');
 const menu=document.createElement('div');menu.id='theme-options';menu.className='app-menu theme-options';menu.popover='auto';menu.setAttribute('role','menu');
 for(const [value,label] of choices){const option=document.createElement('button');option.type='button';option.dataset.theme=value;option.setAttribute('role','menuitemradio');option.textContent=label;option.onclick=()=>{setTheme(value);menu.hidePopover();};menu.append(option);}
 document.body.append(menu);
 button.onclick=()=>{const rect=button.getBoundingClientRect();menu.style.top=rect.bottom+4+'px';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-190))+'px';menu.matches(':popover-open')?menu.hidePopover():menu.showPopover();button.setAttribute('aria-expanded',String(menu.matches(':popover-open')));};
 menu.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 window.addEventListener('storage',event=>{if(event.key===KEY)setTheme(event.newValue||'light');});
 system.addEventListener('change',()=>{if(selected==='system')syncSurfaceThemes(actualTheme());});
 setTheme(localStorage.getItem(KEY)||'light');
  setAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)||'null')||appearance);
}

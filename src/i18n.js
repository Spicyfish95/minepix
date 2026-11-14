import parity from './i18n-en/parity.js';
import normalMap from './i18n-en/normal-map.js';
import imageImport from './i18n-en/image-import.js';
import shell from './i18n-en/shell.js';
import settings from './i18n-en/settings.js';
import panels from './i18n-en/panels.js';
import app1 from './i18n-en/app1.js';
import app2 from './i18n-en/app2.js';
import app3 from './i18n-en/app3.js';
import app4 from './i18n-en/app4.js';
import palette from './i18n-en/palette.js';
import brushes from './i18n-en/brushes.js';

export const LOCALE_KEY='pixpix-locale-v1';
export const LOCALES={zh:'简体中文',en:'English'};
export function systemLocale(language){return /^zh(?:$|-CN$|-SG$|-Hans(?:-|$))/i.test(language||'')?'zh':'en';}

const groups=[parity,normalMap,imageImport,shell,settings,panels,app1,app2,app3,app4,palette,brushes];
const table=new Map();
let byFirst=new Map();
const observers=new Map();
const surfaceTitles=new WeakMap();
let current='zh';
const zhText=new WeakMap(),zhAttrs=new WeakMap();
const ATTRS=['title','aria-label','placeholder','alt'];

function rebuild(){for(const group of groups)for(const[key,value]of Object.entries(group))table.set(key,value);
 byFirst=new Map();
 for(const key of table.keys()){const first=key[0];if(!byFirst.has(first))byFirst.set(first,[]);byFirst.get(first).push(key);}
 for(const list of byFirst.values())list.sort((a,b)=>b.length-a.length);}

function translateRun(text){
 if(!text)return text;
 const whole=table.get(text);
 if(whole!==undefined)return whole;
 let out='',index=0;
 while(index<text.length){
  const candidates=byFirst.get(text[index]);
  let hit=null;
  if(candidates)for(const key of candidates)if(text.startsWith(key,index)){hit=key;break;}
  if(hit){out+=table.get(hit);index+=hit.length;}else{out+=text[index];index++;}
 }
 return out;
}

export function translateText(text){
 if(current!=='en'||typeof text!=='string')return text;
 if(!/[\u3400-\u9fff]/.test(text))return text;
 const match=/^(\s*)([\s\S]*?)(\s*)$/.exec(text);
 if(!match)return text;
 return match[1]+translateRun(match[2])+match[3];
}

export function t(text){return translateText(text);}

function translateNodeText(node){
 if(current==='en'){
  if(!zhText.has(node))zhText.set(node,node.nodeValue);
  const next=translateText(node.nodeValue);
  if(next!==node.nodeValue)node.nodeValue=next;
 }else if(zhText.has(node)){const original=zhText.get(node);if(node.nodeValue!==original)node.nodeValue=original;}
}

function translateElementAttrs(element){
 if(current==='en'){
  if(!zhAttrs.has(element))zhAttrs.set(element,new Map());
  const store=zhAttrs.get(element);
  for(const name of ATTRS){
   if(!element.hasAttribute(name))continue;
   if(!store.has(name))store.set(name,element.getAttribute(name));
   const next=translateText(store.get(name));
   if(next!==element.getAttribute(name))element.setAttribute(name,next);
  }
 }else if(zhAttrs.has(element)){
  for(const[name,value]of zhAttrs.get(element))if(element.getAttribute(name)!==value)element.setAttribute(name,value);
 }
}

export function translateTree(root){
 if(!root)return;
 if(root.nodeType===3){translateNodeText(root);return;}
 if(root.nodeType===1)translateElementAttrs(root);
 const walker=(root.ownerDocument||document).createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 let node=walker.nextNode();
 while(node){if(node.nodeType===3)translateNodeText(node);else translateElementAttrs(node);node=walker.nextNode();}
}

function startObserver(root=document){
 if(observers.has(root))return;
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='characterData')translateNodeText(record.target);
   else if(record.type==='attributes')translateElementAttrs(record.target);
   else for(const node of record.addedNodes)translateTree(node);
  }
 });
 observer.observe(root.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
 observers.set(root,observer);
}

function translateDocument(root){
 root.documentElement.lang=current==='en'?'en':'zh-CN';
 translateTree(root.body);
 root.documentElement.style.setProperty('--hint-empty',translateText(' · 拖入 PNG 或点导入'));
 if(root.title)root.title=translateText(surfaceTitles.get(root)||root.title);
}

export function registerLocaleSurface(root){
 surfaceTitles.set(root,root.title);
 translateDocument(root);
 startObserver(root);
 return()=>{observers.get(root)?.disconnect();observers.delete(root);};
}

export function locale(){return current;}

export function applyLocale(next){
 const target=next==='en'?'en':'zh';
 if(target!==current){
  current=target;
  translateDocument(document);
  for(const root of observers.keys())if(root!==document)translateDocument(root);
 }
 startObserver();
 if(window.desktop?.setLocale)window.desktop.setLocale(current);
 return current;
}

export function initI18n(){
 rebuild();
 let saved=systemLocale(navigator.language);
 try{saved=localStorage.getItem(LOCALE_KEY)||saved;}catch{}
 applyLocale(saved);
 return saved;
}

export function persistLocale(next){
 const target=next==='en'?'en':'zh';
 try{localStorage.setItem(LOCALE_KEY,target);}catch{}
 return applyLocale(target);
}

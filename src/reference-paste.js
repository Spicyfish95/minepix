import {isTextTarget} from './interaction.js';

export function installReferencePaste({onUI,panel,readImages,importImages,blocked=()=>false,onError}){
 let hovered=null,pasting=false;
 onUI('pointerover',event=>{hovered=event.target.closest?.('#reference-panel')||null;});
 onUI('pointerout',event=>{if(hovered?.contains(event.target)&&!hovered.contains(event.relatedTarget))hovered=null;});
 onUI('pointerleave',()=>{hovered=null;});
 onUI('keydown',event=>{
  if(!hovered||hovered!==panel()||hovered.hidden||hovered.ownerDocument!==event.target.ownerDocument
    ||isTextTarget(event.target)||event.isComposing||event.keyCode===229
    ||!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||event.key.toLowerCase()!=='v'||blocked())return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.repeat||pasting)return;
  pasting=true;
  void (async()=>{
   try{const images=await readImages();if(images.length)await importImages(images);}
   catch(error){onError(error);}
   finally{pasting=false;}
  })();
 },true);
}

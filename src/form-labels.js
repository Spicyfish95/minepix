export function installFormLabels(onUI){
 onUI('click',event=>{
  const label=event.target.closest?.('label');
  if(!label||label.classList.contains('toolbar-toggle-label'))return;
  const control=label.control;
  if(!control?.matches('input,select,textarea')||control.type==='radio'
    ||event.target.closest('input,select,textarea,button,a'))return;
  if(control.type==='checkbox'&&control.getAttribute('role')!=='switch'&&control.parentElement!==label)return;
  event.preventDefault();
 },true);
}

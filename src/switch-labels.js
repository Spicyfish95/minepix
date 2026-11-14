export function installSwitchLabels(onUI){
 onUI('click',event=>{
  const label=event.target.closest?.('label');
  if(!label||label.classList.contains('toolbar-toggle-label'))return;
  const control=label.control;
  if(control?.type!=='checkbox'||event.target===control)return;
  if(control.getAttribute('role')==='switch'||control.parentElement===label)event.preventDefault();
 },true);
}

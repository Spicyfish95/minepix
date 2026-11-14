const UNIT_PATTERN=/^\s*(px|%|°|ms|像素|毫秒|秒|度)\s*$/;
const CAPTION_UNIT=/\s*[（(](px|%|°|ms|像素|毫秒|秒|度)[）)]\s*$/;
export function normalizeNumberUnits(root){
 const inputs=[...(root.matches?.('input[type=number]')?[root]:[]),...root.querySelectorAll('input[type=number]')];
 for(const input of inputs){
  if(input.closest('.number-unit'))continue;
  const tail=input.nextSibling,caption=input.previousSibling;
  const suffix=tail?.nodeType===3&&tail.textContent.match(UNIT_PATTERN);
  const captionNode=caption?.nodeType===3?caption:input.previousElementSibling?.matches('.field-caption')?input.previousElementSibling:null;
  const captionUnit=!suffix&&captionNode?.textContent.match(CAPTION_UNIT),unit=suffix?.[1]||captionUnit?.[1];
  if(!unit)continue;
  if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',input.closest('label')?.textContent.trim()||unit);
  if(suffix)tail.remove();else captionNode.textContent=captionNode.textContent.replace(CAPTION_UNIT,'');
  const parent=input.parentElement,wrap=parent.matches('span')&&parent.childNodes.length===1?parent:input.ownerDocument.createElement('span');
  wrap.classList.add('number-unit');wrap.dataset.unit=unit;
  if(input.classList.contains('field-control')){input.classList.remove('field-control');wrap.classList.add('field-control');}
  if(wrap!==parent){input.before(wrap);wrap.append(input);}
 }
}

// Only visible captions participate; icon-only and compound slider controls keep their layout.
export function normalizeFormLayout(root){
 normalizeNumberUnits(root);
 const fields=[...(root.matches?.('label,.color-field')?[root]:[]),...root.querySelectorAll('label,.color-field')];
 for(const field of fields){
  if(field.classList.contains('form-field'))continue;
  const controls=[...field.children].filter(el=>el.matches('input,select,textarea,.number-unit'));
  if(controls.length!==1){
   const caption=[...field.children].find(el=>el.tagName==='SPAN'&&el.textContent.trim()&&!el.querySelector('input,select'));
   if(caption){caption.classList.add('field-caption');if(/[:：]\s*$/.test(caption.textContent))caption.dataset.hasColon='true';}
   continue;
  }
  const control=controls[0],captionNodes=[...field.childNodes].filter(node=>node!==control);
  if(!captionNodes.some(node=>node.textContent.trim()))continue;
  const caption=document.createElement('span');caption.className='field-caption';caption.append(...captionNodes);
  if(/[:：]\s*$/.test(caption.textContent))caption.dataset.hasColon='true';
  field.prepend(caption);field.classList.add('form-field');control.classList.add('field-control');
 }
}

export function orderFormOptions(root){
 const parents=new Set([...root.querySelectorAll('.form-field')].map(field=>field.parentElement));
 for(const parent of parents){
  if(parent.matches('.repair-option-row,.form-option-row'))continue;
  let run=[];
  const flush=()=>{
   if(run.some(field=>field.querySelector('input[type=checkbox]'))){
    const end=run.at(-1).nextSibling;
    for(const field of run.toSorted((a,b)=>Number(!!a.querySelector('input[type=checkbox]'))-Number(!!b.querySelector('input[type=checkbox]'))))parent.insertBefore(field,end);
   }
   run=[];
  };
  for(const child of [...parent.children]){if(child.classList.contains('form-field')&&!child.hasAttribute('data-master-switch'))run.push(child);else flush();}
  flush();
 }
}

export function initFormLayout(){
 normalizeFormLayout(document.body);
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===Node.ELEMENT_NODE)normalizeFormLayout(node);
 });
 observer.observe(document.body,{childList:true,subtree:true});
}

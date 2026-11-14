import {colorValue} from './model.js';
import {combineSelection} from './selection-mask.js';
import {colorRangeSelection,modifySelection} from './selection-edit.js';

export async function editSelectionDialog(kind,{doc,pixels,foreground,modal,$,getSelection,setSelection,rememberSelection}){
 const original=getSelection(),range=kind==='color-range',titles={expand:'扩展选区',contract:'收缩选区',border:'边界选区','color-range':'按颜色范围选择'};
 if(!range&&!original?.w)return;
 const saved=JSON.parse(localStorage.getItem('pixel-studio-selection-modify')||'{"amount":1,"shape":"circle"}');
 const fields=range?'<label>目标颜色<input name="matchColor" type="color" value="'+foreground.slice(0,7)+'"></label><label>目标透明度<input name="alpha" type="number" min="0" max="255" value="'+(foreground.length===9?parseInt(foreground.slice(7),16):255)+'" required></label><label>颜色容差<input name="tolerance" type="number" min="0" max="255" value="0" required></label><label>选区操作<select name="operation"><option value="replace">替换</option><option value="add">相加</option><option value="subtract">相减</option><option value="intersect">相交</option></select></label>':'<label>'+(kind==='border'?'边界宽度':'修改数量')+'<input name="amount" type="number" min="1" max="100" value="'+saved.amount+'" required> px</label><label>边角形状<select name="shape"><option value="circle">圆形</option><option value="square">方形</option></select></label>';
 let chosen;
 try{
  const values=await modal(titles[kind],'<div class="selection-edit-fields">'+fields+'</div><label><input name="preview" type="checkbox" checked>预览选区</label>',form=>{
   if(!range)form.elements.shape.value=saved.shape;
   const read=()=>range?combineSelection(doc,original,colorRangeSelection(doc,pixels,colorValue(form.elements.matchColor.value+(+form.elements.alpha.value).toString(16).padStart(2,'0')),+form.elements.tolerance.value),form.elements.operation.value):modifySelection(doc,original,kind,+form.elements.amount.value,form.elements.shape.value);
   const preview=()=>{if(!form.checkValidity()){setSelection(original);return;}chosen=read();setSelection(form.elements.preview.checked?chosen:original);};
   form.oninput=preview;preview();
  },()=>{if(!$('modal-form').checkValidity())throw new Error('请填写有效的选区参数');});
  if(values){rememberSelection(original);setSelection(chosen);if(!range)localStorage.setItem('pixel-studio-selection-modify',JSON.stringify({amount:+values.amount,shape:values.shape}));}
  else setSelection(original);
 }finally{$('modal-form').oninput=null;}
}

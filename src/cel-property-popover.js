import {showTimelinePopover} from './timeline-popover.js';
export function showCelProperties({trigger,initial,apply}){
 return showTimelinePopover({trigger,id:'cel-properties-popover',title:'Cel 属性',
 content:'<label>位置 X<input name="x" type="number" min="-32768" max="32767" required></label><label>位置 Y<input name="y" type="number" min="-32768" max="32767" required></label><label>Cel 透明度<span class="number-unit opacity-editor" data-unit="%"><input data-opacity-slider type="range" min="0" max="100" step="1" aria-label="Cel 透明度滑条"><input name="opacity" type="number" min="0" max="100" step="any" required aria-label="Cel 透明度"></span></label><p>位置与透明度仅作用于当前 cel；链接 cel 继续共享原始图像。</p>',
 setup:form=>{
  for(const name of ['x','y','opacity'])form.elements[name].value=initial[name];
  const number=form.elements.opacity,slider=form.querySelector('[data-opacity-slider]');slider.value=number.value;
  slider.oninput=()=>{number.value=slider.value;};
  number.oninput=()=>{if(number.validity.valid)slider.value=number.value;};
 },apply:form=>apply(Object.fromEntries(['x','y','opacity'].map(key=>[key,+form.elements[key].value])))
 });
}

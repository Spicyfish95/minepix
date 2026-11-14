import {rgba,hsv,fromRgba,fromHsv,normalizeColor} from './colors.js';

export function initColorAdjustments({onPreview,onCommit}){
 const host=document.createElement('section');host.id='color-adjustments';host.setAttribute('aria-label','当前前景色调整');
 host.innerHTML='<div class="color-adjust-heading"><strong>前景色调整</strong><select aria-label="颜色通道模式"><option value="hsv">HSV</option><option value="rgb">RGB</option></select></div><div class="color-sv" role="slider" tabindex="0" aria-label="饱和度与明度" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="color-adjust-channels"></div>';
 document.getElementById('add-color').after(host);
 const mode=host.querySelector('select'),square=host.querySelector('.color-sv'),marker=square.firstElementChild,rows=host.querySelector('.color-adjust-channels');
 let current=null,channels={h:0,s:100,v:100,a:255},rgb={r:255,g:0,b:0,a:255};
 const specs={h:['H',360,'色相'],s:['S',100,'饱和度'],v:['V',100,'明度'],r:['R',255,'红色'],g:['G',255,'绿色'],b:['B',255,'蓝色'],a:['A',255,'透明度']};
 function paint(){
  square.style.setProperty('--hue',fromHsv({h:channels.h,s:100,v:100}));marker.style.left=channels.s+'%';marker.style.top=(100-channels.v)+'%';square.setAttribute('aria-valuenow',channels.s);square.setAttribute('aria-valuetext',`饱和度 ${channels.s}%，明度 ${channels.v}%`);
  for(const row of rows.children){const key=row.dataset.channel,[,max]=specs[key],value=key in rgb&&mode.value==='rgb'?rgb[key]:channels[key];for(const input of row.querySelectorAll('input'))input.value=value;
   let gradient;if(key==='h')gradient='linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';else{const colorAt=n=>key==='a'?fromRgba({...rgb,a:n}):mode.value==='rgb'?fromRgba({...rgb,[key]:n}):fromHsv({...channels,[key]:n});gradient=`linear-gradient(to right,${colorAt(0)},${colorAt(max)})`;}
   row.querySelector('[type=range]').style.background=gradient;
  }
 }
 function update(value){value=normalizeColor(value);if(value!==current){current=value;rgb=rgba(value);const next=hsv(value);channels={...next,h:next.s&&next.v?next.h:channels.h,a:rgb.a};}paint();}
 function apply(key,value,commit=false){const [,max]=specs[key];value=Math.round(Math.max(0,Math.min(max,value)));if(mode.value==='rgb'&&['r','g','b','a'].includes(key)){rgb[key]=value;current=fromRgba(rgb);const next=hsv(current);channels={...next,h:next.s&&next.v?next.h:channels.h,a:rgb.a};}else{channels[key]=value;current=fromHsv(channels);rgb=rgba(current);}paint();onPreview(current);if(commit)onCommit(current);}
 function build(){rows.replaceChildren();for(const key of [...(mode.value==='hsv'?['h','s','v']:['r','g','b']),'a']){const [text,max,label]=specs[key],row=document.createElement('label');row.dataset.channel=key;row.innerHTML=`<span>${text}</span><input type="range" min="0" max="${max}" aria-label="${label}"><input type="number" min="0" max="${max}" aria-label="${label}数值">`;for(const input of row.querySelectorAll('input')){input.oninput=()=>{if(input.value!==''&&input.validity.valid)apply(key,+input.value);};input.onchange=()=>{if(input.value!==''&&input.validity.valid)apply(key,+input.value,true);};}rows.append(row);}paint();}
 mode.onchange=build;
 const pick=event=>{const r=square.getBoundingClientRect();channels.s=Math.round(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width))*100);channels.v=Math.round((1-Math.max(0,Math.min(1,(event.clientY-r.top)/r.height)))*100);current=fromHsv(channels);rgb=rgba(current);paint();onPreview(current);};
 square.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();square.focus();square.setPointerCapture(event.pointerId);pick(event);};
 square.onpointermove=event=>{if(square.hasPointerCapture(event.pointerId))pick(event);};
 square.onpointerup=event=>{if(square.hasPointerCapture(event.pointerId)){pick(event);square.releasePointerCapture(event.pointerId);onCommit(current);}};
 square.onpointercancel=()=>onCommit(current);
 square.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?10:1;apply(event.key==='ArrowLeft'||event.key==='ArrowRight'?'s':'v',channels[event.key==='ArrowLeft'||event.key==='ArrowRight'?'s':'v']+(['ArrowRight','ArrowUp'].includes(event.key)?step:-step),true);};
 build();return{update};
}

export function lightAngleEndpoint(degrees){
 const radians=degrees*Math.PI/180;
 return{x:Math.round((60+36*Math.cos(radians))*1000)/1000,y:Math.round((60+36*Math.sin(radians))*1000)/1000};
}

export function normalAngleGuideMarkup(){
 return `<aside id="normal-angle-guide"><svg viewBox="0 0 120 120" role="slider" tabindex="0" aria-label="原绘光照角度盘" aria-valuemin="0" aria-valuemax="359" aria-labelledby="normal-angle-title"><title id="normal-angle-title">原绘光照角度盘</title><defs><marker id="normal-angle-tip" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="currentColor"/></marker></defs><circle cx="60" cy="60" r="38"/><path class="normal-angle-axes" d="M22 60H98 M60 22V98"/><text x="108" y="64">0°</text><text x="60" y="116">90°</text><text x="12" y="64">180°</text><text x="60" y="12">270°</text><line id="normal-angle-vector" x1="60" y1="60" x2="96" y2="60" marker-end="url(#normal-angle-tip)" hidden/></svg><div><strong>原绘光照角度盘</strong><p id="normal-angle-readout" aria-live="polite"></p><p>0° 向右 · 90° 向下 · 180° 向左 · 270° 向上</p></div></aside>`;
}

export function angleFromPoint(x,y){return Math.round((Math.atan2(y-60,x-60)*180/Math.PI+360)%360)%360;}

export function updateNormalAngleGuide(host,degrees,automatic,pending=false){
 const svg=host.querySelector('svg'),arrow=host.querySelector('#normal-angle-vector'),readout=host.querySelector('#normal-angle-readout'),valid=Number.isFinite(degrees)&&degrees>=0&&degrees<=359;
 svg.setAttribute('aria-disabled',String(automatic));svg.tabIndex=automatic?-1:0;
 svg.setAttribute('title',automatic?'关闭“自动估计原绘光照”后可调整角度':'点击、拖动或使用方向键调整角度');
 arrow.toggleAttribute('hidden',!valid);
 if(valid){const point=lightAngleEndpoint(degrees);arrow.setAttribute('x2',point.x);arrow.setAttribute('y2',point.y);svg.setAttribute('aria-valuenow',degrees);}else svg.removeAttribute('aria-valuenow');
 readout.textContent=automatic?(pending?'正在估计光照角度':valid?`自动估计角度：${degrees}°`:'无法可靠估计光照角度'):valid?`手动角度：${degrees}°`:'请输入有效角度';
}

export function bindNormalAngleGuide(host,onChange){
 const svg=host.querySelector('svg');let drag=null;
 const editable=()=>svg.getAttribute('aria-disabled')!=='true';
 const move=event=>{if(!editable())return;const r=svg.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*120,y=(event.clientY-r.top)/r.height*120;if(Math.hypot(x-60,y-60)>=4)onChange(angleFromPoint(x,y));};
 const down=event=>{if(event.button!==0||!editable())return;event.preventDefault();svg.focus();drag=event.pointerId;svg.setPointerCapture(drag);move(event);};
 const pointerMove=event=>{if(event.pointerId===drag)move(event);};
 const end=event=>{if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);drag=null;};
 const key=event=>{if(!editable())return;const step=event.shiftKey?10:1,delta={ArrowLeft:-step,ArrowDown:-step,ArrowRight:step,ArrowUp:step}[event.key];if(delta===undefined&&!['Home','End'].includes(event.key))return;event.preventDefault();onChange(event.key==='Home'?0:event.key==='End'?359:(+(svg.getAttribute('aria-valuenow')||0)+delta+360)%360);};
 svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);svg.addEventListener('keydown',key);
 return()=>{svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerup',end);svg.removeEventListener('pointercancel',end);svg.removeEventListener('lostpointercapture',end);svg.removeEventListener('keydown',key);};
}

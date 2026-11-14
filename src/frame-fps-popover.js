import {showTimelinePopover} from './timeline-popover.js';
export function showFrameFps({trigger,initial,apply}){
 return showTimelinePopover({trigger,id:'frame-fps-popover',title:'按 FPS 设置选中帧',
 content:'<label>帧率<span class="number-unit" data-unit="FPS"><input name="fps" type="number" min="0.1" max="50" step="any" required></span></label><p>应用到所有选中帧，时长按 1000 / FPS 四舍五入为毫秒。当前时长范围 20–10000 ms，对应 0.1–50 FPS。</p>',
 setup:form=>{form.elements.fps.value=initial;},apply:form=>apply(+form.elements.fps.value)
 });
}

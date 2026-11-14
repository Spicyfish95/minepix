export const INPUT_KEY='pixel-studio-input-v1';
export const DEFAULT_INPUT={left:'tool',right:'erase',wheel:'zoom',invert:false,middlePan:true,zoomStep:1.25,panSpeed:1};
export function validateInput(value){const p={...DEFAULT_INPUT,...value};if(!['tool','pan','eyedropper'].includes(p.left)||!['erase','background','pan','eyedropper'].includes(p.right)||!['zoom','pan','frames','brush'].includes(p.wheel)||typeof p.invert!=='boolean'||typeof p.middlePan!=='boolean'||!Number.isFinite(p.zoomStep)||p.zoomStep<1.05||p.zoomStep>2||!Number.isFinite(p.panSpeed)||p.panSpeed<.25||p.panSpeed>4)throw new Error('鼠标动作或速度无效');return p;}
export function loadInput(storage){try{return validateInput(JSON.parse(storage.getItem(INPUT_KEY)||'{}'));}catch{return{...DEFAULT_INPUT};}}
export function pointerTool(tool,prefs,button){const action=button===2?prefs.right:button===0?prefs.left:'tool';return action==='pan'?'hand':action==='eyedropper'?'eyedropper':tool;}
export function wheelIntent(event,prefs){const delta=(event.deltaY||event.deltaX)*(prefs.invert?-1:1);return{action:event.ctrlKey||event.metaKey?'zoom':prefs.wheel,delta,horizontal:!!event.shiftKey};}

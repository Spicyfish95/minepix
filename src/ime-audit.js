export function validateImeAudit(record){
  const events=record.events,starts=events.filter(e=>e.type==='compositionstart'),ends=events.filter(e=>e.type==='compositionend');
  const committed=ends.map(e=>e.data).join('');
  return{ok:record.value==='像素测试'&&starts.length>0&&starts.length===ends.length&&starts.every(e=>e.trusted)&&events.some(e=>e.type==='input'&&e.trusted&&e.composing)&&committed===record.value,committed,compositions:starts.length};
}

export function errorText(error){
  return error instanceof Error?error.message:String(error??'未知错误');
}

export function installErrorDialog(win,document,onReport=()=>{}){
  const dialog=document.createElement('dialog');
  dialog.id='error-dialog';dialog.setAttribute('aria-labelledby','error-title');dialog.setAttribute('role','alertdialog');
  dialog.innerHTML='<form method="dialog"><div class="modal-heading"><h2 id="error-title">Error · 错误</h2><button value="close" aria-label="关闭">×</button></div><p id="error-detail" role="alert"></p><div class="modal-actions"><button class="primary" value="ok">确定</button></div></form>';
  document.body.append(dialog);
  const report=error=>{
    const text=errorText(error);onReport(text);
    document.getElementById('error-detail').textContent=text;
    if(!dialog.open)dialog.showModal();
  };
  win.addEventListener('error',event=>{if(event.error||event.message)report(event.error||event.message);});
  win.addEventListener('unhandledrejection',event=>{event.preventDefault();report(event.reason);});
  return report;
}

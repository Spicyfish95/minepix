param([ValidateSet('show','alt-start','click','release')][string]$Mode,[string]$Output,[int]$ProcessId,[int]$X,[int]$Y)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ScreenColorInput {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
}
"@
[ScreenColorInput]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
if($Mode -eq 'show') {
 $taskScreen=[Windows.Forms.Screen]::PrimaryScreen.Bounds
 $taskForm=[Windows.Forms.Form]::new();$taskForm.Text='MinePix screen color fixture';$taskForm.FormBorderStyle='None';$taskForm.StartPosition='Manual';$taskForm.Location=[Drawing.Point]::new($taskScreen.Left+16,$taskScreen.Top+16);$taskForm.Size=[Drawing.Size]::new(160,120);$taskForm.BackColor=[Drawing.Color]::FromArgb(36,104,172);$taskForm.TopMost=$true
 $taskSecond=[Windows.Forms.Panel]::new();$taskSecond.Location=[Drawing.Point]::new(80,0);$taskSecond.Size=[Drawing.Size]::new(80,120);$taskSecond.BackColor=[Drawing.Color]::FromArgb(155,70,15);$taskForm.Controls.Add($taskSecond)
 $taskForm.Add_Shown({[IO.File]::WriteAllText($Output,(@{x=$taskForm.Left+40;x2=$taskForm.Left+120;y=$taskForm.Top+60;color='#2468ac'}|ConvertTo-Json -Compress))})
 [Windows.Forms.Application]::Run($taskForm)
} elseif($Mode -eq 'alt-start') {
 $taskApp=Get-Process -Id $ProcessId
 [ScreenColorInput]::SetForegroundWindow($taskApp.MainWindowHandle) | Out-Null
 [ScreenColorInput]::SetCursorPos($X,$Y) | Out-Null
 Start-Sleep -Milliseconds 150
 [ScreenColorInput]::keybd_event(18,0,0,[UIntPtr]::Zero)
} elseif($Mode -eq 'click') {
 [ScreenColorInput]::SetCursorPos($X,$Y) | Out-Null
 [ScreenColorInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
 [ScreenColorInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
} else {[ScreenColorInput]::keybd_event(18,0,2,[UIntPtr]::Zero)}

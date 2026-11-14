param([Parameter(Mandatory=$true)][int]$ProcessId)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MinePixWindowState {
    public delegate bool WindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    public static IntPtr MinimizedWindow(uint processId) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window, parameter)=>{uint owner;GetWindowThreadProcessId(window,out owner);if(owner==processId && IsIconic(window)){found=window;return false;}return true;},IntPtr.Zero);
        return found;
    }
}
'@
$taskMinimized=$false
for($taskAttempt=0;$taskAttempt -lt 50;$taskAttempt++) {
    $taskHandle=[MinePixWindowState]::MinimizedWindow($ProcessId)
    if($taskHandle -ne [IntPtr]::Zero) { $taskMinimized=$true; break }
    Start-Sleep -Milliseconds 50
}
if(-not $taskMinimized) { throw 'Own test window did not minimize' }
[MinePixWindowState]::ShowWindowAsync($taskHandle,9) | Out-Null
for($taskAttempt=0;$taskAttempt -lt 50;$taskAttempt++) {
    if(-not [MinePixWindowState]::IsIconic($taskHandle)) { [pscustomobject]@{minimized=$true;restored=$true;processId=$ProcessId}|ConvertTo-Json -Compress; exit 0 }
    Start-Sleep -Milliseconds 50
}
throw 'Own test window did not restore'

param([Parameter(Mandatory=$true)][int]$ProcessId)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class MinePixBenchmarkForeground {
    public delegate bool WindowCallback(IntPtr window, IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder title, int max);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll",SetLastError=true)] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
    public static IntPtr MainWindow(uint processId) {
        IntPtr found=IntPtr.Zero; long area=0;
        EnumWindows((window,parameter)=>{
            uint owner; GetWindowThreadProcessId(window,out owner);
            if(owner!=processId)return true;
            var title=new StringBuilder(512); GetWindowText(window,title,title.Capacity);
            if(!title.ToString().Contains("MinePix"))return true;
            Rect rect; GetWindowRect(window,out rect);
            long size=(long)(rect.right-rect.left)*(rect.bottom-rect.top);
            if(size>area){area=size;found=window;}return true;
        },IntPtr.Zero);return found;
    }
}
'@
$taskProcess=Get-Process -Id $ProcessId
$taskWindow=[MinePixBenchmarkForeground]::MainWindow($ProcessId)
if($taskWindow -eq [IntPtr]::Zero) { throw 'Own benchmark process has no main window' }
if([MinePixBenchmarkForeground]::IsIconic($taskWindow) -or -not [MinePixBenchmarkForeground]::IsWindowVisible($taskWindow)) { [MinePixBenchmarkForeground]::ShowWindowAsync($taskWindow,9) | Out-Null }
if(-not [MinePixBenchmarkForeground]::SetWindowPos($taskWindow,[IntPtr](-1),0,0,0,0,0x43)) { throw 'Cannot show own benchmark window above other windows' }
$taskFocused=[MinePixBenchmarkForeground]::SetForegroundWindow($taskWindow)
# Official APIs: SetWindowPos / SetThreadExecutionState; no registry or global power-plan changes.
try {
    $taskPower=[MinePixBenchmarkForeground]::SetThreadExecutionState([uint32]2147483651)
    if($taskPower -eq 0) { throw 'Cannot keep the display awake for this measurement' }
    [pscustomobject]@{processId=$ProcessId;topmost=$true;keepDisplayAwake=$true;foregroundRequested=$taskFocused} | ConvertTo-Json -Compress
    [Console]::Out.Flush()
    $taskProcess.WaitForExit()
} finally {
    [MinePixBenchmarkForeground]::SetThreadExecutionState([uint32]2147483648) | Out-Null
}

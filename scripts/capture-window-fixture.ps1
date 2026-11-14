param([int]$ProcessId,[ValidateSet('inspect','watch','move')][string]$Mode='inspect',[int]$X,[int]$Y)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class CaptureWindowFixture {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    public delegate bool Callback(IntPtr window, IntPtr arg);
    [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr arg);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder title, int count);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
    public static IntPtr Find(int process) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window,arg)=>{
            uint owner; GetWindowThreadProcessId(window,out owner);
            if(owner!=process) return true;
            var title=new StringBuilder(256); GetWindowText(window,title,256);
            if(title.ToString().Contains("\u622a\u56fe")) { found=window; return false; }
            return true;
        },IntPtr.Zero);
        return found;
    }
}
'@
[CaptureWindowFixture]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
if ($Mode -eq 'move') {
    if (-not [CaptureWindowFixture]::SetCursorPos($X,$Y)) { throw 'Cannot move test cursor' }
    exit 0
}
if ($Mode -eq 'watch') {
    Write-Output 'watching'
    $taskHidden=0
    $taskStart=[DateTime]::UtcNow
    while (([DateTime]::UtcNow-$taskStart).TotalSeconds -lt 15) {
        $taskWindow=[CaptureWindowFixture]::Find($ProcessId)
        if ($taskWindow -ne [IntPtr]::Zero) {
            if ([CaptureWindowFixture]::IsWindowVisible($taskWindow)) {
                @{visible=$true;hiddenSamples=$taskHidden;focused=[CaptureWindowFixture]::GetForegroundWindow() -eq $taskWindow;visibleAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json -Compress
                exit 0
            }
            $taskHidden++
        }
        Start-Sleep -Milliseconds 5
    }
    throw 'Capture window did not become visible'
}
$taskWindow=[CaptureWindowFixture]::Find($ProcessId)
if ($taskWindow -eq [IntPtr]::Zero) { throw 'Capture window not found in test process' }
$taskBounds=[CaptureWindowFixture+Rect]::new()
[CaptureWindowFixture]::GetWindowRect($taskWindow,[ref]$taskBounds) | Out-Null
@{visible=[CaptureWindowFixture]::IsWindowVisible($taskWindow);focused=[CaptureWindowFixture]::GetForegroundWindow() -eq $taskWindow;x=$taskBounds.left;y=$taskBounds.top;width=$taskBounds.right-$taskBounds.left;height=$taskBounds.bottom-$taskBounds.top} | ConvertTo-Json -Compress

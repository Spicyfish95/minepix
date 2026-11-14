param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [Parameter(Mandatory=$true)][string]$ExpectedTitle,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MinePixToastPointer {
    public delegate bool WindowCallback(IntPtr window,IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int x,y; }
    [StructLayout(LayoutKind.Sequential)] public struct MouseInput { public int dx,dy; public uint mouseData,flags,time; public UIntPtr extraInfo; }
    [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public MouseInput mouse; }
    [StructLayout(LayoutKind.Sequential)] public struct Input { public uint type; public InputUnion data; }
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback,IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder title,int length);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint count,Input[] inputs,int size);
    public static void Button(uint flags) {
        var input=new Input { type=0, data=new InputUnion { mouse=new MouseInput { flags=flags } } };
        if(SendInput(1,new[]{input},Marshal.SizeOf(typeof(Input)))!=1)throw new Exception("Toast input was rejected");
    }
    public static IntPtr Find(uint pid) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window,parameter)=>{
            uint owner;GetWindowThreadProcessId(window,out owner);
            var title=new StringBuilder(1024);GetWindowText(window,title,title.Capacity);
            if(owner==pid && title.ToString()=="MinePix Tauri"){found=window;return false;}return true;
        },IntPtr.Zero);return found;
    }
}
'@
[MinePixToastPointer]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$taskAppWindow=[MinePixToastPointer]::Find($ProcessId)
if($taskAppWindow -eq [IntPtr]::Zero) { throw 'Own MinePix window not found' }
$taskRoot=[System.Windows.Automation.AutomationElement]::RootElement
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'native-ready.json'),([pscustomobject]@{ready=$true;expectedTitle=$ExpectedTitle} | ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
$taskMatches=[System.Collections.Generic.List[object]]::new()
$taskSeenRoots=[System.Collections.Generic.HashSet[string]]::new()
$taskRoots=[System.Collections.Generic.List[object]]::new()
$taskToast=$null
$taskTitle=$null
$taskDeadline=[DateTime]::UtcNow.AddSeconds(15)
while([DateTime]::UtcNow -lt $taskDeadline -and $null -eq $taskToast) {
    foreach($taskTop in $taskRoot.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)) {
        $taskTopOwner=Get-Process -Id $taskTop.Current.ProcessId
        $taskWindowsPath=$env:WINDIR.TrimEnd('\')+'\'
        if(-not $taskTopOwner.Path -or -not $taskTopOwner.Path.StartsWith($taskWindowsPath,[StringComparison]::OrdinalIgnoreCase)) { continue }
        $taskRootKey=[string]$taskTop.Current.ProcessId+':'+$taskTop.Current.NativeWindowHandle
        if($taskSeenRoots.Add($taskRootKey)) { $taskRoots.Add(@{owner=$taskTopOwner.ProcessName;class=$taskTop.Current.ClassName;offscreen=$taskTop.Current.IsOffscreen;width=$taskTop.Current.BoundingRectangle.Width;height=$taskTop.Current.BoundingRectangle.Height}) }
        foreach($taskElement in $taskTop.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)) {
            if(-not $taskElement.Current.Name.Contains($ExpectedTitle)) { continue }
            $taskOwner=Get-Process -Id $taskElement.Current.ProcessId
            if($taskMatches.Count -lt 20) { $taskMatches.Add(@{type=$taskElement.Current.ControlType.ProgrammaticName;class=$taskElement.Current.ClassName;pid=$taskElement.Current.ProcessId;owner=$taskOwner.ProcessName;offscreen=$taskElement.Current.IsOffscreen;width=$taskElement.Current.BoundingRectangle.Width;height=$taskElement.Current.BoundingRectangle.Height}) }
            if($taskElement.Current.IsOffscreen) { continue }
            $taskOwnerPath=$taskOwner.Path
            $taskWindowsPath=$env:WINDIR.TrimEnd('\')+'\'
            if(-not $taskOwnerPath.StartsWith($taskWindowsPath,[StringComparison]::OrdinalIgnoreCase)) { continue }
            $taskCandidate=$taskElement
            while($null -ne $taskCandidate -and $taskCandidate.Current.ProcessId -eq $taskTop.Current.ProcessId) {
                if($taskCandidate.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button) {
                    $taskRect=$taskCandidate.Current.BoundingRectangle
                    if($taskRect.Width -ge 100 -and $taskRect.Width -le 900 -and $taskRect.Height -ge 40 -and $taskRect.Height -le 600) {
                        $taskToast=$taskCandidate;$taskTitle=$taskElement.Current.Name;break
                    }
                }
                $taskCandidate=[System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($taskCandidate)
            }
            if($null -ne $taskToast) { break }
        }
        if($null -ne $taskToast) { break }
    }
    if($null -eq $taskToast) { Start-Sleep -Milliseconds 50 }
}
if($null -eq $taskToast) {
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'uia-matches.json'),([pscustomobject]@{matches=@($taskMatches.ToArray());roots=@($taskRoots.ToArray())} | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
    throw 'No visible Windows toast matched the exact MinePix test title; no notification settings were changed'
}
while(-not [MinePixToastPointer]::IsIconic($taskAppWindow) -and [DateTime]::UtcNow -lt $taskDeadline) { Start-Sleep -Milliseconds 25 }
if(-not [MinePixToastPointer]::IsIconic($taskAppWindow)) { throw 'Own app must be minimized before testing notification return' }
$taskRect=$taskToast.Current.BoundingRectangle
$taskPoint=[MinePixToastPointer+Point]::new()
$taskPoint.x=[int]($taskRect.X+$taskRect.Width/2)
$taskPoint.y=[int]($taskRect.Y+$taskRect.Height/2)
$taskHit=[MinePixToastPointer]::GetAncestor([MinePixToastPointer]::WindowFromPoint($taskPoint),2)
[uint32]$taskHitPid=0
[MinePixToastPointer]::GetWindowThreadProcessId($taskHit,[ref]$taskHitPid) | Out-Null
if($taskHitPid -ne $taskToast.Current.ProcessId -or -not $taskToast.Current.Name.Contains($ExpectedTitle)) { throw 'Native toast input target no longer matches the MinePix notification' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$taskBitmap=[Drawing.Bitmap]::new([int]$taskRect.Width,[int]$taskRect.Height)
$taskGraphics=[Drawing.Graphics]::FromImage($taskBitmap)
try {
    $taskGraphics.CopyFromScreen([int]$taskRect.X,[int]$taskRect.Y,0,0,$taskBitmap.Size)
    $taskBitmap.Save((Join-Path $OutputDirectory 'windows-toast.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally { $taskGraphics.Dispose();$taskBitmap.Dispose() }
$taskCursor=[MinePixToastPointer+Point]::new()
[MinePixToastPointer]::GetCursorPos([ref]$taskCursor) | Out-Null
$taskPressed=$false
try {
    [MinePixToastPointer]::SetCursorPos($taskPoint.x,$taskPoint.y) | Out-Null
    [MinePixToastPointer]::Button(0x0002)
    $taskPressed=$true
    [MinePixToastPointer]::Button(0x0004)
    $taskPressed=$false
} finally {
    if($taskPressed) { [MinePixToastPointer]::Button(0x0004) }
    [MinePixToastPointer]::SetCursorPos($taskCursor.x,$taskCursor.y) | Out-Null
}
$taskReport=[pscustomobject]@{title=$taskTitle;hostPid=$taskHitPid;minimizedBeforeClick=$true;clicked=$true;rect=@{x=$taskRect.X;y=$taskRect.Y;width=$taskRect.Width;height=$taskRect.Height};point=@{x=$taskPoint.x;y=$taskPoint.y}}
$taskReport | ConvertTo-Json -Depth 5 -Compress

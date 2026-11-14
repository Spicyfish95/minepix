param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [Parameter(Mandatory=$true)][string]$Title,
    [ValidateSet('inspect','drag','resize')][string]$Action='inspect',
    [int]$ClientX=0,[int]$ClientY=0,[int]$DeltaX=0,[int]$DeltaY=0
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MinePixNativePointer {
    public delegate bool WindowCallback(IntPtr window,IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int x,y; }
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct MouseInput { public int dx,dy; public uint mouseData,flags,time; public UIntPtr extraInfo; }
    [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public MouseInput mouse; }
    [StructLayout(LayoutKind.Sequential)] public struct Input { public uint type; public InputUnion data; }
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback,IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder title,int length);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window,ref Point point);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll",EntryPoint="SendMessageW")] public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint count,Input[] inputs,int size);
    public static void Button(uint flags) {
        var input=new Input { type=0, data=new InputUnion { mouse=new MouseInput { flags=flags } } };
        if(SendInput(1,new[]{input},Marshal.SizeOf(typeof(Input)))!=1)throw new Exception("Native mouse input was rejected");
    }
    public static IntPtr Find(uint pid,string expected) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window,parameter)=>{
            uint owner;GetWindowThreadProcessId(window,out owner);
            if(owner==pid){var title=new StringBuilder(1024);GetWindowText(window,title,title.Capacity);if(title.ToString()==expected){found=window;return false;}}return true;
        },IntPtr.Zero);return found;
    }
}
'@
[MinePixNativePointer]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$taskWindow=[MinePixNativePointer]::Find($ProcessId,$Title)
if($taskWindow -eq [IntPtr]::Zero) { throw 'Own process/title window not found' }
function Read-TaskWindow {
    $taskRect=[MinePixNativePointer+Rect]::new()
    $taskClient=[MinePixNativePointer+Rect]::new()
    $taskOrigin=[MinePixNativePointer+Point]::new()
    [MinePixNativePointer]::GetWindowRect($taskWindow,[ref]$taskRect) | Out-Null
    [MinePixNativePointer]::GetClientRect($taskWindow,[ref]$taskClient) | Out-Null
    [MinePixNativePointer]::ClientToScreen($taskWindow,[ref]$taskOrigin) | Out-Null
    [pscustomobject]@{rect=@{x=$taskRect.left;y=$taskRect.top;width=$taskRect.right-$taskRect.left;height=$taskRect.bottom-$taskRect.top};client=@{x=$taskOrigin.x;y=$taskOrigin.y;width=$taskClient.right;height=$taskClient.bottom};dpi=[MinePixNativePointer]::GetDpiForWindow($taskWindow);monitor=[System.Windows.Forms.Screen]::FromHandle($taskWindow).DeviceName;minimized=[MinePixNativePointer]::IsIconic($taskWindow);maximized=[MinePixNativePointer]::IsZoomed($taskWindow);visible=[MinePixNativePointer]::IsWindowVisible($taskWindow)}
}
$taskBefore=Read-TaskWindow
$taskInput=$null
if($Action -in 'drag','resize') {
    if($taskBefore.minimized -or $taskBefore.maximized -or -not $taskBefore.visible) { throw 'Own test window must be visible and restored before dragging' }
    $taskStart=[MinePixNativePointer+Point]::new()
    if($Action -eq 'resize') {
        $taskStart.x=$taskBefore.rect.x+$taskBefore.rect.width-3
        $taskStart.y=$taskBefore.rect.y+$taskBefore.rect.height-3
        $taskPacked=($taskStart.x -band 65535) -bor (($taskStart.y -band 65535) -shl 16)
        if([MinePixNativePointer]::SendMessage($taskWindow,0x84,[IntPtr]::Zero,[IntPtr]$taskPacked).ToInt64() -ne 17) { throw 'Own resize origin must hit HTBOTTOMRIGHT' }
    } else {
        if($ClientX -lt 0 -or $ClientY -lt 0 -or $ClientX -ge $taskBefore.client.width -or $ClientY -ge $taskBefore.client.height) { throw 'Input origin is outside own client area' }
        $taskStart.x=$taskBefore.client.x+$ClientX
        $taskStart.y=$taskBefore.client.y+$ClientY
    }
    $taskWasTopmost=([MinePixNativePointer]::GetWindowLong($taskWindow,-20) -band 8) -ne 0
    $taskCursor=[MinePixNativePointer+Point]::new()
    [MinePixNativePointer]::GetCursorPos([ref]$taskCursor) | Out-Null
    $taskDown=$false
    try {
        [MinePixNativePointer]::SetWindowPos($taskWindow,[IntPtr](-1),0,0,0,0,0x43) | Out-Null
        [MinePixNativePointer]::SetForegroundWindow($taskWindow) | Out-Null
        [MinePixNativePointer]::SetCursorPos($taskStart.x,$taskStart.y) | Out-Null
        Start-Sleep -Milliseconds 120
        if([MinePixNativePointer]::GetAncestor([MinePixNativePointer]::WindowFromPoint($taskStart),2) -ne $taskWindow) { throw 'Native pointer origin did not hit own test window' }
        [MinePixNativePointer]::Button(2)
        $taskDown=$true
        Start-Sleep -Milliseconds 150
        $taskMoveSamples=[System.Collections.Generic.List[object]]::new()
        for($taskStep=1;$taskStep -le 12;$taskStep++) {
            [MinePixNativePointer]::SetCursorPos($taskStart.x+[int][Math]::Round($DeltaX*$taskStep/12),$taskStart.y+[int][Math]::Round($DeltaY*$taskStep/12)) | Out-Null
            Start-Sleep -Milliseconds 25
            $taskMoveSamples.Add((Read-TaskWindow))
        }
        [MinePixNativePointer]::Button(4)
        $taskDown=$false
        Start-Sleep -Milliseconds 150
        $taskInput=@{origin=@{x=$taskStart.x;y=$taskStart.y};delta=@{x=$DeltaX;y=$DeltaY};steps=12;source='Windows SendInput + SetCursorPos';samples=@($taskMoveSamples.ToArray())}
    } finally {
        if($taskDown) { [MinePixNativePointer]::Button(4) }
        if(-not $taskWasTopmost) { [MinePixNativePointer]::SetWindowPos($taskWindow,[IntPtr](-2),0,0,0,0,0x13) | Out-Null }
        [MinePixNativePointer]::SetCursorPos($taskCursor.x,$taskCursor.y) | Out-Null
    }
}
$taskScreens=@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{name=$_.DeviceName;primary=$_.Primary;bounds=@{x=$_.Bounds.X;y=$_.Bounds.Y;width=$_.Bounds.Width;height=$_.Bounds.Height};workingArea=@{x=$_.WorkingArea.X;y=$_.WorkingArea.Y;width=$_.WorkingArea.Width;height=$_.WorkingArea.Height}} })
[pscustomobject]@{processId=$ProcessId;title=$Title;before=$taskBefore;after=(Read-TaskWindow);input=$taskInput;monitors=$taskScreens} | ConvertTo-Json -Depth 8 -Compress

param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [ValidateSet('inspect','select-all','letters','space','ctrl-space')][string]$Action='inspect',
    [ValidatePattern('^[A-Z]*$')][string]$Letters='',
    [string]$Screenshot
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MinePixKeyboard {
    public delegate bool WindowCallback(IntPtr window,IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct GuiThreadInfo {
        public uint cbSize,flags;
        public IntPtr active,focus,capture,menuOwner,moveSize,caret;
        public Rect caretRect;
    }
    [StructLayout(LayoutKind.Sequential)] public struct KeyboardInput {
        public ushort vk,scan; public uint flags,time; public UIntPtr extra;
    }
    [StructLayout(LayoutKind.Explicit,Size=32)] public struct InputUnion {
        [FieldOffset(0)] public KeyboardInput keyboard;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Input { public uint type; public InputUnion data; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback,IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder title,int size);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint thread,ref GuiThreadInfo info);
    [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(uint thread);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern uint MapVirtualKeyW(uint code,uint mapType);
    [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint count,Input[] inputs,int size);
    public static IntPtr Find(uint pid) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window,parameter)=>{
            uint owner;GetWindowThreadProcessId(window,out owner);
            var title=new StringBuilder(1024);GetWindowText(window,title,title.Capacity);
            if(owner==pid&&title.ToString()=="MinePix Tauri"){found=window;return false;}return true;
        },IntPtr.Zero);
        return found;
    }
    public static void Key(ushort key,bool up) {
        var input=new Input {type=1,data=new InputUnion {keyboard=new KeyboardInput {scan=(ushort)MapVirtualKeyW(key,0),flags=8u|(up?2u:0u)}}};
        if(SendInput(1,new[]{input},Marshal.SizeOf(typeof(Input)))!=1)throw new Exception("Native key input rejected");
    }
    public static void Tap(ushort key){Key(key,false);Key(key,true);}
}
'@
[MinePixKeyboard]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$taskWindow=[MinePixKeyboard]::Find($ProcessId)
if($taskWindow -eq [IntPtr]::Zero){throw 'Own MinePix main window not found'}
[MinePixKeyboard]::SetForegroundWindow($taskWindow) | Out-Null
Start-Sleep -Milliseconds 150
function FocusState {
    if([MinePixKeyboard]::GetForegroundWindow() -ne $taskWindow){throw 'Native keyboard target is not foreground'}
    $taskInfo=[MinePixKeyboard+GuiThreadInfo]::new()
    $taskInfo.cbSize=[Runtime.InteropServices.Marshal]::SizeOf($taskInfo)
    if(-not [MinePixKeyboard]::GetGUIThreadInfo(0,[ref]$taskInfo)){throw 'Foreground focus information unavailable'}
    if([MinePixKeyboard]::GetAncestor($taskInfo.focus,2) -ne $taskWindow){throw 'Focus does not belong to own MinePix window'}
    [uint32]$taskFocusPid=0
    $taskThread=[MinePixKeyboard]::GetWindowThreadProcessId($taskInfo.focus,[ref]$taskFocusPid)
    return @{focus=$taskInfo.focus.ToInt64();focusProcessId=$taskFocusPid;layout=[MinePixKeyboard]::GetKeyboardLayout($taskThread).ToInt64().ToString('x')}
}
$taskBefore=FocusState
switch($Action){
    'select-all' {
        [MinePixKeyboard]::Key(0x11,$false)
        try{[MinePixKeyboard]::Tap(0x41)}finally{[MinePixKeyboard]::Key(0x11,$true)}
    }
    'letters' {
        foreach($taskLetter in $Letters.ToCharArray()){
            $null=FocusState
            [MinePixKeyboard]::Tap([uint16]$taskLetter)
            Start-Sleep -Milliseconds 100
        }
    }
    'space' { [MinePixKeyboard]::Tap(0x20) }
    'ctrl-space' {
        [MinePixKeyboard]::Key(0x11,$false)
        try{[MinePixKeyboard]::Tap(0x20)}finally{[MinePixKeyboard]::Key(0x11,$true)}
    }
}
Start-Sleep -Milliseconds 250
$taskAfter=FocusState
if($Screenshot){
    $taskRect=[MinePixKeyboard+Rect]::new()
    if(-not [MinePixKeyboard]::GetWindowRect($taskWindow,[ref]$taskRect)){throw 'Own window bounds unavailable'}
    $taskBitmap=[Drawing.Bitmap]::new($taskRect.right-$taskRect.left,$taskRect.bottom-$taskRect.top)
    try{
        $taskGraphics=[Drawing.Graphics]::FromImage($taskBitmap)
        try{
            $taskGraphics.CopyFromScreen($taskRect.left,$taskRect.top,0,0,$taskBitmap.Size)
            $taskBitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png)
        }finally{$taskGraphics.Dispose()}
    }finally{$taskBitmap.Dispose()}
}
@{processId=$ProcessId;action=$Action;letters=$Letters;before=$taskBefore;after=$taskAfter;source='Windows SendInput scan-code keys; no Unicode or clipboard'} | ConvertTo-Json -Depth 4 -Compress

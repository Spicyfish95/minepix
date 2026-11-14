param()
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MinePixInstallerUI {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
    [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr h,uint m,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
}
'@
[MinePixInstallerUI]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskVersion = (Get-Content -Raw "$taskRepo/package.json" | ConvertFrom-Json).version
$taskInstaller = Get-Item -LiteralPath "$taskRepo/src-tauri/target/release/bundle/nsis/MinePix_${taskVersion}_x64-setup.exe"
$taskRoot = Join-Path $taskRepo 'artifacts/installer-languages'
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
$taskResults = [Collections.Generic.List[object]]::new()
$taskLanguages = [Collections.Generic.List[object]]::new()
$taskProcess = $null
$taskOk = $false
$taskPreferencePath = 'Software\minepix\MinePix Tauri'
$taskPreference = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($taskPreferencePath)
$taskHadPreferenceKey = $null -ne $taskPreference
$taskHadLanguage = $taskHadPreferenceKey -and $taskPreference.GetValueNames() -contains 'Installer Language'
$taskLanguageValue = if ($taskHadLanguage) { $taskPreference.GetValue('Installer Language') } else { $null }
$taskLanguageKind = if ($taskHadLanguage) { $taskPreference.GetValueKind('Installer Language') } else { $null }
if ($null -ne $taskPreference) { $taskPreference.Dispose() }
function Check([string]$Name, [bool]$Pass) {
    $taskResults.Add([ordered]@{name=$Name;pass=$Pass})
    if (-not $Pass) { throw $Name }
}
function KeyTree([string]$Path) {
    $taskKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
    if ($null -eq $taskKey) { return $null }
    try {
        $taskValues = [ordered]@{}
        foreach ($taskName in @($taskKey.GetValueNames() | Sort-Object)) {
            $taskValues[$taskName] = @{kind=$taskKey.GetValueKind($taskName).ToString();value=$taskKey.GetValue($taskName)}
        }
        $taskChildren = [ordered]@{}
        foreach ($taskName in @($taskKey.GetSubKeyNames() | Sort-Object)) { $taskChildren[$taskName] = KeyTree "$Path\$taskName" }
        return [ordered]@{values=$taskValues;children=$taskChildren}
    } finally { $taskKey.Dispose() }
}
function InstallationState {
    $taskState = [ordered]@{}
    foreach ($taskPath in @(
        'Software\Microsoft\Windows\CurrentVersion\Uninstall\MinePix Tauri',
        'Software\Classes\.pix','Software\Classes\.ase','Software\Classes\.aseprite',
        'Software\Classes\MinePix.Project','Software\Classes\MinePixTauri.Project',
        'Software\Classes\MinePixTauri.Aseprite','Software\Classes\Applications\minepix-tauri.exe',
        'Software\Classes\AppUserModelId\com.minepix.tauri',$taskPreferencePath
    )) { $taskState[$taskPath] = KeyTree $taskPath }
    $taskCache = Join-Path $env:APPDATA 'com.minepix.tauri\update-cache\base.exe'
    $taskState.cache = if (Test-Path -LiteralPath $taskCache) { (Get-FileHash -LiteralPath $taskCache).Hash } else { $null }
    return $taskState | ConvertTo-Json -Depth 40 -Compress
}
function Windows {
    return [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $taskProcess.Id))
}
function Control($Window, [string]$Id) {
    return $Window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$Id))
}
function WaitPage([string]$ControlId) {
    for ($taskAttempt=0; $taskAttempt -lt 100; $taskAttempt++) {
        foreach ($taskWindow in (Windows)) {
            if ($null -ne (Control $taskWindow $ControlId)) { return $taskWindow }
        }
        if ($taskProcess.HasExited) { throw 'Installer exited before the expected page' }
        Start-Sleep -Milliseconds 100
    }
    throw "Installer page did not appear: $ControlId"
}
function Click($Button) {
    if (-not [MinePixInstallerUI]::PostMessageW([IntPtr]$Button.Current.NativeWindowHandle,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)) {
        throw 'Installer control click failed'
    }
}
function Capture($Window, [string]$Name) {
    $taskHandle = [IntPtr]$Window.Current.NativeWindowHandle
    [MinePixInstallerUI]::ShowWindow($taskHandle,1) | Out-Null
    [MinePixInstallerUI]::SetForegroundWindow($taskHandle) | Out-Null
    Start-Sleep -Milliseconds 400
    $taskRect = [MinePixInstallerUI+Rect]::new()
    if (-not [MinePixInstallerUI]::GetWindowRect($taskHandle,[ref]$taskRect)) { throw 'Installer window bounds unavailable' }
    $taskBitmap = [Drawing.Bitmap]::new($taskRect.right-$taskRect.left,$taskRect.bottom-$taskRect.top)
    try {
        $taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
        try {
            $taskDc = $taskGraphics.GetHdc()
            try { if (-not [MinePixInstallerUI]::PrintWindow($taskHandle,$taskDc,0)) { throw 'Installer window capture failed' } }
            finally { $taskGraphics.ReleaseHdc($taskDc) }
        } finally { $taskGraphics.Dispose() }
        $taskBitmap.Save((Join-Path $taskRoot "$Name.png"),[Drawing.Imaging.ImageFormat]::Png)
        if ([MinePixInstallerUI]::GetForegroundWindow() -ne $taskHandle) { throw 'Installer is not foreground for screen capture' }
        $taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
        try {
            $taskGraphics.CopyFromScreen($taskRect.left,$taskRect.top,0,0,$taskBitmap.Size)
            $taskBitmap.Save((Join-Path $taskRoot "$Name-screen.png"),[Drawing.Imaging.ImageFormat]::Png)
        } finally { $taskGraphics.Dispose() }
    } finally { $taskBitmap.Dispose() }
    return @($Window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) |
        ForEach-Object { [ordered]@{name=$_.Current.Name;id=$_.Current.AutomationId;class=$_.Current.ClassName} })
}
$taskBefore = InstallationState
try {
    foreach ($taskSpec in @(
        @{code='english';item='English';title='Welcome to MinePix Setup';next='Next';cancel='Cancel'},
        @{code='simplified';item='中文(简体)';title='欢迎使用 MinePix 安装程序';next='下一步';cancel='取消'},
        @{code='traditional';item='中文(繁體)';title='歡迎使用 MinePix 安裝精靈';next='下一步';cancel='取消'}
    )) {
        $taskProcess = Start-Process -FilePath $taskInstaller.FullName -WindowStyle Hidden -PassThru
        $taskChooser = WaitPage '1002'
        $taskChooserSnapshot = Capture $taskChooser "$($taskSpec.code)-chooser"
        $taskNames = @($taskChooserSnapshot | ForEach-Object { $_.name })
        Check "$($taskSpec.code): chooser exposes all three languages" (
            $taskNames -contains 'English' -and $taskNames -contains '中文(简体)' -and $taskNames -contains '中文(繁體)')
        $taskItem = $taskChooser.FindFirst([System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.AndCondition]::new(
                [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,$taskSpec.item),
                [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::ListItem)))
        ([System.Windows.Automation.SelectionItemPattern]$taskItem.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)).Select()
        Check "$($taskSpec.code): requested language selected" ((Control $taskChooser '1002').Current.Name -ceq $taskSpec.item)
        Click (Control $taskChooser '1')
        $taskWelcome = WaitPage '1201'
        $taskWelcomeSnapshot = Capture $taskWelcome "$($taskSpec.code)-welcome"
        Check "$($taskSpec.code): translated welcome title" ((Control $taskWelcome '1201').Current.Name -ceq $taskSpec.title)
        Check "$($taskSpec.code): translated Next button" ((Control $taskWelcome '1').Current.Name.Contains($taskSpec.next))
        Check "$($taskSpec.code): translated Cancel button" ((Control $taskWelcome '2').Current.Name.Contains($taskSpec.cancel))
        $taskLanguages.Add([ordered]@{language=$taskSpec.code;pid=$taskProcess.Id;chooser=$taskChooserSnapshot;welcome=$taskWelcomeSnapshot})
        Click (Control $taskWelcome '2')
        Check "$($taskSpec.code): cancel exits without installation" ($taskProcess.WaitForExit(10000))
        Check "$($taskSpec.code): installation and preferences unchanged" ((InstallationState) -ceq $taskBefore)
        $taskProcess.Dispose()
        $taskProcess = $null
    }
    $taskOk = $true
} finally {
    if ($null -ne $taskProcess) {
        if (-not $taskProcess.HasExited) { Stop-Process -Id $taskProcess.Id -Force }
        $taskProcess.Dispose()
    }
    $taskPreference = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($taskPreferencePath,$true)
    if ($null -ne $taskPreference) {
        try {
            if ($taskHadLanguage) { $taskPreference.SetValue('Installer Language',$taskLanguageValue,$taskLanguageKind) }
            else { $taskPreference.DeleteValue('Installer Language',$false) }
            $taskEmpty = $taskPreference.ValueCount -eq 0 -and $taskPreference.SubKeyCount -eq 0
        } finally { $taskPreference.Dispose() }
        if (-not $taskHadPreferenceKey -and $taskEmpty) { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($taskPreferencePath) }
    }
    $taskPreserved = (InstallationState) -ceq $taskBefore
    $taskReport = [ordered]@{
        ok=($taskOk -and $taskPreserved);date=(Get-Date).ToString('o');installer=$taskInstaller.FullName
        installerBytes=$taskInstaller.Length;installerSha256=(Get-FileHash -LiteralPath $taskInstaller.FullName).Hash.ToLowerInvariant()
        installed=$false;updated=$false;statePreserved=$taskPreserved
        capture='PrintWindow and foreground screen crop of actual installer windows, UIAutomation control snapshots'
        checks=@($taskResults.ToArray());languages=@($taskLanguages.ToArray())
    }
    [IO.File]::WriteAllText((Join-Path $taskRoot 'report.json'),(($taskReport | ConvertTo-Json -Depth 12) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
}
if (-not $taskReport.ok) { throw 'Installer language verification failed; see report.json' }
[pscustomobject]@{ok=$taskReport.ok;installerSha256=$taskReport.installerSha256;statePreserved=$taskReport.statePreserved;checks=$taskReport.checks.Count} | ConvertTo-Json

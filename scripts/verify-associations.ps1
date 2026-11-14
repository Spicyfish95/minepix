param([switch]$Notifications,[switch]$ManualNotificationReturn)
if ($ManualNotificationReturn) { $Notifications = $true }
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskValidation = Join-Path (Split-Path $taskRepo -Parent) 'minepix-tauri-validation'
$taskInstall = Join-Path $taskValidation 'installed associations'
$taskVersion = (Get-Content -Raw "$taskRepo\package.json" | ConvertFrom-Json).version
$taskInstaller = Get-Item -LiteralPath "$taskRepo\src-tauri\target\release\bundle\nsis\MinePix_${taskVersion}_x64-setup.exe"
$taskRoot = if ($env:MINEPIX_ASSOCIATIONS_ROOT) { [IO.Path]::GetFullPath((Join-Path $taskRepo $env:MINEPIX_ASSOCIATIONS_ROOT)) } else { Join-Path $taskRepo 'artifacts\associations' }
$taskCache = Join-Path $env:APPDATA 'com.minepix.tauri\update-cache\base.exe'
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
New-Item -ItemType Directory -Path $taskValidation -Force | Out-Null
$taskResults = [System.Collections.Generic.List[object]]::new()
function Check([string]$Name,[bool]$Pass) {
    $taskResults.Add([pscustomobject]@{name=$Name;pass=$Pass})
    if (-not $Pass) { throw $Name }
}
function DefaultValue([string]$Path) {
    $taskKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
    if ($null -eq $taskKey) { return $null }
    try { return $taskKey.GetValue('') } finally { $taskKey.Dispose() }
}
function KeyTree([string]$Path) {
    $taskKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
    if ($null -eq $taskKey) { return $null }
    try {
        $taskValues = [ordered]@{}
        foreach ($taskName in @($taskKey.GetValueNames() | Sort-Object)) {
            $taskValues[$taskName] = [ordered]@{kind=$taskKey.GetValueKind($taskName).ToString();value=$taskKey.GetValue($taskName)}
        }
        $taskChildren = [ordered]@{}
        foreach ($taskName in @($taskKey.GetSubKeyNames() | Sort-Object)) { $taskChildren[$taskName] = KeyTree "$Path\$taskName" }
        return [ordered]@{values=$taskValues;children=$taskChildren}
    } finally { $taskKey.Dispose() }
}
function OriginalState {
    return [ordered]@{
        pix=(DefaultValue 'Software\Classes\.pix')
        ase=(DefaultValue 'Software\Classes\.ase')
        aseprite=(DefaultValue 'Software\Classes\.aseprite')

    } | ConvertTo-Json -Depth 30 -Compress
}
$taskBefore = OriginalState
$taskPreserved = @{}
if ($ManualNotificationReturn) {
    if (-not $env:MINEPIX_ASSOCIATIONS_ROOT) { throw 'Manual notification validation requires its own MINEPIX_ASSOCIATIONS_ROOT' }
    if (@(Get-Process minepix-tauri -ErrorAction SilentlyContinue).Count -or @(Get-NetTCPConnection -State Listen -LocalPort 9223,19412 -ErrorAction SilentlyContinue).Count) { throw 'Own application or validation port already occupied' }
    foreach ($taskName in @('updater-settings.json','recent-files.json')) {
        $taskPath=Join-Path $env:APPDATA "com.minepix.tauri\$taskName"
        $taskPreserved[$taskPath]=if(Test-Path -LiteralPath $taskPath){[IO.File]::ReadAllBytes($taskPath)}else{$null}
    }
}
$taskApp = $null
$taskOk = $false
$taskInstalled = $false
$taskExisting = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -in @('MinePix','MinePix Tauri') })
if ($taskExisting.Count -or (Test-Path -LiteralPath (Join-Path $taskInstall 'minepix-tauri.exe')) -or (Test-Path -LiteralPath 'HKCU:\Software\Classes\AppUserModelId\com.minepix.tauri') -or (Test-Path -LiteralPath $taskCache)) { throw 'Association validation requires a clean independent installation; an existing MinePix installation, notification identity or update cache was found' }
try {
    $taskSetup = Start-Process -FilePath $taskInstaller.FullName -ArgumentList "/S /D=$taskInstall" -WindowStyle Hidden -Wait -PassThru
    Check 'NSIS silent installation succeeds' ($taskSetup.ExitCode -eq 0)
    $taskInstalled = $true
    $taskExe = Join-Path $taskInstall 'minepix-tauri.exe'
    Check 'Installed executable exists in path with spaces' (Test-Path -LiteralPath $taskExe)
    Check 'Fresh installation retains no installer cache' (-not (Test-Path -LiteralPath $taskCache))
    $taskCacheBytes = 0
    $taskIconPath = Join-Path $taskInstall 'project-icon.ico'
    Check 'Installed project icon matches the dedicated document asset' ((Test-Path -LiteralPath $taskIconPath) -and (Get-FileHash -LiteralPath $taskIconPath).Hash -ceq (Get-FileHash -LiteralPath "$taskRepo\src\assets\project-icon.ico").Hash)
    Add-Type -AssemblyName System.Drawing
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MinePixAssociationIcon {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr LoadImageW(IntPtr instance, string name, uint type, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool DrawIconEx(IntPtr dc, int x, int y, IntPtr icon, int width, int height, uint step, IntPtr brush, uint flags);
    [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr icon);
}
'@
    $taskIcon = [MinePixAssociationIcon]::LoadImageW([IntPtr]::Zero, $taskIconPath, 1, 48, 48, 0x10)
    try {
        Check 'Windows loads the dedicated project icon at 48 pixels' ($taskIcon -ne [IntPtr]::Zero)
        $taskBitmap = [System.Drawing.Bitmap]::new(48, 48)
        try {
            $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
            try {
                $taskGraphics.Clear([System.Drawing.Color]::White)
                $taskDc = $taskGraphics.GetHdc()
                try { Check 'Windows draws the dedicated project icon' ([MinePixAssociationIcon]::DrawIconEx($taskDc, 0, 0, $taskIcon, 48, 48, 0, [IntPtr]::Zero, 3)) }
                finally { $taskGraphics.ReleaseHdc($taskDc) }
            } finally { $taskGraphics.Dispose() }
            $taskBitmap.Save("$taskRoot\project-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $taskBitmap.Dispose() }
    } finally { if ($taskIcon -ne [IntPtr]::Zero) { [MinePixAssociationIcon]::DestroyIcon($taskIcon) | Out-Null } }
    $taskFootprintFiles = @(Get-ChildItem -LiteralPath $taskInstall -File -Recurse | ForEach-Object {
        [pscustomobject]@{path=$_.FullName.Substring($taskInstall.Length+1);bytes=$_.Length}
    })
    $taskFootprint = [pscustomobject]@{installedDirectory=$taskInstall;bytes=($taskFootprintFiles | Measure-Object -Property bytes -Sum).Sum;files=$taskFootprintFiles;excludesSharedWebView2=$true}
    [IO.File]::WriteAllText("$taskRoot\footprint.json",(($taskFootprint | ConvertTo-Json -Depth 5) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
    $taskExpectedDefaults=$taskBefore|ConvertFrom-Json
    if(-not $taskExpectedDefaults.pix){$taskExpectedDefaults.pix='MinePix.Project'}
    $taskInstalledDefaults=OriginalState|ConvertFrom-Json
    Check 'Install initializes unassigned PIX and preserves other defaults' ($taskInstalledDefaults.pix -ceq $taskExpectedDefaults.pix -and $taskInstalledDefaults.ase -ceq $taskExpectedDefaults.ase -and $taskInstalledDefaults.aseprite -ceq $taskExpectedDefaults.aseprite)
    foreach ($taskType in @(@('pix','MinePixTauri.Project'),@('ase','MinePixTauri.Aseprite'),@('aseprite','MinePixTauri.Aseprite'))) {
        $taskExt,$taskProg = $taskType
        $taskKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Software\Classes\.$taskExt\OpenWithProgids")
        try { Check "Open With registration: $taskExt" ($null -ne $taskKey -and $taskKey.GetValueNames() -contains $taskProg) }
        finally { if ($null -ne $taskKey) { $taskKey.Dispose() } }
        Check "Quoted open command: $taskExt" ((DefaultValue "Software\Classes\$taskProg\shell\open\command") -ceq "`"$taskExe`" `"%1`"")
        $taskExpectedIcon = if ($taskExt -eq 'pix') { "`"$taskIconPath`"" } else { "`"$taskExe`",0" }
        Check "File type icon: $taskExt" ((DefaultValue "Software\Classes\$taskProg\DefaultIcon") -ceq $taskExpectedIcon)
    }
    $taskTypes = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Classes\Applications\minepix-tauri.exe\SupportedTypes')
    try { Check 'Application SupportedTypes includes all three extensions' ($null -ne $taskTypes -and @('.pix','.ase','.aseprite' | Where-Object { $taskTypes.GetValueNames() -notcontains $_ }).Count -eq 0) }
    finally { if ($null -ne $taskTypes) { $taskTypes.Dispose() } }
    Check 'Application open command is quoted' ((DefaultValue 'Software\Classes\Applications\minepix-tauri.exe\shell\open\command') -ceq "`"$taskExe`" `"%1`"")
    Check 'Application Open With uses the dedicated document icon' ((DefaultValue 'Software\Classes\Applications\minepix-tauri.exe\DefaultIcon') -ceq "`"$taskIconPath`"")
    if ($Notifications) {
        $taskPrograms = [Environment]::GetFolderPath('Programs')
        $taskShell = New-Object -ComObject Shell.Application
        $taskShortcut = $taskShell.NameSpace($taskPrograms).ParseName('MinePix.lnk')
        $taskAppId = if ($null -ne $taskShortcut) { [string]$taskShortcut.ExtendedProperty('System.AppUserModel.ID') } else { '' }
        $taskRegistration=Get-ItemProperty -LiteralPath 'HKCU:\Software\Classes\AppUserModelId\com.minepix.tauri' -ErrorAction SilentlyContinue
        $taskIdentity = [pscustomobject]@{shortcut=(Join-Path $taskPrograms 'MinePix.lnk');appId=$taskAppId;displayName=$taskRegistration.DisplayName;icon=$taskRegistration.IconUri;startApps=@(Get-StartApps | Where-Object { $_.Name -eq 'MinePix' })}
        [IO.File]::WriteAllText("$taskRoot\notification-identity.json",(($taskIdentity | ConvertTo-Json -Depth 4) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
        Check 'Installed start menu shortcut carries the notification AppUserModelID' ($taskAppId -ceq 'com.minepix.tauri')
        Check 'Own notification display identity and icon are installed' ($taskRegistration.DisplayName -ceq 'MinePix' -and $taskRegistration.IconUri -ceq "$taskInstall\notification-icon.png" -and (Test-Path -LiteralPath "$taskInstall\notification-icon.png"))
    }
    $taskSample = if ($ManualNotificationReturn) { Join-Path $taskValidation ('notification-return-'+[Guid]::NewGuid().ToString()+'.pix') } else { Join-Path $taskValidation ([string]::Concat([char]0x4F5C,[char]0x54C1,' sample.pix')) }
    Copy-Item -LiteralPath "$taskRepo\examples\mushroom.pix" -Destination $taskSample -Force
    $taskCommand = DefaultValue 'Software\Classes\MinePixTauri.Project\shell\open\command'
    if ($taskCommand -notmatch '^"([^"]+)" "%1"$') { throw 'Registered command is not a quoted executable and one file argument' }
    $taskRegisteredExe = $Matches[1]
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223'
    if ($ManualNotificationReturn) {
        [IO.File]::WriteAllText((Join-Path $env:APPDATA 'com.minepix.tauri\updater-settings.json'), '{"autoUpdate":false}', [Text.UTF8Encoding]::new($false))
    }
    $taskArguments = if ($ManualNotificationReturn) { "--update-validation=http://127.0.0.1:19412/latest.json `"$taskSample`"" } else { "`"$taskSample`"" }
    $taskApp = Start-Process -FilePath $taskRegisteredExe -ArgumentList $taskArguments -WorkingDirectory $taskValidation -WindowStyle Hidden -PassThru -RedirectStandardOutput "$taskRoot\stdout.log" -RedirectStandardError "$taskRoot\stderr.log"
    Push-Location $taskRepo
    try { node scripts/check-installed-launch.mjs $taskSample; Check 'Registered installed executable opens binary project using embedded page' ($LASTEXITCODE -eq 0) }
    finally { Pop-Location }
    if ($Notifications) {
        Push-Location $taskRepo
        try {
            if ($ManualNotificationReturn) { node scripts/notification-return-desktop.mjs $taskApp.Id $taskExe $taskSample }
            else { node scripts/notification-desktop-smoke.mjs $taskApp.Id $taskExe $taskSample }
            Check 'Installed native notification and return validation' ($LASTEXITCODE -eq 0)
        }
        finally { Pop-Location }
    }
    Stop-Process -Id $taskApp.Id
    $taskApp = $null
    $taskUninstaller = Join-Path $taskInstall 'uninstall.exe'
    $taskUninstall = Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    Check 'NSIS silent uninstall succeeds' ($taskUninstall.ExitCode -eq 0)
    $taskInstalled = $false
    for ($taskAttempt=0; $taskAttempt -lt 100 -and (Test-Path -LiteralPath $taskExe); $taskAttempt++) { Start-Sleep -Milliseconds 100 }
    Check 'Uninstall removes application executable' (-not (Test-Path -LiteralPath $taskExe))
    Check 'Uninstall removes its own differential update cache' (-not (Test-Path -LiteralPath $taskCache) -and -not (Test-Path -LiteralPath (Split-Path $taskCache -Parent)))
    Check 'Uninstall removes the dedicated project icon resource' (-not (Test-Path -LiteralPath $taskIconPath))
    foreach ($taskProg in @('MinePixTauri.Project','MinePixTauri.Aseprite','Applications\minepix-tauri.exe','MinePix.Project','Applications\MinePix.exe')) {
        Check "Uninstall removes own registration: $taskProg" ($null -eq (KeyTree "Software\Classes\$taskProg"))
    }
    Check 'Uninstall removes own notification identity' ($null -eq (KeyTree 'Software\Classes\AppUserModelId\com.minepix.tauri'))
    foreach ($taskType in @(@('pix','MinePixTauri.Project'),@('ase','MinePixTauri.Aseprite'),@('aseprite','MinePixTauri.Aseprite'))) {
        $taskExt,$taskProg = $taskType
        $taskKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Software\Classes\.$taskExt\OpenWithProgids")
        try { Check "Uninstall removes own Open With entry: $taskExt" ($null -eq $taskKey -or $taskKey.GetValueNames() -notcontains $taskProg) }
        finally { if ($null -ne $taskKey) { $taskKey.Dispose() } }
    }
    Check 'Original defaults are unchanged after uninstall' ((OriginalState) -ceq $taskBefore)
    $taskOk = $true
} catch {
    $taskResults.Add([pscustomobject]@{name='association validation failure';pass=$false;error=$_.Exception.Message})
    throw
} finally {
    if ($null -ne $taskApp -and -not $taskApp.HasExited) { Stop-Process -Id $taskApp.Id }
    if ($taskInstalled) {
        $taskUninstaller = Join-Path $taskInstall 'uninstall.exe'
        if (Test-Path -LiteralPath $taskUninstaller) {
            $taskCleanup = Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
            if ($taskCleanup.ExitCode -ne 0) { Write-Warning 'Own association validation installation could not be uninstalled' }
        }
    }
    if ($ManualNotificationReturn) {
        $taskRestored=$true
        foreach ($taskPath in $taskPreserved.Keys) {
            $taskBytes=$taskPreserved[$taskPath]
            if ($null -eq $taskBytes) {
                if(Test-Path -LiteralPath $taskPath){Remove-Item -LiteralPath $taskPath}
                if(Test-Path -LiteralPath $taskPath){$taskRestored=$false}
            } else {
                [IO.File]::WriteAllBytes($taskPath,$taskBytes)
                if([Convert]::ToBase64String([IO.File]::ReadAllBytes($taskPath)) -cne [Convert]::ToBase64String($taskBytes)){$taskRestored=$false}
            }
        }
        $taskResults.Add([pscustomobject]@{name='Original settings and recent-file bytes restored';pass=$taskRestored})
        $taskOk=$taskOk -and $taskRestored
    }
    $taskReport = [pscustomobject]@{ok=$taskOk;updateCacheBytes=$taskCacheBytes;results=@($taskResults.ToArray())}
    [IO.File]::WriteAllText("$taskRoot\validation.json",(($taskReport | ConvertTo-Json -Depth 6) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
    $taskReport | ConvertTo-Json -Depth 6
}

param([string]$Script='scripts/capture-desktop.mjs')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$taskCursor=[Windows.Forms.Cursor]::Position
if (Get-Process -Name 'minepix-tauri','MinePix' -ErrorAction SilentlyContinue) { throw 'Close MinePix before running the isolated desktop checks' }
$taskClipboard=[Windows.Forms.DataObject]::new()
$taskOriginal=[Windows.Forms.Clipboard]::GetDataObject()
if ($taskOriginal) {
    foreach ($taskFormat in $taskOriginal.GetFormats($false)) {
        $taskValue=$taskOriginal.GetData($taskFormat,$false)
        if ($null -ne $taskValue) { $taskClipboard.SetData($taskFormat,$false,$taskValue) }
    }
}
$taskSettings=Join-Path $env:APPDATA 'com.minepix.tauri\updater-settings.json'
$taskHadSettings=Test-Path -LiteralPath $taskSettings
$taskSettingsBytes=if ($taskHadSettings) { [IO.File]::ReadAllBytes($taskSettings) }
$taskRecent=Join-Path $env:APPDATA 'com.minepix.tauri\recent-files.json'
$taskHadRecent=Test-Path -LiteralPath $taskRecent
$taskRecentBytes=if ($taskHadRecent) { [IO.File]::ReadAllBytes($taskRecent) }
try {
    [IO.Directory]::CreateDirectory((Split-Path $taskSettings -Parent)) | Out-Null
    [IO.File]::WriteAllText($taskSettings,'{"autoUpdate":false}',[Text.UTF8Encoding]::new($false))
    node $Script
    if ($LASTEXITCODE) { throw "Desktop checks failed: $Script" }
} finally {
    [Windows.Forms.Cursor]::Position=$taskCursor
    [Windows.Forms.Clipboard]::SetDataObject($taskClipboard,$true)
    if ($taskHadSettings) { [IO.File]::WriteAllBytes($taskSettings,$taskSettingsBytes) }
    else { Remove-Item -LiteralPath $taskSettings -ErrorAction SilentlyContinue }
    if ($taskHadRecent) { [IO.File]::WriteAllBytes($taskRecent,$taskRecentBytes) }
    else { Remove-Item -LiteralPath $taskRecent -ErrorAction SilentlyContinue }
}

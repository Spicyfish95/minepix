param([Parameter(Mandatory=$true)][string]$Executable, [switch]$Workers, [switch]$WorkersOnly)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskValidation = Join-Path (Split-Path $taskRepo -Parent) 'minepix-tauri-validation'
$taskSource = (Resolve-Path -LiteralPath $Executable).Path
New-Item -ItemType Directory -Path $taskValidation -Force | Out-Null
Copy-Item -LiteralPath $taskSource -Destination "$taskValidation\MinePix-Tauri.exe" -Force
Copy-Item -LiteralPath "$taskRepo\examples\mushroom.pix" -Destination "$taskValidation\roundtrip.pix" -Force
$taskReport = Join-Path $taskRepo 'artifacts\packaged'
New-Item -ItemType Directory -Path $taskReport -Force | Out-Null
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223'
$env:MINEPIX_SMOKE_ROOT = 'artifacts/packaged'
$env:MINEPIX_REQUIRE_EMBEDDED = '1'
$taskApp = Start-Process -FilePath "$taskValidation\MinePix-Tauri.exe" -ArgumentList @("$taskValidation\roundtrip.pix") -WorkingDirectory $taskValidation -WindowStyle Hidden -PassThru -RedirectStandardOutput "$taskReport\stdout.log" -RedirectStandardError "$taskReport\stderr.log"
$taskApp.Id | Set-Content -LiteralPath "$taskReport\process-id.txt"
try {
    $taskReady = $false
    for ($taskAttempt=0; $taskAttempt -lt 100; $taskAttempt++) {
        if ($taskApp.HasExited) { throw "Packaged app exited: $($taskApp.ExitCode)" }
        try {
            $taskTargets = Invoke-RestMethod 'http://127.0.0.1:9223/json/list'
            if (@($taskTargets | Where-Object { $_.url -match '^http://tauri.localhost|^tauri:' }).Count -gt 0) { $taskReady=$true; break }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
    if (-not $taskReady) { throw 'Embedded WebView2 page did not become available' }
    Push-Location $taskRepo
    try {
        if (-not $WorkersOnly) {
            node scripts/desktop-smoke.mjs
            if ($LASTEXITCODE -ne 0) { throw 'Packaged desktop verification failed' }
        }
        if ($Workers -or $WorkersOnly) {
            node scripts/workers-desktop-smoke.mjs
            if ($LASTEXITCODE -ne 0) { throw 'Packaged Worker verification failed' }
        }
    }
    finally { Pop-Location }
} finally {
    if (-not $taskApp.HasExited) { Stop-Process -Id $taskApp.Id }
    Remove-Item Env:MINEPIX_SMOKE_ROOT,Env:MINEPIX_REQUIRE_EMBEDDED -ErrorAction SilentlyContinue
}

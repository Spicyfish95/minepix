$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskVersion = (Get-Content -Raw "$taskRepo\package.json" | ConvertFrom-Json).version
$taskExe = Get-Item -LiteralPath "$taskRepo\src-tauri\target\release\minepix-tauri.exe"
$taskInstaller = Get-ChildItem -LiteralPath "$taskRepo\src-tauri\target\release\bundle\nsis" -Filter '*-setup.exe' | Where-Object { $_.Name.Contains($taskVersion) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $taskInstaller) { throw "No NSIS installer for $taskVersion" }
$taskArtifacts = @($taskExe, $taskInstaller) | ForEach-Object {
    [pscustomobject]@{ file=$_.FullName; bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$taskReport = [pscustomobject]@{ version=$taskVersion; measuredAt=(Get-Date).ToString('o'); artifacts=$taskArtifacts }
New-Item -ItemType Directory -Path "$taskRepo\artifacts\release" -Force | Out-Null
$taskReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$taskRepo\artifacts\release\manifest.json" -Encoding UTF8
$taskArtifacts | Format-Table -AutoSize

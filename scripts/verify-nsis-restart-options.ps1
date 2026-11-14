$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
$taskRoot=Join-Path $taskRepo 'artifacts\nsis-restart-options'
New-Item -ItemType Directory -Path $taskRoot -Force|Out-Null
$taskOutput=Join-Path $taskRoot 'parser-check.exe'
$taskCompiler=Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'
& $taskCompiler /NOCD /V2 /INPUTCHARSET UTF8 "/DOUTPUT=$taskOutput" (Join-Path $taskRepo 'tests\fixtures\nsis-restart-options.nsi')
if($LASTEXITCODE -ne 0){throw 'NSIS parser probe compile failed'}
$taskProbe=Start-Process -FilePath $taskOutput -WindowStyle Hidden -Wait -PassThru
if($taskProbe.ExitCode -ne 0){throw 'Actual NSIS argument parser check failed'}
Get-Content -LiteralPath (Join-Path $taskRoot 'parser-result.json')

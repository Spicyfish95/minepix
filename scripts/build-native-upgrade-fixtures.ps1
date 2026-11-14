$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
$taskRoot=Join-Path $taskRepo 'artifacts\native-upgrade\rebuilt'
New-Item -ItemType Directory -Path $taskRoot -Force|Out-Null
. (Join-Path $PSScriptRoot 'rust-env.ps1')
$env:TAURI_SIGNING_PRIVATE_KEY=(Resolve-Path (Join-Path (Split-Path $taskRepo -Parent) '.signing\minepix-tauri.key')).Path
$env:CI='true'
$taskOverride=Join-Path $taskRoot 'alpha2.json'
[IO.File]::WriteAllText($taskOverride,'{"version":"2.0.0-alpha.2"}'+"`n",[Text.UTF8Encoding]::new($false))
function Save-Build([string]$Version,[string]$Label){
 $taskSetup=Join-Path $taskRepo "src-tauri\target\release\bundle\nsis\MinePix Tauri_${Version}_x64-setup.exe"
 $taskCopy=Join-Path $taskRoot "$Label-setup.exe"
 $taskRaw=Join-Path $taskRoot "$Label-raw.exe"
 Copy-Item -LiteralPath $taskSetup -Destination $taskCopy -Force
 Copy-Item -LiteralPath "$taskSetup.sig" -Destination "$taskCopy.sig" -Force
 Copy-Item -LiteralPath (Join-Path $taskRepo 'src-tauri\target\release\minepix-tauri.exe') -Destination $taskRaw -Force
 return @{version=$Version;installer=$taskCopy;installerSha256=(Get-FileHash -LiteralPath $taskCopy).Hash.ToLower();raw=$taskRaw;rawSha256=(Get-FileHash -LiteralPath $taskRaw).Hash.ToLower();installerBytes=(Get-Item -LiteralPath $taskCopy).Length;rawBytes=(Get-Item -LiteralPath $taskRaw).Length}
}
Push-Location $taskRepo
try{
 try{
  node node_modules/@tauri-apps/cli/tauri.js build --config $taskOverride
  if($LASTEXITCODE -ne 0){throw 'Temporary alpha.2 build failed'}
  $taskTarget=Save-Build '2.0.0-alpha.2' 'target'
 }finally{
  node node_modules/@tauri-apps/cli/tauri.js build
  if($LASTEXITCODE -ne 0){throw 'Normal alpha.1 build restoration failed'}
 }
 $taskSource=Save-Build '2.0.0-alpha.1' 'source'
 $taskReport=@{ok=$true;source=$taskSource;target=$taskTarget;mainVersionUnchanged=$true;published=$false}
 [IO.File]::WriteAllText((Join-Path (Split-Path $taskRoot -Parent) 'build.json'),(($taskReport|ConvertTo-Json -Depth 5) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
 $taskReport|ConvertTo-Json -Depth 5
}finally{Pop-Location}

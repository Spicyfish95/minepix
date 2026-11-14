param([switch]$InspectOnly)
$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
$taskRoot=Join-Path $taskRepo 'artifacts\native-upgrade'
$taskInstall=Join-Path (Split-Path $taskRepo -Parent) 'minepix-tauri-validation\native-upgrade-install'
$taskSource=Join-Path $taskRepo 'src-tauri\target\release\bundle\nsis\MinePix Tauri_2.0.0-alpha.1_x64-setup.exe'
$taskTarget=Join-Path $taskRepo 'artifacts\differential-release\target\setup.exe'
$taskRaw=Join-Path $taskRepo 'src-tauri\target\release\minepix-tauri.exe'
$taskBuildPath=Join-Path $taskRoot 'build.json'
if(Test-Path -LiteralPath $taskBuildPath){
 $taskBuild=Get-Content -Raw -LiteralPath $taskBuildPath|ConvertFrom-Json
 if(-not $taskBuild.ok){throw 'Two-version build did not complete'}
 $taskSource=$taskBuild.source.installer
 $taskTarget=$taskBuild.target.installer
 $taskRaw=$taskBuild.source.raw
}
$taskExe=Join-Path $taskInstall 'minepix-tauri.exe'
$taskData=Join-Path $env:APPDATA 'com.minepix.tauri'
$taskCache=Join-Path $taskData 'update-cache\base.exe'
$taskResults=[Collections.Generic.List[object]]::new()
$taskPreserved=@{}
$taskInstalled=$false
$taskOk=$false
function Check([string]$Name,[bool]$Pass){
 $taskResults.Add([pscustomobject]@{name=$Name;pass=$Pass})
 if(-not $Pass){throw $Name}
}
function KeyTree([string]$Path){
 $taskKey=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
 if($null -eq $taskKey){return $null}
 try{
  $taskValues=[ordered]@{}
  foreach($taskName in @($taskKey.GetValueNames()|Sort-Object)){$taskValues[$taskName]=[ordered]@{kind=$taskKey.GetValueKind($taskName).ToString();value=$taskKey.GetValue($taskName)}}
  $taskChildren=[ordered]@{}
  foreach($taskName in @($taskKey.GetSubKeyNames()|Sort-Object)){$taskChildren[$taskName]=KeyTree "$Path\$taskName"}
  return [ordered]@{values=$taskValues;children=$taskChildren}
 }finally{$taskKey.Dispose()}
}
function OriginalState{
 $taskState=[ordered]@{}
 foreach($taskExt in @('pix','ase','aseprite')){
  $taskKey=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Software\Classes\.$taskExt")
  try{$taskState[$taskExt]=if($null -eq $taskKey){$null}else{$taskKey.GetValue('')}}finally{if($taskKey){$taskKey.Dispose()}}
  $taskState["$taskExt-choice"]=KeyTree "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.$taskExt\UserChoice"
 }
 return $taskState|ConvertTo-Json -Depth 30 -Compress
}
function OwnAssociations{
 $taskState=[ordered]@{}
 foreach($taskName in @('MinePixTauri.Project','MinePixTauri.Aseprite','Applications\minepix-tauri.exe','AppUserModelId\com.minepix.tauri')){$taskState[$taskName]=KeyTree "Software\Classes\$taskName"}
 return $taskState|ConvertTo-Json -Depth 30 -Compress
}
New-Item -ItemType Directory -Path $taskRoot -Force|Out-Null
$taskExisting=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue|Where-Object {$_.DisplayName -in @('MinePix','MinePix Tauri')})
if($taskExisting.Count -or (Test-Path -LiteralPath $taskExe) -or (Test-Path -LiteralPath $taskCache) -or (Test-Path -LiteralPath 'HKCU:\Software\Classes\AppUserModelId\com.minepix.tauri') -or (Get-Process minepix-tauri -ErrorAction SilentlyContinue)){throw 'Native upgrade requires a clean independent installation; existing state will not be replaced'}
$taskBefore=OriginalState
$taskSourceHash=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLower()
$taskTargetHash=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLower()
if($taskBuild){
 if($taskSourceHash -ne $taskBuild.source.installerSha256 -or $taskTargetHash -ne $taskBuild.target.installerSha256 -or (Get-FileHash -LiteralPath $taskRaw).Hash.ToLower() -ne $taskBuild.source.rawSha256){throw 'Two-version build hashes changed'}
}elseif($taskSourceHash -ne 'be37b8c0e2f8fa1a551eae26430df714df4d53a9c58d83fce066c24a885bff82' -or $taskTargetHash -ne '3750443e46315e89961da849abed1b06e9238945ef20713132f37578b62fecd0'){throw 'Reviewed original two-version installer hashes changed'}
foreach($taskName in @('updater-settings.json','recent-files.json')){
 $taskPath=Join-Path $taskData $taskName
 $taskPreserved[$taskName]=if(Test-Path -LiteralPath $taskPath){[IO.File]::ReadAllBytes($taskPath)}else{$null}
}
try{
 $taskSetup=Start-Process -FilePath $taskSource -ArgumentList "/S /D=$taskInstall" -WindowStyle Hidden -Wait -PassThru
 $taskInstalled=Test-Path -LiteralPath $taskExe
 Check 'Source alpha.1 silent install succeeds' ($taskSetup.ExitCode -eq 0 -and $taskInstalled)
 Copy-Item -LiteralPath $taskExe -Destination (Join-Path $taskRoot 'source-installed.exe') -Force
 $taskInstalledIdentity=[pscustomobject]@{sha256=(Get-FileHash -LiteralPath $taskExe).Hash.ToLower();bytes=(Get-Item -LiteralPath $taskExe).Length;version=(Get-Item -LiteralPath $taskExe).VersionInfo.ProductVersion}
 [IO.File]::WriteAllText((Join-Path $taskRoot 'source-installed.json'),($taskInstalledIdentity|ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false))
 if($InspectOnly){$taskOk=$true;return}
 Push-Location $taskRepo
 try{node scripts/verify-installed-binary.mjs $taskRaw $taskExe;Check 'Source EXE equals current build with only official NSIS marker patch' ($LASTEXITCODE -eq 0)}finally{Pop-Location}
 Check 'Source installed EXE has alpha.1 version identity' ($taskInstalledIdentity.version -eq '2.0.0-alpha.1')
 Check 'Source install cache matches source installer' ((Get-FileHash -LiteralPath $taskCache).Hash.ToLower() -eq $taskSourceHash)
 Check 'Source install preserves existing defaults and UserChoice' ((OriginalState) -ceq $taskBefore)
 $taskOwnBefore=OwnAssociations
 $taskIconBefore=(Get-FileHash -LiteralPath (Join-Path $taskInstall 'project-icon.ico')).Hash
 Push-Location $taskRepo
 try{node scripts/native-upgrade-desktop.mjs $taskExe $taskTarget;Check 'Production native download, overlay and automatic restart' ($LASTEXITCODE -eq 0)}finally{Pop-Location}
 $taskUninstallKey=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MinePix Tauri'
 Check 'Installed registry version is alpha.2' ($taskUninstallKey.DisplayVersion -eq '2.0.0-alpha.2')
 Check 'Updated Open With, commands and notification identity are unchanged' ((OwnAssociations) -ceq $taskOwnBefore)
 Check 'Project icon is unchanged through upgrade' ((Get-FileHash -LiteralPath (Join-Path $taskInstall 'project-icon.ico')).Hash -ceq $taskIconBefore)
 Check 'Target installer remains the verified differential cache' ((Get-FileHash -LiteralPath $taskCache).Hash.ToLower() -eq $taskTargetHash)
 Check 'Overlay preserves existing defaults and UserChoice' ((OriginalState) -ceq $taskBefore)
 $taskOk=$true
}catch{
 $taskResults.Add([pscustomobject]@{name='native installation failure';pass=$false;error=$_.Exception.Message})
 throw
}finally{
 $taskOwned=@(Get-Process minepix-tauri -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq $taskExe})
 foreach($taskProcess in $taskOwned){Stop-Process -Id $taskProcess.Id -ErrorAction Stop}
 if($taskInstalled){
  $taskUninstaller=Join-Path $taskInstall 'uninstall.exe'
  $taskRemoval=Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  for($taskAttempt=0;$taskAttempt -lt 200 -and (Test-Path -LiteralPath $taskExe);$taskAttempt++){Start-Sleep -Milliseconds 100}
  Check 'Own upgraded installation uninstalls successfully' ($taskRemoval.ExitCode -eq 0 -and -not (Test-Path -LiteralPath $taskExe))
  Check 'Uninstall removes own associations and notification identity' ((OwnAssociations) -ceq '{"MinePixTauri.Project":null,"MinePixTauri.Aseprite":null,"Applications\\minepix-tauri.exe":null,"AppUserModelId\\com.minepix.tauri":null}')
  Check 'Uninstall removes its update cache' (-not (Test-Path -LiteralPath $taskCache))
  Check 'Uninstall preserves existing defaults and UserChoice' ((OriginalState) -ceq $taskBefore)
 }
 foreach($taskName in $taskPreserved.Keys){
  $taskPath=Join-Path $taskData $taskName
  if($null -eq $taskPreserved[$taskName]){if(Test-Path -LiteralPath $taskPath){Remove-Item -LiteralPath $taskPath -Force}}
  else{[IO.File]::WriteAllBytes($taskPath,$taskPreserved[$taskName])}
 }
 $taskRestored=$true
 foreach($taskName in $taskPreserved.Keys){
  $taskPath=Join-Path $taskData $taskName
  if($null -eq $taskPreserved[$taskName]){$taskRestored=$taskRestored -and -not (Test-Path -LiteralPath $taskPath)}
  else{$taskRestored=$taskRestored -and ([Convert]::ToBase64String([IO.File]::ReadAllBytes($taskPath)) -ceq [Convert]::ToBase64String($taskPreserved[$taskName]))}
 }
 Check 'User update settings and recent-file bytes are restored' $taskRestored
 $taskReport=[pscustomobject]@{ok=$taskOk;inspectOnly=[bool]$InspectOnly;source=@{file=$taskSource;sha256=$taskSourceHash};target=@{file=$taskTarget;sha256=$taskTargetHash};results=@($taskResults.ToArray());realInstallerExecuted=$taskInstalled}
 [IO.File]::WriteAllText((Join-Path $taskRoot 'installation.json'),(($taskReport|ConvertTo-Json -Depth 7) -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
 $taskReport|ConvertTo-Json -Depth 7
}

param(
 [Parameter(Mandatory=$true)][string]$SourceInstaller,
 [Parameter(Mandatory=$true)][string]$TargetInstaller,
 [string]$SourceVersion='2.0.0-alpha.1',
 [string]$TargetVersion='2.0.0-alpha.2'
)
$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
$taskRoot=Join-Path $taskRepo 'artifacts/native-upgrade'
$taskInstall=Join-Path $taskRepo 'artifacts/public-update-install'
$taskExe=Join-Path $taskInstall 'minepix-tauri.exe'
$taskData=Join-Path $env:APPDATA 'com.minepix.tauri'
$taskCache=Join-Path $taskData 'update-cache/base.exe'
$taskVerifier=Join-Path $taskRepo 'src-tauri/target/release/examples/update-tool.exe'
$taskSource=(Resolve-Path -LiteralPath $SourceInstaller).Path
$taskTarget=(Resolve-Path -LiteralPath $TargetInstaller).Path
$taskResults=[Collections.Generic.List[object]]::new()
$taskSaved=@{}
$taskInstalled=$false
$taskOk=$false
$taskCleaning=$false
$taskStarted=Get-Date
function Check([string]$Name,[bool]$Pass){
 $taskResults.Add([pscustomobject]@{name=$Name;pass=$Pass})
 if(-not $Pass -and -not $taskCleaning){throw $Name}
}
function KeyTree([string]$Path){
 $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
 if($null -eq $key){return $null}
 try{
  $values=[ordered]@{};$children=[ordered]@{}
  foreach($name in @($key.GetValueNames()|Sort-Object)){$values[$name]=$key.GetValue($name)}
  foreach($name in @($key.GetSubKeyNames()|Sort-Object)){$children[$name]=KeyTree ($Path+'\'+$name)}
  return [ordered]@{values=$values;children=$children}
 }finally{$key.Dispose()}
}
function Defaults{
 $state=[ordered]@{}
 foreach($extension in @('pix','ase','aseprite')){
  $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Classes\.'+$extension)
  try{$state[$extension]=if($null -eq $key){$null}else{$key.GetValue('')}}finally{if($key){$key.Dispose()}}
  $state[$extension+'-choice']=KeyTree ('Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.'+$extension+'\UserChoice')
 }
 return $state|ConvertTo-Json -Depth 40 -Compress
}
if((Get-Process minepix-tauri -ErrorAction SilentlyContinue) -or (Test-Path -LiteralPath $taskExe) -or (Test-Path -LiteralPath $taskCache) -or (Test-Path -LiteralPath 'HKCU:\Software\Classes\AppUserModelId\com.minepix.tauri') -or (Test-Path -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MinePix Tauri')){throw 'A clean test installation is required; existing app state will not be replaced'}
if(-not (Test-Path -LiteralPath $taskVerifier)){throw 'Build the fixed-key update-tool release example first'}
New-Item -ItemType Directory -Path $taskRoot -Force|Out-Null
$taskDefaults=Defaults
foreach($name in @('updater-settings.json','recent-files.json')){
 $file=Join-Path $taskData $name
 $taskSaved[$name]=if(Test-Path -LiteralPath $file){[IO.File]::ReadAllBytes($file)}else{$null}
}
try{
 & $taskVerifier $taskSource $SourceVersion
 Check 'Source signature, version binding and tamper rejection' ($LASTEXITCODE -eq 0)
 & $taskVerifier $taskTarget $TargetVersion
 Check 'Target signature, version binding and tamper rejection' ($LASTEXITCODE -eq 0)
 $setup=Start-Process -FilePath $taskSource -ArgumentList ('/S /D='+$taskInstall) -WindowStyle Hidden -Wait -PassThru
 $taskInstalled=Test-Path -LiteralPath $taskExe
 Check 'Signed baseline installs successfully' ($setup.ExitCode -eq 0 -and $taskInstalled)
 Check 'Baseline version matches source release' ((Get-Item -LiteralPath $taskExe).VersionInfo.ProductVersion -eq $SourceVersion)
 Check 'Installation preserves existing defaults' ((Defaults) -ceq $taskDefaults)
 $identity=KeyTree 'Software\Classes\MinePixTauri.Project'|ConvertTo-Json -Depth 30 -Compress
 $previousPublicMode=$env:MINEPIX_PUBLIC_UPDATE
 $env:MINEPIX_PUBLIC_UPDATE='1'
 Push-Location $taskRepo
 try{
  node scripts/native-upgrade-desktop.mjs $taskExe $taskTarget $TargetVersion $SourceVersion
  Check 'Production HTTPS download, native overlay and restart' ($LASTEXITCODE -eq 0)
 }finally{Pop-Location;$env:MINEPIX_PUBLIC_UPDATE=$previousPublicMode}
 Check 'Updated installed version matches target release' ((Get-Item -LiteralPath $taskExe).VersionInfo.ProductVersion -eq $TargetVersion)
 Check 'Project registration survives update' ((KeyTree 'Software\Classes\MinePixTauri.Project'|ConvertTo-Json -Depth 30 -Compress) -ceq $identity)
 Check 'Update preserves existing defaults' ((Defaults) -ceq $taskDefaults)
 Check 'Successful target restart removes downloaded installer files' (-not (Test-Path -LiteralPath $taskCache) -and -not (Test-Path -LiteralPath (Join-Path $taskData 'update-cache/pending.exe')) -and -not (Test-Path -LiteralPath (Join-Path $taskData 'update-cache/pending.json')))
 $taskOk=$true
}catch{
 $taskResults.Add([pscustomobject]@{name='Public update verification error';pass=$false;error=$_.Exception.Message})
 throw
}finally{
 $taskCleaning=$true
 try{
 try{
 $taskDetections=@(Get-MpThreatDetection -ErrorAction Stop | Where-Object {
  $_.InitialDetectionTime -ge $taskStarted -and
  @($_.Resources | Where-Object {$_ -like ('*'+$taskExe+'*')}).Count -gt 0
 })
 Check 'No Defender detection for this test executable' ($taskDetections.Count -eq 0)
 if($taskDetections.Count){$taskOk=$false}
 }catch{
  $taskOk=$false
  $taskResults.Add([pscustomobject]@{name='Defender detection history could not be verified';pass=$false;error=$_.Exception.Message})
 }
 foreach($process in @(Get-Process minepix-tauri -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq $taskExe})){Stop-Process -Id $process.Id}
 if($taskInstalled){
  $remove=Start-Process -FilePath (Join-Path $taskInstall 'uninstall.exe') -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  for($attempt=0;$attempt -lt 200 -and (Test-Path -LiteralPath $taskExe);$attempt++){Start-Sleep -Milliseconds 100}
  Check 'Test installation uninstalled' ($remove.ExitCode -eq 0 -and -not(Test-Path -LiteralPath $taskExe))
  Check 'Own cache removed' (-not(Test-Path -LiteralPath $taskCache))
  Check 'Own notification and project identity removed' (-not(Test-Path -LiteralPath 'HKCU:\Software\Classes\AppUserModelId\com.minepix.tauri') -and -not(Test-Path -LiteralPath 'HKCU:\Software\Classes\MinePixTauri.Project'))
 }
 }catch{
  $taskOk=$false
  $taskResults.Add([pscustomobject]@{name='Cleanup error';pass=$false;error=$_.Exception.Message})
  throw
 }finally{
 foreach($name in $taskSaved.Keys){
  $file=Join-Path $taskData $name
  if($null -eq $taskSaved[$name]){if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file -Force}}
  else{[IO.File]::WriteAllBytes($file,$taskSaved[$name])}
  $restored=if($null -eq $taskSaved[$name]){-not(Test-Path -LiteralPath $file)}else{[Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) -ceq [Convert]::ToBase64String($taskSaved[$name])}
  Check ('Original bytes restored: '+$name) $restored
 }
 Check 'Defaults restored after cleanup' ((Defaults) -ceq $taskDefaults)
 $report=[pscustomobject]@{ok=($taskOk -and -not($taskResults|Where-Object {-not $_.pass}));sourceVersion=$SourceVersion;targetVersion=$TargetVersion;publicChannel=$true;results=@($taskResults.ToArray())}
 [IO.File]::WriteAllText((Join-Path $taskRoot 'public-install.json'),(($report|ConvertTo-Json -Depth 10).Replace([string][char]13,''))+[char]10,[Text.UTF8Encoding]::new($false))
 $report|ConvertTo-Json -Depth 10
 }
 if(-not $report.ok){throw 'Public update verification did not pass'}
}

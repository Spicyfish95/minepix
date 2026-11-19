param([string]$Root,[string]$ThumbnailDll)
$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Root) {$Root=Join-Path $workspace ('artifacts\thumbnail-registration\'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())}
$Root=[IO.Path]::GetFullPath($Root)
if (-not $Root.StartsWith(($workspace+'\'),[StringComparison]::OrdinalIgnoreCase)) {throw 'Test outputs must stay in the workspace'}
New-Item -ItemType Directory -Force -Path $Root | Out-Null
$dll=if($ThumbnailDll){[IO.Path]::GetFullPath($ThumbnailDll)}else{Join-Path $workspace 'src-tauri\thumbnailer\target\debug\minepix_thumbnailer.dll'}
$probe=Join-Path $workspace 'src-tauri\thumbnailer\target\debug\examples\probe.exe'
$makensis=Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'
$hooks=Join-Path $workspace 'src-tauri\windows\thumbnail-hooks.nsh'
$clsid='{B7972150-427A-4999-8FB5-8B1661C2510B}'
$iid='{E357FCCD-A995-4576-B01F-234630154E96}'
$classPath="Registry::HKEY_CURRENT_USER\Software\Classes\CLSID\$clsid"
if (Test-Path -LiteralPath $classPath) {throw 'A registered MinePix thumbnailer already exists; use an isolated test installation'}
$snapshots=@{}
$existingProviders=@{}
$existingPrograms=@{}
foreach($ext in @('pix','ase','aseprite')) {
    $key="Registry::HKEY_CURRENT_USER\Software\Classes\.$ext\ShellEx\$iid"
    $snapshots[$ext]=@{exists=(Test-Path -LiteralPath $key);value=(Get-ItemPropertyValue -LiteralPath $key -Name '(default)' -ErrorAction SilentlyContinue)}
    $program=Get-ItemPropertyValue -LiteralPath "Registry::HKEY_CLASSES_ROOT\.$ext" -Name '(default)' -ErrorAction SilentlyContinue
    $existingPrograms[$ext]=$program
    $existingProviders[$ext]=if($program){Get-ItemPropertyValue -LiteralPath "Registry::HKEY_CLASSES_ROOT\$program\ShellEx\$iid" -Name '(default)' -ErrorAction SilentlyContinue}else{$null}
}
$results=[Collections.Generic.List[object]]::new()
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ThumbnailShellNotify {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern void SHChangeNotify(uint e, uint flags, string first, IntPtr second);
}
'@
function Check([string]$Name,[bool]$Pass) {if(-not $Pass){throw $Name};$results.Add(@{name=$Name;pass=$true})}
function Run-Installer([string]$File) {
    $process=Start-Process -FilePath $File -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if($process.ExitCode -ne 0){throw "NSIS harness failed: $($process.ExitCode)"}
}
function Build-Harness([string]$Version) {
    $script=@'
Unicode true
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
!include "LogicLib.nsh"
!define MINEPIX_THUMB_SOURCE "@DLL@"
!include "@HOOKS@"
!define VERSION "@VERSION@"
Name "MinePix thumbnail test"
OutFile "@OUTPUT@"
InstallDir "@INSTALL@"
Section
  SetOutPath "$INSTDIR"
  !insertmacro MinePixInstallThumbnails
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  WriteUninstaller "$INSTDIR\uninstall-@VERSION@.exe"
SectionEnd
Section "Uninstall"
  !insertmacro MinePixUninstallThumbnails
  Delete "$INSTDIR\minepix-thumbnailer.dll"
  Delete "$INSTDIR\uninstall-@VERSION@.exe"
  RMDir "$INSTDIR"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd
'@
    $output=Join-Path $Root "install-$Version.exe"
    $script=$script.Replace('@HOOKS@',$hooks).Replace('@VERSION@',$Version).Replace('@OUTPUT@',$output).Replace('@INSTALL@',(Join-Path $Root 'install')).Replace('@DLL@',$dll)
    $file=Join-Path $Root "install-$Version.nsi"
    [IO.File]::WriteAllText($file,$script.Replace("`r`n","`n"),[Text.UTF8Encoding]::new($false))
    & $makensis /NOCD /V2 /INPUTCHARSET UTF8 $file | Out-Host
    if($LASTEXITCODE){throw 'NSIS compilation failed'}
    return $output
}
try {
    $v1=Build-Harness '0.0.1';$v2=Build-Harness '0.0.2'
    $conflictKey="Registry::HKEY_CURRENT_USER\Software\Classes\.aseprite\ShellEx\$iid"
    $testConflict='{1711A1EF-2ADE-49C6-AB19-5B07AC42BC6B}'
    $testConflictCreated=-not $snapshots['aseprite'].exists
    if($testConflictCreated){New-Item -Path $conflictKey -Force | Out-Null;Set-Item -LiteralPath $conflictKey -Value $testConflict}
    Run-Installer $v1
    $registered=Get-ItemPropertyValue -LiteralPath "$classPath\InprocServer32" -Name '(default)'
    Check 'installer registers the independent versioned DLL' ($registered -eq (Join-Path $Root 'install\thumbnails\0.0.1\minepix-thumbnailer.dll'))
    $sample=Join-Path $Root 'visible.ase'
    Copy-Item -LiteralPath (Join-Path $workspace 'tests\fixtures\rgba-linked.aseprite') -Destination $sample
    $out=Join-Path $Root 'shell.bgra'
    & $probe shell $sample 96 $out 1
    if($LASTEXITCODE){throw 'Windows Shell failed to produce a thumbnail'}
    Check 'Windows Shell resolves an ASE thumbnail without the editor' ((Get-Item -LiteralPath $out).Length -gt 0)
    $pix=Join-Path $Root 'visible.pix';$json=Join-Path $Root 'visible.json'
    [IO.File]::WriteAllText($json,'{"format":"pixel-studio","width":2,"height":1,"layers":[{"id":1,"visible":true}],"frames":[{"cels":[[4278190335,0]]}]}',[Text.UTF8Encoding]::new($false))
    & (Join-Path $workspace 'src-tauri\target\debug\examples\project-tool.exe') encode $json $pix
    if($LASTEXITCODE){throw 'PIX fixture failed'}
    & $probe shell $pix 96 $out 1
    if($LASTEXITCODE){throw 'PIX thumbnail failed'}
    Check 'PIX Shell request uses the MinePix provider' ((Get-ItemPropertyValue -LiteralPath "Registry::HKEY_CURRENT_USER\Software\Classes\.pix\ShellEx\$iid" -Name '(default)') -eq $clsid)
    Check 'Windows Shell resolves a PIX thumbnail' ((Get-Item -LiteralPath $out).Length -gt 0)
    $original=[Convert]::ToBase64String([IO.File]::ReadAllBytes($out))
    [IO.File]::WriteAllText($json,'{"format":"pixel-studio","width":2,"height":1,"layers":[{"id":1,"visible":true}],"frames":[{"cels":[[16711935,0]]}]}',[Text.UTF8Encoding]::new($false))
    & (Join-Path $workspace 'src-tauri\target\debug\examples\project-tool.exe') encode $json $pix
    if($LASTEXITCODE){throw 'Updated PIX fixture failed'}
    [ThumbnailShellNotify]::SHChangeNotify(0x2000,0x1005,$pix,[IntPtr]::Zero)
    & $probe shell $pix 96 $out 1
    if($LASTEXITCODE){throw 'Changed PIX thumbnail failed'}
    Check 'MinePix Shell thumbnail cache refreshes after file modification' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($out)) -ne $original)
    if($testConflictCreated){Check 'install preserves a third-party extension handler' ((Get-ItemPropertyValue -LiteralPath $conflictKey -Name '(default)') -eq $testConflict)}
    Run-Installer $v2
    Check 'update changes the COM registration to the new DLL' ((Get-ItemPropertyValue -LiteralPath "$classPath\InprocServer32" -Name '(default)') -eq (Join-Path $Root 'install\thumbnails\0.0.2\minepix-thumbnailer.dll'))
    # An old uninstaller must not remove a newer registration.
    Run-Installer (Join-Path $Root 'install\uninstall-0.0.1.exe')
    Check 'old uninstaller preserves the newer registration' (Test-Path -LiteralPath "$classPath\InprocServer32")
    if($testConflictCreated -and -not $existingProviders['aseprite']){
        Remove-Item -LiteralPath $conflictKey
        Run-Installer $v2
        Check 'reinstall registers the newly available ASEPRITE handler' ((Get-ItemPropertyValue -LiteralPath $conflictKey -Name '(default)' -ErrorAction SilentlyContinue) -eq $clsid)
        $aseprite=Join-Path $Root 'visible.aseprite';Copy-Item -LiteralPath $sample -Destination $aseprite
        & $probe shell $aseprite 96 $out 1
        if($LASTEXITCODE){throw 'ASEPRITE thumbnail failed'}
        Check 'Windows Shell resolves an ASEPRITE thumbnail' ((Get-Item -LiteralPath $out).Length -gt 0)
        # The user can replace our provider after installation; uninstall must preserve that choice.
        New-Item -Path $conflictKey -Force | Out-Null;Set-Item -LiteralPath $conflictKey -Value $testConflict
    }
    elseif($existingProviders['aseprite']){Check 'existing Aseprite ProgID handler stays registered' ((Get-ItemPropertyValue -LiteralPath "Registry::HKEY_CLASSES_ROOT\$($existingPrograms['aseprite'])\ShellEx\$iid" -Name '(default)') -eq $existingProviders['aseprite'])}
    Run-Installer (Join-Path $Root 'install\uninstall-0.0.2.exe')
    Check 'current uninstaller removes its COM registration' (-not (Test-Path -LiteralPath $classPath))
    if($testConflictCreated){Check 'uninstall preserves a third-party extension handler' ((Get-ItemPropertyValue -LiteralPath $conflictKey -Name '(default)') -eq $testConflict);Remove-Item -LiteralPath $conflictKey}
    foreach($ext in @('pix','ase','aseprite')) {
        $key="Registry::HKEY_CURRENT_USER\Software\Classes\.$ext\ShellEx\$iid"
        Check "uninstall preserves or restores previous .$ext handler" ((Get-ItemPropertyValue -LiteralPath $key -Name '(default)' -ErrorAction SilentlyContinue) -eq $snapshots[$ext].value)
    }
} finally {
    # Only delete test-owned COM keys. Never touch another handler or default association.
    if(Test-Path -LiteralPath $classPath) {
        $registered=Get-ItemPropertyValue -LiteralPath "$classPath\InprocServer32" -Name '(default)' -ErrorAction SilentlyContinue
        if($registered -and $registered.StartsWith(($Root+'\'),[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $classPath -Recurse}
    }
    foreach($ext in @('pix','ase','aseprite')) {
        $key="Registry::HKEY_CURRENT_USER\Software\Classes\.$ext\ShellEx\$iid"
        $value=Get-ItemPropertyValue -LiteralPath $key -Name '(default)' -ErrorAction SilentlyContinue
        if($value -eq $clsid) {
            if($snapshots[$ext].exists){Set-Item -LiteralPath $key -Value $snapshots[$ext].value}
            else{Remove-Item -LiteralPath $key}
        }
    }
    if($testConflictCreated -and (Get-ItemPropertyValue -LiteralPath $conflictKey -Name '(default)' -ErrorAction SilentlyContinue) -eq $testConflict){Remove-Item -LiteralPath $conflictKey}
    $report=@{results=$results;root=$Root}
    [IO.File]::WriteAllText((Join-Path $Root 'result.json'),(($report|ConvertTo-Json -Depth 6).Replace("`r`n","`n")),[Text.UTF8Encoding]::new($false))
}
Write-Output ($results|ConvertTo-Json -Depth 4)

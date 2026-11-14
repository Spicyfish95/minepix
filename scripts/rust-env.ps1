# Use a normal system installation first; support the workspace-local toolchain for local development.
$taskTools = Join-Path (Split-Path $PSScriptRoot -Parent) '..\.toolchains'
if (-not (Get-Command cargo -ErrorAction SilentlyContinue) -and (Test-Path "$taskTools\cargo\bin\cargo.exe")) {
    $env:CARGO_HOME = [IO.Path]::GetFullPath("$taskTools\cargo")
    $env:RUSTUP_HOME = [IO.Path]::GetFullPath("$taskTools\rustup")
    $env:PATH = "$env:CARGO_HOME\bin;$env:PATH"
}
$taskCompilerRoot = "$taskTools\vs-buildtools\VC\Tools\MSVC"
$taskSdkRoot = "${env:ProgramFiles(x86)}\Windows Kits\10"
if (Test-Path -LiteralPath $taskCompilerRoot) {
    $taskCompiler = Get-ChildItem -LiteralPath $taskCompilerRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    $taskSdk = Get-ChildItem -LiteralPath "$taskSdkRoot\Lib" -Directory | Sort-Object Name -Descending | Select-Object -First 1
    $env:PATH = "$($taskCompiler.FullName)\bin\Hostx64\x64;$taskSdkRoot\bin\$($taskSdk.Name)\x64;$env:PATH"
    $env:LIB = "$($taskCompiler.FullName)\lib\x64;$($taskSdk.FullName)\um\x64;$($taskSdk.FullName)\ucrt\x64"
    $env:INCLUDE = "$($taskCompiler.FullName)\include;$taskSdkRoot\Include\$($taskSdk.Name)\um;$taskSdkRoot\Include\$($taskSdk.Name)\ucrt;$taskSdkRoot\Include\$($taskSdk.Name)\shared"
}

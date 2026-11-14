param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Model,
    [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=(Resolve-Path -LiteralPath $Executable).Path
$taskInfo.Arguments='encode "'+$Model+'" "'+$Output+'"'
$taskInfo.UseShellExecute=$false
$taskInfo.CreateNoWindow=$true
$taskInfo.RedirectStandardOutput=$true
$taskInfo.RedirectStandardError=$true
$taskInfo.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
$taskInfo.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
$taskProcess=[Diagnostics.Process]::new()
$taskProcess.StartInfo=$taskInfo
$taskSamples=[Collections.Generic.List[object]]::new()
$taskWatch=[Diagnostics.Stopwatch]::StartNew()
try {
    $taskProcess.Start() | Out-Null
    while (-not $taskProcess.WaitForExit(10)) {
        try {
            $taskProcess.Refresh()
            $taskSamples.Add([pscustomobject]@{atMs=$taskWatch.Elapsed.TotalMilliseconds;privateBytes=$taskProcess.PrivateMemorySize64;workingSetBytes=$taskProcess.WorkingSet64;peakWorkingSetBytes=$taskProcess.PeakWorkingSet64})
        } catch [InvalidOperationException] {
            if (-not $taskProcess.HasExited) { throw }
        }
    }
    $taskWatch.Stop()
    $taskStdout=$taskProcess.StandardOutput.ReadToEnd()
    $taskStderr=$taskProcess.StandardError.ReadToEnd()
    if ($taskProcess.ExitCode -ne 0) { throw "Encoder failed: $taskStderr" }
    if ($taskSamples.Count -eq 0) { throw 'No live process samples captured' }
    [pscustomobject]@{
        pid=$taskProcess.Id
        executable=$taskInfo.FileName
        wallMs=$taskWatch.Elapsed.TotalMilliseconds
        sampleIntervalMs=10
        sampledPeakPrivateBytes=($taskSamples | Measure-Object privateBytes -Maximum).Maximum
        observedOsPeakWorkingSetBytes=($taskSamples | Measure-Object peakWorkingSetBytes -Maximum).Maximum
        stdout=$taskStdout.Trim()
        samples=$taskSamples
    } | ConvertTo-Json -Depth 5 -Compress
} finally {
    $taskProcess.Dispose()
}

param([Parameter(Mandatory=$true)][int]$RootProcessId, [int]$Samples=5, [int]$IntervalMilliseconds=1000, [switch]$JsonLines)
$ErrorActionPreference='Stop'
. "$PSScriptRoot\process-tree.ps1"
$taskSamples=@()
for($taskIndex=0;$taskIndex -lt $Samples;$taskIndex++) {
    $taskProcesses=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CreationDate)
    $taskIds=Get-DescendantProcessIds $taskProcesses $RootProcessId
    $taskMetrics=@(foreach($taskProcess in $taskProcesses) {
        if($taskIds.Contains([int]$taskProcess.ProcessId)) {
            $taskValue=Get-Process -Id $taskProcess.ProcessId -ErrorAction SilentlyContinue
            if($null -ne $taskValue) {
                [pscustomobject]@{pid=$taskValue.Id;parentPid=$taskProcess.ParentProcessId;createdAt=$taskProcess.CreationDate.ToString('o');name=$taskProcess.Name;path=$taskProcess.ExecutablePath;privateBytes=$taskValue.PrivateMemorySize64;workingSetBytes=$taskValue.WorkingSet64;cpuSeconds=$taskValue.CPU}
            }
        }
    })
    if(-not ($taskMetrics | Where-Object {$_.pid -eq $RootProcessId})) { throw 'Benchmark root process exited' }
    $taskSample=[pscustomobject]@{at=[DateTimeOffset]::Now.ToUnixTimeMilliseconds();processes=$taskMetrics;privateBytes=($taskMetrics|Measure-Object -Property privateBytes -Sum).Sum;workingSetBytes=($taskMetrics|Measure-Object -Property workingSetBytes -Sum).Sum;cpuSeconds=($taskMetrics|Measure-Object -Property cpuSeconds -Sum).Sum}
    if($JsonLines) { $taskSample | ConvertTo-Json -Depth 6 -Compress; [Console]::Out.Flush() }
    else { $taskSamples += $taskSample }
    if($taskIndex -lt $Samples-1) { Start-Sleep -Milliseconds $IntervalMilliseconds }
}
if(-not $JsonLines) { $taskSamples | ConvertTo-Json -Depth 6 -Compress }

$ErrorActionPreference='Stop'
. "$PSScriptRoot\process-tree.ps1"
$taskStart=[datetime]'2026-11-14T04:00:00'
function New-TaskProcess([int]$Id,[int]$Parent,[double]$Seconds) {
    [pscustomobject]@{ProcessId=$Id;ParentProcessId=$Parent;CreationDate=$taskStart.AddSeconds($Seconds)}
}
$taskProcesses=@(
    (New-TaskProcess 300 200 3),
    (New-TaskProcess 301 100 2),
    (New-TaskProcess 200 100 2),
    (New-TaskProcess 100 999 1)
)
$taskIds=Get-DescendantProcessIds $taskProcesses 100
if((($taskIds | Sort-Object) -join ',') -ne '100,200,300,301') { throw 'Valid out-of-order multilevel tree missing descendants' }
$taskProcesses+=@((New-TaskProcess 400 200 1.5),(New-TaskProcess 401 400 4),(New-TaskProcess 500 100 0))
$taskIds=Get-DescendantProcessIds $taskProcesses 100
if((($taskIds | Sort-Object) -join ',') -ne '100,200,300,301') { throw 'Reused parent PID included an older process or its child' }
$taskProcesses=@($taskProcesses | Where-Object ProcessId -ne 100)+@((New-TaskProcess 100 999 5),(New-TaskProcess 600 100 6))
$taskIds=Get-DescendantProcessIds $taskProcesses 100
if((($taskIds | Sort-Object) -join ',') -ne '100,600') { throw 'Reused root PID included its previous subtree' }
[pscustomobject]@{ok=$true;passed=3} | ConvertTo-Json -Compress

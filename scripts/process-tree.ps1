function Get-DescendantProcessIds([array]$Processes, [int]$RootProcessId) {
    $taskById=@{}
    foreach($taskProcess in $Processes) { $taskById[[int]$taskProcess.ProcessId]=$taskProcess }
    $taskIds=[Collections.Generic.HashSet[int]]::new()
    $taskIds.Add($RootProcessId) | Out-Null
    do {
        $taskChanged=$false
        foreach($taskProcess in $Processes) {
            $taskParent=[int]$taskProcess.ParentProcessId
            if($taskIds.Contains($taskParent) -and $taskProcess.CreationDate -ge $taskById[$taskParent].CreationDate -and $taskIds.Add([int]$taskProcess.ProcessId)) { $taskChanged=$true }
        }
    } while($taskChanged)
    return ,$taskIds
}

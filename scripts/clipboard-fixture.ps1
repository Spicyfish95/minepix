param([ValidateSet('files','image','inspect')][string]$Mode='inspect',[string]$Directory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ($Mode -eq 'files') {
    $taskFiles=[Collections.Specialized.StringCollection]::new()
    $taskFiles.Add((Join-Path $Directory 'one.png')) | Out-Null
    $taskFiles.Add((Join-Path $Directory 'two.png')) | Out-Null
    [Windows.Forms.Clipboard]::SetFileDropList($taskFiles)
} elseif ($Mode -eq 'image') {
    $taskImage=[Drawing.Image]::FromFile((Join-Path $Directory 'one.png'))
    try { [Windows.Forms.Clipboard]::SetImage($taskImage) } finally { $taskImage.Dispose() }
} else {
    $taskHasImage=[Windows.Forms.Clipboard]::ContainsImage()
    $taskResult=@{image=$taskHasImage}
    if ($taskHasImage) {
        $taskImage=[Windows.Forms.Clipboard]::GetImage()
        if ($null -eq $taskImage) { throw 'Clipboard format exists but Windows could not decode the image' }
        try { $taskResult.width=$taskImage.Width; $taskResult.height=$taskImage.Height } finally { $taskImage.Dispose() }
    }
    $taskResult | ConvertTo-Json -Compress
}

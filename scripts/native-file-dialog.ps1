param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [string]$FilePath,
    [switch]$Cancel
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MinePixDialogInput {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern IntPtr SendMessageW(IntPtr window, uint message, IntPtr wParam, string text);
    [DllImport("user32.dll")]
    public static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
$taskCondition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$ProcessId),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')
)
$taskDialog = $null
for ($taskAttempt=0; $taskAttempt -lt 100; $taskAttempt++) {
    $taskDialog = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$taskCondition)
    if ($null -ne $taskDialog) { break }
    Start-Sleep -Milliseconds 100
}
if ($null -eq $taskDialog) { throw 'MinePix native file dialog did not appear' }
$taskButtonId = if ($Cancel) { '2' } else { '1' }
$taskButtonCondition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$taskButtonId),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'Button')
)
$taskButton = $null
for ($taskAttempt=0; $taskAttempt -lt 100; $taskAttempt++) {
    $taskButton = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskButtonCondition)
    if ($null -ne $taskButton -and $taskButton.Current.IsEnabled) { break }
    Start-Sleep -Milliseconds 100
}
if ($null -eq $taskButton) { throw 'Native confirm/cancel button not found' }
if (-not $Cancel) {
    if ([string]::IsNullOrWhiteSpace($FilePath)) { throw 'FilePath is required' }
    $taskFilenameIds = [System.Windows.Automation.OrCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1148'),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1001'),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1152')
    )
    $taskEditCondition = [System.Windows.Automation.AndCondition]::new(
        $taskFilenameIds,
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'Edit')
    )
    $taskEdit = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskEditCondition)
    if ($null -eq $taskEdit) { throw 'Native filename field not found' }
    [MinePixDialogInput]::SendMessageW([IntPtr]$taskEdit.Current.NativeWindowHandle,0x000C,[IntPtr]::Zero,$FilePath) | Out-Null
}
if (-not [MinePixDialogInput]::PostMessageW([IntPtr]$taskButton.Current.NativeWindowHandle,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)) {
    throw 'Native dialog button click failed'
}

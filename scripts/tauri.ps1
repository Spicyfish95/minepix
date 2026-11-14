$taskArguments = $args
. "$PSScriptRoot\rust-env.ps1"
npm exec -- tauri @taskArguments
exit $LASTEXITCODE

$taskArguments = $args
. "$PSScriptRoot\rust-env.ps1"
cargo @taskArguments
exit $LASTEXITCODE

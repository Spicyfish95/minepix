$ErrorActionPreference = 'Stop'
npm run build
if ($LASTEXITCODE) { exit $LASTEXITCODE }
. "$PSScriptRoot\rust-env.ps1"
$thumbnailFlags=$env:RUSTFLAGS
try {
    $env:RUSTFLAGS=($thumbnailFlags+' -C target-feature=+crt-static').Trim()
    cargo build --locked --release --target x86_64-pc-windows-msvc --manifest-path src-tauri/thumbnailer/Cargo.toml --target-dir src-tauri/target
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
    Copy-Item -LiteralPath 'src-tauri/target/x86_64-pc-windows-msvc/release/minepix_thumbnailer.dll' -Destination 'src-tauri/target/release/minepix_thumbnailer.dll' -Force
} finally { $env:RUSTFLAGS=$thumbnailFlags }

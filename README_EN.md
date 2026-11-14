# MinePix

A Windows x64 pixel art and animation editor built with Tauri 2, Rust and system WebView2.

Features include layers and groups, selection and transforms, animation tags, linked cels, indexed color, references, tilesets, compressed binary PIX projects, ASE interchange and image/animation export.

Download the installer from this repository's Releases. Installation is per user and preserves existing file defaults. This is a prerelease; keep copies of important artwork. Automatic update checks default to off; use Help to check manually.

Choose `MinePix.Tauri_<version>_x64-setup.exe` from the matching `tauri-v<version>` release. The `.sig` file is used automatically by the updater. The `tauri-latest` release hosts the update channel manifest.

Development requires Node.js 24, stable Rust MSVC, Windows SDK and C++ Build Tools. Run `npm ci` and `npm run desktop`.

See [development](docs/DEVELOPMENT.md), [release operations](docs/RELEASING.md), [PIX format](docs/PROJECT_FORMAT.md) and [licenses](THIRD_PARTY_NOTICES.md). Operational guides are currently in Chinese.

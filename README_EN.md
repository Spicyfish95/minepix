# MinePix

A Windows x64 pixel art and animation editor built with Tauri 2, Rust and system WebView2.

[简体中文](README.md) · [User guide (Chinese)](docs/USER_GUIDE.md)

The current preview is **2.0.0-alpha.4**. The Windows x64 installer is published, and installation and in-app updates have passed verification on the test machine.

[Download the Windows x64 installer](https://github.com/Spicyfish95/minepix/releases/download/tauri-v2.0.0-alpha.4/MinePix.Tauri_2.0.0-alpha.4_x64-setup.exe)

Features include layers and groups, selection and transforms, animation tags, linked cels, indexed color, references, tilesets, compressed binary PIX projects, ASE interchange and image/animation export.

Download the installer from this repository's Releases. Installation is per user and preserves existing file defaults. This is a prerelease; keep copies of important artwork. Automatic update checks default to off. Use Help → Check for updates, or enable startup checks in Help → About. After downloading, choose Restart and update, then follow the prompts for unsaved projects.

Choose `MinePix.Tauri_<version>_x64-setup.exe` from the matching `tauri-v<version>` release. The `.sig` file is used automatically by the updater. The `tauri-latest` release hosts the update channel manifest.

Development requires Node.js 24, stable Rust MSVC, Windows SDK and C++ Build Tools. Run `npm ci` and `npm run desktop`.

See [development](docs/DEVELOPMENT.md), [release operations](docs/RELEASING.md), [PIX format](docs/PROJECT_FORMAT.md) and [licenses](THIRD_PARTY_NOTICES.md). Operational guides are currently in Chinese.

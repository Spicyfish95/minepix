# Third-party notices / 第三方声明

MinePix 自行编写的项目代码使用 [MIT](LICENSE)。下列组件保留各自作者及许可证；JavaScript版本和校验值由 `package-lock.json` 固定，Rust依赖由 `src-tauri/Cargo.lock` 固定。

## Pixel processing: rhinoc / xprite-pixelate

像素处理导入使用 **[rhinoc](https://github.com/rhinoc)** 创作的 **[xprite-pixelate](https://github.com/rhinoc/xprite-pixelate)**（`@xprite/pixelate` 0.1.2）。Copyright (c) 2026 rhinoc，MIT。MinePix 调用未修改的上游 JS / WASM，不将其网格检测、采样及轮廓算法声明为 MinePix 原创。

原包及以下声明随 `node_modules/@xprite/pixelate/` 分发：

| 组件 | 许可 | 上游包中的完整声明 |
| --- | --- | --- |
| xprite-pixelate | MIT | `LICENSE` |
| pixel-art-fixer WASM detector（Astropulse, LLC / Retro-Diffusion） | MIT | `licenses/pixel-art-fixer-MIT.txt` |
| PixelOE ports and contour processing（KohakuBlueleaf） | Apache-2.0 | `licenses/PixelOE-Apache-2.0.txt` |
| proper-pixel-art ideas / algorithms（Kenneth Allen） | MIT | `licenses/proper-pixel-art-MIT.txt` |
| Bayer dithering matrix（tensorhead/dithering） | MIT | `licenses/tensorhead-dithering-MIT.txt` |

组件的具体归属还见原包 `NOTICE.md`。上游许可证、NOTICE 和 licenses 目录随依赖保留。

## Normal maps: rhinoc / xprite-lighter

法线生成使用 **[rhinoc](https://github.com/rhinoc)** 创作的 **[xprite-lighter](https://github.com/rhinoc/xprite-lighter)**（`@xprite/lighter` 0.1.1）。Copyright (c) 2026 rhinoc，MIT。原包与 LICENSE 随 `node_modules/@xprite/lighter/` 分发。

上游包含的改编代码另有 Copyright (c) 2026 **Red Hat Sprite**，MIT；其完整声明随仓库保留在 [pixel-art-lighter-MIT.txt](docs/licenses/pixel-art-lighter-MIT.txt)。MinePix 提供编辑器集成与预览操作，没有分发上游 demo 或 benchmark 美术资源。

## Rust system notifications

Windows系统通知使用Tauri官方`tauri-plugin-notification` 2.8.1及其Windows后端`notify-rust` 4.19.0、`tauri-winrt-notification` 0.8.1。均按MIT许可使用：Tauri组件Copyright (c) 2017 - Present Tauri Apps Contributors；notify-rust Copyright (c) 2017 Hendrik Sollich；WinRT适配作者及完整声明见以下许可副本。原始包同时提供Apache-2.0选项。

- [Tauri notification plugin MIT](docs/licenses/tauri-plugin-notification-MIT.txt)
- [notify-rust MIT](docs/licenses/notify-rust-MIT.txt)
- [Tauri WinRT notification MIT](docs/licenses/tauri-winrt-notification-MIT.txt)

## Other dependencies

Windows本地文件拖入路径桥接直接使用既有Tauri依赖树中的`webview2-com` 0.39.1（MIT，Copyright (c) 2021 Bill Avery）及`windows` 0.62.2（按MIT使用，Copyright (c) Microsoft Corporation）。未引入另一套浏览器运行时。许可副本见 [webview2-com MIT](docs/licenses/webview2-com-MIT.txt) 与 [windows-rs MIT](docs/licenses/windows-rs-MIT.txt)。

Rust差分更新复用既有依赖树中的`reqwest` 0.13.5（MIT，Copyright (c) 2016–2026 Sean McArthur）与`sha2` 0.10.9（按MIT使用，Graydon Hoare / Mozilla Foundation / Artyom Pavlov，完整年份及声明见副本）；没有另加运行时浏览器或差分二进制工具。许可副本见 [reqwest MIT](docs/licenses/reqwest-MIT.txt) 与 [sha2 MIT](docs/licenses/sha2-MIT.txt)。内容定义分块实现为本项目代码，最终包认证仍使用Tauri官方更新器与原固定公钥。

| 组件 | 版本与用途 | 许可及作者 |
| --- | --- | --- |
| [gifenc](https://github.com/mattdesl/gifenc) | 1.0.3，GIF 编码与量化 | MIT，Copyright (c) 2017 Matt DesLauriers；完整许可为原包 `LICENSE.md` |
| [omggif](https://github.com/deanm/omggif) | 1.0.10，仅测试中的独立 GIF 解码 | MIT，Copyright (c) 2013 Dean McNamee；声明在原包 `omggif.js` 头部 |

Rust / Tauri 与前端构建工具保留原包附带的第三方许可。GIF 测试图由本项目脚本生成，生成工具 Pillow 不属于应用运行依赖。演示项目见 [examples](examples/README.md)，互通样例来源见 [tests/fixtures](tests/fixtures/README.md)。

## NSIS installer template

`src-tauri/windows/installer.nsi` 来自 tauri-apps/tauri 的 `tauri-cli-v2.12.4`，按 MIT 许可使用，Copyright (c) 2017 - Present Tauri Apps Contributors。修改仅固定安装注册键，保证产品显示名变更不改变升级身份。许可文本见 [Tauri MIT](docs/licenses/tauri-plugin-notification-MIT.txt)。后续升级 CLI 时需要同步审查模板。

# MinePix

使用 Tauri 2 和 Rust 构建的 Windows x64 像素画与动画编辑器。界面使用系统 WebView2，项目存储、文件操作、格式编解码和更新由 Rust 处理。

## 功能

- 像素绘画、选区、变换、对称绘画、图层分组、撤销重做。
- 多帧动画、标签、链接 cel、调色板、索引色、参考图、图集和地形预览。
- 二进制压缩 PIX 项目；ASE / Aseprite、PNG、GIF、WebP 和精灵表等工作流。
- 多窗口工作区、中文输入、压感笔、显示缩放和恢复。
- 简体中文、繁体中文及英语安装界面，签名更新与差分下载。

## 安装与使用

从本仓库 Releases 下载 Windows x64 安装器，以当前用户安装。运行依赖 WebView2 Runtime，缺失时安装器会引导安装。通过文件菜单新建项目并保存为 .pix；与其他工具交换作品请使用 ASE 导入导出。安装不会擅自替换文件默认打开方式，可通过系统“打开方式”选择 MinePix。

在对应版本的 `tauri-v<版本>` Release 中下载 `MinePix.Tauri_<版本>_x64-setup.exe`；`.sig` 为软件自动使用的更新签名，不需要手动打开。`tauri-latest` 用于保存更新频道清单。

这是预发布版本，重要作品请保留副本。自动检查更新默认关闭，可通过帮助菜单手动检查。当前频道状态见发布指南。

## 开发

需要 Node.js 24、Rust stable MSVC、C++ Build Tools、Windows SDK。运行 `npm ci` 和 `npm run desktop`。

- [使用指南](docs/USER_GUIDE.md)
- [开发与验证](docs/DEVELOPMENT.md)
- [构建、签名、发布与更新](docs/RELEASING.md)
- [二进制 PIX 格式](docs/PROJECT_FORMAT.md)
- [差分更新协议](docs/DIFFERENTIAL_UPDATES.md)
- [示例作品](examples/README.md)
- [第三方许可证](THIRD_PARTY_NOTICES.md)

MIT License。构建产物、测试输出和密钥不进入源码仓库。

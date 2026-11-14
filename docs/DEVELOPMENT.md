# 开发与验证

## 环境与命令

Windows x64、Node.js 24、Rust stable MSVC、C++ Build Tools、Windows SDK、WebView2 Runtime。环境脚本优先使用系统工具链。

在仓库根目录执行：

```powershell
npm ci
npm run desktop
```

`npm run desktop` 启动桌面应用和前端开发服务；`npm run dev` 仅启动前端服务。

```powershell
# 前端构建
npm run build

# 生成签名桌面安装包，需先配置签名环境变量
npm run package
```

安装包位于 `src-tauri/target/release/bundle/nsis/`。签名配置和标签发布步骤见[发布指南](RELEASING.md)。私钥保存在用户 `.ssh` 目录，不复制到工作区，不提交 Git。

## 目录

| 路径 | 内容 |
| --- | --- |
| src/ | 编辑器前端、桌面桥接和界面资源 |
| src-tauri/src/ | Rust 文件、格式、存储、窗口与更新实现 |
| src-tauri/windows/ | Windows 安装器钩子 |
| tests/ | Node 测试与固定样例 |
| scripts/ | 构建、发布与专项验证脚本 |
| examples/ | 用户示例作品 |
| artifacts/ | 本地报告、日志和截图，不提交 Git |

## 定向测试

每次改动先记录范围并运行相关测试，跨模块影响或相关失败时再扩大回归。不因文档修改重跑绘画、安装或长时间观察。

```powershell
# 发布相关 Node 测试
node --test tests/release.test.js tests/public-release-download.test.js

# Rust 文件模块测试
powershell -NoProfile -File scripts/cargo.ps1 test --locked --manifest-path src-tauri/Cargo.toml --lib files::tests

# 文档链接、源码引用与 LF
node scripts/check-repository.mjs
git diff --check
```

ASE Node 测试调用真实 Rust 编解码工具，单独运行前需先构建：

```powershell
powershell -NoProfile -File scripts/cargo.ps1 build --locked --manifest-path src-tauri/Cargo.toml --example project-tool
```

完整回归入口为 `npm test` 与 `npm run test:backend`。`npm test` 的前置步骤会构建上述工具。CI 仅在推送 `tauri-v*` 标签时执行完整回归、前端构建及签名发布；普通 main 推送和 PR 不运行 Actions。日常提交需在本地完成相关定向验证。

## 安装与更新验证

原生测试使用独立作品和安装目录，不与编辑会话并行。真实安装更新入口及参数见[发布指南](RELEASING.md)。验证结果必须同时覆盖作品、偏好、文件关联及清理，不能只以进程重启判断成功。

当前 2.0.0-alpha.4 的定向验收结果（2026-11-14）：

| 验证项 | 结果 |
| --- | --- |
| 调整触发规则前的 main 回归记录 | Actions 43580585728 成功；Node 451/451、Rust 49/49；此记录不代表 main 仍会自动运行 CI |
| alpha.4 标签构建与发布 | Actions 43579750199 第 2 次运行成功；签名安装包、公开下载和频道提升通过 |
| alpha.4 独立安装、正常启动及卸载 | 13/13 通过，不使用调试启动参数 |
| 生产频道 alpha.3 → alpha.4 | 桌面 15/15，安装及清理 17/17，全部清理标记为 true |
| 作品和偏好保护 | 项目字节、像素及元数据、显示画布、主题、语言和更新偏好保持；更新后绘画与撤销正常 |
| 本机 Defender | 特征库 1.463.293.0，实时防护开启；安装包与包内主程序扫描未检出威胁，复测未新增检测 |

较早的一次 alpha.3 测试曾触发隔离。原始失败记录和相同文件复测记录保留在本地 `artifacts/security-review/`，不能据此宣称微软已正式确认误报或保证所有机器均不会拦截。

## 本地清理

发布使用 GitHub Actions 自带的 CLI 环境，本地编辑、测试和构建不要求安装 GitHub CLI。按需清理 dist、src-tauri/target、src-tauri/gen，以及独立桌面验证目录中的临时作品；下次构建会重新生成资源及编译产物。

本次验证范围：核对清理路径位于工作区内、不含 Git 跟踪文件且无进程占用，清理后检查文件缺失、保留项及仓库状态；不重跑构建来生成已清理的缓存。

本次已卸载便携 GitHub CLI 并删除其下载 ZIP，使用 Cargo clean 清除 20,841 个文件、约 29.6 GiB 编译产物，通过 Git 定向清除 dist 与 src-tauri/gen，并删除顶层临时脚本、测试日志及工具链安装器下载文件。源码、依赖、已安装工具链、alpha.4 公开安装包及验收和失败报告保留。其他测试临时目录、下载缓存和过期测试载荷的批量递归清理被执行策略拦截，仍保留，不能视为已全部清空。

## 文档维护

README 面向下载和入门，使用指南对应实际界面，开发与发布指南说明可复用的操作。原始执行日志保存在 artifacts，不在指南中累积过时的阶段状态。每项功能验证后同步相关说明并创建本地提交，源码与文档统一 LF。

本次范围：发布工作流仅接受 `tauri-v*` 标签推送，移除 main、PR 和手动触发；标签内保留完整回归、签名构建和发布顺序。更新中英文 README、使用指南及发布操作，突出小体积分发、图集地形预览、参考板和游戏素材交付。

定向验证：核对工作流唯一触发入口及发布步骤条件，运行发布相关 Node 测试；按源码核对菜单、快捷键和导出能力，执行仓库链接、模块引用、LF 与 Git diff 检查。普通 main 推送应不产生新的工作流运行，本次不创建发布标签，不重跑安装更新或编辑器回归。

文档组织参考 [Aseprite 官方指南](https://aseprite.org/docs/)的基础操作、动画、文件与工作区分类，以及 [Pixelorama 官网](https://pixelorama.org/)按创作场景展示功能的方式。特色描述以本项目源码为准：菜单与快捷键对应 application-menu.js、keymap-manager.js；地形规则及预览对应 tileset-panel.js、terrain-preview.js；法线与引擎导出对应 normal-map-export.js、formats/engine-export.js。不将常见编辑能力标为行业独有，也不作未经测量的性能比较。

本次本地结果：发布相关 Node 测试 7/7 通过；工作流检查确认只有标签推送入口，触发段以外的回归、签名及发布配置与调整前一致。仓库检查通过，339 个文本文件、48 个本地文档链接、584 个模块引用有效，LF 与 Git diff 空白检查通过。main 推送后的远程结果另行核对。

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
| docs/images/ | README 与使用指南引用的真实界面截图，提交 Git |
| artifacts/ | 本地报告、日志和验证截图，不提交 Git |

## 定向测试

只运行改动涉及的测试；跨模块影响或相关测试失败时扩大范围。Node 测试可直接执行 `node --test tests/<相关测试>.test.js`。完整入口 `npm test` 会先构建 Rust 格式工具，日常小改动无需运行全部测试。

```powershell
node scripts/check-repository.mjs
git diff --check
```

ASE 编解码测试需要先构建真实 Rust 工具：

```powershell
powershell -NoProfile -File scripts/cargo.ps1 build --locked --manifest-path src-tauri/Cargo.toml --example project-tool
```

栏目及图集回归范围（相关 Node 测试与 `node scripts/test-panels-browser.mjs` 隔离浏览器专项）：恢复默认及缺失栏目修复时保留下方折叠状态；无图集时屏蔽图集及地形预览的所有栏目入口；修正检视器和同像素图块规则迁移；统一 MinePix 对外名称；修复关于窗口资源引用和 PIX 文档图标关联。定向验证菜单、布局入口、DOM 下拉显示、规则迁移、发布文件名与图标配置，并构建前端检查资源。浏览器专项只使用临时配置；真实安装更新专项另行执行。

发布准备的定向范围：核对五处版本文件、版本标签与安装包名称一致，运行发布协议及安装配置测试和仓库检查。标签流水线负责完整回归、签名构建和发布；发布后只回读工作流与 Release，不追加核验报告提交。

更新体验的定向范围：关于页移除测试通知入口及说明；首次使用默认自动检查并下载，保留已有开关选择；验证已签名更新包与元数据跨启动恢复（含离线）、篡改拒绝、取消及重试、升级成功后的包与临时文件清理。浏览器专项检查后台自动下载、右下角一键重启更新、未保存项目取消后的重试入口；Rust 使用本地 HTTP 与签名固定样例，不执行安装器或发布版本。

## 本地资源与设置

布局、主题和输入偏好保存在应用 WebView2 用户数据内；最近文件、恢复副本与更新偏好位于独立应用数据目录。安装器使用与 CLI 对应的官方 NSIS 模板，仅固定现有安装注册键以保持升级识别；升级 CLI 时同步审查模板。产品显示名称调整不应改变 `com.minepix.tauri` 标识、WebView 来源或已有存储键。排查设置时先保留原始数据，不以重置设置代替修复。

构建缓存包含 dist、src-tauri/target 和 src-tauri/gen；按需清理，下一次构建会重新生成。安装更新专项必须使用独立目录与作品，并恢复原有偏好。

## 文档维护

README 面向下载和入门，使用指南对应实际界面，开发与发布指南只保留可复用操作。核验报告、哈希、任务编号和执行流水保存在本地 artifacts，不写入指南，不为发布后核验单独创建提交。必要的功能说明、定向验证范围与功能修改一并提交；源码和文档统一 LF。

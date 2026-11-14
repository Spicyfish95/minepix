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

截图模式交互的定向范围：初始无选区和工具栏，准星与操作提示；单击选择当前屏、双击直接复制当前屏、拖动框选（含反向、微小抖动），重新框选恢复待选。多屏只使用一个截图窗口，按物理鼠标位置切屏，选区开始后锁屏，重选解锁；验证负坐标、不同 DPI 的物理裁剪及原始像素。运行截图 Node/浏览器、Rust 专项、本地 Debug 构建和真实多屏窗口/剪贴板专项；不执行安装更新或发布。

进入延迟与闪烁的关联范围：编辑器就绪后预载透明截图窗口；待选仅显示准星提示，不等待整屏像素或铺图。确认/取消后隐藏复用并释放截图会话与前端画布，切屏无需等待隐藏页面的渲染帧；最后编辑器关闭时销毁预载窗口。补充验证连续进入/取消、切屏就绪、失败退出及应用正常结束，保留剪贴板与鼠标原状态。

截图传输优化的定向范围：Rust 通过二进制 IPC 传输当前屏宽高与 RGBA 原始像素，不经过 PNG/Base64。待选布局完成后显示、聚焦透明窗口，后台准备画布，选中后才显示截图。验证像素传输、加载失败可关闭、取消不改剪贴板及再次截图；运行截图 Node/浏览器、Rust 专项，构建本地 Debug 并执行真实桌面截图检查，不运行安装或更新。

表单说明文字的定向范围：在既有 Switch 规则上补齐输入框、数值、下拉框和多行文本；点击内嵌或 `for` 关联说明及空白不聚焦、不转发点击，不改变输入内容或下拉值。验证动态弹窗、独立面板、控件本体、键盘 Tab / 输入 / 选择，以及普通复选框、单选和工具图标行为。运行表单说明与 Switch 浏览器专项、定向原生键鼠检查、资源检查和本地 Debug 构建，不运行安装更新。

Switch 文字点击的定向范围：静态和动态弹窗、独立面板中的说明文字及空白不再触发开关；直接点击开关仍触发一次 change，保留原生键盘操作和无障碍名称；普通复选框及工具图标按钮不受影响。运行 Switch 浏览器专项和相关表单、前端构建检查。

独立窗口置顶与截图粘贴的定向范围：参考、地形预览、预览独立窗口的 Pin 开关与主题状态；前台可配置 `Ctrl+1` 启动截图，待选及整屏/框选、反向拖选、工具栏边界、取消不改剪贴板、确认复制与无项目导入；参考区悬停 `Ctrl+V` 导入单张位图和多个图片文件，停靠和独立窗口均支持，文本输入及像素粘贴保持原行为。运行相关 Node/浏览器专项、Rust 图像裁剪与剪贴板格式测试及本地 Debug 构建；原生专项只验证窗口和截图剪贴板，不运行安装或更新。

版本说明的定向范围：按发布版本提取 `CHANGELOG.md` 对应二级标题下的内容，排除未发布及其他版本，保留段落与子标题；缺失、重复或空章节中止生成。验证自定义说明文件、更新清单实际生成和 Release 共用说明来源；运行相关 Node 发布测试与仓库检查，不构建安装包、不发布或修改已有 Release。

更新就绪图标的定向范围：完成下载后在原更新状态位置显示主题强调色的圆形下载图标，悬停提示“有可用更新”；验证主题切换、无障碍名称、下载进度到就绪的原位切换、跨启动恢复及点击安装/取消后重试。运行 `node scripts/test-panels-browser.mjs updates` 与前端构建、资源检查，不执行真实安装或发布。

只运行改动涉及的测试；跨模块影响或相关测试失败时扩大范围。Node 测试可直接执行 `node --test tests/<相关测试>.test.js`。完整入口 `npm test` 会先构建 Rust 格式工具，日常小改动无需运行全部测试。

```powershell
node scripts/check-repository.mjs
git diff --check
```

截图、参考粘贴、Pin、Switch 和表单说明文字交互可分别执行 `node scripts/test-panels-browser.mjs screenshot`、`reference-paste`、`pin`、`switch`、`form-labels` 浏览器专项。截图选区和快捷键测试为 `node --test tests/screenshot-selection.test.js tests/keymap.test.js`，原始裁剪与 PNG 往返测试为 Cargo 的 `screen_capture::tests`。

构建本地 Debug 版后，在关闭已有 MinePix 的情况下执行 `powershell -NoProfile -STA -File scripts/test-capture-desktop.ps1`。该专项使用隔离 WebView 配置，只读观察真实截图窗口从隐藏准备到显示、聚焦，验证双屏切换/锁定、准备失败退出、真实屏幕像素、图片剪贴板、参考粘贴、原生置顶和最后编辑器关闭后的退出；结束时恢复原剪贴板、鼠标位置及更新偏好，不执行安装或更新。报告保存在本地 `artifacts/capture-desktop/`。截图浏览器专项使用实际页面，验证透明待选、二进制画布和框选交互。

Debug 的屏幕像素处理未优化，不用于判断实际截图性能。本地优化构建无需打包或签名：`powershell -NoProfile -File scripts/tauri.ps1 build --no-bundle -- --locked`，可执行文件位于 `src-tauri/target/release/minepix-tauri.exe`。设置 `MINEPIX_TEST_EXE` 为该路径后，可复用同一原生专项验证；这不会生成安装器或发布版本。

截图预览通过 `capture_pixels` 返回当前显示器的小端宽高与 RGBA 二进制，仅截图窗口可调用；透明待选布局完成后发送 `captureReady`，Rust 显示、聚焦窗口，后台像素绘制不会阻塞进入。`captureMonitor` 根据物理鼠标位置移动同一窗口，选区通过 `captureLock` 固定显示器；取消或复制后隐藏复用，销毁画布和当前截图会话，最后编辑器关闭时销毁预载窗口。预览无需 PNG 编码、Base64 或图片解码，确认复制后的 PNG 导入事件维持原有格式。

ASE 编解码测试需要先构建真实 Rust 工具：

```powershell
powershell -NoProfile -File scripts/cargo.ps1 build --locked --manifest-path src-tauri/Cargo.toml --example project-tool
```

栏目及图集回归范围（相关 Node 测试与 `node scripts/test-panels-browser.mjs` 隔离浏览器专项）：恢复默认及缺失栏目修复时保留下方折叠状态；无图集时屏蔽图集及地形预览的所有栏目入口；修正检视器和同像素图块规则迁移；统一 MinePix 对外名称；修复关于窗口资源引用和 PIX 文档图标关联。定向验证菜单、布局入口、DOM 下拉显示、规则迁移、发布文件名与图标配置，并构建前端检查资源。浏览器专项只使用临时配置；真实安装更新专项另行执行。

发布准备的定向范围：核对五处版本文件、版本标签与安装包名称一致，运行发布协议及安装配置测试和仓库检查。标签流水线负责完整回归、签名构建和发布；发布后只回读工作流与 Release，不追加核验报告提交。

更新体验的定向范围：关于页移除测试通知入口及说明；首次使用默认自动检查并下载，保留已有开关选择；验证已签名更新包与元数据跨启动恢复（含离线）、篡改拒绝、取消及重试、升级成功后的包与临时文件清理。浏览器专项检查后台自动下载、右下角一键重启更新、未保存项目取消后的重试入口；Rust 使用本地 HTTP 与签名固定样例，不执行安装器或发布版本。

安装包图标的定向范围：NSIS 的 `installerIcon` 显式使用 `src/assets/app-icon.ico`，与 PIX 文档图标分开配置。运行安装配置测试，构建本地 NSIS 验证包，直接提取 `.exe` 图标并与源图标对比；验证包不安装、不发布，无需读取签名私钥。

## 本地资源与设置

布局、主题和输入偏好保存在应用 WebView2 用户数据内；最近文件、恢复副本与更新偏好位于独立应用数据目录。安装器使用与 CLI 对应的官方 NSIS 模板，仅固定现有安装注册键以保持升级识别；升级 CLI 时同步审查模板。产品显示名称调整不应改变 `com.minepix.tauri` 标识、WebView 来源或已有存储键。排查设置时先保留原始数据，不以重置设置代替修复。

构建缓存包含 dist、src-tauri/target 和 src-tauri/gen；按需清理，下一次构建会重新生成。安装更新专项必须使用独立目录与作品，并恢复原有偏好。

## 文档维护

README 面向下载和入门，使用指南对应实际界面，开发与发布指南只保留可复用操作。核验报告、哈希、任务编号和执行流水保存在本地 artifacts，不写入指南，不为发布后核验单独创建提交。必要的功能说明、定向验证范围与功能修改一并提交；源码和文档统一 LF。

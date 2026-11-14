# 构建、签名、发布与更新

## 本地构建

版本号维护在 package.json、package-lock.json、src-tauri/tauri.conf.json、Cargo.toml 和 Cargo.lock。Windows x64 NSIS 安装器采用当前用户安装，运行依赖 WebView2。执行 npm ci、npm run build、npm run package。

签名使用环境变量 TAURI_SIGNING_PRIVATE_KEY 和 TAURI_SIGNING_PRIVATE_KEY_PASSWORD。私钥可为 Tauri 支持的文件路径或内容，不得提交或输出。固定公钥保存在 tauri.conf.json，签名必须绑定版本。

本机私钥存放于 `$env:USERPROFILE\.ssh\minepix-tauri.key`，独立公钥文件为同目录的 `minepix-tauri.key.pub`。本地签名前设置路径即可，无需复制密钥到项目目录：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY=Join-Path $env:USERPROFILE '.ssh\minepix-tauri.key'
npm run package
```

密钥位置调整不改变已发布应用的信任关系。应用配置中保留用于验证更新的固定公钥。本机文件移动不等于远程 Secret 配置，二者独立管理。

## GitHub Actions

构建使用 Windows runner、Node 24、Rust stable 和锁文件。仓库 Actions Secret `TAURI_SIGNING_PRIVATE_KEY` 保存私钥内容；只有私钥设置了密码时才需额外配置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。不将本机 `.ssh` 路径作为远程 Secret 值。

main 和 PR 执行回归及前端构建，不生成签名安装包。tauri-v<版本> 标签才构建签名安装包并触发版本发布，安装器和 .sig 归属对应版本 Release。latest.json 指向版本资产，更新频道标签为 tauri-latest。先上传并验证版本资产，最后提升频道。已发布版本资产不覆盖；频道拒绝被较低版本回退。

本地 NSIS 文件名包含空格；发布时将相同字节暂存为不含空格的 `MinePix.Tauri_<版本>_x64-setup.exe` 及 `.sig`。更新 URL 与差分块图均绑定此公开名称，避免 GitHub 自动将空格转为点号后出现 404。

日常先提交并执行 `git push origin main`，等待该提交的 Actions 通过，再为相同提交创建与应用版本一致的标签，例如 `git tag tauri-v2.0.0-alpha.1`、`git push origin tauri-v2.0.0-alpha.1`。标签工作流通过后，用户从对应 Release 下载安装包，已安装版本从 tauri-latest 读取更新。后续发布必须先同步上述五处版本号并提高版本；同版本重新构建不能替换已发布安装包，也不能使客户端识别为新版本。

## 更新安全与验收

应用读取 https://github.com/Spicyfish95/minepix/releases/download/tauri-latest/latest.json 。要求 HTTPS、固定公钥和版本绑定签名。差分失败可完整下载，任何路径都需验证完整包签名。自动检查默认关闭。

发布后检查公开下载的哈希、签名，再在独立测试安装上验证更新、重启及作品保护。正在运行的应用可通过下载完成通知返回更新面板；退出后的通知激活不在当前保证范围。

## 执行记录

- Tauri 源码通过正常 Git 推送维护 main 和版本标签，不强制改写历史。
- 经用户明确授权，已从用户 `.ssh` 配置当前仓库 Actions 签名 Secret；私钥不在工作区。本地签名安装器、固定公钥验证、版本绑定、篡改拒绝均通过。
- Windows 临时目录短路径断言已修复，main 运行 43576345651、43576875220、43577816663 均通过。
- alpha.1/alpha.2 的远程构建、回归和签名验证通过，但发布后的清单文件名不匹配导致 404，未提升更新频道。alpha.3 已统一公开资产名称，正在执行标签发布验收。
- 公开更新原生验证入口已准备：scripts/verify-public-update.ps1，参数 SourceInstaller、TargetInstaller、SourceVersion、TargetVersion。它直接使用生产 HTTPS 频道，不添加本地更新地址覆盖；本次尚未运行。

源码提交不是发布完成。必须同时确认标签工作流、公开资产与更新频道，再执行实际安装更新验收。

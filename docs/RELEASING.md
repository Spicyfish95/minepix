# 构建、签名、发布与更新

当前预览版为 **2.0.0-alpha.4**，已公开发布。对应标签工作流成功，公开安装包与生产更新频道核验通过；本机独立安装、启动及 alpha.3 → alpha.4 的软件内覆盖更新通过，实时防护开启且未新增检测。验收范围见[开发与验证](DEVELOPMENT.md)。

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

## 安装与更新验收

下载后的安装器应与发布哈希一致，并通过固定公钥、版本绑定和篡改拒绝验证。随后在独立安装上验证：安装与启动、软件内发现新版本、下载、覆盖、自动重启、作品与偏好保持、文件关联和卸载清理。

生产频道专项入口：

```powershell
powershell -NoProfile -File scripts/verify-public-update.ps1 `
  -SourceInstaller '<旧版本安装器的本地路径>' `
  -TargetInstaller '<新版本安装器的本地路径>' `
  -SourceVersion '<旧版本号>' `
  -TargetVersion '<新版本号>'
```

该脚本会真实安装、运行、更新并卸载测试应用，直接使用生产 HTTPS 频道，不修改应用更新地址。需无已有测试安装、缓存或运行中的编辑器；测试完成后恢复原有偏好并检查清理结果。原始报告位于 `artifacts/native-upgrade/`。

安全检测会使验收失败，检测历史无法读取也不算通过。较早的 alpha.3 隔离记录及本次无新增检测的复测均保存在 `artifacts/security-review/`。不以排除项或关闭防护代替验收，当前结果也不代表微软已正式认定较早检测为误报。

源码提交和构建成功不能替代完整交付验收，必须同时确认版本 Release、公开下载、更新频道和实际安装更新。

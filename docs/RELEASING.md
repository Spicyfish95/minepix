# 构建、签名、发布与更新

当前正式版为 **2.0.0**，已以 `minepix-v2.0.0` 发布并标记为 Latest。标签任务 `43589722949` 的测试、签名构建与发布均成功；公开附件的大小、SHA256、签名文件及更新清单一致性核验通过。本次验收仅核对标签工作流、正式版 Release / Latest、公开安装包与签名、生产更新清单，不运行本机安装或更新。此前 alpha.4 的独立安装与 alpha.3 → alpha.4 更新记录仍保留，不作为 2.0.0 新增实测结果。执行结果见[开发与验证](DEVELOPMENT.md)。

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

工作流仅由推送 `minepix-v*` 标签触发。普通 main 推送、PR 和手动操作均不触发工作流。标签运行依次执行前后端完整回归、前端构建、资源及仓库检查、签名安装包构建、签名验证、版本发布和更新频道提升；任一步失败都会停止后续步骤。

安装器和 .sig 归属对应版本 Release。latest.json 指向版本资产，更新频道标签为 tauri-latest；它不匹配 `minepix-v*`，不会再次触发构建。先上传并验证版本资产，最后提升频道。已发布版本资产不覆盖；频道拒绝被较低版本回退。正式版在公开资产与频道验证通过后标为 Latest，预发布版保持 Prerelease 且不占用正式版 Latest 入口。

版本标签统一使用 `minepix-v<版本号>`，例如 `minepix-v2.0.0`。已有预览版使用的 `tauri-latest` 频道地址继续保留，它与版本标签前缀分开管理。

本地 NSIS 文件名包含空格；发布时将相同字节暂存为不含空格的 `MinePix.Tauri_<版本>_x64-setup.exe` 及 `.sig`。更新 URL 与差分块图均绑定此公开名称，避免 GitHub 自动将空格转为点号后出现 404。

日常修改先在本地执行相关定向测试，再提交并执行 `git push origin main`，此时不会运行 Actions。准备发布时，同步上述五处版本号并提高版本，在 main 的待发布提交上创建与应用版本一致的新标签，再单独推送标签：

```powershell
# 将 <新版本号> 替换为已写入版本文件、且从未发布的版本号
git tag minepix-v<新版本号>
git push origin minepix-v<新版本号>
```

标签工作流通过后，用户从对应 Release 下载安装包，已安装版本从 tauri-latest 读取更新。不要移动已发布标签；同版本重新构建不能替换已发布安装包，也不能使客户端识别为新版本。main 的普通提交不会发布软件，也不会改变用户收到的更新。

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

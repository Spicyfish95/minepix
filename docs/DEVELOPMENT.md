# 开发与验证

## 环境与命令

Windows x64、Node.js 24、Rust stable MSVC、C++ Build Tools、Windows SDK、WebView2 Runtime。环境脚本优先使用系统工具链。

```powershell
npm ci
npm run desktop
powershell -NoProfile -File scripts/cargo.ps1 build --locked --manifest-path src-tauri/Cargo.toml --example project-tool
npm test
npm run test:backend
npm run build
npm run package
```

ASE Node 测试直接调用实际 Rust project-tool，npm test 的 pretest 会先构建工具；单独运行 ASE 测试时需先执行上面的构建命令。固定样例位于 tests/fixtures，运行输出位于忽略的 artifacts。原生测试使用独立作品并恢复偏好，不能与编辑会话并行。

## 实施与定向验证范围（2026-11-14）

| 需求 | 验证范围 | 状态 |
| --- | --- | --- |
| 源码、指南与缓存清理 | 引用扫描、文档链接、LF、Git diff、固定样例 | 引用、链接和 LF 检查通过 |
| 后端测试入口 | Node、Rust ASE 工具、Cargo lib | Node 447/447；Rust 49/49 通过 |
| Windows 构建 | Vite 资源、签名 NSIS、版本一致性 | 本地通过，固定公钥 / 版本绑定 / 篡改拒绝通过 |
| 远程主线和 Actions | 正常提交及远程工作流结果 | main 已推送；首轮远程回归失败，日志读取审批超时 |
| 公开签名更新 | 下载哈希、固定公钥、版本绑定、实际更新 | 待运行 |

本次跨测试入口、指南、CI 和发布链路，回归覆盖这些影响项。不重复长时间空闲观察。准备好脚本不代表已通过远程验收。

已移除的后端专属 Node 测试由实际 Rust 文件、存储、导出、更新测试覆盖；ASE 前端互通断言改为调用生产 Rust 编解码器。

本地安装器 2,081,757 bytes，SHA256 7619f1e8f12ee4ff5ee6ceeb71f06ee3471cea5f15e6987f69783ec233e88df9。远程产物需独立验证，不能沿用该哈希。

发布追加验证：版本排序、拒绝频道回退、已发布资产不覆盖以及先校验后提升频道；运行 tests/release.test.js。

公开原生更新专项：从远程 alpha.1 签名安装包安装，在生产 HTTPS 频道发现 alpha.2，正常面板下载、签名验证、覆盖、自动重启；逐字节检查作品与偏好、关联保护及卸载清理。仅运行更新相关专项，不重复空闲观察。状态：脚本语法与引用检查通过，公开安装验证未运行。

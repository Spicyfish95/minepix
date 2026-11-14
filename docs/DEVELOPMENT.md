# 开发与验证

## 本地签名密钥位置（2026-11-14）

签名私钥和独立公钥文件存放于用户目录的 `.ssh`，不存放于工作区。此次只迁移现有文件，保留密钥及应用内固定公钥；不上传 GitHub，不重新生成密钥。验证范围：移动前后内容一致、工作区副本移除、私钥权限、相关脚本语法、临时载荷签名及固定公钥验证、仓库引用与 LF 检查。无需重跑绘图或空闲观察测试。

结果：两份密钥文件移动前后校验一致，旧签名目录已移除，工作区扫描未发现 MinePix 密钥文件。私钥仅允许当前用户与 SYSTEM 访问。新路径成功签名 2 MiB 临时载荷，固定公钥验证、版本绑定和篡改拒绝通过；相关 Node/PowerShell 脚本语法、仓库引用及 LF 检查通过。未访问 GitHub，未执行安装器。

## Windows CI 路径断言修复（2026-11-14）

范围：仅修复 files 模块测试对临时目录路径的预期，不修改文件读取或更新逻辑。Windows runner 的 TEMP 可能包含 RUNNER~1，生产代码使用 canonicalize 返回 runneradmin；二者指向同一文件。断言应比较规范化后的路径，并检查描述符、最近文件和 selected 记录一致，损坏文件不被记录。定向运行 Cargo files::tests 与发布清单 Node 测试。

发布规则保持：main 推送执行构建和回归，匹配应用版本的 tauri-v<版本> 标签触发签名安装包发布；公开资产验证后才更新 tauri-latest 频道。不改为 main 每次提交都发布。远程验证结果需独立记录，不能以本地通过代替。

本次结果：Cargo files::tests 7/7，发布及安装配置 Node 测试 10/10；Vite 构建、生产资源及仓库引用/LF 检查通过。现有本地 alpha.1 安装包通过清单检查，以及固定公钥、签名版本绑定和篡改拒绝验证；未执行该安装包。远程状态读取两次因执行环境自动审批超时未启动，远程 CI、公开下载与实际更新仍待验证。

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
